-- ============================================================================
-- JUNOON — complete official menu structure and seed
--
-- High Tea: Seasons Special High Tea — Rs 1,895 + tax
-- Time slots: 03:30–05:00 pm and 05:15–06:45 pm
--
-- This script is safe to run repeatedly. It creates the two menu tables when
-- missing, keeps the uncategorized parking row, retires obsolete starter
-- sections, upserts the 16 active official sections, upserts all 87 menu items,
-- preserves the four-signature limit, and publishes a verification summary.
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
-- 4. All 90 menu items. The first 57 are live High Tea station items and the
--    final 33 are the priced à la carte menu. Names and prices are exact.
-- ---------------------------------------------------------------------------
insert into public.menu_dishes
  (slug, name, urdu, category_id, summary, description, notes, pairings, image,
   image_path, price_per_plate, active, featured, demo, sort_order, updated_at)
select d.slug, d.name, null, d.category_id, d.name, d.name, '[]'::jsonb,
       '[]'::jsonb, null, null, d.price, true, d.featured, true, d.sort_order,
       (extract(epoch from now()) * 1000)::bigint
from (values
  ('lemonade-slush', 'Lemonade Slush', 'welcome-drinks', null, false, 1),
  ('mint-margarita-high-tea', 'Mint Margarita (5 Servings)', 'welcome-drinks', null, false, 2),
  ('chicken-corn-soup', 'Chicken Corn Soup', 'soup-counter', null, false, 3),
  ('hot-n-sour-soup', 'Hot N Sour Soup', 'soup-counter', null, false, 4),
  ('seekh-kabab-of-the-day', 'Seekh Kabab of the Day', 'junooni-special-counter', null, false, 5),
  ('chicken-boti-of-the-day', 'Chicken Boti of the Day', 'junooni-special-counter', null, false, 6),
  ('chicken-karahi-counter', 'Chicken Karahi', 'junooni-special-counter', null, false, 7),
  ('chicken-drumstick', 'Drumstick', 'chinese-counter', null, false, 8),
  ('fried-chicken', 'Fried Chicken', 'chinese-counter', null, false, 9),
  ('chicken-manchurian', 'Chicken Manchurian', 'chinese-counter', null, false, 10),
  ('oyster-chicken', 'Oyster Chicken', 'chinese-counter', null, false, 11),
  ('stir-fried-chicken', 'Stir Fried Chicken', 'chinese-counter', null, false, 12),
  ('szechuan-chicken', 'Szechuan Chicken', 'chinese-counter', null, false, 13),
  ('egg-fried-rice', 'Egg Fried Rice', 'chinese-counter', null, false, 14),
  ('vegetable-fried-rice', 'Vegetable Fried Rice', 'chinese-counter', null, false, 15),
  ('steamed-rice', 'Steamed Rice', 'chinese-counter', null, false, 16),
  ('vegetable-chowmein', 'Vegetable Chowmein', 'chinese-counter', null, false, 17),
  ('chicken-pepper-steak', 'Chicken Pepper Steak', 'italian-continental', null, false, 18),
  ('pizza-of-the-day', 'Pizza of the Day', 'italian-continental', null, false, 19),
  ('chicken-sandwich', 'Chicken Sandwich', 'italian-continental', null, false, 20),
  ('club-sandwich', 'Club Sandwich', 'italian-continental', null, false, 21),
  ('fruit-chaat', 'Fruit Chaat', 'salad-chaat', null, false, 22),
  ('dahi-bhalay', 'Dahi Bhalay', 'salad-chaat', null, false, 23),
  ('dahi-phulkian', 'Dahi Phulkian', 'salad-chaat', null, false, 24),
  ('channa-chaat', 'Channa Chaat', 'salad-chaat', null, false, 25),
  ('apple-cabbage-salad', 'Apple Cabbage Salad', 'salad-chaat', null, false, 26),
  ('red-bean-salad', 'Red Bean Salad', 'salad-chaat', null, false, 27),
  ('french-potato-salad', 'French Potato Salad', 'salad-chaat', null, false, 28),
  ('fresh-green-salad-counter', 'Fresh Green Salad', 'salad-chaat', null, false, 29),
  ('mango-cucumber-salad', 'Mango & Cucumber Salad', 'salad-chaat', null, false, 30),
  ('greek-potato-salad', 'Greek Potato Salad', 'salad-chaat', null, false, 31),
  ('crispy-potato-salad', 'Crispy Potato Salad', 'salad-chaat', null, false, 32),
  ('turkish-salad', 'Turkish Salad', 'salad-chaat', null, false, 33),
  ('shawarma', 'Shawarma', 'street-food', null, true, 34),
  ('aloo-samosa', 'Aloo Samosa', 'street-food', null, false, 35),
  ('lahori-fries-counter', 'Lahori Fries', 'street-food', null, false, 36),
  ('lahori-pakora', 'Pakora', 'street-food', null, false, 37),
  ('gol-gappay', 'Gol Gappay', 'street-food', null, false, 38),
  ('variety-of-naans', 'Variety of Naans', 'variety-naans-meetha', null, false, 39),
  ('tiramisu-counter', 'Tiramisu', 'variety-naans-meetha', null, false, 40),
  ('croquembouche-counter', 'Croquembouche', 'variety-naans-meetha', null, false, 41),
  ('cold-om-ali', 'Cold Om Ali', 'variety-naans-meetha', null, false, 42),
  ('bread-pudding', 'Bread Pudding', 'variety-naans-meetha', null, false, 43),
  ('coconut-turkish-custard-pudding', 'Coconut Turkish Custard Pudding', 'variety-naans-meetha', null, false, 44),
  ('chocolate-meringue-pudding', 'Chocolate Meringue Pudding', 'variety-naans-meetha', null, false, 45),
  ('doughnut', 'Doughnut', 'variety-naans-meetha', null, false, 46),
  ('cake-of-the-day', 'Cake of the Day', 'variety-naans-meetha', null, false, 47),
  ('pastries', 'Pastries', 'variety-naans-meetha', null, false, 48),
  ('variety-tart', 'Variety Tart', 'variety-naans-meetha', null, false, 49),
  ('fruit-trifle', 'Fruit Trifle', 'variety-naans-meetha', null, false, 50),
  ('jelly', 'Jelly', 'variety-naans-meetha', null, false, 51),
  ('brownies-counter', 'Brownies', 'variety-naans-meetha', null, false, 52),
  ('gulab-jamun-counter', 'Gulab Jamun', 'variety-naans-meetha', null, false, 53),
  ('kulfa-counter', 'Kulfa', 'variety-naans-meetha', null, false, 54),
  ('flavoured-ice-cream', 'Flavoured Ice Cream', 'variety-naans-meetha', null, false, 55),
  ('tea-counter', 'Tea', 'beverages-counter', null, false, 56),
  ('green-tea-counter', 'Green Tea', 'beverages-counter', null, false, 57),
  ('roasted-mutton-joints', 'Roasted Mutton Joints (1 pc)', 'chef-special', 1495, false, 58),
  ('mutton-kunna', 'Mutton Kunna', 'chef-special', 4095, true, 59),
  ('mutton-dum-wala', 'Mutton Dum Wala', 'chef-special', 6985, false, 60),
  ('junooni-royal-platter', 'Junooni Royal Platter (6 persons serving)', 'chef-special', 11495, false, 61),
  ('fries', 'Fries', 'appetizers', 625, false, 62),
  ('qeema-naan-chicken', 'Qeema Naan Chicken', 'appetizers', 845, false, 63),
  ('cheese-naan', 'Cheese Naan', 'appetizers', 865, false, 64),
  ('qeema-naan-beef', 'Qeema Naan Beef', 'appetizers', 975, false, 65),
  ('bbq-wings', 'BBQ Wings (8 pcs)', 'appetizers', 1345, true, 66),
  ('dal-makhni', 'Dall Makhni', 'veg-lentils', 1355, false, 67),
  ('palak-paneer', 'Palak Paneer', 'veg-lentils', 1355, false, 68),
  ('junooni-special-daal', 'Junooni Special Daal', 'veg-lentils', 1355, false, 69),
  ('tandoori-roti', 'Tandoori Roti', 'junooni-tandoor', 95, false, 70),
  ('plain-naan', 'Plain Naan', 'junooni-tandoor', 125, false, 71),
  ('roghni-naan', 'Roghni Naan', 'junooni-tandoor', 165, false, 72),
  ('garlic-naan', 'Garlic Naan', 'junooni-tandoor', 195, false, 73),
  ('kalwanji-naan', 'Kalwanji Naan', 'junooni-tandoor', 195, false, 74),
  ('tandoori-pratha', 'Tandoori Pratha', 'junooni-tandoor', 355, false, 75),
  ('special-desi-ghee-roti', 'Special Roti with Desi Ghee', 'junooni-tandoor', 355, false, 76),
  ('raita', 'Raita', 'salads', 295, false, 77),
  ('yogurt-salad', 'Yogurt Salad', 'salads', 305, false, 78),
  ('fresh-garden-salad', 'Fresh Garden Salad', 'salads', 365, false, 79),
  ('fresh-green-salad', 'Fresh Green Salad', 'salads', 365, false, 80),
  ('junooni-kheer', 'Junooni Kheer', 'desserts-signature', 765, false, 81),
  ('rasmalai', 'Rasmalai', 'desserts-signature', 765, false, 82),
  ('piping-hot-gulab-jamun', 'Piping Hot Gulab Jamun', 'desserts-signature', 765, false, 83),
  ('san-sebastian-cheesecake', 'San Sebastian Cheese Cake', 'desserts-signature', 1145, true, 84),
  ('water-small', 'Water Small', 'drinks', 105, false, 85),
  ('water-large', 'Water (Large)', 'drinks', 195, false, 86),
  ('soft-drinks', 'Soft Drinks', 'drinks', 195, false, 87),
  ('karak-chai', 'Karak Chai', 'drinks', 245, false, 88),
  ('frrsh-lime-soda', 'Frrsh Lime Soda', 'drinks', 275, false, 89),
  ('mint-margarita', 'Mint Margarita', 'drinks', 445, false, 90)
) as d(slug, name, category_id, price, featured, sort_order)
on conflict (slug) do update set
  name = excluded.name,
  category_id = excluded.category_id,
  summary = excluded.summary,
  description = excluded.description,
  notes = excluded.notes,
  pairings = excluded.pairings,
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
select 'official_dishes', count(*) from public.menu_dishes
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
