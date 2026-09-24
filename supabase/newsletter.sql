-- ============================================================================
-- JUNOON — Royal Dispatch (the footer's email list)
--
-- Run this once in the Supabase SQL editor. It is safe to run again at any
-- time: the table, the index and the function are all created only when
-- missing, and a repeat signup keeps the row it already has.
--
-- Why a function instead of letting the browser insert straight into a table:
-- the table is closed to guests entirely. The address is validated, lower-cased
-- and throttled on the server, so the footer form can neither read the list back
-- nor be used to fill it with junk.
-- ============================================================================

create table if not exists public.newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at bigint not null default 0
);

-- One row per address. The function lower-cases before it writes, so the plain
-- column is enough to compare on.
create unique index if not exists newsletter_signups_email_key
  on public.newsletter_signups (email);

alter table public.newsletter_signups enable row level security;

-- Staff can read the list from the portal. Guests have no policy at all, so the
-- only way in is the function below.
drop policy if exists newsletter_signups_staff_read on public.newsletter_signups;
create policy newsletter_signups_staff_read
  on public.newsletter_signups
  for select to authenticated
  using (public.is_staff());

create or replace function public.subscribe_to_dispatch(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  -- Deliberately strict: this list is mailed to, so a half-typed address is
  -- refused here rather than discovered by the first letter that bounces.
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'That email address does not look right.';
  end if;

  perform public.tribe_throttle_guest('dispatch', v_email, 5, 25, 600);

  insert into public.newsletter_signups (email, created_at)
  values (v_email, (extract(epoch from now()) * 1000)::bigint)
  on conflict (email) do nothing;

  return jsonb_build_object('email', v_email, 'subscribed', true);
end $$;

grant execute on function public.subscribe_to_dispatch(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Verification — expect the count to go up by one per new address.
-- ----------------------------------------------------------------------------
select 'dispatch_signups' as what, count(*) as rows
from public.newsletter_signups;
