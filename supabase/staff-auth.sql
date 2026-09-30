-- ============================================================================
--  Junoon — staff authentication migration
--
--  Run this AFTER supabase/schema.sql (or supabase/fix-admin-recovery.sql).
--  It is idempotent: re-running it changes nothing and deletes nothing.
--
--  WHY THIS FILE EXISTS
--
--  Setting the restaurant up must not depend on an email being deliverable.
--  The browser used to create the first admin with `auth.signUp()`, which makes
--  Supabase send a confirmation mail — and that call is refused with
--  "Too many attempts just now" once the project's hourly mail quota is spent.
--  The address is fine; the mail quota is the problem, and it recovers on its
--  own schedule rather than on ours. So the whole email step is gone from the
--  setup path:
--
--    1. staff_ensure_auth_user(email, password, display_name)
--       Find the Supabase Auth identity for an address, or create it here, in
--       Postgres, already confirmed and with a bcrypt-hashed password. Also
--       writes the matching `auth.identities` row, without which GoTrue refuses
--       the account at sign-in. Revoked from PUBLIC and granted to no role, so
--       it is only ever reached from inside the two functions below — which
--       check their own guards first.
--
--    2. admin_bootstrap_owner(email, password, display_name)
--       Create the FIRST administrator. It cannot ask "is the caller an admin"
--       because there is none yet, so it asks the one question that matters:
--       does this restaurant already have an active admin? While the answer is
--       no, setup is offered and this function performs it. The moment an admin
--       exists, both the card and this function refuse — the window is shut in
--       the database, not merely hidden in the UI.
--
--    3. admin_upsert_staff_account(email, password, display_name, role)
--       The single call the Team screen makes for everybody after the owner:
--       reuse or create the identity, confirm the address, write exactly one
--       `staff_members` row under that identity's UUID, and maintain
--       `staff_member_roles`. The older admin_add_staff() only granted a role to
--       an account that already existed, which left the browser to create the
--       Auth user first — and with "Confirm email" on, that account could not
--       sign in.
--
--  Plus the recovery and team-management functions the Team screen needs:
--  admin_confirm_staff_email, admin_delete_staff_account,
--  admin_sync_staff_roles, admin_set_staff_active, admin_remove_staff and
--  admin_set_staff_role — the last four re-stated here with their last-admin
--  guards, so this file alone leaves the Team screen complete.
--
--  WHAT THIS FILE DOES NOT TOUCH
--
--  Nothing outside `auth.users`, `auth.identities`, `public.staff_members` and
--  `public.staff_member_roles`. No menu, categories, reservations, pre-orders,
--  deliveries, promotions, photos or demo content is read or written here, and
--  no row in any of those tables is deleted. Existing staff and admin accounts
--  are never removed — `create or replace` only changes function definitions.
--
--  SECURITY
--
--  • Every function is SECURITY DEFINER. All of them but admin_bootstrap_owner
--    refuse any caller whose own `staff_members` row is not an active admin.
--    That check runs in Postgres, so hiding the Team screen from a staff
--    account is a convenience and not the boundary.
--  • admin_bootstrap_owner is open to `anon` because the person setting the
--    restaurant up has no session yet. It grants nothing and creates no second
--    admin once one exists, and it refuses an account that is already on the
--    team as staff, so it is never a route from staff to admin. Once your own
--    admin exists you can close it for good:
--        revoke execute on function public.admin_bootstrap_owner(text, text, text) from anon;
--  • No service-role key appears anywhere, in this file or in the app. One in a
--    web page would hand every visitor the ability to rewrite any account.
--  • A password is hashed with bcrypt inside this function and written only as
--    `encrypted_password` — the same column Supabase Auth keeps. The plaintext
--    is never stored in any table, never logged, and never returned. There is
--    no password column in `staff_members` and none is added.
--  • A person who already has an account keeps their existing password and
--    UUID: the identity is looked up by address and reused, never created a
--    second time.
--
--  TESTING NOTE
--
--  The two functions that write to `auth.users` do so by hand, which is the
--  part of this file worth trying on a throwaway address first:
--      select public.admin_bootstrap_owner('you@example.com', 'a-strong-password', null);
--  If your Supabase version has changed those tables' columns, that call is
--  where it shows — and the dashboard's Authentication → Users screen is the
--  fallback that always works.
-- ============================================================================

--  pgcrypto supplies bcrypt (crypt / gen_salt) and gen_random_uuid(). Supabase
--  installs it into the `extensions` schema; `if not exists` keeps this safe to
--  re-run, and the exception handler covers a project where it is already there
--  under a different name.
do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then
  null; -- already installed elsewhere; the qualified calls below still resolve
end $$;

-- ============================================================================
--
--  Deliberately not callable by anyone. It is revoked from PUBLIC and granted to
--  no role, so it can only ever be reached from inside the two functions below
--  — which check their own guards first. That is what keeps "create an account"
--  from being a capability a browser can use on its own.
--
--  Returns the UUID, whether it was created, and whether the address had to be
--  confirmed. An address that already has an identity is returned untouched:
--  the same UUID, the same password, no second account for one address.
-- ============================================================================
create or replace function public.staff_ensure_auth_user(
  p_email        text,
  p_password     text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_password text := coalesce(p_password, '');
  v_name     text := nullif(trim(coalesce(p_display_name, '')), '');
  v_uid      uuid;
  v_created  boolean := false;
  v_stored   boolean := false;   -- did that account already have a password?
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required.';
  end if;

  if v_name is null then
    v_name := coalesce(nullif(split_part(v_email, '@', 1), ''), 'Team');
  end if;

  -- Reuse. This lookup is what makes a second account for one address
  -- impossible: the create below only runs when it finds nothing.
  select u.id, u.encrypted_password is not null
    into v_uid, v_stored
    from auth.users u
   where lower(u.email) = v_email
   limit 1;

  if v_uid is not null then
    return jsonb_build_object(
      'userId', v_uid, 'email', v_email, 'displayName', v_name,
      'created', false, 'hadPassword', v_stored, 'confirmed', false);
  end if;

  -- Create. A password of less than eight characters is refused here rather
  -- than producing an account nobody can sign in to.
  if length(v_password) < 8 then
    raise exception
      'A password of at least 8 characters is required to create a sign-in account.';
  end if;

  v_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values (
    coalesce(
      (select u2.instance_id from auth.users u2 limit 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    v_uid,
    'authenticated',
    'authenticated',
    v_email,
    -- Hashed in this statement. The plaintext exists only as the argument of
    -- this call and survives nowhere else.
    extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    now(), now(),
    '', '', '', ''
  );

  -- GoTrue expects one identity row per provider. Without it the account exists
  -- but cannot sign in, which looks exactly like a missing account.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    v_uid, v_uid, v_uid,
    jsonb_build_object(
      'sub', v_uid,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(), now(), now()
  );

  return jsonb_build_object(
    'userId', v_uid, 'email', v_email, 'displayName', v_name,
    'created', true, 'hadPassword', true, 'confirmed', true);
end $$;

--  Not callable by anyone. It is revoked from PUBLIC and granted to
--  no role, so the only way in is from inside the functions above.
revoke all on function public.staff_ensure_auth_user(text, text, text) from public;

-- ============================================================================
--
--  The door before anybody holds the role, so it cannot ask "is the caller an
--  admin" — there is none yet. What it asks instead is the only question that
--  matters here:
--
--      does this restaurant already have an active administrator?
--
--  While the answer is no, the setup card offers the action and this function
--  performs it. The moment an admin exists the answer is yes, and both the card
--  and this function refuse — so the window is not merely hidden, it is shut in
--  the database. It reopens only if that admin is later removed or deactivated
--  through the legitimate team workflow.
--
--  No email is sent and none is needed: the identity is created confirmed, so
--  the person signs in immediately with the password they just chose. That is
--  the whole point of this function — setup must not be blocked by a mail quota.
--
--  Two further guards, both in the database:
--    • An account that is already on the team as staff is refused. This is never
--      a route from staff to admin, however empty the admin list is.
--    • An address that already has an account keeps its UUID and its own
--      password; nothing is overwritten and no second account is created.
-- ============================================================================
create or replace function public.admin_bootstrap_owner(
  p_email        text,
  p_password     text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_name   text;
  v_uid    uuid;
  v_auth   jsonb;
  v_role   text;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required.';
  end if;

  v_name := nullif(trim(coalesce(p_display_name, '')), '');
  if v_name is null then
    v_name := coalesce(nullif(split_part(v_email, '@', 1), ''), 'Owner');
  end if;

  -- The one-time rule, asked of the database rather than of the browser.
  lock table public.staff_members in exclusive mode;
  if public.tribe_active_admins() > 0 then
    raise exception 'An admin account already exists for this restaurant.'
      using errcode = '23505';
  end if;

  -- No route from staff to admin, even while the admin list is empty.
  select role into v_role from public.staff_members where user_id = (
    select u.id from auth.users u where lower(u.email) = v_email limit 1
  );
  if v_role = 'staff' then
    raise exception
      'Staff accounts cannot claim admin access. Ask an admin to grant it.'
      using errcode = '42501';
  end if;

  -- Create the sign-in identity, or reuse the one this address already has.
  v_auth := public.staff_ensure_auth_user(v_email, p_password, v_name);
  v_uid := (v_auth ->> 'userId')::uuid;

  -- Confirm the address, for this one account, by hand. `coalesce` leaves an
  -- already-confirmed address exactly as it was. There is no project-wide
  -- switch here: turning confirmation off for everyone would also confirm
  -- strangers, and that is not this function's decision to make.
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmed_at       = coalesce(confirmed_at, now()),
         updated_at         = now()
   where id = v_uid;

  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, 'admin', (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  insert into public.staff_members
    (user_id, email, display_name, role, active, created_at)
  values (
    v_uid, v_email, v_name, 'admin', true,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update
    set email        = excluded.email,
        display_name = excluded.display_name,
        role         = 'admin',
        active       = true;

  return jsonb_build_object(
    'ok', true,
    'userId', v_uid,
    'email', v_email,
    'displayName', v_name,
    'role', 'admin',
    'active', true,
    'authCreated', (v_auth ->> 'created')::boolean,
    'confirmed', true,
    'passwordApplied', (v_auth ->> 'created')::boolean
                   or not (v_auth ->> 'hadPassword')::boolean
  );
end $$;

revoke all on function public.admin_bootstrap_owner(text, text, text) from public;
grant execute on function public.admin_bootstrap_owner(text, text, text) to anon, authenticated;

-- ============================================================================
--
--  The single call the Team screen makes for everybody after the owner. In
--  order: refuse a caller who is not an active admin; reuse the exact UUID for
--  an address that has an account; create the identity here when it does not;
--  confirm the address, so the member is not left in the state this project
--  refuses at sign-in; upsert exactly one `staff_members` row under that UUID
--  and maintain `staff_member_roles`; and return the row as stored rather than
--  as requested.
-- ============================================================================
create or replace function public.admin_upsert_staff_account(
  p_email        text,
  p_password     text,
  p_display_name text default null,
  p_role         text default 'staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role  text := case when p_role = 'admin' then 'admin' else 'staff' end;
  v_name  text;
  v_auth  jsonb;
  v_uid   uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required.';
  end if;

  v_name := nullif(trim(coalesce(p_display_name, '')), '');
  if v_name is null then
    v_name := coalesce(nullif(split_part(v_email, '@', 1), ''), 'Team');
  end if;

  v_auth := public.staff_ensure_auth_user(v_email, p_password, v_name);
  v_uid := (v_auth ->> 'userId')::uuid;

  -- Confirm, for this one address, by an admin. Never a project-wide switch.
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmed_at       = coalesce(confirmed_at, now()),
         updated_at         = now()
   where id = v_uid;

  -- Exactly one team row, keyed by the Auth UUID, with the role maintained in
  -- the junction table.
  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, v_role, (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  insert into public.staff_members
    (user_id, email, display_name, role, active, created_at)
  values (
    v_uid, v_email, v_name, v_role, true,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update
    set email        = excluded.email,
        display_name = excluded.display_name,
        active       = true,
        -- Promotion only. Demotion is admin_set_staff_role's job, and it
        -- carries the last-admin guard; doing it here would route around it.
        role = case
                 when public.staff_members.role = 'admin' then 'admin'
                 else excluded.role
               end;

  return jsonb_build_object(
    'ok', true,
    'userId', v_uid,
    'email', v_email,
    'displayName', v_name,
    'role', v_role,
    'active', true,
    'authCreated', (v_auth ->> 'created')::boolean,
    'passwordApplied', (v_auth ->> 'created')::boolean
                   or not (v_auth ->> 'hadPassword')::boolean,
    'confirmed', true
  );
end $$;

revoke all on function public.admin_upsert_staff_account(text, text, text, text) from public;
grant execute on function public.admin_upsert_staff_account(text, text, text, text) to authenticated;

-- ============================================================================
--  Mark a team member's address as confirmed.
--
--  A project with "Confirm email" switched on will not let a new staff account
--  sign in until the address is confirmed, which is what turns "add a member"
--  into "the new account cannot log in". `signUp` has no `email_confirm` option
--  and the admin API that does needs a service-role key — which must never be
--  in a page — so the confirmation is done here instead, by the role that owns
--  the database.
--
--  The trust model is the same as `admin_add_staff`: only an admin can call it,
--  and only for an address already on *this* team, so it can never be used to
--  confirm a stranger's account. Both timestamps are written with `coalesce`,
--  so an already-confirmed address is left exactly as it was and re-running the
--  file changes nothing.
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

revoke all on function public.admin_confirm_staff_email(text) from public;
grant execute on function public.admin_confirm_staff_email(text) to authenticated;

-- ============================================================================
--  Erase a team member for good — the sign-in account as well as the team rows.
--
--  `admin_remove_staff` above takes away access and leaves the Auth account
--  standing, which is the right default: it is reversible. This one is not. It
--  deletes the row in `auth.users` — the identities go with it by cascade — so
--  the email address is released and can be registered again from scratch. It
--  is the action behind "delete this person properly" when someone leaves for
--  good and their address should be reusable.
--
--  Three guards, and they are the reason this is safe to offer from a panel:
--  the caller must be an admin, nobody may delete the account they are signed
--  in with, and the last admin cannot be deleted. Nothing outside
--  `staff_members`, `staff_member_roles` and the one auth row is touched.
--
--  Deleting from `auth.users` needs rights this function has only because it is
--  `security definer` and owned by the role that runs the SQL editor. A
--  publishable key can never do this — which is exactly why it is a function in
--  Postgres rather than a call from the browser.
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

  -- A mis-click must not lock the panel out with no way back in.
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete the account you are signed in with.';
  end if;

  if v_role = 'admin' and public.tribe_active_admins() <= 1 then
    raise exception 'This is the only admin account — it cannot be deleted.';
  end if;

  -- The team rows first, so a project whose foreign keys are missing still
  -- ends up clean. Both tables also cascade from auth.users; doing it here
  -- first means the cascade has nothing left to do.
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

revoke all on function public.admin_delete_staff_account(uuid) from public;
grant execute on function public.admin_delete_staff_account(uuid) to authenticated;

-- ============================================================================
--  Put the three stores back in step.
--
--  A staff account lives in three places at once: `auth.users` (the sign-in),
--  `staff_members` (the row that lets a portal open) and `staff_member_roles`
--  (which roles it holds). They are written by different calls, and a project
--  that has been through a few versions of this schema can end up with a member
--  whose primary row exists but whose junction entry does not — which reads as
--  somebody who is on the team and holds no role at all.
--
--  This repairs that, idempotently: every primary role with no matching
--  junction row is written. It also counts rows whose sign-in account has gone,
--  because those members can never get in and no amount of syncing will change
--  it — they are reported, not deleted: what to do with an orphaned record is
--  the owner's decision, not a function's.
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

revoke all on function public.admin_sync_staff_roles() from public;
grant execute on function public.admin_sync_staff_roles() to authenticated;

-- ============================================================================
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

revoke all on function public.admin_set_staff_active(uuid, boolean) from public;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;

-- ============================================================================
--  Remove someone from the team. Their Supabase Auth account is left alone —
--  deleting that is an owner decision made in the dashboard, not something this
--  panel can do with a publishable key.
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

revoke all on function public.admin_remove_staff(uuid) from public;
grant execute on function public.admin_remove_staff(uuid) to authenticated;

-- ============================================================================
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

revoke all on function public.admin_set_staff_role(uuid, text) from public;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;

-- ============================================================================
--  Done. Nothing above read or wrote a menu, category, reservation, pre-order,
--  delivery, promotion or media row, and nothing deleted an existing account.
--
--  After running this, open the app signed out and use the "Set up the admin
--  account" card: the account is created, confirmed and signed in to in one
--  step, with no confirmation mail involved. After that, Admin → Team → Add a
--  team member, where each new member signs in at /staff with the password you
--  set.
-- ============================================================================
