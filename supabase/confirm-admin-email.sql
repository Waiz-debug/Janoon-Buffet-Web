-- ============================================================================
--  JUNOON — why is the administrator locked out, and how to let them in
--
--  Run this from the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--  Nothing here is granted to `anon` or `authenticated`, so the website cannot
--  call either function: they exist for whoever holds the database password.
--
--  THE CAUSE THIS FILE IS HERE FOR
--  ------------------------------
--  This project has "Confirm email" switched on (auth setting
--  `mailer_autoconfirm = false`). An account created from the admin door is
--  therefore created *unconfirmed*, and Supabase Auth refuses it with
--  `email_not_confirmed` until somebody opens the confirmation link.
--
--  The website now says exactly that, and offers to send the link again. This
--  file is the fallback for when the mail never arrives: it reports what the
--  database actually holds, and can mark a staff address confirmed.
--
--  WHY THE MAIL OFTEN CANNOT BE SENT AT ALL  (check this before anything else)
--  -------------------------------------------------------------------------
--  Supabase's shared testing mail server will only deliver to the email
--  addresses that belong to the project's own organisation team. Every other
--  address is refused with "Email address not authorized", and the allowance is
--  2 messages per hour. A restaurant domain such as owner@janoon.pk is almost
--  never on that team list, so the confirmation mail is refused before a single
--  message leaves Supabase.
--
--  THE PROPER FIX — a dashboard setting, not a code change:
--
--    1. Dashboard → Authentication → Emails → SMTP Settings
--       Enable Custom SMTP and enter the host, port, user, password and From
--       address from a real sending service (Resend, SendGrid, AWS SES,
--       Postmark, Brevo). This is what makes confirmation mail deliver to any
--       address. It is the only setting that actually fixes delivery.
--
--    2. Dashboard → Authentication → Rate Limits
--       Raise "Rate limit for sending emails". A project that has just added
--       custom SMTP is held at 30 messages per hour until it is changed.
--
--    3. Dashboard → Authentication → URL Configuration
--       Site URL       — the deployed restaurant address, e.g.
--                        https://your-project.vly.sh
--       Redirect URLs  — add https://your-project.vly.sh/** and
--                        http://localhost:5173/**
--       A redirect Supabase does not recognise is silently rewritten to the
--       Site URL, so both have to be set for the confirmation link to come back
--       to the admin door.
--
--  DO NOT set "Confirm email" off to get past this. That would drop the check
--  for every account on the project. Confirm the one address below instead, or
--  use the Team tab of the organisation's settings to add the address to the
--  team, which lets the shared mail server deliver to it without loosening
--  anything for anyone else.
--
--  It never creates a user, never changes a password, never grants a role and
--  never touches a business table. Confirming an address is the same change the
--  confirmation link makes — nothing more.
--
--  Idempotent: safe to run twice, or after the site has been updated again.
--
--  ---------------------------------------------------------------------------
--  1. Ask what is wrong. One call, one row of answers:
--
--       select public.staff_login_state('owner@janoon.pk');
--
--     `can_open_admin` is true only when every link in the chain is sound:
--     the sign-in account exists, its address is confirmed, and the team row is
--     an active admin whose user id is that same account.
--
--     Reading the result:
--       auth_user_exists false   → the address was never signed up, or is
--                                   spelled differently. Create the admin again
--                                   from the Admin Portal.
--       email_confirmed  false   → the confirmation link was never opened.
--                                   Use step 2 below, or resend it from the
--                                   sign-in card.
--       on_the_team      false   → the account exists but has no staff row.
--       ids_match        false   → the staff row points at a different sign-in
--                                   account. Fix with step 3.
--       active           false   → the account was switched off in the Team
--                                   screen.
--
--  2. Confirm the address when the link never arrived:
--
--       select public.confirm_staff_email('owner@janoon.pk');
--
--     Then sign in at the Admin Portal with the password you chose. If the
--     password itself is also unknown, use "Send setup link" from the Team tab
--     (or Supabase → Authentication → Users → Reset password) and set a new one.
--
--  3. Repoint a staff row at the right sign-in account:
--
--       update public.staff_members sm
--          set user_id = u.id
--         from auth.users u
--        where lower(sm.email) = lower(u.email)
--          and sm.user_id <> u.id;
--
-- ============================================================================


-- ---------------------------------------------------------------- diagnose --
--  Reads, never writes. Returns one JSON object so a single query answers the
--  whole question instead of needing four.
create or replace function public.staff_login_state(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user  record;
  v_row   record;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Give a full email address, for example owner@janoon.pk.';
  end if;

  select u.id,
         u.email,
         u.email_confirmed_at,
         u.last_sign_in_at
    into v_user
    from auth.users u
   where lower(u.email) = v_email
   order by u.created_at
   limit 1;

  select sm.user_id,
         sm.role,
         sm.active,
         sm.display_name
    into v_row
    from public.staff_members sm
   where lower(coalesce(sm.email, '')) = v_email
      or sm.user_id = v_user.id
   limit 1;

  return jsonb_build_object(
    'email',             v_email,
    -- Is there a Supabase Auth identity for this address at all?
    'auth_user_exists',  v_user.id is not null,
    'auth_user_id',      v_user.id,
    -- Is that identity allowed to sign in yet? This is the link that was
    -- silently broken, and the one the website used to report as a bad
    -- password.
    'email_confirmed',   v_user.email_confirmed_at is not null,
    'confirmed_at',      v_user.email_confirmed_at,
    'last_sign_in_at',   v_user.last_sign_in_at,
    -- Is the account on the team, and may it open a portal?
    'on_the_team',       v_row.user_id is not null,
    'staff_user_id',     v_row.user_id,
    'role',              v_row.role,
    'active',            v_row.active,
    -- Do the two rows point at the same identity? If not, a role was recorded
    -- against a different sign-in account and the door will never open for
    -- this address.
    'ids_match',         v_user.id is not null
                           and v_row.user_id is not null
                           and v_user.id = v_row.user_id,
    -- The single answer the question was really about.
    'can_open_admin',    coalesce(v_row.role = 'admin' and v_row.active, false)
                           and v_user.email_confirmed_at is not null
  );
end $$;


-- ------------------------------------------------- confirm a staff address --
--  The same change the confirmation link makes, for when the mail cannot be
--  delivered. Deliberately narrow:
--
--    • the address has to belong to a row in `staff_members`, so this can never
--      confirm a customer or a stranger's account;
--    • the identity has to exist in Supabase Auth;
--    • an address that is already confirmed is left exactly as it is, so the
--      original confirmation timestamp is never overwritten;
--    • no password, role or session is involved.
create or replace function public.confirm_staff_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id    uuid;
  v_rows  integer := 0;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Give a full email address, for example owner@janoon.pk.';
  end if;

  select sm.user_id into v_id
    from public.staff_members sm
   where lower(coalesce(sm.email, '')) = v_email
   limit 1;

  if v_id is null then
    raise exception
      'Not on the team: no staff record carries that address, so there is nothing to confirm.'
      using errcode = '42501';
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at         = now()
   where id = v_id;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception
      'No sign-in account exists with that id. Re-create the administrator from the Admin Portal.';
  end if;

  return jsonb_build_object(
    'ok',    true,
    'email', v_email,
    'user_id', v_id,
    'note',  'Address confirmed. Sign in at the Admin Portal with your password.'
  );
end $$;


--  Neither function is exposed to the website. Take away the default PUBLIC
--  grants and hand out nothing in their place: only the SQL Editor and the
--  service role can reach them. (`staff_login_state` reads `auth.users`, which
--  is why it must not be callable with the publishable key either.)
revoke all on function public.staff_login_state(text) from public;
revoke all on function public.confirm_staff_email(text) from public;

--  ---------------------------------------------------------------------------
--  Verify the door is open for the owner:
--
--    select public.staff_login_state('owner@janoon.pk') -> 'can_open_admin';
--    select * from public.tribe_active_admins();       -- expect: 1
--    select public.staff_bootstrap_state();            -- expect: {"claimable": false, "version": 2}
--  ---------------------------------------------------------------------------
