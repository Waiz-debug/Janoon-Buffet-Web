/**
 * JUNOON's official menu catalogue.
 *
 * The first nine sections are live High Tea stations. The remaining seven are
 * à la carte sections. The distinction is carried in the stable category ids
 * and order; the database stores both in menu_categories and every item in
 * menu_dishes, so the admin board and guest site read the same rows.
 *
 * High Tea items have no individual price: they are included in the
 * Seasons Special High Tea seat price of Rs 1,895 + tax. Their database price
 * is therefore null and the guest cart does not offer them as standalone
 * delivery items. A la carte rows carry the exact published prices.
 */

export type CategoryId =
  // Counters — live High Tea stations
  | "welcome-drinks"
  | "soup-counter"
  | "junooni-special-counter"
  | "chinese-counter"
  | "italian-continental"
  | "salad-chaat"
  | "street-food"
  | "variety-naans-meetha"
  | "beverages-counter"
  // Main menu — à la carte
  | "chef-special"
  | "appetizers"
  | "veg-lentils"
  | "junooni-tandoor"
  | "salads"
  | "desserts-signature"
  | "drinks";

export type MenuIcon =
  | "drink"
  | "soup"
  | "salad"
  | "bites"
  | "dessert"
  | "flame"
  | "pot"
  | "bread";

export type MenuCategory = {
  id: CategoryId;
  name: string;
  urdu: string;
  blurb: string;
  icon: MenuIcon;
};

export type WeightOption = {
  id: string;
  label: string;
  priceDelta: number;
};

export type Dish = {
  slug: string;
  name: string;
  urdu: string;
  categoryId: CategoryId;
  summary: string;
  description: string;
  notes: { label: string; value: string }[];
  pairings: string[];
  image: string;
  pricePerPlate?: number | null;
  weights?: WeightOption[];
};

/**
 * Demo food photography, straight from Unsplash's CDN.
 *
 * Every dish below carries one of these so the guest menu looks like the
 * designed menu rather than a wall of empty tiles — on the site and, once the
 * seed has run, in the database too: `seedMenuCatalog()` writes the same URL
 * into `menu_dishes.image`, and `supabase/official-menu.sql` is generated from
 * this file by `tools/generate-menu-sql.mjs`, so the SQL copy cannot drift.
 *
 * They are placeholders by design: an upload in the admin panel writes
 * `image_path` and clears `image`, which is what takes over once the kitchen
 * has real photographs.
 */
const unsplash = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;

/**
 * The same photo at thumbnail width.
 *
 * A counter row shows the dish at 56px, and there is no reason for a phone to
 * pull a 1200px file to fill a 56px box. Only the demo URLs carry a `w=` to
 * rewrite; a photo uploaded through the admin panel is served exactly as it was
 * stored, whatever size that is.
 */
export function photoThumb(url: string, width = 240): string {
  return url.replace(/([?&])w=\d+/, `$1w=${width}`);
}

const IMG = {
  lemonade: unsplash("photo-1546173159-315724a31696"),
  cocktail: unsplash("photo-1544145945-f90425340c7e"),
  tea: unsplash("photo-1544787219-7f47ccb76574"),
  greenTea: unsplash("photo-1476718406336-bb5a9690ee2a"),
  soup: unsplash("photo-1543339308-43e59d6b73a6"),
  soup2: unsplash("photo-1610057099443-fde8c4d50f91"),
  friedChicken: unsplash("photo-1600891964092-4316c288032e"),
  drumstick: unsplash("photo-1585937421612-70a008356fbe"),
  manchurian: unsplash("photo-1565557623262-b51c2513a641"),
  friedRice: unsplash("photo-1603133872878-684f208fb84b"),
  chowmein: unsplash("photo-1497636577773-f1231844b336"),
  chaat: unsplash("photo-1414235077428-338989a2e8c0"),
  dahi: unsplash("photo-1476224203421-9ac39bcb3327"),
  channa: unsplash("photo-1599487488170-d11ec9c172f0"),
  salad: unsplash("photo-1512621776951-a57141f2eefd"),
  greenSalad: unsplash("photo-1540189549336-e6e99c3679fe"),
  shawarma: unsplash("photo-1615719413546-198b25453f85"),
  samosa: unsplash("photo-1546793665-c74683f339c1"),
  fries: unsplash("photo-1546069901-ba9599a7e63c"),
  golGappay: unsplash("photo-1604909052743-94e838986d24"),
  bread: unsplash("photo-1509440159596-0249088772ff"),
  bakery: unsplash("photo-1495521821757-a1efb6729352"),
  flatbread: unsplash("photo-1549931319-a545dcf3bc73"),
  breadBasket: unsplash("photo-1608039755401-742074f0548d"),
  breadRoll: unsplash("photo-1608198093002-ad4e005484ec"),
  stuffedBread: unsplash("photo-1572449043416-55f4685c9bb7"),
  grilled: unsplash("photo-1555939594-58d7cb561ad1"),
  grillPlate: unsplash("photo-1504674900247-0877df9cc836"),
  tandoori: unsplash("photo-1585032226651-759b368d7246"),
  meatBoard: unsplash("photo-1541529086526-db283c563270"),
  kebab: unsplash("photo-1512058564366-18510be2db19"),
  karahi: unsplash("photo-1606491956689-2ea866880c84"),
  curry: unsplash("photo-1563379091339-03b21ab4a4f8"),
  curry2: unsplash("photo-1517248135467-4c7edcad34c4"),
  curry3: unsplash("photo-1603894584373-5ac82b2ae398"),
  biryani: unsplash("photo-1626074353765-517a681e40be"),
  cake: unsplash("photo-1565958011703-44f9829ba187"),
  pastry: unsplash("photo-1571877227200-a0d98ea607e9"),
  brownie: unsplash("photo-1551024506-0bccd828d307"),
  mithai: unsplash("photo-1488900128323-21503983a07e"),
  iceCream: unsplash("photo-1501443762994-82bd5dace89a"),
  kulfi: unsplash("photo-1621263764928-df1444c5e859"),
  falooda: unsplash("photo-1563805042-7684c019e1cb"),
  cheesecake: unsplash("photo-1601050690597-df0568f70950"),
} as const;

export const MENU_CATEGORIES: MenuCategory[] = [
  { id: "welcome-drinks", name: "Welcome Drink", urdu: "خوش آمدید ڈرنک", blurb: "The first glass of the High Tea service — a five-serving welcome pour with every seat.", icon: "drink" },
  { id: "soup-counter", name: "Soup", urdu: "سوپ", blurb: "Hot soups served at the opening of the live High Tea service.", icon: "soup" },
  { id: "junooni-special-counter", name: "Junooni Special", urdu: "جنونی اسپیشل", blurb: "The kitchen's live mutton and charcoal specials, including the seekh kabab and chicken boti of the day.", icon: "flame" },
  { id: "chinese-counter", name: "Chinese", urdu: "چائنیز", blurb: "A wok counter running fried, sauced and rice dishes through both High Tea time slots.", icon: "soup" },
  { id: "italian-continental", name: "Italian & Continental", urdu: "ایٹالین این کانٹیننٹل", blurb: "Hot continental favourites from the pizza and sandwich station.", icon: "bites" },
  { id: "salad-chaat", name: "Salad & Chaat Section", urdu: "سالیڈ اور چاٹ", blurb: "Fresh fruit, chaat and chilled salads assembled at the live counter.", icon: "salad" },
  { id: "street-food", name: "Street Food Special", urdu: "اسٹریٹ فوڈ اسپیشل", blurb: "Lahori street-food favourites fried and served throughout the High Tea slots.", icon: "bites" },
  { id: "variety-naans-meetha", name: "Variety of Naans & Junooni Meetha", urdu: "نان کی Variety اور جنونی میٹھا", blurb: "A tandoor bread platter and the full dessert cabinet, from continental cakes to warm mithai.", icon: "dessert" },
  { id: "beverages-counter", name: "Beverages", urdu: "مشروبات", blurb: "Tea and green tea kept coming for the length of the High Tea service.", icon: "drink" },
  { id: "chef-special", name: "Chef Special", urdu: "چیف اسپیشل", blurb: "The kitchen's à la carte signatures, prepared with home-made desi ghee.", icon: "flame" },
  { id: "appetizers", name: "Appetizers", urdu: "اپیٹائزرز", blurb: "The table's opening course: fries, stuffed naan and grilled wings.", icon: "bites" },
  { id: "veg-lentils", name: "Vegetables & Lentils", urdu: "سبزیاں اور دال", blurb: "Slow-cooked daals and spinach dishes finished with butter and desi ghee.", icon: "pot" },
  { id: "junooni-tandoor", name: "Junooni Tandoor", urdu: "جنونی تندور", blurb: "Breads pulled to order from the clay tandoor and finished with house ghee.", icon: "bread" },
  { id: "salads", name: "Salads", urdu: "سالیڈز", blurb: "Raita and fresh salads to begin an à la carte meal.", icon: "salad" },
  { id: "desserts-signature", name: "Desserts & Signature Dessert", urdu: "میٹھا اور سیگنیچر ڈیسرٹ", blurb: "The final sweet course, from slow-reduced kheer to the Junooni signature cheesecake.", icon: "dessert" },
  { id: "drinks", name: "Drinks", urdu: "مشروبات", blurb: "Chilled water, soft drinks and house refreshers for the à la carte table.", icon: "drink" },
];

/**
 * The nine live High Tea stations, in service order — what the guest site shows
 * under "Live Imperial Counters".
 *
 * The seven à la carte sections are everything else in `MENU_CATEGORIES`, split
 * from that one list rather than typed out a second time, so a section can
 * never end up in both places or in neither.
 */
export const HIGH_TEA_COUNTER_IDS: readonly CategoryId[] = [
  "welcome-drinks",
  "soup-counter",
  "junooni-special-counter",
  "chinese-counter",
  "italian-continental",
  "salad-chaat",
  "street-food",
  "variety-naans-meetha",
  "beverages-counter",
];

/** The seven chapters of the à la carte board, in menu order. */
export const MAIN_MENU_IDS: readonly CategoryId[] = MENU_CATEGORIES.map(
  (category) => category.id,
).filter((id) => !HIGH_TEA_COUNTER_IDS.includes(id));

type DishSeed = readonly [slug: string, name: string, urdu: string, categoryId: CategoryId, summary: string, image: string, price: number | null];

const makeDish = ([slug, name, urdu, categoryId, summary, image, price]: DishSeed): Dish => ({
  slug,
  name,
  urdu,
  categoryId,
  summary,
  description: `${summary} Prepared fresh by the Junoon kitchen and served with the care befitting the house.`,
  notes: [],
  pairings: [],
  image,
  pricePerPlate: price,
});

export const DISHES: Dish[] = [
  makeDish(["lemonade-slush", "Lemonade Slush", "لیمونیڈ سلش", "welcome-drinks", "Iced lemon crushed to a slush with mint.", IMG.lemonade, null]),
  makeDish(["mint-margarita-high-tea", "Mint Margarita (5 Servings)", "منٹ مارگریٹا", "welcome-drinks", "The welcome pour, served in five servings.", IMG.cocktail, null]),
  makeDish(["chicken-corn-soup", "Chicken Corn Soup", "چکن کورن سوپ", "soup-counter", "Clear chicken soup with sweet corn and white pepper.", IMG.soup, null]),
  makeDish(["hot-n-sour-soup", "Hot N Sour Soup", "ہاٹ این سور سوپ", "soup-counter", "A sharp, gently hot broth with egg ribbons.", IMG.soup2, null]),
  makeDish(["seekh-kabab-of-the-day", "Seekh Kabab of the Day", "سیخ کباب آف دا ڈے", "junooni-special-counter", "Minced seekh kabab prepared fresh at the live counter.", IMG.kebab, null]),
  makeDish(["chicken-boti-of-the-day", "Chicken Boti of the Day", "چکن بوتی آف دا ڈے", "junooni-special-counter", "Tender chicken boti grilled to order.", IMG.grilled, null]),
  makeDish(["chicken-karahi-counter", "Chicken Karahi", "چکن کڑاہی", "junooni-special-counter", "Wok-cooked chicken karahi with ginger and green chilli.", IMG.karahi, null]),
  makeDish(["chicken-drumstick", "Drumstick", "ڈرم اسٹک", "chinese-counter", "Crisp fried chicken drumstick from the Chinese counter.", IMG.drumstick, null]),
  makeDish(["fried-chicken", "Fried Chicken", "فرائڈ چکن", "chinese-counter", "Crisp-crumbed chicken fried in small batches.", IMG.friedChicken, null]),
  makeDish(["chicken-manchurian", "Chicken Manchurian", "چکن مانچورین", "chinese-counter", "Fried chicken tossed in a hot garlic sauce.", IMG.manchurian, null]),
  makeDish(["oyster-chicken", "Oyster Chicken", "ا oyster چکن", "chinese-counter", "Chicken in a savoury oyster sauce.", IMG.manchurian, null]),
  makeDish(["stir-fried-chicken", "Stir Fried Chicken", "اسٹر فرائیڈ چکن", "chinese-counter", "Chicken tossed with vegetables over a fierce wok flame.", IMG.tandoori, null]),
  makeDish(["szechuan-chicken", "Szechuan Chicken", "سچوان چکن", "chinese-counter", "Chicken with a peppery Szechuan-style finish.", IMG.grillPlate, null]),
  makeDish(["egg-fried-rice", "Egg Fried Rice", "ایگ فرائز رائس", "chinese-counter", "Wok-tossed rice with egg and vegetables.", IMG.friedRice, null]),
  makeDish(["vegetable-fried-rice", "Vegetable Fried Rice", "ویجیٹیبل فرائز رائس", "chinese-counter", "Vegetable rice tossed with soy and spring onion.", IMG.friedRice, null]),
  makeDish(["steamed-rice", "Steamed Rice", "بخار بند چاول", "chinese-counter", "Plain steamed rice served warm.", IMG.biryani, null]),
  makeDish(["vegetable-chowmein", "Vegetable Chowmein", "ویجیٹیبل چومین", "chinese-counter", "Egg noodles tossed with vegetables and soy.", IMG.chowmein, null]),
  makeDish(["chicken-pepper-steak", "Chicken Pepper Steak", "چکن پیپر اسٹیک", "italian-continental", "Chicken with peppers in a savoury sauce.", IMG.grillPlate, null]),
  makeDish(["pizza-of-the-day", "Pizza of the Day", "پیزہ آف دا ڈے", "italian-continental", "The day's pizza, baked and served hot.", IMG.bakery, null]),
  makeDish(["chicken-sandwich", "Chicken Sandwich", "چکن سینڈوچ", "italian-continental", "Grilled chicken in a fresh sandwich.", IMG.breadRoll, null]),
  makeDish(["club-sandwich", "Club Sandwich", "کلب سینڈوچ", "italian-continental", "A layered sandwich with chicken and fresh salad.", IMG.breadRoll, null]),
  makeDish(["fruit-chaat", "Fruit Chaat", "فرٹ چاٹ", "salad-chaat", "Seasonal fruit with chaat masala and imli.", IMG.chaat, null]),
  makeDish(["dahi-bhalay", "Dahi Bhalay", "دہی بڑے", "salad-chaat", "Soft lentil dumplings under chilled yoghurt.", IMG.dahi, null]),
  makeDish(["dahi-phulkian", "Dahi Phulkian", "دہی پھولکیاں", "salad-chaat", "The classic tangy dahi phulkian.", IMG.dahi, null]),
  makeDish(["channa-chaat", "Channa Chaat", "چنا چاٹ", "salad-chaat", "Chickpeas, tomato, onion and bright chaat dressing.", IMG.channa, null]),
  makeDish(["apple-cabbage-salad", "Apple Cabbage Salad", "ایپل کیبج سالیڈ", "salad-chaat", "Crunchy apple and cabbage with a fresh dressing.", IMG.salad, null]),
  makeDish(["red-bean-salad", "Red Bean Salad", "ریڈ بین سالیڈ", "salad-chaat", "Red bean salad with herbs and a light dressing.", IMG.salad, null]),
  makeDish(["french-potato-salad", "French Potato Salad", "فرنچ پٹیٹو سالیڈ", "salad-chaat", "Potato salad dressed the French way.", IMG.salad, null]),
  makeDish(["fresh-green-salad-counter", "Fresh Green Salad", "تازہ گرین سالیڈ", "salad-chaat", "Fresh green leaves and vegetables from the counter.", IMG.greenSalad, null]),
  makeDish(["mango-cucumber-salad", "Mango & Cucumber Salad", "آم اور خربازہ سالیڈ", "salad-chaat", "Sweet mango with cool cucumber and herbs.", IMG.greenSalad, null]),
  makeDish(["greek-potato-salad", "Greek Potato Salad", "یونانی پٹیٹو سالیڈ", "salad-chaat", "Potato salad with Greek-style seasoning.", IMG.salad, null]),
  makeDish(["crispy-potato-salad", "Crispy Potato Salad", "کرسپی پٹیٹو سالیڈ", "salad-chaat", "Crisp potatoes folded through a fresh salad dressing.", IMG.salad, null]),
  makeDish(["turkish-salad", "Turkish Salad", "ترکش سالیڈ", "salad-chaat", "A bright Turkish-style salad with herbs.", IMG.greenSalad, null]),
  makeDish(["shawarma", "Shawarma", "شاورما", "street-food", "Spit-roasted chicken shaved into a warm wrap.", IMG.shawarma, null]),
  makeDish(["aloo-samosa", "Aloo Samosa", "آلو سموسہ", "street-food", "Spiced potato samosa fried to order.", IMG.samosa, null]),
  makeDish(["lahori-fries-counter", "Lahori Fries", "لاہوری فرائز", "street-food", "Double-fried Lahori fries with chaat masala.", IMG.fries, null]),
  makeDish(["lahori-pakora", "Pakora", "پکوڑا", "street-food", "Crisp onion pakoras fried in small batches.", IMG.samosa, null]),
  makeDish(["gol-gappay", "Gol Gappay", "گول گپے", "street-food", "Crisp shells with spiced water and tamarind.", IMG.golGappay, null]),
  makeDish(["variety-of-naans", "Variety of Naans", "نان کی Variety", "variety-naans-meetha", "A platter of the tandoor's breads.", IMG.bread, null]),
  makeDish(["tiramisu-counter", "Tiramisu", "ٹیرامیسو", "variety-naans-meetha", "Espresso-soaked sponge with mascarpone and cocoa.", IMG.cake, null]),
  makeDish(["croquembouche-counter", "Croquembouche", "کروکمبوش", "variety-naans-meetha", "A cream-puff tower bound with spun sugar.", IMG.pastry, null]),
  makeDish(["cold-om-ali", "Cold Om Ali", "-cold اوم علی", "variety-naans-meetha", "A chilled layered dessert with milk and crumbs.", IMG.falooda, null]),
  makeDish(["bread-pudding", "Bread Pudding", "بریڈ پڈنگ", "variety-naans-meetha", "Warm bread pudding with cream and sauce.", IMG.cake, null]),
  makeDish(["coconut-turkish-custard-pudding", "Coconut Turkish Custard Pudding", "کوکونٹ ترکش کسٹرڈ پڈنگ", "variety-naans-meetha", "Silky coconut custard set smooth and chilled.", IMG.kulfi, null]),
  makeDish(["chocolate-meringue-pudding", "Chocolate Meringue Pudding", "چاکلیٹ مرنگ پڈنگ", "variety-naans-meetha", "Chocolate pudding finished with crisp meringue.", IMG.cake, null]),
  makeDish(["doughnut", "Doughnut", "ڈونٹ", "variety-naans-meetha", "A soft doughnut from the dessert cabinet.", IMG.pastry, null]),
  makeDish(["cake-of-the-day", "Cake of the Day", "کیک آف دا ڈے", "variety-naans-meetha", "The day's cake, served in slices.", IMG.cake, null]),
  makeDish(["pastries", "Pastries", "پیسٹری", "variety-naans-meetha", "A selection of freshly baked pastries.", IMG.pastry, null]),
  makeDish(["variety-tart", "Variety Tart", "ٹارٹ کی Variety", "variety-naans-meetha", "A selection of sweet and savoury tarts.", IMG.pastry, null]),
  makeDish(["fruit-trifle", "Fruit Trifle", "فرٹ ٹرائیفل", "variety-naans-meetha", "Fruit, cream and sponge in a glass bowl.", IMG.falooda, null]),
  makeDish(["jelly", "Jelly", "جیلی", "variety-naans-meetha", "A bright fruit jelly served chilled.", IMG.iceCream, null]),
  makeDish(["brownies-counter", "Brownies", "براؤنز", "variety-naans-meetha", "Warm dark chocolate brownies with a fudgy centre.", IMG.brownie, null]),
  makeDish(["gulab-jamun-counter", "Gulab Jamun", "گلاب جامن", "variety-naans-meetha", "Warm milk dumplings in cardamom syrup.", IMG.mithai, null]),
  makeDish(["kulfa-counter", "Kulfa", "کلفا", "variety-naans-meetha", "Dense milk kulfi served cold.", IMG.kulfi, null]),
  makeDish(["flavoured-ice-cream", "Flavoured Ice Cream", "فلاورڈ آئس کریم", "variety-naans-meetha", "A choice of flavoured ice creams.", IMG.iceCream, null]),
  makeDish(["tea-counter", "Tea", "چای", "beverages-counter", "Tea pulled in a glass, the Lahori way.", IMG.tea, null]),
  makeDish(["green-tea-counter", "Green Tea", "گرین ٹی", "beverages-counter", "Freshly brewed green tea.", IMG.greenTea, null]),

  makeDish(["roasted-mutton-joints", "Roasted Mutton Joints (1 pc)", "بھونے ہوئے گوشت", "chef-special", "Oven-roasted mutton joint, charred at the edges.", IMG.grilled, 1495]),
  makeDish(["mutton-kunna", "Mutton Kunna", "مٹن کنّا", "chef-special", "Mutton simmered to the bone in a deep gravy.", IMG.karahi, 4095]),
  makeDish(["mutton-dum-wala", "Mutton Dum Wala", "مٹن ڈم والا", "chef-special", "Sealed under dough and steam-cooked until tender.", IMG.curry3, 6985]),
  makeDish(["junooni-royal-platter", "Junooni Royal Platter (6 persons serving)", "جنونی رائل پلیٹر", "chef-special", "The full table arranged for six persons.", IMG.meatBoard, 11495]),
  makeDish(["fries", "Fries", "فرائز", "appetizers", "Thick-cut, double-fried and salted at the pass.", IMG.fries, 625]),
  makeDish(["qeema-naan-chicken", "Qeema Naan Chicken", "کیما نان چکن", "appetizers", "Minced chicken baked inside the naan.", IMG.stuffedBread, 845]),
  makeDish(["cheese-naan", "Cheese Naan", "چیز نان", "appetizers", "Naan stuffed with mozzarella and cheddar.", IMG.bakery, 865]),
  makeDish(["qeema-naan-beef", "Qeema Naan Beef", "کیما نان بیف", "appetizers", "Slow-cooked minced beef baked inside the naan.", IMG.breadBasket, 975]),
  makeDish(["bbq-wings", "BBQ Wings (8 pcs)", "بی بی کوونگز", "appetizers", "Charcoal-grilled wings with a sticky barbecue glaze.", IMG.kebab, 1345]),
  makeDish(["dal-makhni", "Dall Makhni", "دال مکھنی", "veg-lentils", "Black lentils simmered overnight and finished with cream.", IMG.curry, 1355]),
  makeDish(["palak-paneer", "Palak Paneer", "پالک پنیر", "veg-lentils", "House paneer folded through slow-cooked spinach.", IMG.curry2, 1355]),
  makeDish(["junooni-special-daal", "Junooni Special Daal", "جنونی اسپیشل دال", "veg-lentils", "The house dal with butter, ghee and warming spice.", IMG.curry, 1355]),
  makeDish(["tandoori-roti", "Tandoori Roti", "تندوری روٹی", "junooni-tandoor", "The everyday roti pulled straight from the clay.", IMG.flatbread, 95]),
  makeDish(["plain-naan", "Plain Naan", "سادہ نان", "junooni-tandoor", "Rested overnight, blistered and pulled to order.", IMG.bread, 125]),
  makeDish(["roghni-naan", "Roghni Naan", "روغنی نان", "junooni-tandoor", "Naan folded back into the tandoor with ghee.", IMG.flatbread, 165]),
  makeDish(["garlic-naan", "Garlic Naan", "گارلک نان", "junooni-tandoor", "Garlic and coriander worked into the dough.", IMG.bakery, 195]),
  makeDish(["kalwanji-naan", "Kalwanji Naan", "کلوانجی نان", "junooni-tandoor", "A crisp, ghee-rich tandoori naan.", IMG.breadBasket, 195]),
  makeDish(["tandoori-pratha", "Tandoori Pratha", "تندوری پراٹھا", "junooni-tandoor", "Layered paratha cooked against the tandoor wall.", IMG.flatbread, 355]),
  makeDish(["special-desi-ghee-roti", "Special Roti with Desi Ghee", "سپیشل روٹی ڈیسی گھی", "junooni-tandoor", "A special roti finished generously with desi ghee.", IMG.breadRoll, 355]),
  makeDish(["raita", "Raita", "رائتہ", "salads", "Whisked yoghurt with cucumber, mint and cumin.", IMG.dahi, 295]),
  makeDish(["yogurt-salad", "Yogurt Salad", "یوگرٹ سالیڈ", "salads", "Beetroot, cucumber and fruit folded through yoghurt.", IMG.greenSalad, 305]),
  makeDish(["fresh-garden-salad", "Fresh Garden Salad", "تازہ گارڈن سالیڈ", "salads", "A fresh garden salad with seasonal leaves.", IMG.salad, 365]),
  makeDish(["fresh-green-salad", "Fresh Green Salad", "تازہ گرین سالیڈ", "salads", "Cucumber, tomato, onion and green chilli.", IMG.greenSalad, 365]),
  makeDish(["junooni-kheer", "Junooni Kheer", "جنونی کھیر", "desserts-signature", "Rice pudding reduced for hours with saffron and nuts.", IMG.kulfi, 765]),
  makeDish(["rasmalai", "Rasmalai", "رسمالائی", "desserts-signature", "Cottage-cheese dumplings in saffron milk.", IMG.falooda, 765]),
  makeDish(["piping-hot-gulab-jamun", "Piping Hot Gulab Jamun", "گرم گلاب جامن", "desserts-signature", "Gulab jamun served hot in cardamom syrup.", IMG.mithai, 765]),
  makeDish(["san-sebastian-cheesecake", "San Sebastian Cheese Cake", "سین سیباسٹین چیز کیک", "desserts-signature", "Burnt on top, barely set and served near the centre.", IMG.cheesecake, 1145]),
  makeDish(["water-small", "Water Small", "چھوٹا پانی", "drinks", "Chilled small bottle of mineral water.", IMG.lemonade, 105]),
  makeDish(["water-large", "Water (Large)", "بڑا پانی", "drinks", "Chilled large bottle of mineral water.", IMG.lemonade, 195]),
  makeDish(["soft-drinks", "Soft Drinks", "سافٹ ڈرنکس", "drinks", "Chilled soft drinks served with ice.", IMG.lemonade, 195]),
  makeDish(["karak-chai", "Karak Chai", "کراک چائے", "drinks", "The pink chai pulled between two vessels.", IMG.tea, 245]),
  makeDish(["frrsh-lime-soda", "Frrsh Lime Soda", "فریش لائم سوڈا", "drinks", "Fresh lime soda with a bright citrus finish.", IMG.lemonade, 275]),
  makeDish(["mint-margarita", "Mint Margarita", "منٹ مارگریٹا", "drinks", "Tequila, lime and mint shaken to order.", IMG.cocktail, 445]),
];

export function getCategory(id: CategoryId) {
  return MENU_CATEGORIES.find((category) => category.id === id);
}
export function getDish(slug: string) {
  return DISHES.find((dish) => dish.slug === slug);
}
export function dishesByCategory(id: CategoryId) {
  return DISHES.filter((dish) => dish.categoryId === id);
}
export function getPairings(dish: Dish) {
  return dish.pairings.map((slug) => getDish(slug)).filter((paired): paired is Dish => Boolean(paired));
}

export const SIGNATURE_LIMIT = 4;
export const SIGNATURE_SLUGS = ["mutton-kunna", "bbq-wings", "shawarma", "san-sebastian-cheesecake"] as const;

export const DELIVERY_FEE = 150;
export const FREE_DELIVERY_THRESHOLD = 2500;
export function deliveryUnitPrice(slug: string): number {
  return DISHES.find((dish) => dish.slug === slug)?.pricePerPlate ?? 0;
}

export const ADDON_GROUPS = [
  { id: "bread", label: "Breads & Naan", urdu: "روٹی و نان", icon: "🫓" },
  { id: "side", label: "Sides & Salads", urdu: "سالن و سلاد", icon: "🥗" },
  { id: "drink", label: "Drinks & Lassi", urdu: "مشروبات و لسی", icon: "🥤" },
  { id: "cold", label: "Cold Drinks", urdu: "کولڈ ڈرنک", icon: "🧊" },
] as const;
export type AddOnGroupId = (typeof ADDON_GROUPS)[number]["id"];
export type AddOn = { id: string; name: string; urdu: string; price: number; group: AddOnGroupId; chilled?: boolean };
export const ADDONS: AddOn[] = [
  { id: "afghani-naan", name: "Afghani Naan", urdu: "افغانی نان", price: 80, group: "bread" },
  { id: "tandoori-naan", name: "Tandoori Naan", urdu: "تندوری نان", price: 60, group: "bread" },
  { id: "sheermal", name: "Sheermal", urdu: "شیرمال", price: 70, group: "bread" },
  { id: "raita", name: "Raita", urdu: "رائتہ", price: 50, group: "side" },
  { id: "green-salad", name: "Green Salad", urdu: "سلاد", price: 60, group: "side" },
  { id: "pickles", name: "Mixed Pickles", urdu: "اچار", price: 40, group: "side" },
  { id: "mint-lassi", name: "Mint Lassi", urdu: "پودینہ لسی", price: 120, group: "drink" },
  { id: "kashmiri-chai", name: "Kashmiri Chai", urdu: "کشمیری چائے", price: 150, group: "drink" },
  { id: "cola", name: "Cola", urdu: "کولا", price: 100, group: "cold", chilled: true },
  { id: "sprite", name: "Sprite", urdu: "اسپرائٹ", price: 100, group: "cold", chilled: true },
  { id: "fanta", name: "Fanta", urdu: "فانٹا", price: 100, group: "cold", chilled: true },
  { id: "water-bottle", name: "Mineral Water", urdu: "منرل واٹر", price: 60, group: "cold", chilled: true },
];

/**
 * The fine-dining placeholder every item falls back to when it has no photo of
 * its own.
 *
 * The admin panel can upload a real photo for any dish, add-on or pre-order
 * item; until it does, the item shows the photo of the food it belongs to
 * rather than an empty tile, so a freshly seeded site looks finished and a
 * guest is never shown a blank card.
 */
export const DEFAULT_DISH_PHOTO = IMG.grillPlate;

/** One placeholder per add-on group — naan for breads, tea for drinks, … */
export const ADDON_GROUP_PHOTOS: Record<string, string> = {
  bread: IMG.breadBasket,
  side: IMG.salad,
  drink: IMG.tea,
  cold: IMG.lemonade,
};

export const PREORDER_CATEGORIES = [
  { id: "slow-cooked", label: "Slow-cooked & Handi", urdu: "دم پخت و ہانڈی" },
  { id: "grills", label: "Grills & Roast", urdu: "گرل و روسٹ" },
  { id: "platters", label: "Party Platters", urdu: "پارٹی پلیٹر" },
  { id: "sweets", label: "Desserts & Sweets", urdu: "میٹھا" },
] as const;
/** One placeholder per pre-order category — a handi, a roast, a platter, a
 *  sweet — until the kitchen uploads the real photograph. */
export const PREORDER_CATEGORY_PHOTOS: Record<string, string> = {
  "slow-cooked": IMG.karahi,
  grills: IMG.grilled,
  platters: IMG.meatBoard,
  sweets: IMG.mithai,
};

export type PreOrderCategoryId = (typeof PREORDER_CATEGORIES)[number]["id"];
export function preOrderCategoryLabel(id: string): string {
  return PREORDER_CATEGORIES.find((category) => category.id === id)?.label ?? "Pre-order";
}

export const WEIGHTED_SLUGS = ["mutton-kunna", "mutton-dum-wala", "junooni-royal-platter"] as const;
export const DEFAULT_WEIGHTS: WeightOption[] = [
  { id: "half-kg", label: "Half KG", priceDelta: 0 },
  { id: "full-kg", label: "Full KG", priceDelta: 500 },
];
export function formatRupees(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

/**
 * `3250` → `PKR 3,250` — the currency as the printed à la carte board reads it.
 * The delivery side of the app keeps `formatRupees`, which is the shorter form
 * a cart line and an order total want.
 */
export function formatPkr(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}
