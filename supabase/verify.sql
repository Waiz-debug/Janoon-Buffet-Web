-- ============================================================================
--  Tribe of Taste — post-migration verification
--
--  Run this in the Supabase SQL editor immediately AFTER supabase/schema.sql.
--  It changes nothing; it only reports what exists.
--
--  Every row must read "ok". Any row reading "MISSING" (or a null signature)
--  means that object was not created — re-run supabase/schema.sql, which is
--  idempotent, rather than creating objects by hand.
-- ============================================================================

with
-- The eleven tables the admin/staff/public portals read and write.
app_tables (name) as (values
  ('menu_categories'), ('menu_dishes'), ('menu_addons'), ('addon_categories'),
  ('site_media'), ('site_content'), ('promotions'), ('delivery_orders'),
  ('reservations'), ('preorders'), ('pre_order_items')
),
-- guest_write_log backs the rate limiter: RLS on, deliberately no policies.
support_tables (name) as (values ('staff_members'), ('guest_write_log')),
-- Every function the client calls, exactly as src/lib/db.ts calls it.
rpc (name) as (values
  ('is_staff'), ('is_admin'),
  ('lookup_reservation'), ('lookup_delivery_order'), ('cancel_reservation'),
  ('create_reservation'), ('create_preorder'), ('place_delivery_order'),
  ('tribe_throttle_guest'), ('tribe_rate_limit'), ('tribe_client_ip'),
  ('tribe_reference'), ('tribe_limit_signature_dishes'),
  ('staff_bootstrap_state'), ('claim_admin')
),
bucket_policies (name) as (values
  ('tribe media read'), ('tribe media write'),
  ('tribe media update'), ('tribe media delete')
)
select '1. table' as check, t.name as object,
       case when exists (
         select 1 from pg_class c
          where c.relnamespace = 'public'::regnamespace
            and c.relname = t.name and c.relkind = 'r'
            and c.relrowsecurity
       ) then 'ok' else 'MISSING' end as status,
       coalesce((
         select c.relnatts::text || ' columns'
           from pg_class c
          where c.relnamespace = 'public'::regnamespace and c.relname = t.name
       ), 'no such table') as detail
  from app_tables t
union all
select '2. support table', t.name,
       case when exists (
         select 1 from pg_class c
          where c.relnamespace = 'public'::regnamespace
            and c.relname = t.name and c.relkind = 'r'
            and c.relrowsecurity
       ) then 'ok' else 'MISSING' end,
       coalesce((
         select c.relnatts::text || ' columns'
           from pg_class c
          where c.relnamespace = 'public'::regnamespace and c.relname = t.name
       ), 'no such table')
  from support_tables t
union all
select '3. realtime published', t.name,
       case when exists (
         select 1 from pg_publication_tables p
          where p.pubname = 'supabase_realtime'
            and p.schemaname = 'public' and p.tablename = t.name
       ) then 'ok' else 'MISSING' end,
       'needed for live admin -> guest sync'
  from app_tables t
union all
select '4. function', r.name,
       case when exists (
         select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = r.name
       ) then 'ok' else 'MISSING' end,
       coalesce((
         select p.proname || '(' || pg_get_function_arguments(p.oid) || ')'
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = r.name
          order by p.oid limit 1
       ), 'no such function')
  from rpc r
union all
select '5. storage bucket', 'tribe-media',
       case when exists (select 1 from storage.buckets where id = 'tribe-media')
            then 'ok' else 'MISSING' end,
       coalesce((
         select 'public=' || b.public::text
                || ' limit=' || coalesce(b.file_size_limit::text, 'unset')
           from storage.buckets b where b.id = 'tribe-media'
       ), 'bucket missing — uploads will fail')
union all
select '6. storage policy', p.name,
       case when exists (
         select 1 from pg_policies
          where schemaname = 'storage' and tablename = 'objects'
            and policyname = p.name
       ) then 'ok' else 'MISSING' end,
       'guards writes to the media bucket'
  from bucket_policies p
order by 1, 2;

-- ---------------------------------------------------------------------------
--  Row counts — proof the site is reading live data rather than fallback, not
--  a measure of whether the schema ran. A table may legitimately be empty.
-- ---------------------------------------------------------------------------
--  select 'menu_categories' as table, count(*) from public.menu_categories
--  union all select 'menu_dishes',  count(*) from public.menu_dishes
--  union all select 'menu_addons',  count(*) from public.menu_addons
--  union all select 'addon_categories', count(*) from public.addon_categories
--  union all select 'site_media',   count(*) from public.site_media
--  union all select 'promotions',   count(*) from public.promotions
--  union all select 'staff_members', count(*) from public.staff_members;

-- ---------------------------------------------------------------------------
--  Behavioural check — the audit's central claim. Run as the anon role to
--  confirm guests can read the catalogue but never customer records:
--
--    set role anon;
--    select count(*) from public.menu_dishes;        -- expect: succeeds
--    select count(*) from public.delivery_orders;    -- expect: permission denied
--    select count(*) from public.reservations;       -- expect: permission denied
--    select count(*) from public.staff_members;      -- expect: 0 rows, not an error
--
--  And the owner bootstrap, which is how the first admin account gets made:
--
--    select public.staff_bootstrap_state();
--      -- {"claimable": true} while staff_members is empty, then false forever
--      -- after the owner signs up on the site and claims it.
--    reset role;
-- ============================================================================
