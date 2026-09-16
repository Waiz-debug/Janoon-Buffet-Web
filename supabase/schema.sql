-- ============================================================================
--  Tribe of Taste — Supabase schema
--  Paste this whole file into the Supabase SQL editor and run it once.
--  It is idempotent: re-running it will not drop or duplicate anything.
--
--  Timestamps are stored as milliseconds since the epoch (bigint) so the
--  frontend can compare them directly with `Date.now()`.
-- ============================================================================

-- ---------------------------------------------------------------- menu ------ 
create table if not exists public.menu_categories (
  id          text primary key,
  name        text not null,
  urdu        text,
  blurb       text,
  icon        text not null default 'flame',
  sort_order  integer not null default 0,
  active      boolean not null default true
);

create table if not exists public.menu_dishes (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  urdu            text,
  category_id     text not null default 'bbq',
  summary         text,
  description     text,
  notes           jsonb,
  pairings        jsonb,
  image           text,
  image_path      text,
  price_per_plate integer,
  active          boolean not null default true,
  featured        boolean not null default false,
  -- True while the photo is still the seeded placeholder, so the admin panel
  -- can flag it as a demo asset worth replacing. Cleared on first upload.
  demo            boolean not null default false,
  sort_order      integer not null default 0,
  updated_at      bigint
);

create index if not exists menu_dishes_category_idx on public.menu_dishes (category_id);
create index if not exists menu_dishes_sort_idx     on public.menu_dishes (sort_order);

-- Public site imagery: one row per slot (gallery-1 … gallery-6).
create table if not exists public.site_media (
  slot        text primary key,
  caption     text,
  -- `url` holds an external demo photo; `image_path` holds an uploaded object
  -- inside the tribe-media bucket. An upload always clears the other one.
  url         text,
  image_path  text,
  demo        boolean not null default false,
  updated_at  bigint not null default 0
);

-- Editable copy that is not a photo — the seating counter under "The
-- Experience", and room for any future headline or note the owner wants to
-- change without a redeploy. One row per key; `key` is the stable identifier
-- the frontend reads (see SITE_CONTENT_DEFAULTS in src/lib/restaurant.ts).
create table if not exists public.site_content (
  key         text primary key,
  value       text not null,
  updated_at  bigint not null default 0
);

-- -------------------------------------------------------------- add-ons ----
-- The "Traditional Add-ons" board on the public site: breads and naan, sides
-- and salads, drinks and lassi, and cold drinks. Fully admin-managed.
--
-- `category` is one of the four groups the public board renders, in this order:
--   bread  → Breads & Naan
--   side   → Sides & Salads
--   drink  → Drinks & Lassi
--   cold   → Cold Drinks
-- The labels themselves live in ADDON_GROUPS (src/lib/menu.ts) so the admin
-- form and the public board can never disagree about them.
create table if not exists public.menu_addons (
  id          text primary key,
  name        text not null,
  urdu        text,
  price       integer not null default 0,
  category    text not null default 'bread'
              check (category in ('bread', 'side', 'drink', 'cold')),
  -- `image` holds an external URL; `image_path` holds an uploaded object inside
  -- the tribe-media bucket. An upload always clears the other one.
  image       text,
  image_path  text,
  demo        boolean not null default false,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  updated_at  bigint not null default 0
);

create index if not exists menu_addons_category_idx on public.menu_addons (category);
create index if not exists menu_addons_sort_idx     on public.menu_addons (sort_order);

-- -------------------------------------------------------------- orders ------
create table if not exists public.delivery_orders (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null,
  customer_name text not null,
  phone         text not null,
  address       text not null,
  area          text not null,
  notes         text,
  items         jsonb not null default '[]'::jsonb,
  items_total   integer not null default 0,
  delivery_fee  integer not null default 0,
  total         integer not null default 0,
  status        text not null default 'placed'
                check (status in ('placed', 'confirmed', 'delivered')),
  created_at    bigint not null,
  delivered_at  bigint
);

create index if not exists delivery_orders_created_idx on public.delivery_orders (created_at desc);
create index if not exists delivery_orders_status_idx  on public.delivery_orders (status);

-- -------------------------------------------------------- reservations ------
create table if not exists public.reservations (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique,
  name        text not null,
  phone       text not null,
  party_size  integer not null default 2,
  date        text not null,
  time        text not null,
  seating     text not null default 'outdoor'
              check (seating in ('outdoor', 'indoor')),
  notes       text,
  status      text not null default 'pending'
              check (status in ('pending', 'confirmed', 'seated', 'cancelled')),
  created_at  bigint not null
);

create index if not exists reservations_date_idx   on public.reservations (date);
create index if not exists reservations_status_idx on public.reservations (status);

-- ---------------------------------------------------------- promotions ------
create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  headline    text not null,
  body        text,
  visible     boolean not null default true,
  image_url   text,
  image_path  text,
  expires_at  bigint,
  -- True for the sample banner the app seeds, so a lapsed demo can be
  -- refreshed without ever touching a promotion the team wrote themselves.
  demo        boolean not null default false,
  created_at  bigint not null,
  updated_at  bigint not null
);

create index if not exists promotions_visible_idx on public.promotions (visible);

-- ------------------------------------------------------------ preorders ----
-- Takeaway / slow-cooked pre-orders (Dumpukht, Sajji, party platters) placed
-- from the public site. These are the "takeaway orders" that must land on the
-- staff desk alongside table reservations and online delivery orders.
create table if not exists public.preorders (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  customer_name text not null,
  phone         text not null,
  dish          text not null,
  quantity      integer not null default 1,
  pickup_date   text not null,          -- YYYY-MM-DD
  pickup_time   text not null,          -- HH:MM
  notes         text,
  status        text not null default 'pending'
                check (status in ('pending', 'confirmed', 'ready', 'collected', 'cancelled')),
  created_at    bigint not null,
  updated_at    bigint
);

create index if not exists preorders_pickup_idx on public.preorders (pickup_date);
create index if not exists preorders_status_idx on public.preorders (status);
create index if not exists preorders_created_idx on public.preorders (created_at desc);

-- ============================================================================
--  Realtime — the staff portal, the guest tracker and the public banner all
--  subscribe to these tables, so they must be part of the publication.
-- ============================================================================
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'menu_categories', 'menu_dishes', 'menu_addons', 'site_media', 'site_content',
    'delivery_orders', 'reservations', 'promotions', 'preorders'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when duplicate_object then
      null; -- already published
    end;
  end loop;
end $$;

-- ============================================================================
--  Row level security
--  Staff and admins authenticate with a shared PIN in the browser rather than
--  Supabase Auth, so the policies below grant the publishable key full access
--  to the restaurant's own data. Tighten these if you later add real auth.
-- ============================================================================
alter table public.site_content      enable row level security;
alter table public.menu_categories  enable row level security;
alter table public.menu_dishes      enable row level security;
alter table public.menu_addons      enable row level security;
alter table public.site_media       enable row level security;
alter table public.delivery_orders  enable row level security;
alter table public.reservations     enable row level security;
alter table public.promotions       enable row level security;
alter table public.preorders        enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'menu_categories', 'menu_dishes', 'menu_addons', 'site_media', 'site_content',
    'delivery_orders', 'reservations', 'promotions', 'preorders'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_all', tbl);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      tbl || '_all', tbl
    );
  end loop;
end $$;

-- ============================================================================
--  Storage — public bucket that holds dish photos and promo banner graphics.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('tribe-media', 'tribe-media', true)
on conflict (id) do update set public = true;

drop policy if exists "tribe media read"   on storage.objects;
drop policy if exists "tribe media write"  on storage.objects;
drop policy if exists "tribe media update" on storage.objects;
drop policy if exists "tribe media delete" on storage.objects;

create policy "tribe media read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'tribe-media');

create policy "tribe media write" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'tribe-media');

create policy "tribe media update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'tribe-media');

create policy "tribe media delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'tribe-media');

-- ============================================================================
--  Migration — demo media flags
--  `create table if not exists` never adds columns to an existing table, so
--  these run separately for databases created before the demo flags existed.
--  Both are safe to re-run.
-- ============================================================================
alter table public.site_media  add column if not exists demo boolean not null default false;
alter table public.menu_dishes add column if not exists demo boolean not null default false;
alter table public.promotions  add column if not exists demo boolean not null default false;

-- ============================================================================
--  Demo promotional banner
--  Seeds one live sample banner so the public site has something to broadcast
--  out of the box. Idempotent: only inserts when no promotion exists yet.
--  Expires 7 days from the moment this script runs, after which the `active`
--  query filter hides it from the public site automatically.
-- ============================================================================
insert into public.promotions (title, headline, body, visible, demo, expires_at, created_at, updated_at)
select
  'Weekend Live BBQ Nights',
  'Live BBQ Nights — family of four dines for Rs 7,500',
  'Valid Friday to Sunday, 7 PM onwards. Dine-in only.',
  true,
  true,
  (extract(epoch from now()) * 1000)::bigint + (7 * 24 * 60 * 60 * 1000),
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint
where not exists (select 1 from public.promotions where not demo);

-- ============================================================================
--  Demo gallery imagery
--  The six gallery slots (gallery-1 … gallery-6) are seeded from the app itself
--  by `seedDemoGallery()` in src/lib/db.ts, which reads the GALLERY array in
--  src/lib/restaurant.ts. Seeding from code keeps the public site's fallback
--  photos and the admin panel's demo rows pointing at the same URLs — no
--  duplicated image list to drift out of sync.
--
--  The seed runs the first time the admin portal opens and only fills slots
--  that do not already have a row, so it never overwrites a real upload.
--
--  Equivalent SQL, if you would rather seed by hand:
--
--    insert into public.site_media (slot, caption, url, demo, updated_at)
--    values
--      ('gallery-1', 'Live seekh kebab counter', 'https://…', true, 0),
--      ('gallery-2', 'Malai boti off the coals', 'https://…', true, 0)
--    on conflict (slot) do nothing;
--
--  Inspect what is currently published versus still on the demo photo:
--
--    select slot, caption, demo,
--           case when image_path is null then 'demo url' else 'uploaded' end as source
--      from public.site_media
--     order by slot;
--
-- ============================================================================
--  History views — Today vs History, searchable by year / month / date
--  These examples show the exact filter shape the portal runs through
--  PostgREST. `pickup_date`, `date` and the epoch timestamps are all indexed
--  above, so the range scans stay cheap as history grows.
-- ============================================================================
--
--  Today's reservations:
--    select * from public.reservations
--     where date = to_char(now(), 'YYYY-MM-DD')
--     order by time;
--
--  Reservation history for a chosen month (e.g. September 2026):
--    select * from public.reservations
--     where date >= '2026-09-01' and date < '2026-10-01'
--     order by date desc, time desc;
--
--  Reservation history for a single day:
--    select * from public.reservations where date = '2026-09-12';
--
--  Pre-orders for today's pickup:
--    select * from public.preorders
--     where pickup_date = to_char(now(), 'YYYY-MM-DD')
--     order by pickup_time;
--
--  Delivery orders created in a chosen month (created_at is epoch ms):
--    select * from public.delivery_orders
--     where to_timestamp(created_at / 1000.0) >= '2026-09-01'
--       and to_timestamp(created_at / 1000.0) <  '2026-10-01'
--     order by created_at desc;
--
--  Free-text history search across a phone, name or reference:
--    select * from public.delivery_orders
--     where customer_name ilike '%khan%'
--        or phone ilike '%322%'
--        or reference ilike '%DLV%';
--
--  Distinct years present in the history (for the filter sidebar):
--    select distinct extract(year from to_timestamp(created_at / 1000.0))
--      from public.delivery_orders order by 1 desc;

-- ============================================================================
--  Signature dishes — exactly four, enforced in the database
--  The public "Signatures" strip shows four dishes and nothing else; those
--  same four are hidden from the category counters so a dish never appears
--  twice on the page. The admin panel caps its toggle at four, and this
--  trigger is the backstop: no code path — including the seed — can publish a
--  fifth signature dish.
--
--  Unfinished records are unaffected: the check only fires when `featured`
--  actually turns on, so re-running the seed or editing any other column of an
--  already-featured dish is free.
-- ============================================================================
create or replace function public.tribe_limit_signature_dishes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not new.featured then
      return new;
    end if;
  else
    if not new.featured or old.featured then
      return new;
    end if;
  end if;

  if (select count(*) from public.menu_dishes
       where featured and slug <> new.slug) >= 4 then
    raise exception
      'Only four signature dishes are allowed. Clear one before featuring another.';
  end if;

  return new;
end $$;

drop trigger if exists menu_dishes_signature_limit on public.menu_dishes;
create trigger menu_dishes_signature_limit
  before insert or update of featured on public.menu_dishes
  for each row execute function public.tribe_limit_signature_dishes();

-- ============================================================================
--  `orders` — every guest request in one searchable view
--  Reservations, online deliveries and takeaway pre-orders live in three
--  tables because they carry different fields. This view unions them into a
--  single read model so "all orders" can be queried, exported or reported on
--  without the app joining three shapes. Read-only: writes still go to the
--  individual tables.
--
--  `service_day` is always a `YYYY-MM-DD` string — the reservation date, the
--  pre-order pickup date, or the calendar day a delivery was placed — so one
--  filter works across all three kinds.
-- ============================================================================
create or replace view public.orders as
  select
    'delivery'::text            as kind,
    d.id::text                  as id,
    d.reference                 as reference,
    d.customer_name             as customer_name,
    d.phone                     as phone,
    d.status                    as status,
    d.total                     as total,
    d.items                     as items,
    d.notes                     as detail,
    d.created_at                as created_at,
    d.delivered_at              as closed_at,
    to_char(to_timestamp(d.created_at / 1000.0), 'YYYY-MM-DD') as service_day
  from public.delivery_orders d
  union all
  select
    'preorder'::text,
    p.id::text,
    p.reference,
    p.customer_name,
    p.phone,
    p.status,
    null::integer,
    null::jsonb,
    p.dish || ' · pickup ' || p.pickup_date || ' ' || p.pickup_time,
    p.created_at,
    null::bigint,
    p.pickup_date
  from public.preorders p
  union all
  select
    'reservation'::text,
    r.id::text,
    r.reference,
    r.name,
    r.phone,
    r.status,
    null::integer,
    null::jsonb,
    r.party_size::text || ' guests · ' || r.time || ' · ' || r.seating,
    r.created_at,
    null::bigint,
    r.date
  from public.reservations r;

--  Exposed to the publishable key the same way the tables are.
grant select on public.orders to anon, authenticated;

--  All orders for one day, newest first:
--    select * from public.orders where service_day = to_char(now(), 'YYYY-MM-DD');
--
--  Everything still open across all three kinds:
--    select * from public.orders
--     where status not in ('delivered', 'collected', 'cancelled', 'seated')
--     order by created_at desc;
--
--  One month of history, grouped by kind:
--    select kind, count(*) from public.orders
--     where service_day >= '2026-09-01' and service_day < '2026-10-01'
--     group by kind;

-- ============================================================================
--  Editable copy defaults
--  Seeds the "The Experience" seating counter so the section renders the same
--  numbers before the owner has changed anything. Idempotent: existing values
--  are never overwritten.
-- ============================================================================
insert into public.site_content (key, value, updated_at)
select v.key, v.value, (extract(epoch from now()) * 1000)::bigint
from (values
  ('experience-seats',       '4–20'),
  ('experience-seats-label', 'seats per family table')
) as v(key, value)  where not exists (select 1 from public.site_content c where c.key = v.key);

-- ============================================================================
--  Traditional add-ons — seed
--  The twelve items that ship with the site, including the four cold drinks.
--  Idempotent: `on conflict do nothing`, so re-running never overwrites a price
--  or photo the team has already changed. The admin panel runs the same seed
--  from `seedAddOns()` in src/lib/db.ts; either path is enough.
-- ============================================================================
insert into public.menu_addons
  (id, name, urdu, price, category, active, demo, sort_order, updated_at)
values
  ('afghani-naan',   'Afghani Naan',   'افغانی نان',    80, 'bread', true, true, 1, 0),
  ('tandoori-naan',  'Tandoori Naan',  'تندوری نان',    60, 'bread', true, true, 2, 0),
  ('sheermal',       'Sheermal',       'شیرمال',        70, 'bread', true, true, 3, 0),
  ('raita',          'Raita',          'رائتہ',         50, 'side',  true, true, 1, 0),
  ('green-salad',    'Green Salad',    'سلاد',          60, 'side',  true, true, 2, 0),
  ('pickles',        'Mixed Pickles',  'اچار',          40, 'side',  true, true, 3, 0),
  ('mint-lassi',     'Mint Lassi',     'پودینہ لسی',   120, 'drink', true, true, 1, 0),
  ('kashmiri-chai',  'Kashmiri Chai',  'کشمیری چائے',  150, 'drink', true, true, 2, 0),
  ('cola',           'Cola',           'کولا',         100, 'cold',  true, true, 1, 0),
  ('sprite',         'Sprite',         'اسپرائٹ',      100, 'cold',  true, true, 2, 0),
  ('fanta',          'Fanta',          'فانٹا',        100, 'cold',  true, true, 3, 0),
  ('water-bottle',   'Mineral Water',  'منرل واٹر',     60, 'cold',  true, true, 4, 0)
on conflict (id) do nothing;

--  The public board: only the live items, grouped and ordered.
--    select category, name, urdu, price, image, image_path
--      from public.menu_addons
--     where active
--     order by category, sort_order;
--
--  The admin board: everything, hidden items included.
--    select * from public.menu_addons order by category, sort_order;
--
--  Reprice one cold drink:
--    update public.menu_addons set price = 120, updated_at = 0
--     where id = 'cola';
--
--  Which add-ons are still on a demo photo?
--    select id, name, category, demo,
--           case when image_path is null then 'demo url' else 'uploaded' end as source
--      from public.menu_addons order by category, sort_order;

--  Read back everything the owner has customised:
--    select key, value from public.site_content order by key;
