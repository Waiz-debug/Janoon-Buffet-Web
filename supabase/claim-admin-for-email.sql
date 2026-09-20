-- ============================================================================
--  Janoon — claim_admin_for_email migration
--
--  Run this ENTIRE file in the Supabase SQL Editor (Dashboard → SQL Editor).
--  It adds a single function that lets the "Create Admin Account" flow work
--  when the email already exists in Supabase Auth but the password doesn't
--  match (e.g. a staff member or customer whose account predates the admin
--  setup).
--
--  supabase/schema.sql carries this same function, and
--  supabase/fix-admin-recovery.sql installs it together with the rest of the
--  current rules — either of those is enough on a new project. This file stays
--  as the smallest possible patch for a project that only needs this one.
--
--  Security:
--    • Only works while NO active admin exists (same guard as claim_admin).
--    • The target email must exist in auth.users.
--    • A staff account cannot self-promote (same rule as claim_admin).
--    • No session is created — the user must still sign in with their
--      existing password, so only the real account holder gains access.
--
--  After running, verify:
--    select public.staff_bootstrap_state();
--      → { "claimable": true }  if no admin exists yet
-- ============================================================================

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
  -- Look up the auth user by email. SECURITY DEFINER lets us read auth.users.
  select id into v_uid from auth.users where email = p_email;

  if v_uid is null then
    raise exception 'No account found for that email address.'
      using errcode = '23503';
  end if;

  -- An account already on the team as staff may never promote itself.
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

  -- Create or update the admin record for the existing auth user.
  insert into public.staff_members
    (user_id, email, display_name, role, active, created_at)
  values (
    v_uid, p_email, 'Owner', 'admin', true,
    (extract(epoch from now()) * 1000)::bigint
  )
  on conflict (user_id) do update
    set role = 'admin', active = true, email = excluded.email;

  -- Also add to junction table for multi-role support.
  insert into public.staff_member_roles (user_id, role, created_at)
  values (v_uid, 'admin', (extract(epoch from now()) * 1000)::bigint)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object('ok', true, 'role', 'admin', 'email', p_email);
end $$;

--  Open to both anon and authenticated: the function itself is gated by the
--  "no admin exists" check, and it never creates a session — the caller must
--  still authenticate with the real password to use the newly granted access.
grant execute on function public.claim_admin_for_email(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
--  Verify. After running the above:
--
--    select public.staff_bootstrap_state();
--      → { "claimable": true }  means the setup form is offered
--
--    To test claim_admin_for_email (only works while claimable is true):
--      select public.claim_admin_for_email('test@example.com');
--        → { "ok": true, "role": "admin", "email": "test@example.com" }
--        OR
--        → error if no auth user with that email, or admin already exists
-- ---------------------------------------------------------------------------
select public.staff_bootstrap_state() as admin_setup_state;
