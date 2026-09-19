-- ============================================================================
--  Janoon — admin setup / recovery fix (copy-paste, idempotent)
--
--  Run this whole file in the Supabase SQL Editor, then reload the website and
--  open the Admin Portal. It replaces ONLY the two functions that decide
--  whether "Create Admin Account" is offered.
--
--  Before:
--    * staff_bootstrap_state() reported claimable only while staff_members was
--      COMPLETELY EMPTY — so a single staff row (or an inactive admin) hid the
--      setup action forever.
--    * claim_admin() required the caller to be the FIRST auth user ever created
--      on the project — so as soon as any other Auth user existed, nobody could
--      ever claim again.
--
--  After:
--    * claimable  ⇔  no ACTIVE admin exists
--    * claim_admin() grants admin exactly in that state, under a table lock,
--      and refuses any account that already holds a staff row.
-- ============================================================================

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
  -- Needs a real Supabase Auth session; `anon` is not granted execute.
  if v_uid is null then
    raise exception 'Sign in before claiming admin access.'
      using errcode = '42501';
  end if;

  -- A staff account may never promote itself, even while no admin exists.
  select role into v_role
    from public.staff_members
   where user_id = v_uid;

  if v_role = 'staff' then
    raise exception
      'Staff accounts cannot claim admin access. Ask an admin to grant it.'
      using errcode = '42501';
  end if;

  -- One claimant at a time.
  lock table public.staff_members in exclusive mode;

  -- Same test as staff_bootstrap_state(), re-read under the lock so the button
  -- and the claim can never disagree.
  if exists (
    select 1 from public.staff_members
     where role = 'admin' and active
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

  return jsonb_build_object('ok', true, 'role', 'admin', 'email', v_email);
end $$;

revoke all on function public.claim_admin() from public;
grant execute on function public.claim_admin() to authenticated;


-- ---------------------------------------------------------------------------
--  Verify. After running the above:
--
--    select public.staff_bootstrap_state();
--      → { "claimable": true }   means the Admin Portal will offer
--                                "Create Admin Account".
--      → { "claimable": false }  means an active admin exists; sign in with it.
--
--  To reopen the door, remove (or switch off) the admin row — see
--  supabase/admin-recovery.sql. The Supabase Auth account is not touched.
-- ---------------------------------------------------------------------------
select public.staff_bootstrap_state() as admin_setup_state;
