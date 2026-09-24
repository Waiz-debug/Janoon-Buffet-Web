-- ============================================================================
--  JUNOON — official menu loader
--
--  Writes the official catalogue into the two tables the app reads:
--  `menu_categories` (five live High Tea counters plus six main-menu sections)
--  and `menu_dishes` (the items, each filed under a section through
--  `category_id`). Fifty-two dishes, exact à la carte prices, an Unsplash
--  photo each, and four signature dishes for the guest page's Signatures strip.
--
--  Run it once in the Supabase SQL editor (Database → SQL Editor → paste → Run)
--  and the guest site shows the official menu. The admin panel edits these very
--  rows, so every section, price, photo and re-mapping is editable afterwards.
--
--  Why this file when the app has a button
--  ---------------------------------------
--  Admin → Menu → "Load the official menu" writes the same rows from
--  src/lib/menu.ts, and is the normal way in. This file is the route for a
--  project whose *app* writes are being refused — a missing write policy, a
--  stale trigger — because it runs as the table owner, where row level security
--  does not apply and no signed-in account can block it. The data below was
--  generated from that same catalogue, so the two stay in step.
--
--  Safe to run more than once
--  ---------------------------
--  Sections are written by their primary key and dishes by their slug, so a
--  re-run refreshes these official rows in place instead of creating a second
--  set beside them. A dish the owner added themselves has its own slug and is
--  left alone. It does overwrite the text and photo of the official rows
--  themselves — it is a catalogue loader, not a migration.
--
--  The two schema things the app depends on are (re)created here as well: the
--  unique index on `menu_dishes.slug`, and the four-signature-dish limit.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  1. The home section for items whose section was removed
--
--  Switched off, so guests never see it. `deleteCategory()` in the app parks
--  items here before deleting a section, which is why it has to exist.
-- ---------------------------------------------------------------------------
insert into public.menu_categories (id, name, urdu, blurb, icon, sort_order, active)
values (
  'uncategorized', 'Other', 'دیگر',
  'Dishes whose section was removed from the menu.', 'flame', 99, false
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
--  2. The official sections: five live counters followed by six main-menu
--    sections. Written by primary key, so re-running renames and re-orders
--    them in place.
-- ---------------------------------------------------------------------------
insert into public.menu_categories (id, name, urdu, blurb, icon, sort_order, active)
values
  ('welcome-drinks', 'Welcome Drink & Beverages', 'خوش آمدید مشروبات', 'The first glass of the evening — a cold welcome drink poured as you sit down, and the teas kept coming all night.', 'drink', 1, true),
  ('chinese-counter', 'Soup & Chinese Counter', 'سوپ اور چائنیز کاؤنٹر', 'Hot soups at the front of the line, and a wok station that works through fried rice, chowmein and Manchurian to order.', 'soup', 2, true),
  ('salad-chaat', 'Salad & Chaat Section', 'سالیڈ اور چاٹ', 'Fruit and channa chaat built in front of you, dahi bhalay kept cool, and the fresh salads cut on the stone.', 'salad', 3, true),
  ('street-tandoor', 'Street Food & Tandoor Station', 'اسٹریٹ فوڈ اور تندور اسٹیشن', 'Shawarma off the spit, samosa and gol gappay fried in small batches, and a tandoor pulled straight to the table.', 'bites', 4, true),
  ('meetha-station', 'Desserts & Meetha Station', 'میٹھا اسٹیشن', 'The continental counter and the Pakistani mithai cabinet side by side — cakes, brownies, and gulab jamun still warm.', 'dessert', 5, true),
  ('chef-special', 'Chef Special', 'چیف اسپیشل', 'The dishes the kitchen would put its name to, from a long-roasted mutton joint to the Junooni Royal Platter.', 'flame', 6, true),
  ('appetizers', 'Appetizers', 'اپیٹائزرز', 'To start with — fries, stuffed naan and wings, all of them easy to share across the table before the mains land.', 'bites', 7, true),
  ('veg-lentils', 'Vegetables & Lentils', 'سبزی اور دال', 'Slow-cooked lentils and spinach dishes, rich with butter and finished by hand — the vegetarian heart of the menu.', 'pot', 8, true),
  ('junooni-tandoor', 'Junooni Tandoor', 'جنونی تندور', 'The tandoor banked at opening and never let go out. Every bread here is pulled to order and blistered in the heat.', 'bread', 9, true),
  ('salads-desserts', 'Salads & Desserts', 'سالیڈ اور میٹھا', 'Cool raita and yogurt salad to start, and a short list of desserts worth saving room for.', 'salad', 10, true),
  ('drinks', 'Drinks', 'مشروبات', 'Water, soft drinks, karak chai pulled until it foams, and the house Margarita for the table that wants something longer.', 'drink', 11, true)
on conflict (id) do update
   set name       = excluded.name,
       urdu       = excluded.urdu,
       blurb      = excluded.blurb,
       icon       = excluded.icon,
       sort_order = excluded.sort_order,
       active     = excluded.active;


-- ---------------------------------------------------------------------------
--  3. `menu_dishes.slug` has to be unique
--
--  Every path to a dish — edit it, hide it, move it to another section, price
--  it, delete it — looks it up by slug, and step 4 resolves conflicts on it.
--  `create table if not exists` never adds a constraint to a table that already
--  exists, so a project created from an older copy of the schema can be missing
--  it, which is also why the app's own dish writes were being rejected.
--
--  Duplicate slugs are reported rather than deleted: which row the owner meant
--  to keep is their call, not this script's.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.menu_dishes group by slug having count(*) > 1
  ) then
    raise warning
      'menu_dishes holds duplicate slugs — the unique index was skipped and step 4 will be refused. The duplicates are listed below; rename or delete them, then re-run this file.';
  else
    execute
      'create unique index if not exists menu_dishes_slug_key on public.menu_dishes (slug)';
    raise notice 'menu_dishes slug index: ready';
  end if;
end $$;

select slug, count(*) as rows
  from public.menu_dishes
 group by slug
having count(*) > 1
 order by slug;


-- ---------------------------------------------------------------------------
--  4. The four-signature-dish limit, paused for the load
--
--  The trigger counts featured rows as they go in, so a single statement that
--  features four dishes can trip the limit halfway through and take the whole
--  write with it. It is dropped here and re-created in step 6, so the loader
--  cannot be refused by a copy of the rule that counts differently. Any other
--  trigger on the table is left alone.
-- ---------------------------------------------------------------------------
do $$
declare
  sig record;
begin
  for sig in
    select t.tgname
      from pg_trigger t
     where t.tgrelid = 'public.menu_dishes'::regclass
       and not t.tgisinternal
       and t.tgname ilike '%signature%'
  loop
    execute format('drop trigger if exists %I on public.menu_dishes', sig.tgname);
    raise notice 'paused trigger % for the load', sig.tgname;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
--  5. The official dishes
--
--  slug, name, urdu, section, summary, description, photo, per-plate price,
--  signature, order. Every dish is published (`active` is set true below), so
--  the guest menu draws all of them the moment this finishes.
--
--  `demo = true` marks the photograph as a placeholder, which is what the admin
--  panel uses to flag rows worth replacing with the kitchen's own pictures.
-- ---------------------------------------------------------------------------
insert into public.menu_dishes
  (slug, name, urdu, category_id, summary, description, image, price_per_plate,
   active, featured, demo, sort_order, updated_at)
select
  d.slug, d.name, d.urdu, d.category_id, d.summary, d.description, d.image,
  d.price_per_plate, true, d.featured, true, d.sort_order,
  (extract(epoch from now()) * 1000)::bigint
  from (values
    ('lemonade-slush', 'Lemonade Slush', 'لیمونیڈ سلش', 'welcome-drinks', 'Iced lemon, crushed to a slush, with a mint top.', 'Fresh lemon squeezed to order, blended with crushed ice and a little sugar until it pours like snow, finished with mint and a slice of lemon on the rim. The glass the whole table starts with.', 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=1200&q=70', 450, false, 1),
    ('mint-margarita-station', 'Mint Margarita', 'منٹ مارگریٹا', 'welcome-drinks', 'The welcome pour — tequila, lime and mint, crushed to order.', 'Tequila, fresh lime and a fistful of mint shaken hard with ice until it frosts the glass, then poured over fresh crushed ice. Served at the counter as the welcome drink, and the same recipe with a little more lime as a plated drink further down the menu.', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=70', 650, false, 2),
    ('tea', 'Tea', 'چای', 'welcome-drinks', 'Pulled in a glass, the way every Lahori table takes it.', 'Loose-leaf tea boiled with milk and poured between two vessels until it turns the colour of rose and a skin of foam sits on top. Sugar to the house standard, and the pot refilled for as long as you are sitting.', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=70', 120, false, 3),
    ('green-tea', 'Green Tea', 'گرین ٹی', 'welcome-drinks', 'Sugar-free, lightly brewed, good after the meal.', 'Green tea brewed gently so it does not turn bitter, served without sugar and hot in a small pot. The pot most guests ask for once the barbecue is finished.', 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=1200&q=70', 140, false, 4),
    ('chicken-corn-soup', 'Chicken Corn Soup', 'چکن کورن سوپ', 'chinese-counter', 'Clear, sweet and hot — the first thing off the counter.', 'Chicken stock kept clear rather than creamed, with corn, egg and a little white pepper, thickened just enough to hold a spoon upright. Served in a warmed bowl with spring onion, the way it should be at the start of a cold evening.', 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=1200&q=70', 480, false, 5),
    ('hot-n-sour-soup', 'Hot & Sour Soup', 'ہاٹ این سور سوپ', 'chinese-counter', 'Sharp, a little hot, with egg ribbons through it.', 'A darker broth sharpened with vinegar and chilli, with shredded chicken, mushroom and fine ribbons of egg stirred through at the last moment. The one to order when the table wants a soup with an opinion.', 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=1200&q=70', 520, false, 6),
    ('fried-chicken', 'Fried Chicken', 'فرائڈ چکن', 'chinese-counter', 'Crisp-crumbed pieces, fried to order.', 'Chicken breast and thigh dipped in a seasoned crumb and fried in small batches so the crust is still loud when it reaches the table. Served with a wedge of lemon and a cup of dip from the counter.', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=70', 780, false, 7),
    ('chicken-drumstick', 'Chicken Drumstick', 'چکن ڈرم اسٹک', 'chinese-counter', 'One drumstick, fried hard and salted at the pass.', 'A single large drumstick brined overnight, crumbed and fried until the skin is brittle, then salted and served immediately. The one the children negotiate over, and the easiest thing to eat standing at the counter.', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=70', 650, false, 8),
    ('manchurian', 'Chicken Manchurian', 'چکن مانچورین', 'chinese-counter', 'Deep-fried chicken in a hot, glossy garlic sauce.', 'Battered chicken tossed in a wok with garlic, ginger and chilli in a sauce that clings to every piece, finished with spring onion. Dry or with gravy, and eaten straight from the bowl while the sauce is still moving.', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1200&q=70', 850, false, 9),
    ('fried-rice', 'Egg Fried Rice', 'ایگ فرائز رائس', 'chinese-counter', 'Wok-tossed rice with egg, spring onion and carrot.', 'Cold cooked rice taken hot to the wok with egg, spring onion, carrot and a little soy, tossed over a fierce flame so the grains separate and catch. The default that goes with almost everything on this counter.', 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1200&q=70', 720, false, 10),
    ('chowmein', 'Chicken Chowmein', 'چکن چومین', 'chinese-counter', 'Egg noodles, tossed with vegetables and chicken.', 'Boiled egg noodles tossed in the wok with shredded chicken, cabbage, carrot and spring onion in a light soy and garlic sauce. Served without gravy, the way it is meant to be — the noodles should run free on the plate.', 'https://images.unsplash.com/photo-1497636577773-f1231844b336?auto=format&fit=crop&w=1200&q=70', 780, false, 11),
    ('fruit-chaat', 'Fruit Chaat', 'فرٹ چاٹ', 'salad-chaat', 'Seasonal fruit, chaat masala and a cold, sharp finish.', 'Whatever is best that morning — apple, banana, papaya, guava, pomegranate — tossed with chaat masala, mint, imli and a little rock salt so it tastes sharp rather than sweet. Assembled in front of you so the fruit never sits and bleeds colour.', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=70', 550, false, 12),
    ('dahi-bhalay', 'Dahi Bhalay', 'دہی بڑے', 'salad-chaat', 'Soft lentil dumplings under thick, chilled yoghurt.', 'Lentil dumplings soaked until pillowy, laid in a bowl and drowned in thick whisked yoghurt, then finished with imli chutney, roasted cumin and a scatter of crisp boondi. The coolest thing at the counter and the one the whole table shares first.', 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=70', 450, false, 13),
    ('channa-chaat', 'Channa Chaat', 'چنا چاٹ', 'salad-chaat', 'Chickpeas, tomato, onion and a bright, tangy dressing.', 'Boiled chickpeas tossed with tomato, onion, green chilli, chaat masala, coriander and a squeeze of lemon, with imli poured over at the table. Heavier and sharper than fruit chaat, and the version to order if you want the full Lahore street-food flavour.', 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=1200&q=70', 520, false, 14),
    ('russian-salad', 'Russian Salad', 'روسیئن سالیڈ', 'salad-chaat', 'Potato, carrot and egg under a light mayonnaise dressing.', 'Boiled potato, carrot and peas folded with egg and a light mayonnaise dressing, rested cold so the flavours settle, then finished with a little mustard. The salad that appears on every High Tea table in the country, made properly.', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=70', 650, false, 15),
    ('greek-salad', 'Greek Salad', 'یونانی سالیڈ', 'salad-chaat', 'Tomato, cucumber, olives and feta, dressed at the stone.', 'Tomato, cucumber, capsicum, red onion and kalamata olives, with feta cut over the top and dressed with olive oil, oregano and lemon at the stone. Lighter and sharper than the Russian salad, and the one to order with grilled meat.', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=70', 700, false, 16),
    ('shawarma', 'Chicken Shawarma', 'چکن شاورما', 'street-tandoor', 'Spit-roasted chicken, shaved into a wrap at the counter.', 'Chicken marinated overnight in garlic, lemon and yoghurt, roasted on the spit all day and shaved to order into a hot flatbread with garlic sauce, pickles, tomato and a line of tahini. Wrapped in paper the way it is eaten on the street, and worth eating that way too.', 'https://images.unsplash.com/photo-1615719413546-198b25453f85?auto=format&fit=crop&w=1200&q=70', 650, true, 17),
    ('aloo-samosa', 'Aloo Samosa', 'آلو سموسہ', 'street-tandoor', 'Two samosas, fried in small batches, with chutney.', 'Flour shells filled with spiced potato and peas, folded by hand and fried in small batches through the evening so the crust is still crackling in the hand. Served two to an order with mint chutney and a wedge of lime.', 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=1200&q=70', 300, false, 18),
    ('lahori-fries', 'Lahori Fries', 'لاہوری فرائز', 'street-tandoor', 'Double-fried, dusted chaat masala, served in a cup.', 'Thick-cut potatoes fried twice so they hold their shape, salted and dusted with chaat masala while still hot, with a small cup of ketchup and a green chutney alongside. Ate standing at the counter, as they should be.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=70', 625, false, 19),
    ('gol-gappay', 'Gol Gappay', 'گول گپے', 'street-tandoor', 'Crisp shells, spiced water, six to an order.', 'Small shells fried to order — puffed, hollow and brittle — served six to an order with a bowl of spiced water, tamarind, mint and a little chaat masala to pour in yourself. The shell collapses into the water between your fingers and the plate.', 'https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=1200&q=70', 480, false, 20),
    ('variety-of-naans', 'Variety of Naans', 'نان کی Variety', 'street-tandoor', 'A platter of the tandoor''s breads, four kinds on one plate.', 'One of each of the tandoor''s breads — plain, roghni, garlic and cheese — pulled in the same run so they arrive hot together on a single platter. The way to try the whole tandoor at once before choosing one for the table.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=70', 595, false, 21),
    ('tiramisu', 'Tiramisu', 'ٹیرامیسو', 'meetha-station', 'Espresso-soaked sponge, mascarpone, cocoa.', 'Sponge soaked in espresso and left to drink it, layered with whipped mascarpone and set overnight, dusted with cocoa at the counter. Cut to order — the first dessert of the evening that is not mithai, and the one that disappears first.', 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1200&q=70', 895, false, 22),
    ('croquembouche', 'Croquembouche', 'کروکمبوش', 'meetha-station', 'A tower of cream puffs held together with spun sugar.', 'Choux puffs filled with vanilla cream, stacked into a tower and bound with spun sugar drawn out warm at the counter — a piece that is meant to be carried to the table whole and taken apart in front of everyone. Ordered for celebrations; a day''s notice helps.', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=70', 1095, false, 23),
    ('brownies', 'Brownies with Ice Cream', 'براؤنز آئس کریم کے ساتھ', 'meetha-station', 'Warm dark brownies, ice cream, chocolate sauce.', 'Dark chocolate brownies baked in a small tray so the middle stays fudgy, served warm with a scoop of vanilla ice cream and warm chocolate sauce poured over at the table. The plate that needs no explanation at the end of a long dinner.', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=70', 750, false, 24),
    ('gulab-jamun', 'Gulab Jamun', 'گلاب جامن', 'meetha-station', 'Warm milk dumplings in cardamom syrup.', 'Khoya dumplings fried to a deep amber and soaked in warm cardamom and rose syrup until they have doubled in size, served warm in the syrup with a spoon of rabri if you want it. Made in small batches through the evening so they are never more than a few minutes old.', 'https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=1200&q=70', 420, false, 25),
    ('kulfa', 'Kulfa', 'کلفا', 'meetha-station', 'Dense milk kulfi, cut from the slab.', 'Milk kulfi cooked down slowly until it is almost a solid, poured over ice in a tall glass and cut straight from the slab — dense, cold and slow-melting, with rose and pistachio if you want them. The cheapest thing on the counter and the most ordered.', 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=1200&q=70', 650, false, 26),
    ('roasted-mutton-joints', 'Roasted Mutton Joints', 'بھونے ہوئے گوشت', 'chef-special', 'Oven-roasted, charred at the edges, three joints to an order.', 'Mutton joints marinated overnight in yoghurt, ginger and garlic, then roasted hard until the fat renders and the outside catches at the edges while the meat falls from the bone. Finished with a little butter and coriander at the pass, and eaten with a tandoori roti in hand.', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=70', 1495, false, 27),
    ('mutton-kunna', 'Mutton Kunna', 'مٹن کنّا', 'chef-special', 'Mutton simmered to the bone in a pale, deep-flavoured gravy.', 'The old Lahori way: mutton on the bone cooked down for hours until the marrow gives and the gravy turns deep and soft, then finished with fried onion, green chilli and a little cream. Nothing is added at the end to hide what the pot has done — this one is a matter of time.', 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=1200&q=70', 4095, true, 28),
    ('mutton-dum-wala', 'Mutton Dum Wala', 'مٹن ڈم والا', 'chef-special', 'Sealed under dough, steam-cooked until it gives.', 'Mutton layered with fried onions, whole spices and potatoes, the pan sealed under a flour dough and left on the lowest heat to steam in its own juices for hours. The seal is broken at the table; the first smell that comes off it is the reason this dish is on every wedding menu in the city.', 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=1200&q=70', 6985, false, 29),
    ('junooni-royal-platter', 'Junooni Royal Platter', 'جنونی رائل پلیٹر', 'chef-special', 'The full table — grill, handi, tandoor and meetha on one board.', 'The kitchen''s own table, laid out for the room: charcoal grill, a handi of mutton, breads off the tandoor, salad and a sweet to finish, arranged so everything is reached at once and nothing is passed around twice. The one to order when a table wants the whole restaurant in a single sitting.', 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=1200&q=70', 11495, false, 30),
    ('fries', 'Fries', 'فرائز', 'appetizers', 'Thick-cut, double-fried, salted at the pass.', 'Thick-cut potatoes fried twice for a crisp shell and a soft middle, salted and served in a paper-lined basket with ketchup and a garlic aioli. Simple, done properly, and the thing the table shares before anything else arrives.', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=70', 625, false, 31),
    ('qeema-naan-chicken', 'Qeema Naan Chicken', 'کیما نان چکن', 'appetizers', 'Minced chicken baked inside the naan.', 'The same stuffed-naan method as the tandoor''s special, filled with slow-cooked minced chicken, green chilli and coriander, then baked and brushed with butter. Folded rather than sliced, so the first thing you do is pull it apart over the plate.', 'https://images.unsplash.com/photo-1608039755401-742074f0548d?auto=format&fit=crop&w=1200&q=70', 845, false, 32),
    ('cheese-naan', 'Cheese Naan', 'چیز نان', 'appetizers', 'Stuffed with a blend of mozzarella and cheddar.', 'Naan stuffed with mozzarella and cheddar, sealed and baked until the cheese has melted completely and the bread outside has blistered. The cheese pulls in one long string, which is the whole point and the reason the table stops talking.', 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=70', 865, false, 33),
    ('qeema-naan-beef', 'Qeema Naan Beef', 'کیما نان بیف', 'appetizers', 'Slow-cooked minced beef, baked inside the naan.', 'Minced beef cooked long and slow with onion, tomato and green chilli until it is dark and spiced, then baked inside the naan under the same hard heat as the rest of the tandoor. Richer and more strongly spiced than the chicken version, and ordered by the grown-ups.', 'https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?auto=format&fit=crop&w=1200&q=70', 975, false, 34),
    ('bbq-wings', 'BBQ Wings', 'بی بی کوونگز', 'appetizers', 'Charcoal-grilled, sticky glaze, six to an order.', 'Wings marinated overnight, grilled over charcoal until the skin is lacquered and the edges catch, then tossed in a sticky barbecue glaze at the pass. Six to an order, served hot, and gone before the rest of the table has settled in.', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=70', 1345, true, 35),
    ('dal-makhni', 'Dal Makhni', 'دال مکھنی', 'veg-lentils', 'Black lentils simmered overnight, finished with cream.', 'Urad dal soaked, simmered slowly to a dark, thick paste and finished with butter and a long swirl of cream just before service. The tempering of garlic and chilli poured over at the table is the last thing that happens to it.', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=70', 1355, false, 36),
    ('palak-paneer', 'Palak Paneer', 'پالک پنیر', 'veg-lentils', 'House paneer in slow-cooked spinach.', 'Spinach cooked down slowly so it keeps its colour, blended with ginger and garlic, then finished with a touch of butter and cream. The paneer is set in the kitchen each morning and cut in at the pass so it goes in whole.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=70', 1355, false, 37),
    ('junooni-special-daal', 'Junooni Special Daal', 'جنونی اسپیشل دال', 'veg-lentils', 'The house dal — moong and masoor, butter and spice.', 'Moong and masoor lentils cooked with tomato, ginger and a red chilli that is soaked rather than dried, then finished with butter, ghee and coriander. Ordered at almost every table in the house, and the reason the tandoor is kept so busy.', 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=1200&q=70', 1355, false, 38),
    ('tandoori-roti', 'Tandoori Roti', 'تندوری روٹی', 'junooni-tandoor', 'The everyday roti, straight from the clay.', 'Flour, salt and water, rolled thin and pulled straight from the tandoor wall. Plain, hot and soft, and the bread the daal at this table is meant to be eaten with.', 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=70', 95, false, 39),
    ('plain-naan', 'Plain Naan', 'سادہ نان', 'junooni-tandoor', 'Rested overnight, blistered, pulled to order.', 'Flour, yoghurt and a little mustard oil, rested overnight so the dough keeps its shape, then slapped onto the tandoor wall. Puffy in the middle, crisp at the edges, and the bread everything else on this menu is ordered with.', 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=1200&q=70', 125, false, 40),
    ('roghni-naan', 'Roghni Naan', 'روغنی نان', 'junooni-tandoor', 'Drizzled with ghee and folded in the tandoor.', 'Naan brought out of the tandoor, drenched in ghee and folded back in for a few seconds so the ghee soaks through rather than sitting on the surface. Heavier, richer and more forgiving of a long dinner than plain naan.', 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=70', 165, false, 41),
    ('garlic-naan', 'Garlic Naan', 'گارلک نان', 'junooni-tandoor', 'Garlic butter worked into the dough before baking.', 'Garlic and coriander beaten into soft butter and worked into the naan before it goes near the tandoor, so the flavour is in the bread rather than brushed on afterwards. Pulled with a butter-soaked edge and a scatter of green coriander on top.', 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=70', 195, false, 42),
    ('tandoori-pratha', 'Tandoori Pratha', 'تندوری پراٹھا', 'junooni-tandoor', 'Layered, ghee-soaked, cooked on the tandoor wall.', 'A hundred and twenty layers folded by hand, rolled thin and cooked against the tandoor wall until the edges crisp and the layers separate. Served hot with a spoon of white butter, and the one the whole table shares before the mains.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=70', 355, false, 43),
    ('raita', 'Raita', 'رائتہ', 'salads-desserts', 'Whisked yoghurt with cucumber, mint and roasted cumin.', 'Yoghurt whisked smooth with cucumber, mint, green chilli and a spoon of roasted cumin, served cold in a small bowl. It goes on the table before anything else and is still there at the end of the meal.', 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=70', 295, false, 44),
    ('yogurt-salad', 'Yogurt Salad', 'یوگرٹ سالیڈ', 'salads-desserts', 'Beetroot, cucumber and fruit folded through yoghurt.', 'Diced cucumber, beetroot, onion and a little fruit folded through thick yoghurt with mint and a squeeze of lime, so it is sweet and sharp at once. Served cold, and the one salad the children actually ask for again.', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=70', 305, false, 45),
    ('junooni-kheer', 'Junooni Kheer', 'جنونی کھیر', 'salads-desserts', 'Rice pudding reduced for hours, saffron and nuts.', 'Full-cream milk reduced with broken rice for hours until it thickens to a pale gold, then perfumed with saffron, cardamom and slivered almonds, and served chilled in small bowls. Made every morning in the same pot the kitchen has used for years.', 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=1200&q=70', 765, false, 46),
    ('rasmalai', 'Rasmalai', 'رسمالائی', 'salads-desserts', 'Cottage-cheese dumplings in saffron milk.', 'Chenna worked into soft, cheese-like dumplings, poached gently and served warm in rabri — milk reduced with saffron, cardamom and a little pistachio. Cold on top, sweet underneath, and finished as a proper dinner should be.', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=70', 765, false, 47),
    ('san-sebastian-cheesecake', 'San Sebastian Cheese Cake', 'سین سیباسٹین چیز کیک', 'salads-desserts', 'Burnt on top, barely set, served near the centre.', 'The Spanish style: a batter pushed almost to the top of a very hot tray, baked until the surface is scorched dark and the middle barely sets. Cut in thin wedges at the counter and served barely cold, which is the only temperature it is right at.', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=70', 1145, true, 48),
    ('water', 'Water', 'پانی', 'drinks', 'Chilled mineral water, still or sparkling.', 'Chilled mineral water in its bottle, still or sparkling, brought to the table with the order. Nothing about it needs explaining, which is why it is worth putting on the menu at all.', 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1200&q=70', 100, false, 49),
    ('soft-drinks', 'Soft Drinks', 'سافٹ ڈرنکس', 'drinks', 'Cans and bottles, chilled to the temperature of the ice box.', 'The usual selection of chilled soft drinks — cola, lemon-lime and orange — kept in the ice box rather than the fridge so they arrive at the temperature people actually want. Served in the can or with ice and a straw.', 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=1200&q=70', 180, false, 50),
    ('karak-chai', 'Karak Chai', 'کراک چائے', 'drinks', 'The pink one, pulled between two vessels.', 'Loose-leaf tea boiled with milk and then pulled — poured high from one glass into another — until it froths and turns the colour of rose, with cardamom and sugar to the house standard. Served in a glass, and never in a pot.', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=1200&q=70', 220, false, 51),
    ('mint-margarita', 'Mint Margarita', 'منٹ مارگریٹا', 'drinks', 'Tequila, lime and mint, shaken to order.', 'The counter''s welcome pour, made to the full measure: tequila shaken with fresh lime and mint until the glass frosts, poured over crushed ice and finished with a lime wheel. Order it long if the table is in the mood to stay a while.', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=70', 680, false, 52)
  ) as d(slug, name, urdu, category_id, summary, description, image,
        price_per_plate, featured, sort_order)
on conflict (slug) do update
   set name            = excluded.name,
       urdu            = excluded.urdu,
       category_id     = excluded.category_id,
       summary         = excluded.summary,
       description     = excluded.description,
       image           = excluded.image,
       price_per_plate = excluded.price_per_plate,
       active          = true,
       featured        = excluded.featured,
       demo            = true,
       sort_order      = excluded.sort_order,
       updated_at      = excluded.updated_at;


-- ---------------------------------------------------------------------------
--  6. The four-signature-dish limit, back on
--
--  The guest page's Signatures strip holds exactly four, and this is the rule
--  that keeps it there. It counts the *other* featured rows, so a dish never
--  blocks its own save.
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
--  7. What landed
--
--  Expect eleven active official sections and fifty-two dishes, four of them
--  signatures. The guest site and both admin boards read these same rows over
--  the shared realtime channel, so they change the moment this finishes — no
--  redeploy, no refresh for anyone.
-- ---------------------------------------------------------------------------
select
  'categories' as what,
  count(*)                        as rows,
  count(*) filter (where active)  as published
  from public.menu_categories
union all
select
  'dishes',
  count(*),
  count(*) filter (where active)
  from public.menu_dishes;

select
  'signatures' as what,
  count(*)     as rows
  from public.menu_dishes
 where featured;

-- Every section with the number of items filed under it, from the read-only
-- overview view (created by supabase/counters.sql).
select
  c.id,
  c.name,
  c.sort_order,
  c.active,
  count(d.slug) filter (where d.active) as live_items,
  count(d.slug)                        as total_items
  from public.menu_categories c
  left join public.menu_dishes d on d.category_id = c.id
 group by c.id, c.name, c.sort_order, c.active
 order by c.sort_order, c.name;
