-- ============================================================================
--  Handover cleanup — remove the sample content once the real content is live
-- ============================================================================
--  Paste this whole file into the Supabase SQL editor and run it at handover,
--  once the restaurant's own offers, copy and photographs are on the site. It
--  is idempotent — re-running changes nothing once the rows are gone.
--
--  While the site is being previewed, the seeded samples are deliberately left
--  in place: the offers board shows the sample banner and the gallery shows the
--  placeholder photographs, so the pages never look empty. This file is what
--  ends that — run it once and the samples are gone for good.
--
--  What it removes, and why:
--
--    * `site_content.high-tea-offer` — a retired offer line from an earlier
--      revision ("Seasons Special High Tea — Rs 1,895 + tax ..."). The
--      application no longer reads the key at all; this deletes the row so it
--      cannot come back through the admin panel either.
--
--    * `promotions` rows with `demo = true` — the seeded "Weekend Live BBQ
--      Nights" sample. Guest surfaces show it only while the restaurant has no
--      offers of its own; this removes it from the database outright.
--
--    * `site_media` captions on demo rows — sample captions the restaurant
--      never wrote. The photographs themselves are kept: they are the
--      placeholder house photos, and a real upload replaces a slot from the
--      admin panel.
--
--    * Finally, it writes `site_content.demo-seeding = 'off'`. Without that
--      flag, the admin panel would publish a fresh sample banner the next time
--      it loads; with it, the samples stay gone.
--
--  Nothing else is touched — no menu row, no price, no reservation, no staff
--  account and no table definition. Every statement is scoped either by the
--  `demo` flag or by the exact key of the retired copy.
-- ============================================================================

-- 1. The retired offer line under the hero.
delete from public.site_content where key = 'high-tea-offer';

-- 2. Stop the sample banner from ever being re-published.
insert into public.site_content (key, value, updated_at)
values ('demo-seeding', 'off', (extract(epoch from now()) * 1000)::bigint)
on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at;

-- 3. Demo promotions. Guarded so this file can be pasted even before
--    supabase/schema.sql has created the table.
do $$
begin
  if to_regclass('public.promotions') is not null then
    delete from public.promotions where demo;
  end if;
end $$;

-- 4. Captions on demo photographs.
do $$
begin
  if to_regclass('public.site_media') is not null then
    update public.site_media set caption = null where demo and caption is not null;
  end if;
end $$;

-- 5. Verification — the first three counts should read 0; the last should
--    read 1 (the stop flag is set, keeping the sample gone).
select 'high_tea_offer_rows' as what, count(*) as rows
  from public.site_content where key = 'high-tea-offer'
union all
select 'demo_promotions', count(*) from public.promotions where demo
union all
select 'demo_captions', count(*) from public.site_media where demo and caption is not null
union all
select 'demo_seeding_off', count(*) from public.site_content where key = 'demo-seeding' and value = 'off';
