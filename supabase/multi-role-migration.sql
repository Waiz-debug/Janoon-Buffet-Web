-- ============================================================================
--  Multi-role migration — supports the same user having both admin & staff
--
--  Run this once in the Supabase SQL Editor.  It is idempotent:
--  every statement is guarded so re-running is safe.
-- ============================================================================

-- 1. Junction table: one row per (user, role).
--    A user can hold multiple roles simultaneously.
create table if not exists public.staff_member_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('staff', 'admin')),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (user_id, role)
);

alter table public.staff_member_roles enable row level security;

-- Staff can read their own role rows; admins can read all.
drop policy if exists staff_member_roles_select on public.staff_member_roles;
create policy staff_member_roles_select on public.staff_member_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- No direct client writes — all mutations go through SECURITY DEFINER functions.
-- (Inserts/updates/deletes are handled by admin_add_staff, admin_set_staff_role,
--  admin_remove_staff, and claim_admin below.)

-- 2. Seed the junction table from existing staff_members data.
--    Every existing row gets a matching role entry. Idempotent.
insert into public.staff_member_roles (user_id, role, created_at)
select sm.user_id, sm.role, sm.created_at
  from public.staff_members sm
  on conflict (user_id, role) do nothing;

-- 3. Update is_staff() to check BOTH tables.
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.staff_members
     where user_id = auth.uid() and active
  ) or exists (
    select 1 from public.staff_member_roles r
     where r.user_id = auth.uid()
  );
$$;

-- 4. Update is_admin() to check BOTH tables.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.staff_members
     where user_id = auth.uid() and active and role = 'admin'
  ) or exists (
    select 1 from public.staff_member_roles r
     where r.user_id = auth.uid() and r.role = 'admin'
  );
$$;

-- 5. Update admin_list_staff() to return roles as an array.
create or replace function public.admin_list_staff()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_rows jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'userId',      sm.user_id,
               'email',       sm.email,
               'displayName', sm.display_name,
               'role',        sm.role,
               'roles',       coalesce(r.roles, jsonb_build_array(sm.role)),
               'active',      sm.active,
               'createdAt',   sm.created_at
             )
             order by case when sm.role = 'admin' then 0 else 1 end, sm.email
           ),
           '[]'::jsonb
         )
    into v_rows
    from public.staff_members sm
    left join lateral (
      select jsonb_agg(r2.role) as roles
        from public.staff_member_roles r2
       where r2.user_id = sm.user_id
    ) r on true;

  return v_rows;
end $$;

-- 6. Update admin_add_staff() to ADD a role (not replace).
--    If the user already has a different role, both are kept.
create or replace function public.admin_add_staff(
  p_email text,
  p_role  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role  text := case when p_role = 'admin' then 'admin' else 'staff' end;
  v_uid   uuid;
  v_name  text;
  v_existing_role text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required.';
  end if;

  select u.id,
         coalesce(nullif(split_part(coalesce(u.email, v_email), '@', 1), ''), 'Team')
    into v_uid, v_name
    from auth.users u
   where lower(u.email) = v_email
   limit 1;

  if v_uid is null then
    raise exception
      'No Sign-in account exists for %. Create the account first, then add the role.',
      v_email;
  end if;

  -- Check if user already has this exact role in the junction table.
  select role into v_existing_role
    from public.staff_member_roles
   where user_id = v_uid and role = v_role;

  if v_existing_role is not null then
    -- User already has this role. Just ensure they're active in staff_members.
    insert into public.staff_members
      (user_id, email, display_name, role, active, created_at)
    values (
      v_uid, v_email, v_name, v_role, true,
      (extract(epoch from now()) * 1000)::bigint
    )
    on conflict (user_id) do update
      set email = excluded.email, active = true;

    return jsonb_build_object('ok', true, 'userId', v_uid, 'email', v_email, 'role', v_role, 'added', false);
  end if;

  -- User does not have this role yet. Add it to the junction table.
  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, v_role, (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  -- Also ensure a row exists in staff_members (the legacy table).
  -- If the user already has a staff_members row with a different role, we keep it.
  -- The staff_members.role column represents the "primary" role.
  insert into public.staff_members
    (user_id, email, display_name, role, active, created_at)
  values (
    v_uid, v_email, v_name, v_role, true,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update
    set email = excluded.email, active = true;
    -- NOTE: we intentionally do NOT overwrite role here if the user already
    -- has a staff_members row — that preserves their existing primary role.

  return jsonb_build_object('ok', true, 'userId', v_uid, 'email', v_email, 'role', v_role, 'added', true);
end $$;

-- 7. Update admin_set_staff_role() to work with the junction table.
--    This replaces a user's PRIMARY role in staff_members and ensures
--    the role exists in the junction table.
create or replace function public.admin_set_staff_role(
  p_user_id uuid,
  p_role    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  if p_role not in ('staff', 'admin') then
    raise exception 'A role must be either staff or admin.';
  end if;

  select role into v_current from public.staff_members where user_id = p_user_id;
  if v_current is null then
    raise exception 'That account is not on the team.';
  end if;

  if v_current = 'admin'
     and p_role = 'staff'
     and public.tribe_active_admins() <= 1 then
    raise exception 'This is the only admin account — make someone else an admin first.';
  end if;

  -- Update the primary role in staff_members.
  update public.staff_members
     set role = p_role
   where user_id = p_user_id;

  -- Ensure the role is in the junction table.
  insert into public.staff_member_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'role', p_role);
end $$;

-- 8. New function: remove a specific role from the junction table.
--    Cannot remove the last admin role. Cannot remove the primary role
--    from staff_members (use admin_set_staff_role or admin_remove_staff for that).
create or replace function public.admin_remove_role(
  p_user_id uuid,
  p_role    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  if p_role not in ('staff', 'admin') then
    raise exception 'A role must be either staff or admin.';
  end if;

  -- If removing admin, check we don't lock out.
  if p_role = 'admin' then
    select count(*) into v_count
      from public.staff_member_roles
     where role = 'admin';

    if v_count <= 1 then
      raise exception 'This is the only admin account — cannot remove admin role.';
    end if;
  end if;

  -- Remove from junction table.
  delete from public.staff_member_roles
   where user_id = p_user_id and role = p_role;

  -- If no roles remain, the user has no portal access at all.
  -- (staff_members row is left for admin_remove_staff to handle.)

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'removedRole', p_role);
end $$;

-- 9. New function: add a specific role to the junction table.
create or replace function public.admin_grant_role(
  p_user_id uuid,
  p_role    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  if p_role not in ('staff', 'admin') then
    raise exception 'A role must be either staff or admin.';
  end if;

  -- Ensure a staff_members row exists.
  if not exists (select 1 from public.staff_members where user_id = p_user_id) then
    raise exception 'That account is not on the team.';
  end if;

  -- Add to junction table.
  insert into public.staff_member_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id, role) do nothing;

  -- Also update the primary role in staff_members if the new role is higher.
  if p_role = 'admin' then
    update public.staff_members set role = 'admin'
     where user_id = p_user_id and role = 'staff';
  end if;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'grantedRole', p_role);
end $$;

-- 10. New function: get all roles for a user (used by frontend).
create or replace function public.staff_get_roles(
  p_user_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(r.role order by case when r.role = 'admin' then 0 else 1 end),
    '[]'::jsonb
  )
  from public.staff_member_roles r
  where r.user_id = p_user_id
    and exists (
      select 1 from public.staff_members sm
       where sm.user_id = p_user_id and sm.active
    );
$$;

-- 11. Update admin_remove_staff() to also clean up the junction table.
create or replace function public.admin_remove_staff(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  select role into v_role from public.staff_members where user_id = p_user_id;
  if v_role is null then
    raise exception 'That account is not on the team.';
  end if;

  if v_role = 'admin' and public.tribe_active_admins() <= 1 then
    raise exception 'This is the only admin account — it cannot be removed.';
  end if;

  -- Remove from junction table first.
  delete from public.staff_member_roles where user_id = p_user_id;

  -- Then remove from staff_members.
  delete from public.staff_members where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'userId', p_user_id);
end $$;

-- 12. Update claim_admin() to also add admin role to junction table.
create or replace function public.claim_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_role  text;
begin
  if v_uid is null then
    raise exception 'Sign in before claiming admin access.'
      using errcode = '42501';
  end if;

  select role into v_role
    from public.staff_members
   where user_id = v_uid;

  if v_role = 'staff' then
    raise exception
      'Staff accounts cannot claim admin access. Ask an admin to grant it.'
      using errcode = '42501';
  end if;

  lock table public.staff_members in exclusive mode;

  if exists (
    select 1 from public.staff_members
     where role = 'admin' and active
  ) or exists (
    select 1 from public.staff_member_roles
     where role = 'admin'
  ) then
    raise exception 'An admin account already exists for this restaurant.'
      using errcode = '23505';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.staff_members
    (user_id, email, display_name, role, active, created_at)
  values (
    v_uid, v_email, 'Owner', 'admin', true,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update
    set role = 'admin', active = true, email = excluded.email;

  -- Also add to junction table.
  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, 'admin', (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object('ok', true, 'role', 'admin', 'email', v_email);
end $$;

-- 13. Revoke direct access to new functions from public.
revoke all on function public.admin_remove_role(uuid, text) from public;
revoke all on function public.admin_grant_role(uuid, text) from public;
revoke all on function public.staff_get_roles(uuid) from public;

grant execute on function public.admin_remove_role(uuid, text) to authenticated;
grant execute on function public.admin_grant_role(uuid, text) to authenticated;
grant execute on function public.staff_get_roles(uuid) to authenticated;
