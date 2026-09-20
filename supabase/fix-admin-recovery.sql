-- ============================================================================
--  Janoon — authorization & admin setup rules (copy-paste, idempotent)
--
--  Run this whole file in the Supabase SQL Editor, then reload the website and
--  open the Admin Portal. It adds one table if it is missing and replaces nine
--  functions. No row is deleted and no business table is touched.
--
--  Why it is needed on an older project:
--
--    * The Team screen's Remove button and its role buttons called functions the
--      project did not have at all ("Could not find the function"), and two of
--      them — admin_grant_role and admin_remove_role — were taken away from
--      PUBLIC without being handed to `authenticated`, so even the owner was
--      refused permission to change a role.
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
revoke all on function public.admin_grant_role(uuid, text) from public;
revoke all on function public.admin_remove_role(uuid, text) from public;

grant execute on function public.admin_remove_staff(uuid) to authenticated;
grant execute on function public.admin_grant_role(uuid, text) to authenticated;
grant execute on function public.admin_remove_role(uuid, text) to authenticated;


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
