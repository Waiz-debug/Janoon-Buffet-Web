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
  sort_order      integer not null default 0,
  updated_at      bigint
);

create index if not exists menu_dishes_category_idx on public.menu_dishes (category_id);
create index if not exists menu_dishes_sort_idx     on public.menu_dishes (sort_order);

-- Public site imagery: one row per slot (gallery-1 … gallery-6).
create table if not exists public.site_media (
  slot        text primary key,
  caption     text,
  url         text,
  image_path  text,
  updated_at  bigint not null default 0
);

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
  created_at  bigint not null,
  updated_at  bigint not null
);

create index if not exists promotions_visible_idx on public.promotions (visible);

-- ============================================================================
--  Realtime — the staff portal, the guest tracker and the public banner all
--  subscribe to these tables, so they must be part of the publication.
-- ============================================================================
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'menu_categories', 'menu_dishes', 'site_media',
    'delivery_orders', 'reservations', 'promotions'
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
alter table public.menu_categories  enable row level security;
alter table public.menu_dishes      enable row level security;
alter table public.site_media       enable row level security;
alter table public.delivery_orders  enable row level security;
alter table public.reservations     enable row level security;
alter table public.promotions       enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'menu_categories', 'menu_dishes', 'site_media',
    'delivery_orders', 'reservations', 'promotions'
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
