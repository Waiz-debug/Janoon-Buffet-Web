-- ============================================================================
--  Junoon — first admin only
--
--  A cut-down copy of supabase/staff-auth.sql, containing only the two
--  functions needed to create the first administrator. Same SQL, same
--  definitions — this file is generated from that one, so they cannot drift.
--
--  WHY A SHORTER FILE
--
--  Setting the restaurant up was blocked by Supabase's email rate limit, because
--  the browser created the account with `auth.signUp()`, which sends a
--  confirmation mail. Once the hourly quota is spent, that call is refused with
--  "Too many attempts just now" — a complaint about the quota, on an address
--  that was never the problem.
--
--  These two functions create the account in Postgres instead, already
--  confirmed, and send nothing at all:
--
--    staff_ensure_auth_user  — find the Auth identity for an address, or create
--                              it here with a bcrypt-hashed password. Revoked
--                              from PUBLIC and granted to no role, so it is only
--                              reachable from inside the function below.
--    admin_bootstrap_owner   — create the FIRST admin. It cannot ask "is the
--                              caller an admin" because there is none yet, so it
--                              asks the only question that matters: does this
--                              restaurant already have an active admin? The
--                              moment one exists, this refuses — the window is
--                              shut in the database, not merely hidden in the UI.
--
--  It also refuses an account already on the team as staff, so it is never a
--  route from staff to admin. Nothing outside `auth.users`, `auth.identities`,
--  `staff_members` and `staff_member_roles` is touched.
--
--  AFTER THIS, STILL RUN supabase/staff-auth.sql
--
--  It installs the remaining seven functions the Team screen needs: adding a
--  member, setting a role, activating and removing, deleting an account,
--  confirming an address by hand and repairing roles. It does not change the
--  owner you create here, and re-running it is safe.
-- ============================================================================

--  pgcrypto supplies bcrypt (crypt / gen_salt) and gen_random_uuid(). Supabase
--  installs it into the `extensions` schema; the exception handler covers a
--  project where it is already there under a different name.
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

  --  Not callable by anyone. It is revoked from PUBLIC and granted to no
  --  role, so the only way in is from inside the function below.
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
--  Done. The setup card on the website now creates the first admin through this
--  function: no confirmation mail, no rate limit, no waiting.
--
--  After signing in, run supabase/staff-auth.sql for the rest of the Team
--  screen. To close the setup door for good, once your admin exists:
--
--    revoke execute on function public.admin_bootstrap_owner(text, text, text) from anon;
-- ============================================================================
