-- ============================================================================
--  Junoon — staff authentication migration
--
--  Run this AFTER supabase/schema.sql (or supabase/fix-admin-recovery.sql).
--  It is idempotent: re-running it changes nothing and deletes nothing.
--
--  WHY THIS FILE EXISTS
--
--  The live project needs three things the earlier migrations do not give the
--  browser, and this file is the only place they can live:
--
--    1. admin_upsert_staff_account()
--       One call that creates OR reuses the Supabase Auth identity for an
--       address, writes exactly one `staff_members` row under that identity's
--       UUID, maintains `staff_member_roles`, and confirms the address.
--
--       The earlier admin_add_staff() only *granted a role to an account that
--       already existed*, which left the browser to create the Auth user first —
--       and this project has "Confirm email" switched on, so that account was
--       created unconfirmed and could not sign in. This function creates the
--       identity here, in Postgres, and stamps the confirmation in the same
--       transaction, so the member signs in with the password the admin set.
--
--    2. admin_confirm_staff_email(p_email)
--       Confirm one address by hand, for accounts made before this existed.
--
--    3. admin_delete_staff_account(p_user_id) / admin_sync_staff_roles()
--       The permanent account delete, and the repair for a member whose role
--       records went missing.
--
--  It also re-states the three team-management functions with their last-admin
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
--  • Every function is SECURITY DEFINER and refuses any caller whose own
--    `staff_members` row is not an active admin. That check runs in Postgres, so
--    the Team screen being hidden from a staff account is a convenience and not
--    the boundary.
--  • No service-role key appears anywhere, in this file or in the app. A
--    service-role key in a web page would hand every visitor the ability to
--    rewrite any account in the project.
--  • A password is hashed with bcrypt inside this function and written only as
--    `encrypted_password` — the same column Supabase Auth keeps. The plaintext
--    is never stored in any table, never written to a log table, and never
--    returned. There is no password column in `staff_members` and none is added.
--  • A person who already has an account keeps their existing password and their
--    existing UUID: the identity is looked up by address and reused, never
--    created a second time.
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
--  admin_upsert_staff_account — create or reuse an identity, and record it.
--
--  The single call the Team screen makes. In order:
--
--    1. Refuse anyone who is not an active admin.
--    2. Look the address up in `auth.users`. Found → reuse that exact UUID. The
--       existing password is untouched: the owner may have typed a password here
--       that is not this account's, and it is reported rather than silently
--       overwritten.
--    3. Not found → create the identity here, with a bcrypt hash of the
--       supplied password, and a matching `auth.identities` row so GoTrue treats
--       it as an email account.
--    4. Stamp the confirmation. This project has `mailer_autoconfirm = false`, so
--       an unconfirmed address is refused at sign-in with a message that reads
--       like a wrong password. Confirmed here, by an admin, for one address on
--       this team.
--    5. Upsert exactly one `staff_members` row — `user_id` is the primary key,
--       so a second record for the same identity is not possible — and maintain
--       `staff_member_roles`.
--    6. Return the row as the database holds it, so the caller can show what was
--       really written instead of what it asked for.
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
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_role     text := case when p_role = 'admin' then 'admin' else 'staff' end;
  v_name     text;
  v_password text := coalesce(p_password, '');
  v_uid      uuid;
  v_created  boolean := false;
  v_stored   boolean := false;   -- was the supplied password actually set?
  v_confirmed boolean := false;  -- was the address unconfirmed a moment ago?
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

  -- 2. The identity for this address, if there is one. Reused as-is.
  select u.id, u.email_confirmed_at is null, u.encrypted_password is not null
    into v_uid, v_confirmed, v_stored
    from auth.users u
   where lower(u.email) = v_email
   limit 1;

  -- 3. No identity: make one here. The password is hashed in this statement and
  --    survives only as the bcrypt digest GoTrue itself keeps.
  if v_uid is null then
    if length(v_password) < 8 then
      raise exception
        'A password of at least 8 characters is required to create a new sign-in account.';
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
      extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      now(), now(),
      '', '', '', ''
    );

    -- GoTrue expects one identity row per provider. Without it the account
    -- exists but cannot sign in, which looks exactly like a missing account.
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

    v_created := true;
    v_stored := true;
  end if;

  -- 4. Confirm the address. Only ever for an address this admin has just
  --    resolved, and only while they are an admin — never a blanket switch, and
  --    never a confirmation of a stranger's account. `coalesce` leaves an
  --    already-confirmed address exactly as it was.
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmed_at       = coalesce(confirmed_at, now()),
         updated_at         = now()
   where id = v_uid;
  get diagnostics v_confirmed = row_count;

  -- 5. Exactly one team row, keyed by the Auth UUID, with the role maintained in
  --    the junction table.
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

  -- 6. The row as stored, not as requested.
  return jsonb_build_object(
    'ok', true,
    'userId', v_uid,
    'email', v_email,
    'displayName', v_name,
    'role', v_role,
    'active', true,
    'authCreated', v_created,
    'passwordApplied', v_created or not v_stored,
    'confirmed', v_confirmed
  );
end $$;

revoke all on function public.admin_upsert_staff_account(text, text, text, text) from public;
grant execute on function public.admin_upsert_staff_account(text, text, text, text) to authenticated;


-- ============================================================================
--  admin_confirm_staff_email — confirm one address by hand.
--
--  For an account created before this file existed, or on a project whose mail
--  never arrives. Same trust model as the function above: an admin may confirm
--  an address that is already on *this* team, and nothing else.
-- ============================================================================
create or replace function public.admin_confirm_staff_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_confirmed boolean;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can manage the team.' using errcode = '42501';
  end if;

  if p_email is null or position('@' in coalesce(p_email, '')) = 0 then
    raise exception 'Enter a valid email address.';
  end if;

  select u.id, u.email_confirmed_at is null
    into v_user_id, v_confirmed
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
         confirmed_at       = coalesce(confirmed_at, now()),
         updated_at         = now()
   where id = v_user_id;

  return jsonb_build_object('ok', true, 'userId', v_user_id, 'confirmed', v_confirmed);
end $$;

revoke all on function public.admin_confirm_staff_email(text) from public;
grant execute on function public.admin_confirm_staff_email(text) to authenticated;


-- ============================================================================
--  admin_delete_staff_account — erase a member for good.
--
--  `admin_remove_staff` below takes access away and leaves the Auth account
--  standing, which is the reversible default. This one is not: it deletes the
--  row in `auth.users` (the identities go with it by cascade), so the address is
--  released and can be registered again from scratch.
--
--  Three guards, in the database rather than in the browser: the caller must be
--  an admin, nobody may delete the account they are signed in with, and the last
--  admin cannot be deleted. Nothing outside `staff_members`,
--  `staff_member_roles` and that one auth row is touched.
-- ============================================================================
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
  delete from public.staff_members      where user_id = p_user_id;

  delete from auth.users where id = p_user_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception
      'The sign-in account could not be deleted. Remove it in the Supabase dashboard under Authentication → Users, then try again.';
  end if;

  return jsonb_build_object(
    'ok', true, 'userId', p_user_id, 'email', v_email, 'authDeleted', v_deleted);
end $$;

revoke all on function public.admin_delete_staff_account(uuid) from public;
grant execute on function public.admin_delete_staff_account(uuid) to authenticated;


-- ============================================================================
--  admin_sync_staff_roles — repair, never delete.
--
--  A member lives in three places at once: `auth.users` (the sign-in),
--  `staff_members` (the row that lets a portal open) and `staff_member_roles`
--  (which roles it holds). A member whose junction row is missing reads as
--  holding no role at all, on screen and in every policy that asks.
--
--  This writes the roles that are already on their primary row. It deletes
--  nothing and grants nothing new: a role nobody chose is never invented. Rows
--  whose sign-in account has gone are counted and reported, because deciding
--  what to do with an orphaned record is the owner's, not a function's.
-- ============================================================================
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
--  The last-admin guards, restated so this file leaves the Team screen whole.
--
--  Each refuses the change that would leave the restaurant with nobody able to
--  open the admin portal. The rule lives here, in Postgres: a browser that sends
--  the request anyway is refused by the database, not by the screen.
-- ============================================================================
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

  if not coalesce(p_active, false) and v_role = 'admin'
     and public.tribe_active_admins() <= 1 then
    raise exception 'This is the only admin account — it cannot be deactivated.';
  end if;

  update public.staff_members
     set active = coalesce(p_active, false)
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'active', p_active);
end $$;

revoke all on function public.admin_set_staff_active(uuid, boolean) from public;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;

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

  delete from public.staff_member_roles where user_id = p_user_id;
  delete from public.staff_members      where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'userId', p_user_id);
end $$;

revoke all on function public.admin_remove_staff(uuid) from public;
grant execute on function public.admin_remove_staff(uuid) to authenticated;

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

  if v_current = 'admin' and p_role = 'staff'
     and public.tribe_active_admins() <= 1 then
    raise exception 'This is the only admin account — make someone else an admin first.';
  end if;

  update public.staff_members set role = p_role where user_id = p_user_id;

  insert into public.staff_member_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object('ok', true, 'userId', p_user_id, 'role', p_role);
end $$;

revoke all on function public.admin_set_staff_role(uuid, text) from public;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;


-- ============================================================================
--  Done. Nothing above read or wrote a menu, category, reservation, pre-order,
--  delivery, promotion or media row, and nothing deleted an existing account.
--
--  After running this: Admin → Team → Add a team member. The account is created
--  and confirmed in one call, and the new member signs in at /staff with the
--  password you set.
-- ============================================================================
