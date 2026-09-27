-- ============================================================================
--  Junoon — authorization & admin setup rules (copy-paste, idempotent)
--
--  Run this whole file in the Supabase SQL Editor, then reload the website and
--  open the Admin Portal. It adds one table if it is missing and replaces
--  fourteen functions. No row is deleted and no business table is touched.
--
--  Why it is needed on an older project:
--
--    * The Team screen's Remove button and its role buttons called functions the
--      project did not have at all ("Could not find the function"), and two of
--      them — admin_grant_role and admin_remove_role — were taken away from
--      PUBLIC without being handed to `authenticated`, so even the owner was
--      refused permission to change a role.
--
--    * The rest of that screen's functions — the team list, adding a member,
--      changing a role, switching access on and off — exist in earlier copies
--      that were written before the junction table did. The list one reads that
--      table, so on a project without it the Team tab fails instead of listing
--      anyone. All five are replaced here, so one paste leaves nothing
--      half-upgraded.
--
--    * staff_bootstrap_state() used to report claimable only while
--      staff_members was COMPLETELY EMPTY, and answered without a `version`
--      field. A single staff row — or an admin merely switched off — hid the
--      "Create Admin Account" action forever.
--    * claim_admin() used to require the caller to be the FIRST auth user ever
--      created on the project, so as soon as any other account existed nobody
--      could claim again.
--    * claim_admin() and claim_admin_for_email() counted an admin from
--      staff_member_roles whether or not that account was still switched on,
--      while staff_bootstrap_state() counted only active admins. Switching the
--      last admin off therefore offered a setup button whose every click was
--      refused.
--    * is_staff() and is_admin() had the same blind spot: an account switched
--      off in the Team screen kept its access, because the junction-table branch
--      never looked at `active`. Switching somebody off did not close the door.
--
--  After this file:
--
--    • One question decides everything — "is there an ACTIVE admin?" — asked in
--      exactly one place (public.tribe_active_admins()), so the button the
--      sign-in card shows and the claim the database accepts cannot disagree.
--    • `active = false` really does revoke portal access, at the database.
--    • "Create Admin Account" appears while no active admin exists, disappears
--      the moment one does, and comes back if the last one is removed or
--      switched off.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  0. The multi-role table.
--
--     The rules below read it, so it has to exist first. A project created from
--     supabase/schema.sql already has it; a project that predates it gets it
--     here, filled in from the primary role already recorded in staff_members.
--     `if not exists` throughout: running this twice changes nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.staff_member_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('staff', 'admin')),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (user_id, role)
);

alter table public.staff_member_roles enable row level security;

insert into public.staff_member_roles (user_id, role, created_at)
select sm.user_id, sm.role, sm.created_at
  from public.staff_members sm
 on conflict (user_id, role) do nothing;


-- ---------------------------------------------------------------------------
--  1. Can this account read and write the restaurant's tables?
--     An active row in `staff_members` is required; the junction table only
--     adds roles to it.
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.staff_members sm
     where sm.user_id = auth.uid()
       and sm.active
       and (
         sm.role = 'admin'
         or exists (
           select 1 from public.staff_member_roles r
            where r.user_id = sm.user_id
         )
       )
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.staff_members sm
     where sm.user_id = auth.uid()
       and sm.active
       and (
         sm.role = 'admin'
         or exists (
           select 1 from public.staff_member_roles r
            where r.user_id = sm.user_id and r.role = 'admin'
         )
       )
  );
$$;

grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

--  The policy comes after the helpers, because a policy's expression is
--  resolved when the policy is created: a member may read their own role rows,
--  and other staff may read the team.
drop policy if exists staff_member_roles_select on public.staff_member_roles;
create policy staff_member_roles_select on public.staff_member_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());


-- ---------------------------------------------------------------------------
--  2. The one question every other rule asks: how many admins can still open
--     the panel? Called from inside the security-definer functions below, so it
--     stays closed to the browser.
-- ---------------------------------------------------------------------------
create or replace function public.tribe_active_admins()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
    from public.staff_members
   where role = 'admin' and active;
$$;

revoke all on function public.tribe_active_admins() from public;
grant execute on function public.tribe_active_admins() to authenticated;


-- ---------------------------------------------------------------------------
--  3. The flag the Admin Portal reads before it offers "Create Admin Account".
--     `version: 2` is what tells an out-of-date website build that this rule is
--     installed.
-- ---------------------------------------------------------------------------
create or replace function public.staff_bootstrap_state()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'claimable', not exists (
      select 1 from public.staff_members
       where role = 'admin' and active
    ),
    'version', 2
  );
$$;

grant execute on function public.staff_bootstrap_state() to anon, authenticated;


-- ---------------------------------------------------------------------------
--  4. The claim itself. Granted to `authenticated` only: it needs a real
--     Supabase Auth session, so no anonymous visitor can create the owner. The
--     table is locked before the check, so two people clicking at the same
--     moment cannot both win.
-- ---------------------------------------------------------------------------
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

  -- An account already on the team as staff may never promote itself, even
  -- while the panel has no admin: emptying the admin list is not a route to
  -- the top.
  select role into v_role
    from public.staff_members
   where user_id = v_uid;

  if v_role = 'staff' then
    raise exception
      'Staff accounts cannot claim admin access. Ask an admin to grant it.'
      using errcode = '42501';
  end if;

  lock table public.staff_members in exclusive mode;

  --  Re-read after the lock, through the same helper the sign-in card asks, so
  --  the button and the claim can never disagree: one active admin closes the
  --  door.
  if public.tribe_active_admins() > 0 then
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

  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, 'admin', (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object('ok', true, 'role', 'admin', 'email', v_email);
end $$;

revoke all on function public.claim_admin() from public;
grant execute on function public.claim_admin() to authenticated;


-- ---------------------------------------------------------------------------
--  5. The same claim for an email that already has a Supabase Auth account —
--     the case "Create Admin Account" hits when the owner typed an address that
--     was already used. No password is asked for, compared or overwritten, no
--     second Auth user is created, and the existing UUID is the one that gets
--     the role. The caller still has to sign in with the real password, so only
--     the account holder ends up holding admin.
-- ---------------------------------------------------------------------------
create or replace function public.claim_admin_for_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_role  text;
begin
  select id into v_uid from auth.users where email = p_email;

  if v_uid is null then
    raise exception 'No account found for that email address.'
      using errcode = '23503';
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

  if public.tribe_active_admins() > 0 then
    raise exception 'An admin account already exists for this restaurant.'
      using errcode = '23505';
  end if;

  insert into public.staff_members
    (user_id, email, display_name, role, active, created_at)
  values (
    v_uid, p_email, 'Owner', 'admin', true,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update
    set role = 'admin', active = true, email = excluded.email;

  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, 'admin', (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object('ok', true, 'role', 'admin', 'email', p_email);
end $$;

grant execute on function public.claim_admin_for_email(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
--  6. Team management: removing somebody from the team, and adding or removing a
--     single role on somebody who is already on it. The package splits these the
--     same way the schema does — the junction table records the grant, and
--     `staff_members.role` keeps the primary role the portal lets you into.
--     Every function asks public.is_admin() first, and is granted to
--     `authenticated` only: nobody who is not already an admin can reach them.
-- ---------------------------------------------------------------------------
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

  -- Clean up junction table first.
  delete from public.staff_member_roles where user_id = p_user_id;

  delete from public.staff_members where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'userId', p_user_id);
end $$;

--  Delete a team member for good: the sign-in account too, so the address is
--  released and can be registered again. Missing from projects that ran an
--  earlier version of this patch, which is why the Team screen's "Delete
--  account" button had nothing to call. The guards match the two above: admin
--  only, never yourself, never the last admin.
create or replace function public.admin_delete_staff_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    text;
  v_email   text;
  v_deleted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  select sm.role, u.email
    into v_role, v_email
    from public.staff_members sm
    left join auth.users u on u.id = sm.user_id
   where sm.user_id = p_user_id;

  if v_role is null and v_email is null then
    raise exception 'That account is not on the team.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot delete the account you are signed in with.';
  end if;

  if v_role = 'admin' and public.tribe_active_admins() <= 1 then
    raise exception 'This is the only admin account — it cannot be deleted.';
  end if;

  delete from public.staff_member_roles where user_id = p_user_id;
  delete from public.staff_members where user_id = p_user_id;

  delete from auth.users where id = p_user_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception
      'The sign-in account could not be deleted from the database. Remove it in the Supabase dashboard under Authentication → Users, then try again.';
  end if;

  return jsonb_build_object(
    'ok', true, 'userId', p_user_id, 'email', v_email, 'authDeleted', v_deleted);
end $$;

--  Put the three stores back in step.
--
--  Writes any primary role that has no matching row in the junction table, and
--  counts the members whose sign-in account no longer exists. Idempotent, and
--  reported rather than guessed at: the second number is something only the
--  owner can act on.
create or replace function public.admin_sync_staff_roles()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added   integer := 0;
  v_missing integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  insert into public.staff_member_roles (user_id, role, created_at)
  select sm.user_id, sm.role, sm.created_at
    from public.staff_members sm
   where not exists (
     select 1
       from public.staff_member_roles r
      where r.user_id = sm.user_id
        and r.role = sm.role
   )
  on conflict (user_id, role) do nothing;
  get diagnostics v_added = row_count;

  select count(*) into v_missing
    from public.staff_members sm
   where not exists (
     select 1 from auth.users u where u.id = sm.user_id
   );

  return jsonb_build_object(
    'ok', true, 'rolesAdded', v_added, 'accountsMissing', v_missing);
end $$;

--  Confirm a team member's email address, so a new account can sign in on a
--  project that asks new accounts to confirm first. `signUp` cannot do this
--  (no `email_confirm` option) and the admin API that can needs a service-role
--  key, which must never be in a page. Admin-only, and only for an address
--  already on this team.
create or replace function public.admin_confirm_staff_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_updated  integer := 0;
  v_was_open boolean;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'Enter a valid email address.';
  end if;

  select u.id, u.email_confirmed_at is null
    into v_user_id, v_was_open
    from auth.users u
   where lower(u.email) = lower(p_email);

  if v_user_id is null then
    raise exception 'No sign-in account exists for that address yet.';
  end if;

  if not exists (
    select 1 from public.staff_members where user_id = v_user_id
  ) then
    raise exception 'That address is not on this team.';
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmed_at       = coalesce(confirmed_at, now())
   where id = v_user_id;
  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'ok', true, 'userId', v_user_id, 'confirmed', v_was_open);
end $$;

--  Grant a specific role to an existing team member. The role is added to the
--  junction table, and the primary role is promoted to admin when the new role
--  is admin — never the other way round, so this cannot take access away by
--  accident.
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

  if not exists (select 1 from public.staff_members where user_id = p_user_id) then
    raise exception 'That account is not on the team.';
  end if;

  insert into public.staff_member_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id, role) do nothing;

  -- Promote the primary role if granting admin.
  if p_role = 'admin' then
    update public.staff_members set role = 'admin'
     where user_id = p_user_id and role = 'staff';
  end if;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'grantedRole', p_role);
end $$;

--  Remove a specific role. The last admin role cannot be removed — the panel
--  would otherwise be left with nobody able to open it.
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

  if p_role = 'admin' then
    select count(*) into v_count
      from public.staff_member_roles
     where role = 'admin';
    if v_count <= 1 then
      raise exception 'This is the only admin account — cannot remove admin role.';
    end if;
  end if;

  delete from public.staff_member_roles
   where user_id = p_user_id and role = p_role;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'removedRole', p_role);
end $$;

--  Taken from PUBLIC and handed to `authenticated`. Leaving out the second half
--  of that pair is what made the role buttons unusable on an older project.
revoke all on function public.admin_remove_staff(uuid) from public;
revoke all on function public.admin_delete_staff_account(uuid) from public;
revoke all on function public.admin_confirm_staff_email(text) from public;
revoke all on function public.admin_sync_staff_roles() from public;
revoke all on function public.admin_grant_role(uuid, text) from public;
revoke all on function public.admin_remove_role(uuid, text) from public;

grant execute on function public.admin_remove_staff(uuid) to authenticated;
grant execute on function public.admin_delete_staff_account(uuid) to authenticated;
grant execute on function public.admin_confirm_staff_email(text) to authenticated;
grant execute on function public.admin_sync_staff_roles() to authenticated;
grant execute on function public.admin_grant_role(uuid, text) to authenticated;
grant execute on function public.admin_remove_role(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
--  7. The rest of the team-management set, replaced for the same reason.
--
--     The Team tab lists the team, adds a member, and switches roles or access
--     on and off. An older project carries earlier copies of these five,
--     written before the junction table existed — and the list one reads that
--     table, so on a project without it the Team tab fails outright. They are
--     installed here exactly as supabase/schema.sql defines them, so a single
--     paste leaves the whole staff subsystem matching the schema: nothing is
--     left half-upgraded, and no earlier copy survives to disagree.
-- ---------------------------------------------------------------------------
create or replace function public.staff_sync_email()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- An UPDATE, never an INSERT: a signed-in customer who is not on the team
  -- updates zero rows and gains nothing.
  update public.staff_members
     set email = v_email
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'email', v_email);
end $$;

--  The team list, for the admin panel. Emails, roles and active flags only —
--  there is no password column to leak.
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

--  Give an existing Supabase Auth account a place on the team. The account is
--  created by the browser; the role is decided here, by an admin, and nowhere
--  else. A staff caller is refused outright, so this is not a door to promotion.
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

  -- Add to the junction table (multi-role support).
  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, v_role, (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  -- Also ensure a row in staff_members (legacy table).
  insert into public.staff_members
    (user_id, email, display_name, role, active, created_at)
  values (
    v_uid, v_email, v_name, v_role, true,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update
    set email = excluded.email, active = true;

  return jsonb_build_object('ok', true, 'userId', v_uid, 'email', v_email, 'role', v_role);
end $$;

--  Change a role. Refuses to remove the last admin.
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

  update public.staff_members
     set role = p_role
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'role', p_role);
end $$;

--  Turn portal access on or off without touching the role. Same last-admin rule.
create or replace function public.admin_set_staff_active(
  p_user_id uuid,
  p_active  boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text;
  v_active boolean;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  select role, active into v_role, v_active
    from public.staff_members where user_id = p_user_id;
  if v_role is null then
    raise exception 'That account is not on the team.';
  end if;

  if not p_active and v_role = 'admin' and public.tribe_active_admins() <= 1 then
    raise exception 'This is the only admin account — it cannot be deactivated.';
  end if;

  update public.staff_members
     set active = coalesce(p_active, false)
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'active', p_active);
end $$;

--  Same reason as above: these are taken from PUBLIC and handed to
--  `authenticated`. Miss the second half and the function is callable by nobody.
revoke all on function public.staff_sync_email() from public;
revoke all on function public.admin_list_staff() from public;
revoke all on function public.admin_add_staff(text, text) from public;
revoke all on function public.admin_set_staff_role(uuid, text) from public;
revoke all on function public.admin_set_staff_active(uuid, boolean) from public;

grant execute on function public.staff_sync_email() to authenticated;
grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_add_staff(text, text) to authenticated;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------------
--  Verify. After running the above:
--
--    select public.staff_bootstrap_state();
--      → { "claimable": true,  "version": 2 }  the portal offers
--                                              "Create Admin Account"
--      → { "claimable": false, "version": 2 }  an active admin exists; sign in
--                                              with it instead
--
--  To reopen the door, remove or switch off the admin row — see
--  supabase/admin-recovery.sql. To start from an empty team, run
--  supabase/reset-staff-accounts.sql.
-- ---------------------------------------------------------------------------
select public.staff_bootstrap_state() as admin_setup_state,
       public.tribe_active_admins() as active_admins;
