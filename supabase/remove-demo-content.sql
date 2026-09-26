-- ============================================================================
--  Remove the demo content an earlier revision published
-- ============================================================================
--  Paste this whole file into the Supabase SQL editor and run it. It is
--  idempotent — run it as often as you like, and re-running changes nothing
--  once the rows are gone.
--
--  What it removes, and why:
--
--    * `site_content.high-tea-offer` — "Seasons Special High Tea — Rs 1,895 +
--      tax | 03:30–05:00 pm & 05:15–06:45 pm". A price and two sitting times
--      the restaurant never published, drawn under the hero and again over the
--      counters. The application no longer reads this key at all; this deletes
--      the row so it cannot come back through the admin panel either.
--
--    * `promotions` rows with `demo = true` — the seeded "Weekend Live BBQ
--      Nights" offer (family of four for Rs 7,500, Friday to Sunday from 7 PM).
--      Guest surfaces already ignore demo rows — see `fetchPromotions()` in
--      src/lib/db.ts — and this removes them from the database outright.
--
--    * `site_media` captions on demo rows — captions like "Nihari at 3 AM"
--      described dishes and a service the restaurant never claimed. The
--      photographs themselves are kept: they are the placeholder house photos,
--      and a real upload replaces a slot from the admin panel.
--
--  Nothing else is touched — no menu row, no price, no reservation, no staff
--  account and no table definition. Every statement is scoped either by the
--  `demo` flag or by the exact key of the retired copy.
-- ============================================================================

-- 1. The retired High Tea offer line under the hero.
delete from public.site_content where key = 'high-tea-offer';

-- 2. Demo promotions. Guarded so this file can be pasted even before
--    supabase/schema.sql has created the table.
do $$
begin
  if to_regclass('public.promotions') is not null then
    delete from public.promotions where demo;
  end if;
end $$;

-- 3. Captions on demo photographs.
do $$
begin
  if to_regclass('public.site_media') is not null then
    update public.site_media set caption = null where demo and caption is not null;
  end if;
end $$;

-- 4. Verification — all three counts should read 0.
select 'high_tea_offer_rows' as what, count(*) as rows
  from public.site_content where key = 'high-tea-offer'
union all
select 'demo_promotions', count(*) from public.promotions where demo
union all
select 'demo_captions', count(*) from public.site_media where demo and caption is not null;
