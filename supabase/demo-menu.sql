-- ============================================================================
-- JUNOON — complete official menu structure and seed
--
-- High Tea: Seasons Special High Tea — Rs 1,895 + tax
-- Time slots: 03:30–05:00 pm and 05:15–06:45 pm
--
-- This script is safe to run repeatedly. It creates the two menu tables when
-- missing, keeps the uncategorized parking row, retires obsolete starter
-- sections, upserts the 16 active official sections, upserts all 90 menu items
-- with the demo photo each one shows on the guest menu, preserves the
-- four-signature limit, and publishes a verification summary.
--
-- The dish block in section 4 is generated from src/lib/menu.ts by
-- tools/generate-menu-sql.mjs, so it cannot drift from the catalogue the admin
-- panel seeds. The rest of the file is hand-written.
--
-- High Tea counter rows use price_per_plate = null because the individual
-- items are included in the Rs 1,895 + tax seat price and are not standalone
-- delivery products. The exact à la carte prices are stored on their rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Structure
-- ---------------------------------------------------------------------------
create table if not exists public.menu_categories (
  id text primary key,
  name text not null,
  urdu text,
  blurb text,
  icon text not null default 'flame',
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.menu_dishes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  urdu text,
  category_id text not null default 'uncategorized',
  summary text,
  description text,
  notes jsonb,
  pairings jsonb,
  image text,
  image_path text,
  price_per_plate integer,
  active boolean not null default true,
  featured boolean not null default false,
  demo boolean not null default false,
  sort_order integer not null default 0,
  updated_at bigint
);

create index if not exists menu_dishes_category_sort_idx
  on public.menu_dishes (category_id, sort_order);
create index if not exists menu_dishes_sort_idx
  on public.menu_dishes (sort_order);

-- ---------------------------------------------------------------------------
-- 1a. An earlier revision of this project. Its tables are the same shape apart
--     from requirements the app has never written, and one missing table.
--     Left as they are, the seed below is refused outright: a NOT NULL on a
--     counter's old `slug` column rejects every official section, and a dish
--     key with no default rejects every official dish.
--
--     Nothing here rewrites a row or drops a column — only requirements are
--     lifted, missing columns are added, and the counter hero-image table is
--     created when it is not there yet.
-- ---------------------------------------------------------------------------
alter table public.menu_categories
  add column if not exists urdu       text,
  add column if not exists blurb      text,
  add column if not exists icon       text not null default 'flame',
  add column if not exists sort_order integer not null default 0,
  add column if not exists active     boolean not null default true;

alter table public.menu_dishes
  add column if not exists urdu            text,
  add column if not exists summary         text,
  add column if not exists description     text,
  add column if not exists notes           jsonb,
  add column if not exists pairings        jsonb,
  add column if not exists image           text,
  add column if not exists image_path      text,
  add column if not exists price_per_plate integer,
  add column if not exists active          boolean not null default true,
  add column if not exists featured        boolean not null default false,
  add column if not exists demo            boolean not null default false,
  add column if not exists sort_order      integer not null default 0,
  add column if not exists updated_at      bigint;

-- One hero photograph per counter: uploaded from the admin panel's Counters
-- tab, rendered on that counter's card on the guest site. Same storage model
-- as the gallery — `url` for a demo image, `image_path` for an uploaded object
-- that owns the graphic outright.
create table if not exists public.counter_media (
  slot       text primary key,
  caption    text,
  url        text,
  image_path text,
  demo       boolean not null default false,
  updated_at bigint not null default 0
);

do $$
declare
  legacy  record;
  id_type text;
begin
  for legacy in
    select c.table_name, c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.is_nullable = 'NO'
       and c.column_default is null
       and (
         (c.table_name = 'menu_categories'
           and c.column_name in ('slug', 'description', 'display_order'))
         or
         (c.table_name = 'menu_dishes'
           and c.column_name in ('image_url', 'is_active', 'price',
                                 'is_available', 'is_signature', 'display_order'))
       )
  loop
    execute format('alter table public.%I alter column %I drop not null',
                   legacy.table_name, legacy.column_name);
  end loop;

  -- The dish key. An early loader numbered the rows `dish-1`, `dish-2`, … and
  -- the app has never written the column, so a key with no default refuses
  -- every dish saved from the admin panel. Added only when there really is
  -- none, and typed to match the column the project actually has.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'menu_dishes'
       and column_name = 'id' and column_default is not null
  ) then
    select data_type into id_type
      from information_schema.columns
     where table_schema = 'public' and table_name = 'menu_dishes'
       and column_name = 'id';
    if id_type = 'uuid' then
      execute 'alter table public.menu_dishes alter column id set default gen_random_uuid()';
    elsif id_type is not null then
      execute 'alter table public.menu_dishes alter column id set default gen_random_uuid()::text';
    end if;
  end if;
end $$;

-- Keep the High Tea offer and both service slots in the same admin-managed
-- content table used by the guest site.
create table if not exists public.site_content (
  key text primary key,
  value text not null,
  updated_at bigint not null default 0
);
insert into public.site_content (key, value, updated_at)
values ('high-tea-offer', 'Seasons Special High Tea — Rs 1,895 + tax | 03:30–05:00 pm & 05:15–06:45 pm', (extract(epoch from now()) * 1000)::bigint)
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

-- The app addresses every dish by slug. Refuse an ambiguous legacy table
-- rather than silently updating the wrong row.
do $$
begin
  if exists (select 1 from public.menu_dishes group by slug having count(*) > 1) then
    raise exception 'menu_dishes contains duplicate slugs; resolve them before running the official seed.';
  end if;
  execute 'create unique index if not exists menu_dishes_slug_key on public.menu_dishes (slug)';
end $$;

insert into public.menu_categories (id, name, urdu, blurb, icon, sort_order, active)
values ('uncategorized', 'Other', 'دیگر', 'Items whose section was removed from the menu.', 'flame', 99, false)
on conflict (id) do nothing;

-- Retire sections from the previous catalogue without deleting their rows.
update public.menu_categories
set active = false
where id in ('bbq', 'handi', 'tandoor', 'fast-bites', 'desserts', 'street-tandoor', 'meetha-station', 'salads-desserts');

-- The anonymous ids a first-pass loader invented (`cat-1`, `cat-2`, …). Their
-- rows stay for the record, but a retired counter is not published, so the
-- guest menu holds exactly the sixteen official sections above and no dish
-- appears twice.
update public.menu_categories
set active = false
where id like 'cat-%';

-- ---------------------------------------------------------------------------
-- 2. Official active sections: nine live counters followed by seven main-menu
--    sections. These are individual menu_categories rows, as requested.
-- ---------------------------------------------------------------------------
insert into public.menu_categories (id, name, urdu, blurb, icon, sort_order, active)
values
  ('welcome-drinks', 'Welcome Drink', 'خوش آمدید ڈرنک', 'The first glass of the High Tea service — a five-serving welcome pour with every seat.', 'drink', 1, true),
  ('soup-counter', 'Soup', 'سوپ', 'Hot soups served at the opening of the live High Tea service.', 'soup', 2, true),
  ('junooni-special-counter', 'Junooni Special', 'جنونی اسپیشل', 'The kitchen''s live mutton and charcoal specials, including the seekh kabab and chicken boti of the day.', 'flame', 3, true),
  ('chinese-counter', 'Chinese', 'چائنیز', 'A wok counter running fried, sauced and rice dishes through both High Tea time slots.', 'soup', 4, true),
  ('italian-continental', 'Italian & Continental', 'ایٹالین این کانٹیننٹل', 'Hot continental favourites from the pizza and sandwich station.', 'bites', 5, true),
  ('salad-chaat', 'Salad & Chaat Section', 'سالیڈ اور چاٹ', 'Fresh fruit, chaat and chilled salads assembled at the live counter.', 'salad', 6, true),
  ('street-food', 'Street Food Special', 'اسٹریٹ فوڈ اسپیشل', 'Lahori street-food favourites fried and served throughout the High Tea slots.', 'bites', 7, true),
  ('variety-naans-meetha', 'Variety of Naans & Junooni Meetha', 'نان کی Variety اور جنونی میٹھا', 'A tandoor bread platter and the full dessert cabinet, from continental cakes to warm mithai.', 'dessert', 8, true),
  ('beverages-counter', 'Beverages', 'مشروبات', 'Tea and green tea kept coming for the length of the High Tea service.', 'drink', 9, true),
  ('chef-special', 'Chef Special', 'چیف اسپیشل', 'The kitchen''s à la carte signatures, prepared with home-made desi ghee.', 'flame', 10, true),
  ('appetizers', 'Appetizers', 'اپیٹائزرز', 'The table''s opening course: fries, stuffed naan and grilled wings.', 'bites', 11, true),
  ('veg-lentils', 'Vegetables & Lentils', 'سبزیاں اور دال', 'Slow-cooked daals and spinach dishes finished with butter and desi ghee.', 'pot', 12, true),
  ('junooni-tandoor', 'Junooni Tandoor', 'جنونی تندور', 'Breads pulled to order from the clay tandoor and finished with house ghee.', 'bread', 13, true),
  ('salads', 'Salads', 'سالیڈز', 'Raita and fresh salads to begin an à la carte meal.', 'salad', 14, true),
  ('desserts-signature', 'Desserts & Signature Dessert', 'میٹھا اور سیگنیچر ڈیسرٹ', 'The final sweet course, from slow-reduced kheer to the Junooni signature cheesecake.', 'dessert', 15, true),
  ('drinks', 'Drinks', 'مشروبات', 'Chilled water, soft drinks and house refreshers for the à la carte table.', 'drink', 16, true)
on conflict (id) do update set
  name = excluded.name,
  urdu = excluded.urdu,
  blurb = excluded.blurb,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- 3. Signature trigger is paused for the batch, then restored below.
-- ---------------------------------------------------------------------------
do $$
declare sig record;
begin
  for sig in
    select t.tgname from pg_trigger t
    where t.tgrelid = 'public.menu_dishes'::regclass
      and not t.tgisinternal
      and t.tgname ilike '%signature%'
  loop
    execute format('drop trigger if exists %I on public.menu_dishes', sig.tgname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. All 90 menu items. The first 57 are live High Tea station
--    items and the final 33 are the priced à la carte menu. Names, sections and
--    prices are exact, and every row carries the demo photo the guest menu
--    shows — a loaded database should look like the designed menu, not a wall
--    of empty tiles.
--
--    `image` is the Unsplash demo photo, built from the photo id in the rows
--    below so the URL is identical to the one `src/lib/menu.ts` serves. A real
--    upload lives in `image_path` and wins: the update branch leaves `image`
--    alone when the row has an uploaded object, so re-running this loader can
--    never shadow a photo the owner uploaded through the admin panel.
--
--    Generated by tools/generate-menu-sql.mjs — edit src/lib/menu.ts, not this.
-- ---------------------------------------------------------------------------
insert into public.menu_dishes as md
  (slug, name, urdu, category_id, summary, description, notes, pairings, image,
   image_path, price_per_plate, active, featured, demo, sort_order, updated_at)
select d.slug, d.name, d.urdu, d.category_id, d.summary,
       d.summary || ' Prepared fresh by the Junoon kitchen and served with the care befitting the house.',
       '[]'::jsonb, '[]'::jsonb,
       'https://images.unsplash.com/' || d.photo || '?auto=format&fit=crop&w=1200&q=70',
       null, d.price, true, d.featured, true, d.sort_order,
       (extract(epoch from now()) * 1000)::bigint
from (values
  ('lemonade-slush', 'Lemonade Slush', 'لیمونیڈ سلش', 'welcome-drinks', null, false, 1, 'photo-1546173159-315724a31696', 'Iced lemon crushed to a slush with mint.'),
  ('mint-margarita-high-tea', 'Mint Margarita (5 Servings)', 'منٹ مارگریٹا', 'welcome-drinks', null, false, 2, 'photo-1544145945-f90425340c7e', 'The welcome pour, served in five servings.'),
  ('chicken-corn-soup', 'Chicken Corn Soup', 'چکن کورن سوپ', 'soup-counter', null, false, 3, 'photo-1543339308-43e59d6b73a6', 'Clear chicken soup with sweet corn and white pepper.'),
  ('hot-n-sour-soup', 'Hot N Sour Soup', 'ہاٹ این سور سوپ', 'soup-counter', null, false, 4, 'photo-1610057099443-fde8c4d50f91', 'A sharp, gently hot broth with egg ribbons.'),
  ('seekh-kabab-of-the-day', 'Seekh Kabab of the Day', 'سیخ کباب آف دا ڈے', 'junooni-special-counter', null, false, 5, 'photo-1512058564366-18510be2db19', 'Minced seekh kabab prepared fresh at the live counter.'),
  ('chicken-boti-of-the-day', 'Chicken Boti of the Day', 'چکن بوتی آف دا ڈے', 'junooni-special-counter', null, false, 6, 'photo-1555939594-58d7cb561ad1', 'Tender chicken boti grilled to order.'),
  ('chicken-karahi-counter', 'Chicken Karahi', 'چکن کڑاہی', 'junooni-special-counter', null, false, 7, 'photo-1606491956689-2ea866880c84', 'Wok-cooked chicken karahi with ginger and green chilli.'),
  ('chicken-drumstick', 'Drumstick', 'ڈرم اسٹک', 'chinese-counter', null, false, 8, 'photo-1585937421612-70a008356fbe', 'Crisp fried chicken drumstick from the Chinese counter.'),
  ('fried-chicken', 'Fried Chicken', 'فرائڈ چکن', 'chinese-counter', null, false, 9, 'photo-1600891964092-4316c288032e', 'Crisp-crumbed chicken fried in small batches.'),
  ('chicken-manchurian', 'Chicken Manchurian', 'چکن مانچورین', 'chinese-counter', null, false, 10, 'photo-1565557623262-b51c2513a641', 'Fried chicken tossed in a hot garlic sauce.'),
  ('oyster-chicken', 'Oyster Chicken', 'ا oyster چکن', 'chinese-counter', null, false, 11, 'photo-1565557623262-b51c2513a641', 'Chicken in a savoury oyster sauce.'),
  ('stir-fried-chicken', 'Stir Fried Chicken', 'اسٹر فرائیڈ چکن', 'chinese-counter', null, false, 12, 'photo-1585032226651-759b368d7246', 'Chicken tossed with vegetables over a fierce wok flame.'),
  ('szechuan-chicken', 'Szechuan Chicken', 'سچوان چکن', 'chinese-counter', null, false, 13, 'photo-1504674900247-0877df9cc836', 'Chicken with a peppery Szechuan-style finish.'),
  ('egg-fried-rice', 'Egg Fried Rice', 'ایگ فرائز رائس', 'chinese-counter', null, false, 14, 'photo-1603133872878-684f208fb84b', 'Wok-tossed rice with egg and vegetables.'),
  ('vegetable-fried-rice', 'Vegetable Fried Rice', 'ویجیٹیبل فرائز رائس', 'chinese-counter', null, false, 15, 'photo-1603133872878-684f208fb84b', 'Vegetable rice tossed with soy and spring onion.'),
  ('steamed-rice', 'Steamed Rice', 'بخار بند چاول', 'chinese-counter', null, false, 16, 'photo-1626074353765-517a681e40be', 'Plain steamed rice served warm.'),
  ('vegetable-chowmein', 'Vegetable Chowmein', 'ویجیٹیبل چومین', 'chinese-counter', null, false, 17, 'photo-1497636577773-f1231844b336', 'Egg noodles tossed with vegetables and soy.'),
  ('chicken-pepper-steak', 'Chicken Pepper Steak', 'چکن پیپر اسٹیک', 'italian-continental', null, false, 18, 'photo-1504674900247-0877df9cc836', 'Chicken with peppers in a savoury sauce.'),
  ('pizza-of-the-day', 'Pizza of the Day', 'پیزہ آف دا ڈے', 'italian-continental', null, false, 19, 'photo-1495521821757-a1efb6729352', 'The day''s pizza, baked and served hot.'),
  ('chicken-sandwich', 'Chicken Sandwich', 'چکن سینڈوچ', 'italian-continental', null, false, 20, 'photo-1608198093002-ad4e005484ec', 'Grilled chicken in a fresh sandwich.'),
  ('club-sandwich', 'Club Sandwich', 'کلب سینڈوچ', 'italian-continental', null, false, 21, 'photo-1608198093002-ad4e005484ec', 'A layered sandwich with chicken and fresh salad.'),
  ('fruit-chaat', 'Fruit Chaat', 'فرٹ چاٹ', 'salad-chaat', null, false, 22, 'photo-1414235077428-338989a2e8c0', 'Seasonal fruit with chaat masala and imli.'),
  ('dahi-bhalay', 'Dahi Bhalay', 'دہی بڑے', 'salad-chaat', null, false, 23, 'photo-1476224203421-9ac39bcb3327', 'Soft lentil dumplings under chilled yoghurt.'),
  ('dahi-phulkian', 'Dahi Phulkian', 'دہی پھولکیاں', 'salad-chaat', null, false, 24, 'photo-1476224203421-9ac39bcb3327', 'The classic tangy dahi phulkian.'),
  ('channa-chaat', 'Channa Chaat', 'چنا چاٹ', 'salad-chaat', null, false, 25, 'photo-1599487488170-d11ec9c172f0', 'Chickpeas, tomato, onion and bright chaat dressing.'),
  ('apple-cabbage-salad', 'Apple Cabbage Salad', 'ایپل کیبج سالیڈ', 'salad-chaat', null, false, 26, 'photo-1512621776951-a57141f2eefd', 'Crunchy apple and cabbage with a fresh dressing.'),
  ('red-bean-salad', 'Red Bean Salad', 'ریڈ بین سالیڈ', 'salad-chaat', null, false, 27, 'photo-1512621776951-a57141f2eefd', 'Red bean salad with herbs and a light dressing.'),
  ('french-potato-salad', 'French Potato Salad', 'فرنچ پٹیٹو سالیڈ', 'salad-chaat', null, false, 28, 'photo-1512621776951-a57141f2eefd', 'Potato salad dressed the French way.'),
  ('fresh-green-salad-counter', 'Fresh Green Salad', 'تازہ گرین سالیڈ', 'salad-chaat', null, false, 29, 'photo-1540189549336-e6e99c3679fe', 'Fresh green leaves and vegetables from the counter.'),
  ('mango-cucumber-salad', 'Mango & Cucumber Salad', 'آم اور خربازہ سالیڈ', 'salad-chaat', null, false, 30, 'photo-1540189549336-e6e99c3679fe', 'Sweet mango with cool cucumber and herbs.'),
  ('greek-potato-salad', 'Greek Potato Salad', 'یونانی پٹیٹو سالیڈ', 'salad-chaat', null, false, 31, 'photo-1512621776951-a57141f2eefd', 'Potato salad with Greek-style seasoning.'),
  ('crispy-potato-salad', 'Crispy Potato Salad', 'کرسپی پٹیٹو سالیڈ', 'salad-chaat', null, false, 32, 'photo-1512621776951-a57141f2eefd', 'Crisp potatoes folded through a fresh salad dressing.'),
  ('turkish-salad', 'Turkish Salad', 'ترکش سالیڈ', 'salad-chaat', null, false, 33, 'photo-1540189549336-e6e99c3679fe', 'A bright Turkish-style salad with herbs.'),
  ('shawarma', 'Shawarma', 'شاورما', 'street-food', null, true, 34, 'photo-1615719413546-198b25453f85', 'Spit-roasted chicken shaved into a warm wrap.'),
  ('aloo-samosa', 'Aloo Samosa', 'آلو سموسہ', 'street-food', null, false, 35, 'photo-1546793665-c74683f339c1', 'Spiced potato samosa fried to order.'),
  ('lahori-fries-counter', 'Lahori Fries', 'لاہوری فرائز', 'street-food', null, false, 36, 'photo-1546069901-ba9599a7e63c', 'Double-fried Lahori fries with chaat masala.'),
  ('lahori-pakora', 'Pakora', 'پکوڑا', 'street-food', null, false, 37, 'photo-1546793665-c74683f339c1', 'Crisp onion pakoras fried in small batches.'),
  ('gol-gappay', 'Gol Gappay', 'گول گپے', 'street-food', null, false, 38, 'photo-1604909052743-94e838986d24', 'Crisp shells with spiced water and tamarind.'),
  ('variety-of-naans', 'Variety of Naans', 'نان کی Variety', 'variety-naans-meetha', null, false, 39, 'photo-1509440159596-0249088772ff', 'A platter of the tandoor''s breads.'),
  ('tiramisu-counter', 'Tiramisu', 'ٹیرامیسو', 'variety-naans-meetha', null, false, 40, 'photo-1565958011703-44f9829ba187', 'Espresso-soaked sponge with mascarpone and cocoa.'),
  ('croquembouche-counter', 'Croquembouche', 'کروکمبوش', 'variety-naans-meetha', null, false, 41, 'photo-1571877227200-a0d98ea607e9', 'A cream-puff tower bound with spun sugar.'),
  ('cold-om-ali', 'Cold Om Ali', '-cold اوم علی', 'variety-naans-meetha', null, false, 42, 'photo-1563805042-7684c019e1cb', 'A chilled layered dessert with milk and crumbs.'),
  ('bread-pudding', 'Bread Pudding', 'بریڈ پڈنگ', 'variety-naans-meetha', null, false, 43, 'photo-1565958011703-44f9829ba187', 'Warm bread pudding with cream and sauce.'),
  ('coconut-turkish-custard-pudding', 'Coconut Turkish Custard Pudding', 'کوکونٹ ترکش کسٹرڈ پڈنگ', 'variety-naans-meetha', null, false, 44, 'photo-1621263764928-df1444c5e859', 'Silky coconut custard set smooth and chilled.'),
  ('chocolate-meringue-pudding', 'Chocolate Meringue Pudding', 'چاکلیٹ مرنگ پڈنگ', 'variety-naans-meetha', null, false, 45, 'photo-1565958011703-44f9829ba187', 'Chocolate pudding finished with crisp meringue.'),
  ('doughnut', 'Doughnut', 'ڈونٹ', 'variety-naans-meetha', null, false, 46, 'photo-1571877227200-a0d98ea607e9', 'A soft doughnut from the dessert cabinet.'),
  ('cake-of-the-day', 'Cake of the Day', 'کیک آف دا ڈے', 'variety-naans-meetha', null, false, 47, 'photo-1565958011703-44f9829ba187', 'The day''s cake, served in slices.'),
  ('pastries', 'Pastries', 'پیسٹری', 'variety-naans-meetha', null, false, 48, 'photo-1571877227200-a0d98ea607e9', 'A selection of freshly baked pastries.'),
  ('variety-tart', 'Variety Tart', 'ٹارٹ کی Variety', 'variety-naans-meetha', null, false, 49, 'photo-1571877227200-a0d98ea607e9', 'A selection of sweet and savoury tarts.'),
  ('fruit-trifle', 'Fruit Trifle', 'فرٹ ٹرائیفل', 'variety-naans-meetha', null, false, 50, 'photo-1563805042-7684c019e1cb', 'Fruit, cream and sponge in a glass bowl.'),
  ('jelly', 'Jelly', 'جیلی', 'variety-naans-meetha', null, false, 51, 'photo-1501443762994-82bd5dace89a', 'A bright fruit jelly served chilled.'),
  ('brownies-counter', 'Brownies', 'براؤنز', 'variety-naans-meetha', null, false, 52, 'photo-1551024506-0bccd828d307', 'Warm dark chocolate brownies with a fudgy centre.'),
  ('gulab-jamun-counter', 'Gulab Jamun', 'گلاب جامن', 'variety-naans-meetha', null, false, 53, 'photo-1488900128323-21503983a07e', 'Warm milk dumplings in cardamom syrup.'),
  ('kulfa-counter', 'Kulfa', 'کلفا', 'variety-naans-meetha', null, false, 54, 'photo-1621263764928-df1444c5e859', 'Dense milk kulfi served cold.'),
  ('flavoured-ice-cream', 'Flavoured Ice Cream', 'فلاورڈ آئس کریم', 'variety-naans-meetha', null, false, 55, 'photo-1501443762994-82bd5dace89a', 'A choice of flavoured ice creams.'),
  ('tea-counter', 'Tea', 'چای', 'beverages-counter', null, false, 56, 'photo-1544787219-7f47ccb76574', 'Tea pulled in a glass, the Lahori way.'),
  ('green-tea-counter', 'Green Tea', 'گرین ٹی', 'beverages-counter', null, false, 57, 'photo-1476718406336-bb5a9690ee2a', 'Freshly brewed green tea.'),
  ('roasted-mutton-joints', 'Roasted Mutton Joints (1 pc)', 'بھونے ہوئے گوشت', 'chef-special', 1495, false, 58, 'photo-1555939594-58d7cb561ad1', 'Oven-roasted mutton joint, charred at the edges.'),
  ('mutton-kunna', 'Mutton Kunna', 'مٹن کنّا', 'chef-special', 4095, true, 59, 'photo-1606491956689-2ea866880c84', 'Mutton simmered to the bone in a deep gravy.'),
  ('mutton-dum-wala', 'Mutton Dum Wala', 'مٹن ڈم والا', 'chef-special', 6985, false, 60, 'photo-1603894584373-5ac82b2ae398', 'Sealed under dough and steam-cooked until tender.'),
  ('junooni-royal-platter', 'Junooni Royal Platter (6 persons serving)', 'جنونی رائل پلیٹر', 'chef-special', 11495, false, 61, 'photo-1541529086526-db283c563270', 'The full table arranged for six persons.'),
  ('fries', 'Fries', 'فرائز', 'appetizers', 625, false, 62, 'photo-1546069901-ba9599a7e63c', 'Thick-cut, double-fried and salted at the pass.'),
  ('qeema-naan-chicken', 'Qeema Naan Chicken', 'کیما نان چکن', 'appetizers', 845, false, 63, 'photo-1572449043416-55f4685c9bb7', 'Minced chicken baked inside the naan.'),
  ('cheese-naan', 'Cheese Naan', 'چیز نان', 'appetizers', 865, false, 64, 'photo-1495521821757-a1efb6729352', 'Naan stuffed with mozzarella and cheddar.'),
  ('qeema-naan-beef', 'Qeema Naan Beef', 'کیما نان بیف', 'appetizers', 975, false, 65, 'photo-1608039755401-742074f0548d', 'Slow-cooked minced beef baked inside the naan.'),
  ('bbq-wings', 'BBQ Wings (8 pcs)', 'بی بی کوونگز', 'appetizers', 1345, true, 66, 'photo-1512058564366-18510be2db19', 'Charcoal-grilled wings with a sticky barbecue glaze.'),
  ('dal-makhni', 'Dall Makhni', 'دال مکھنی', 'veg-lentils', 1355, false, 67, 'photo-1563379091339-03b21ab4a4f8', 'Black lentils simmered overnight and finished with cream.'),
  ('palak-paneer', 'Palak Paneer', 'پالک پنیر', 'veg-lentils', 1355, false, 68, 'photo-1517248135467-4c7edcad34c4', 'House paneer folded through slow-cooked spinach.'),
  ('junooni-special-daal', 'Junooni Special Daal', 'جنونی اسپیشل دال', 'veg-lentils', 1355, false, 69, 'photo-1563379091339-03b21ab4a4f8', 'The house dal with butter, ghee and warming spice.'),
  ('tandoori-roti', 'Tandoori Roti', 'تندوری روٹی', 'junooni-tandoor', 95, false, 70, 'photo-1549931319-a545dcf3bc73', 'The everyday roti pulled straight from the clay.'),
  ('plain-naan', 'Plain Naan', 'سادہ نان', 'junooni-tandoor', 125, false, 71, 'photo-1509440159596-0249088772ff', 'Rested overnight, blistered and pulled to order.'),
  ('roghni-naan', 'Roghni Naan', 'روغنی نان', 'junooni-tandoor', 165, false, 72, 'photo-1549931319-a545dcf3bc73', 'Naan folded back into the tandoor with ghee.'),
  ('garlic-naan', 'Garlic Naan', 'گارلک نان', 'junooni-tandoor', 195, false, 73, 'photo-1495521821757-a1efb6729352', 'Garlic and coriander worked into the dough.'),
  ('kalwanji-naan', 'Kalwanji Naan', 'کلوانجی نان', 'junooni-tandoor', 195, false, 74, 'photo-1608039755401-742074f0548d', 'A crisp, ghee-rich tandoori naan.'),
  ('tandoori-pratha', 'Tandoori Pratha', 'تندوری پراٹھا', 'junooni-tandoor', 355, false, 75, 'photo-1549931319-a545dcf3bc73', 'Layered paratha cooked against the tandoor wall.'),
  ('special-desi-ghee-roti', 'Special Roti with Desi Ghee', 'سپیشل روٹی ڈیسی گھی', 'junooni-tandoor', 355, false, 76, 'photo-1608198093002-ad4e005484ec', 'A special roti finished generously with desi ghee.'),
  ('raita', 'Raita', 'رائتہ', 'salads', 295, false, 77, 'photo-1476224203421-9ac39bcb3327', 'Whisked yoghurt with cucumber, mint and cumin.'),
  ('yogurt-salad', 'Yogurt Salad', 'یوگرٹ سالیڈ', 'salads', 305, false, 78, 'photo-1540189549336-e6e99c3679fe', 'Beetroot, cucumber and fruit folded through yoghurt.'),
  ('fresh-garden-salad', 'Fresh Garden Salad', 'تازہ گارڈن سالیڈ', 'salads', 365, false, 79, 'photo-1512621776951-a57141f2eefd', 'A fresh garden salad with seasonal leaves.'),
  ('fresh-green-salad', 'Fresh Green Salad', 'تازہ گرین سالیڈ', 'salads', 365, false, 80, 'photo-1540189549336-e6e99c3679fe', 'Cucumber, tomato, onion and green chilli.'),
  ('junooni-kheer', 'Junooni Kheer', 'جنونی کھیر', 'desserts-signature', 765, false, 81, 'photo-1621263764928-df1444c5e859', 'Rice pudding reduced for hours with saffron and nuts.'),
  ('rasmalai', 'Rasmalai', 'رسمالائی', 'desserts-signature', 765, false, 82, 'photo-1563805042-7684c019e1cb', 'Cottage-cheese dumplings in saffron milk.'),
  ('piping-hot-gulab-jamun', 'Piping Hot Gulab Jamun', 'گرم گلاب جامن', 'desserts-signature', 765, false, 83, 'photo-1488900128323-21503983a07e', 'Gulab jamun served hot in cardamom syrup.'),
  ('san-sebastian-cheesecake', 'San Sebastian Cheese Cake', 'سین سیباسٹین چیز کیک', 'desserts-signature', 1145, true, 84, 'photo-1601050690597-df0568f70950', 'Burnt on top, barely set and served near the centre.'),
  ('water-small', 'Water Small', 'چھوٹا پانی', 'drinks', 105, false, 85, 'photo-1546173159-315724a31696', 'Chilled small bottle of mineral water.'),
  ('water-large', 'Water (Large)', 'بڑا پانی', 'drinks', 195, false, 86, 'photo-1546173159-315724a31696', 'Chilled large bottle of mineral water.'),
  ('soft-drinks', 'Soft Drinks', 'سافٹ ڈرنکس', 'drinks', 195, false, 87, 'photo-1546173159-315724a31696', 'Chilled soft drinks served with ice.'),
  ('karak-chai', 'Karak Chai', 'کراک چائے', 'drinks', 245, false, 88, 'photo-1544787219-7f47ccb76574', 'The pink chai pulled between two vessels.'),
  ('frrsh-lime-soda', 'Frrsh Lime Soda', 'فریش لائم سوڈا', 'drinks', 275, false, 89, 'photo-1546173159-315724a31696', 'Fresh lime soda with a bright citrus finish.'),
  ('mint-margarita', 'Mint Margarita', 'منٹ مارگریٹا', 'drinks', 445, false, 90, 'photo-1544145945-f90425340c7e', 'Tequila, lime and mint shaken to order.')
) as d(slug, name, urdu, category_id, price, featured, sort_order, photo, summary)
on conflict (slug) do update set
  name = excluded.name,
  urdu = excluded.urdu,
  category_id = excluded.category_id,
  summary = excluded.summary,
  description = excluded.description,
  notes = excluded.notes,
  pairings = excluded.pairings,
  image = case when md.image_path is null then excluded.image else md.image end,
  price_per_plate = excluded.price_per_plate,
  active = true,
  featured = excluded.featured,
  demo = true,
  sort_order = excluded.sort_order,
  updated_at = excluded.updated_at;

-- ---------------------------------------------------------------------------
-- 5. Four-signature limit, restored after the batch.
-- ---------------------------------------------------------------------------
create or replace function public.tribe_limit_signature_dishes() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not new.featured then return new; end if;
  else
    if not new.featured or old.featured then return new; end if;
  end if;
  if (select count(*) from public.menu_dishes where featured and slug <> new.slug) >= 4 then
    raise exception 'Only four signature dishes are allowed. Clear one before featuring another.';
  end if;
  return new;
end $$;
drop trigger if exists menu_dishes_signature_limit on public.menu_dishes;
create trigger menu_dishes_signature_limit
  before insert or update of featured on public.menu_dishes
  for each row execute function public.tribe_limit_signature_dishes();

-- ---------------------------------------------------------------------------
-- 6. Verification. Expect 16 active official sections, 90 published items,
--    and four signatures.
-- ---------------------------------------------------------------------------
select 'official_sections' as what, count(*) filter (where active and id <> 'uncategorized') as rows
from public.menu_categories
union all
select 'official_dishes', count(*)
from public.menu_dishes d
join public.menu_categories c on c.id = d.category_id
where c.active and c.id <> 'uncategorized'
union all
select 'signatures', count(*) from public.menu_dishes where featured;

select c.id, c.name, c.sort_order,
       count(d.slug) filter (where d.active) as live_items,
       count(d.slug) as total_items
from public.menu_categories c
left join public.menu_dishes d on d.category_id = c.id
where c.id <> 'uncategorized'
group by c.id, c.name, c.sort_order
order by c.sort_order;
