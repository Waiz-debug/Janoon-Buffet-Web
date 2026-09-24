/**
 * The JUNOON menu — the official menu structure, and the exact rows the admin
 * panel writes into Supabase.
 *
 * The menu is split in two, the way the kitchen runs it:
 *
 *  • **Counters** (`welcome-drinks`, `chinese-counter`, `salad-chaat`,
 *    `street-tandoor`, `meetha-station`) — the High Tea stations. What a guest
 *    walks past and picks up as it comes off the line.
 *  • **Main menu** (`chef-special`, `appetizers`, `veg-lentils`,
 *    `junooni-tandoor`, `salads-desserts`, `drinks`) — the à la carte and chef
 *    specials, ordered by the table.
 *
 * Both halves are `menu_categories` rows, because the guest page draws one
 * section per row and the admin panel manages one counter per row; the split is
 * the order and the naming, not a different kind of row. Every item is
 * `menu_dishes`, filed under its section by `category_id`, and the whole list is
 * copied into the database by `seedMenuCatalog()` — after which every row is the
 * owner's to edit: names, prices, photos, and which counter an item sits on.
 *
 * Prices are the official à la carte prices. The High Tea stations are included
 * in the seat price and the menu does not price them individually, so their
 * figures are the delivery-carte rates and are set as ordinary editable prices.
 *
 * Ids are stable and meaningful, so re-seeding updates the same rows instead of
 * creating a second set beside them. Four dishes are `SIGNATURE_SLUGS`, which is
 * also the most the database allows — the guest page shows those once, in the
 * Signatures strip, and withholds them from their sections so nothing appears
 * twice.
 */

export type CategoryId =
  // Counters — High Tea stations
  | "welcome-drinks"
  | "chinese-counter"
  | "salad-chaat"
  | "street-tandoor"
  | "meetha-station"
  // Main menu — à la carte and chef specials
  | "chef-special"
  | "appetizers"
  | "veg-lentils"
  | "junooni-tandoor"
  | "salads-desserts"
  | "drinks";

/** The badge a section carries. Kept in step with `CATEGORY_ICONS`. */
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
  /** Price delta added to the base per-plate price. */
  priceDelta: number;
};

export type Dish = {
  slug: string;
  name: string;
  urdu: string;
  categoryId: CategoryId;
  /** One-line description for menu listings. */
  summary: string;
  /** Full description for the dish detail page. */
  description: string;
  notes: { label: string; value: string }[];
  /** Slugs of dishes served well alongside this one. */
  pairings: string[];
  image: string;
  /**
   * Per-plate price in rupees. This is what the guest menu shows, what the
   * delivery cart charges and what the server re-prices an order from, so a
   * price lives beside the dish it belongs to rather than in a second table.
   */
  pricePerPlate: number;
  /** Weight/portion options (e.g. Half KG / Full KG) for shareable dishes. */
  weights?: WeightOption[];
};

const unsplash = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;

/**
 * Demo photography, one named entry per family of dish.
 *
 * Every id here resolves to a real Unsplash image — a malformed one 404s, which
 * is how the list was checked — and each dish is pointed at a photo from its own
 * family: bread with the tandoor, a gravy with the daal, a glass with the
 * drinks counter. Where a family has more items than the list has photographs,
 * two neighbours share a picture. They are placeholders for the kitchen's own
 * photography: any of them can be replaced in the admin panel, which takes the
 * row's photo outright when a file is uploaded.
 */
const IMG = {
  // drinks
  lemonade: unsplash("photo-1546173159-315724a31696"),
  cocktail: unsplash("photo-1544145945-f90425340c7e"),
  tea: unsplash("photo-1544787219-7f47ccb76574"),
  greenTea: unsplash("photo-1476718406336-bb5a9690ee2a"),
  // soup & chinese
  soup: unsplash("photo-1543339308-43e59d6b73a6"),
  soup2: unsplash("photo-1610057099443-fde8c4d50f91"),
  friedChicken: unsplash("photo-1600891964092-4316c288032e"),
  drumstick: unsplash("photo-1585937421612-70a008356fbe"),
  manchurian: unsplash("photo-1565557623262-b51c2513a641"),
  friedRice: unsplash("photo-1603133872878-684f208fb84b"),
  chowmein: unsplash("photo-1497636577773-f1231844b336"),
  // chaat & salad
  chaat: unsplash("photo-1414235077428-338989a2e8c0"),
  dahiBowl: unsplash("photo-1476224203421-9ac39bcb3327"),
  channa: unsplash("photo-1599487488170-d11ec9c172f0"),
  saladBowl: unsplash("photo-1512621776951-a57141f2eefd"),
  salad: unsplash("photo-1540189549336-e6e99c3679fe"),
  // street food & tandoor
  shawarma: unsplash("photo-1615719413546-198b25453f85"),
  samosa: unsplash("photo-1546793665-c74683f339c1"),
  fries: unsplash("photo-1546069901-ba9599a7e63c"),
  golGappay: unsplash("photo-1604909052743-94e838986d24"),
  breadLoaves: unsplash("photo-1509440159596-0249088772ff"),
  bakery: unsplash("photo-1495521821757-a1efb6729352"),
  flatbread: unsplash("photo-1549931319-a545dcf3bc73"),
  breadBasket: unsplash("photo-1608039755401-742074f0548d"),
  breadRoll: unsplash("photo-1608198093002-ad4e005484ec"),
  stuffedBread: unsplash("photo-1572449043416-55f4685c9bb7"),
  // grill & mutton
  grilled: unsplash("photo-1555939594-58d7cb561ad1"),
  grillPlate: unsplash("photo-1504674900247-0877df9cc836"),
  tandoori: unsplash("photo-1585032226651-759b368d7246"),
  meatBoard: unsplash("photo-1541529086526-db283c563270"),
  kebab: unsplash("photo-1512058564366-18510be2db19"),
  karahi: unsplash("photo-1606491956689-2ea866880c84"),
  // curries, daal & rice
  curry: unsplash("photo-1563379091339-03b21ab4a4f8"),
  curry2: unsplash("photo-1517248135467-4c7edcad34c4"),
  curry3: unsplash("photo-1603894584373-5ac82b2ae398"),
  biryani: unsplash("photo-1626074353765-517a681e40be"),
  // mithai
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
  /* ------------------------------- counters -------------------------------- */
  {
    id: "welcome-drinks",
    name: "Welcome Drink & Beverages",
    urdu: "خوش آمدید مشروبات",
    blurb:
      "The first glass of the evening — a cold welcome drink poured as you sit down, and the teas kept coming all night.",
    icon: "drink",
  },
  {
    id: "chinese-counter",
    name: "Soup & Chinese Counter",
    urdu: "سوپ اور چائنیز کاؤنٹر",
    blurb:
      "Hot soups at the front of the line, and a wok station that works through fried rice, chowmein and Manchurian to order.",
    icon: "soup",
  },
  {
    id: "salad-chaat",
    name: "Salad & Chaat Section",
    urdu: "سالیڈ اور چاٹ",
    blurb:
      "Fruit and channa chaat built in front of you, dahi bhalay kept cool, and the fresh salads cut on the stone.",
    icon: "salad",
  },
  {
    id: "street-tandoor",
    name: "Street Food & Tandoor Station",
    urdu: "اسٹریٹ فوڈ اور تندور اسٹیشن",
    blurb:
      "Shawarma off the spit, samosa and gol gappay fried in small batches, and a tandoor pulled straight to the table.",
    icon: "bites",
  },
  {
    id: "meetha-station",
    name: "Desserts & Meetha Station",
    urdu: "میٹھا اسٹیشن",
    blurb:
      "The continental counter and the Pakistani mithai cabinet side by side — cakes, brownies, and gulab jamun still warm.",
    icon: "dessert",
  },
  /* ------------------------------ main menu -------------------------------- */
  {
    id: "chef-special",
    name: "Chef Special",
    urdu: "چیف اسپیشل",
    blurb:
      "The dishes the kitchen would put its name to, from a long-roasted mutton joint to the Junooni Royal Platter.",
    icon: "flame",
  },
  {
    id: "appetizers",
    name: "Appetizers",
    urdu: "اپیٹائزرز",
    blurb:
      "To start with — fries, stuffed naan and wings, all of them easy to share across the table before the mains land.",
    icon: "bites",
  },
  {
    id: "veg-lentils",
    name: "Vegetables & Lentils",
    urdu: "سبزی اور دال",
    blurb:
      "Slow-cooked lentils and spinach dishes, rich with butter and finished by hand — the vegetarian heart of the menu.",
    icon: "pot",
  },
  {
    id: "junooni-tandoor",
    name: "Junooni Tandoor",
    urdu: "جنونی تندور",
    blurb:
      "The tandoor banked at opening and never let go out. Every bread here is pulled to order and blistered in the heat.",
    icon: "bread",
  },
  {
    id: "salads-desserts",
    name: "Salads & Desserts",
    urdu: "سالیڈ اور میٹھا",
    blurb:
      "Cool raita and yogurt salad to start, and a short list of desserts worth saving room for.",
    icon: "salad",
  },
  {
    id: "drinks",
    name: "Drinks",
    urdu: "مشروبات",
    blurb:
      "Water, soft drinks, karak chai pulled until it foams, and the house Margarita for the table that wants something longer.",
    icon: "drink",
  },
];

export const DISHES: Dish[] = [
  /* ------------------------ Welcome Drink & Beverages ---------------------- */
  {
    slug: "lemonade-slush",
    name: "Lemonade Slush",
    urdu: "لیمونیڈ سلش",
    categoryId: "welcome-drinks",
    summary: "Iced lemon, crushed to a slush, with a mint top.",
    description:
      "Fresh lemon squeezed to order, blended with crushed ice and a little sugar until it pours like snow, finished with mint and a slice of lemon on the rim. The glass the whole table starts with.",
    notes: [
      { label: "Served", value: "Over crushed ice" },
      { label: "Made with", value: "Fresh lemon, no syrup mix" },
      { label: "Best with", value: "Anything off the grill" },
    ],
    pairings: ["mint-margarita-station", "bbq-wings"],
    image: IMG.lemonade,
    pricePerPlate: 450,
  },
  {
    slug: "mint-margarita-station",
    name: "Mint Margarita",
    urdu: "منٹ مارگریٹا",
    categoryId: "welcome-drinks",
    summary: "The welcome pour — tequila, lime and mint, crushed to order.",
    description:
      "Tequila, fresh lime and a fistful of mint shaken hard with ice until it frosts the glass, then poured over fresh crushed ice. Served at the counter as the welcome drink, and the same recipe with a little more lime as a plated drink further down the menu.",
    notes: [
      { label: "Served", value: "Crushed ice, short glass" },
      { label: "Strength", value: "Balanced — ask for it long" },
      { label: "Garnish", value: "Mint & lime wheel" },
    ],
    pairings: ["fries", "shawarma"],
    image: IMG.cocktail,
    pricePerPlate: 650,
  },
  {
    slug: "tea",
    name: "Tea",
    urdu: "چای",
    categoryId: "welcome-drinks",
    summary: "Pulled in a glass, the way every Lahori table takes it.",
    description:
      "Loose-leaf tea boiled with milk and poured between two vessels until it turns the colour of rose and a skin of foam sits on top. Sugar to the house standard, and the pot refilled for as long as you are sitting.",
    notes: [
      { label: "Brewed", value: "Loose leaf, pulled to order" },
      { label: "Served", value: "In a glass" },
      { label: "Refills", value: "All evening" },
    ],
    pairings: ["aloo-samosa", "karak-chai"],
    image: IMG.tea,
    pricePerPlate: 120,
  },
  {
    slug: "green-tea",
    name: "Green Tea",
    urdu: "گرین ٹی",
    categoryId: "welcome-drinks",
    summary: "Sugar-free, lightly brewed, good after the meal.",
    description:
      "Green tea brewed gently so it does not turn bitter, served without sugar and hot in a small pot. The pot most guests ask for once the barbecue is finished.",
    notes: [
      { label: "Brewed", value: "Gently, four minutes" },
      { label: "Sweetness", value: "None — ask for sugar if wanted" },
      { label: "Served", value: "Hot, in a pot" },
    ],
    pairings: ["junooni-kheer", "rasmalai"],
    image: IMG.greenTea,
    pricePerPlate: 140,
  },

  /* --------------------------- Soup & Chinese Counter ---------------------- */
  {
    slug: "chicken-corn-soup",
    name: "Chicken Corn Soup",
    urdu: "چکن کورن سوپ",
    categoryId: "chinese-counter",
    summary: "Clear, sweet and hot — the first thing off the counter.",
    description:
      "Chicken stock kept clear rather than creamed, with corn, egg and a little white pepper, thickened just enough to hold a spoon upright. Served in a warmed bowl with spring onion, the way it should be at the start of a cold evening.",
    notes: [
      { label: "Base", value: "Clear chicken stock" },
      { label: "Heat", value: "Hot, with white pepper" },
      { label: "Served", value: "Warmed bowl" },
    ],
    pairings: ["fried-rice", "manchurian"],
    image: IMG.soup,
    pricePerPlate: 480,
  },
  {
    slug: "hot-n-sour-soup",
    name: "Hot & Sour Soup",
    urdu: "ہاٹ این سور سوپ",
    categoryId: "chinese-counter",
    summary: "Sharp, a little hot, with egg ribbons through it.",
    description:
      "A darker broth sharpened with vinegar and chilli, with shredded chicken, mushroom and fine ribbons of egg stirred through at the last moment. The one to order when the table wants a soup with an opinion.",
    notes: [
      { label: "Base", value: "Stock, vinegar & chilli" },
      { label: "Heat", value: "Medium" },
      { label: "Contains", value: "Egg, soy" },
    ],
    pairings: ["manchurian", "chowmein"],
    image: IMG.soup2,
    pricePerPlate: 520,
  },
  {
    slug: "fried-chicken",
    name: "Fried Chicken",
    urdu: "فرائڈ چکن",
    categoryId: "chinese-counter",
    summary: "Crisp-crumbed pieces, fried to order.",
    description:
      "Chicken breast and thigh dipped in a seasoned crumb and fried in small batches so the crust is still loud when it reaches the table. Served with a wedge of lemon and a cup of dip from the counter.",
    notes: [
      { label: "Cut", value: "Breast and thigh, 3 pieces" },
      { label: "Fried", value: "To order, small batches" },
      { label: "Served with", value: "Lemon & dip" },
    ],
    pairings: ["fries", "lemonade-slush"],
    image: IMG.friedChicken,
    pricePerPlate: 780,
  },
  {
    slug: "chicken-drumstick",
    name: "Chicken Drumstick",
    urdu: "چکن ڈرم اسٹک",
    categoryId: "chinese-counter",
    summary: "One drumstick, fried hard and salted at the pass.",
    description:
      "A single large drumstick brined overnight, crumbed and fried until the skin is brittle, then salted and served immediately. The one the children negotiate over, and the easiest thing to eat standing at the counter.",
    notes: [
      { label: "Cut", value: "One large drumstick" },
      { label: "Fried", value: "Twelve minutes" },
      { label: "Served with", value: "Chilli dip" },
    ],
    pairings: ["fries", "chowmein"],
    image: IMG.drumstick,
    pricePerPlate: 650,
  },
  {
    slug: "manchurian",
    name: "Chicken Manchurian",
    urdu: "چکن مانچورین",
    categoryId: "chinese-counter",
    summary: "Deep-fried chicken in a hot, glossy garlic sauce.",
    description:
      "Battered chicken tossed in a wok with garlic, ginger and chilli in a sauce that clings to every piece, finished with spring onion. Dry or with gravy, and eaten straight from the bowl while the sauce is still moving.",
    notes: [
      { label: "Style", value: "Dry or semi-dry gravy" },
      { label: "Heat", value: "Medium to hot" },
      { label: "Served with", value: "Fried rice or noodles" },
    ],
    pairings: ["fried-rice", "chowmein"],
    image: IMG.manchurian,
    pricePerPlate: 850,
  },
  {
    slug: "fried-rice",
    name: "Egg Fried Rice",
    urdu: "ایگ فرائز رائس",
    categoryId: "chinese-counter",
    summary: "Wok-tossed rice with egg, spring onion and carrot.",
    description:
      "Cold cooked rice taken hot to the wok with egg, spring onion, carrot and a little soy, tossed over a fierce flame so the grains separate and catch. The default that goes with almost everything on this counter.",
    notes: [
      { label: "Rice", value: "Day-old, for separation" },
      { label: "Heat", value: "Wok, very high" },
      { label: "Served with", value: "Chilli sauce" },
    ],
    pairings: ["manchurian", "chicken-corn-soup"],
    image: IMG.friedRice,
    pricePerPlate: 720,
  },
  {
    slug: "chowmein",
    name: "Chicken Chowmein",
    urdu: "چکن چومین",
    categoryId: "chinese-counter",
    summary: "Egg noodles, tossed with vegetables and chicken.",
    description:
      "Boiled egg noodles tossed in the wok with shredded chicken, cabbage, carrot and spring onion in a light soy and garlic sauce. Served without gravy, the way it is meant to be — the noodles should run free on the plate.",
    notes: [
      { label: "Noodles", value: "Egg, tossed to order" },
      { label: "Sauce", value: "Light soy & garlic" },
      { label: "Spice", value: "Mild" },
    ],
    pairings: ["manchurian", "fried-rice"],
    image: IMG.chowmein,
    pricePerPlate: 780,
  },

  /* ------------------------- Salad & Chaat Section ------------------------- */
  {
    slug: "fruit-chaat",
    name: "Fruit Chaat",
    urdu: "فرٹ چاٹ",
    categoryId: "salad-chaat",
    summary: "Seasonal fruit, chaat masala and a cold, sharp finish.",
    description:
      "Whatever is best that morning — apple, banana, papaya, guava, pomegranate — tossed with chaat masala, mint, imli and a little rock salt so it tastes sharp rather than sweet. Assembled in front of you so the fruit never sits and bleeds colour.",
    notes: [
      { label: "Made with", value: "Seasonal fruit, cut to order" },
      { label: "Spice", value: "Tangy, with rock salt" },
      { label: "Served", value: "Chilled, in a bowl" },
    ],
    pairings: ["dahi-bhalay", "lemonade-slush"],
    image: IMG.chaat,
    pricePerPlate: 550,
  },
  {
    slug: "dahi-bhalay",
    name: "Dahi Bhalay",
    urdu: "دہی بڑے",
    categoryId: "salad-chaat",
    summary: "Soft lentil dumplings under thick, chilled yoghurt.",
    description:
      "Lentil dumplings soaked until pillowy, laid in a bowl and drowned in thick whisked yoghurt, then finished with imli chutney, roasted cumin and a scatter of crisp boondi. The coolest thing at the counter and the one the whole table shares first.",
    notes: [
      { label: "Base", value: "Lentil dumplings, soaked" },
      { label: "Served", value: "Chilled" },
      { label: "Finish", value: "Cumin, boondi, imli" },
    ],
    pairings: ["fruit-chaat", "channa-chaat"],
    image: IMG.dahiBowl,
    pricePerPlate: 450,
  },
  {
    slug: "channa-chaat",
    name: "Channa Chaat",
    urdu: "چنا چاٹ",
    categoryId: "salad-chaat",
    summary: "Chickpeas, tomato, onion and a bright, tangy dressing.",
    description:
      "Boiled chickpeas tossed with tomato, onion, green chilli, chaat masala, coriander and a squeeze of lemon, with imli poured over at the table. Heavier and sharper than fruit chaat, and the version to order if you want the full Lahore street-food flavour.",
    notes: [
      { label: "Base", value: "Boiled chickpeas" },
      { label: "Spice", value: "Medium, adjustable" },
      { label: "Served with", value: "Imli at the table" },
    ],
    pairings: ["dahi-bhalay", "aloo-samosa"],
    image: IMG.channa,
    pricePerPlate: 520,
  },
  {
    slug: "russian-salad",
    name: "Russian Salad",
    urdu: "روسیئن سالیڈ",
    categoryId: "salad-chaat",
    summary: "Potato, carrot and egg under a light mayonnaise dressing.",
    description:
      "Boiled potato, carrot and peas folded with egg and a light mayonnaise dressing, rested cold so the flavours settle, then finished with a little mustard. The salad that appears on every High Tea table in the country, made properly.",
    notes: [
      { label: "Base", value: "Boiled vegetables & egg" },
      { label: "Dressing", value: "Light mayonnaise" },
      { label: "Served", value: "Chilled" },
    ],
    pairings: ["greek-salad", "bbq-wings"],
    image: IMG.saladBowl,
    pricePerPlate: 650,
  },
  {
    slug: "greek-salad",
    name: "Greek Salad",
    urdu: "یونانی سالیڈ",
    categoryId: "salad-chaat",
    summary: "Tomato, cucumber, olives and feta, dressed at the stone.",
    description:
      "Tomato, cucumber, capsicum, red onion and kalamata olives, with feta cut over the top and dressed with olive oil, oregano and lemon at the stone. Lighter and sharper than the Russian salad, and the one to order with grilled meat.",
    notes: [
      { label: "Base", value: "Tomato, cucumber, feta" },
      { label: "Dressing", value: "Olive oil, oregano, lemon" },
      { label: "Served", value: "Chilled" },
    ],
    pairings: ["russian-salad", "roasted-mutton-joints"],
    image: IMG.salad,
    pricePerPlate: 700,
  },

  /* --------------------- Street Food & Tandoor Station --------------------- */
  {
    slug: "shawarma",
    name: "Chicken Shawarma",
    urdu: "چکن شاورما",
    categoryId: "street-tandoor",
    summary: "Spit-roasted chicken, shaved into a wrap at the counter.",
    description:
      "Chicken marinated overnight in garlic, lemon and yoghurt, roasted on the spit all day and shaved to order into a hot flatbread with garlic sauce, pickles, tomato and a line of tahini. Wrapped in paper the way it is eaten on the street, and worth eating that way too.",
    notes: [
      { label: "Counter", value: "Shaved from the spit to order" },
      { label: "Served with", value: "Garlic sauce, pickles, tahini" },
      { label: "Best with", value: "Lemonade slush" },
    ],
    pairings: ["lahori-fries", "aloo-samosa"],
    image: IMG.shawarma,
    pricePerPlate: 650,
  },
  {
    slug: "aloo-samosa",
    name: "Aloo Samosa",
    urdu: "آلو سموسہ",
    categoryId: "street-tandoor",
    summary: "Two samosas, fried in small batches, with chutney.",
    description:
      "Flour shells filled with spiced potato and peas, folded by hand and fried in small batches through the evening so the crust is still crackling in the hand. Served two to an order with mint chutney and a wedge of lime.",
    notes: [
      { label: "Serving", value: "Two per order" },
      { label: "Fried", value: "Small batches, to order" },
      { label: "Served with", value: "Mint chutney & lime" },
    ],
    pairings: ["channa-chaat", "gol-gappay"],
    image: IMG.samosa,
    pricePerPlate: 300,
  },
  {
    slug: "lahori-fries",
    name: "Lahori Fries",
    urdu: "لاہوری فرائز",
    categoryId: "street-tandoor",
    summary: "Double-fried, dusted chaat masala, served in a cup.",
    description:
      "Thick-cut potatoes fried twice so they hold their shape, salted and dusted with chaat masala while still hot, with a small cup of ketchup and a green chutney alongside. Ate standing at the counter, as they should be.",
    notes: [
      { label: "Cut", value: "Thick, double-fried" },
      { label: "Finish", value: "Chaat masala at the fryer" },
      { label: "Served with", value: "Ketchup & green chutney" },
    ],
    pairings: ["shawarma", "bbq-wings"],
    image: IMG.fries,
    pricePerPlate: 625,
  },
  {
    slug: "gol-gappay",
    name: "Gol Gappay",
    urdu: "گول گپے",
    categoryId: "street-tandoor",
    summary: "Crisp shells, spiced water, six to an order.",
    description:
      "Small shells fried to order — puffed, hollow and brittle — served six to an order with a bowl of spiced water, tamarind, mint and a little chaat masala to pour in yourself. The shell collapses into the water between your fingers and the plate.",
    notes: [
      { label: "Serving", value: "Six per order" },
      { label: "Served with", value: "Spiced water, tamarind" },
      { label: "Fried", value: "To order" },
    ],
    pairings: ["aloo-samosa", "dahi-bhalay"],
    image: IMG.golGappay,
    pricePerPlate: 480,
  },
  {
    slug: "variety-of-naans",
    name: "Variety of Naans",
    urdu: "نان کی Variety",
    categoryId: "street-tandoor",
    summary: "A platter of the tandoor's breads, four kinds on one plate.",
    description:
      "One of each of the tandoor's breads — plain, roghni, garlic and cheese — pulled in the same run so they arrive hot together on a single platter. The way to try the whole tandoor at once before choosing one for the table.",
    notes: [
      { label: "Includes", value: "Plain, roghni, garlic, cheese" },
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Best with", value: "Karahi, daal and mutton" },
    ],
    pairings: ["mutton-kunna", "dal-makhni"],
    image: IMG.breadLoaves,
    pricePerPlate: 595,
  },

  /* ------------------------ Desserts & Meetha Station ---------------------- */
  {
    slug: "tiramisu",
    name: "Tiramisu",
    urdu: "ٹیرامیسو",
    categoryId: "meetha-station",
    summary: "Espresso-soaked sponge, mascarpone, cocoa.",
    description:
      "Sponge soaked in espresso and left to drink it, layered with whipped mascarpone and set overnight, dusted with cocoa at the counter. Cut to order — the first dessert of the evening that is not mithai, and the one that disappears first.",
    notes: [
      { label: "Contains", value: "Mascarpone, coffee, cocoa" },
      { label: "Set", value: "Overnight" },
      { label: "Served", value: "Cold, cut to order" },
    ],
    pairings: ["junooni-kheer", "rasmalai"],
    image: IMG.cake,
    pricePerPlate: 895,
  },
  {
    slug: "croquembouche",
    name: "Croquembouche",
    urdu: "کروکمبوش",
    categoryId: "meetha-station",
    summary: "A tower of cream puffs held together with spun sugar.",
    description:
      "Choux puffs filled with vanilla cream, stacked into a tower and bound with spun sugar drawn out warm at the counter — a piece that is meant to be carried to the table whole and taken apart in front of everyone. Ordered for celebrations; a day's notice helps.",
    notes: [
      { label: "Made with", value: "Choux, vanilla cream, spun sugar" },
      { label: "Notice", value: "Please order a day ahead" },
      { label: "Serves", value: "Six to eight" },
    ],
    pairings: ["tiramisu", "junooni-kheer"],
    image: IMG.pastry,
    pricePerPlate: 1095,
  },
  {
    slug: "brownies",
    name: "Brownies with Ice Cream",
    urdu: "براؤنز آئس کریم کے ساتھ",
    categoryId: "meetha-station",
    summary: "Warm dark brownies, ice cream, chocolate sauce.",
    description:
      "Dark chocolate brownies baked in a small tray so the middle stays fudgy, served warm with a scoop of vanilla ice cream and warm chocolate sauce poured over at the table. The plate that needs no explanation at the end of a long dinner.",
    notes: [
      { label: "Served", value: "Warm, with ice cream" },
      { label: "Sauce", value: "Warm chocolate" },
      { label: "Contains", value: "Nuts, dairy" },
    ],
    pairings: ["rasmalai", "tiramisu"],
    image: IMG.brownie,
    pricePerPlate: 750,
  },
  {
    slug: "gulab-jamun",
    name: "Gulab Jamun",
    urdu: "گلاب جامن",
    categoryId: "meetha-station",
    summary: "Warm milk dumplings in cardamom syrup.",
    description:
      "Khoya dumplings fried to a deep amber and soaked in warm cardamom and rose syrup until they have doubled in size, served warm in the syrup with a spoon of rabri if you want it. Made in small batches through the evening so they are never more than a few minutes old.",
    notes: [
      { label: "Fried", value: "To order, small batches" },
      { label: "Syrup", value: "Cardamom & rose water" },
      { label: "Served", value: "Warm" },
    ],
    pairings: ["brownies", "junooni-kheer"],
    image: IMG.mithai,
    pricePerPlate: 420,
  },
  {
    slug: "kulfa",
    name: "Kulfa",
    urdu: "کلفا",
    categoryId: "meetha-station",
    summary: "Dense milk kulfi, cut from the slab.",
    description:
      "Milk kulfi cooked down slowly until it is almost a solid, poured over ice in a tall glass and cut straight from the slab — dense, cold and slow-melting, with rose and pistachio if you want them. The cheapest thing on the counter and the most ordered.",
    notes: [
      { label: "Texture", value: "Dense, cut from the slab" },
      { label: "Served", value: "Over ice" },
      { label: "Add", value: "Rose & pistachio" },
    ],
    pairings: ["gulab-jamun", "rasmalai"],
    image: IMG.kulfi,
    pricePerPlate: 650,
  },

  /* ------------------------------ Chef Special ----------------------------- */
  {
    slug: "roasted-mutton-joints",
    name: "Roasted Mutton Joints",
    urdu: "بھونے ہوئے گوشت",
    categoryId: "chef-special",
    summary: "Oven-roasted, charred at the edges, three joints to an order.",
    description:
      "Mutton joints marinated overnight in yoghurt, ginger and garlic, then roasted hard until the fat renders and the outside catches at the edges while the meat falls from the bone. Finished with a little butter and coriander at the pass, and eaten with a tandoori roti in hand.",
    notes: [
      { label: "Serving", value: "Three joints" },
      { label: "Marinated", value: "Overnight, in yoghurt" },
      { label: "Served with", value: "Tandoori roti & salad" },
    ],
    pairings: ["tandoori-roti", "greek-salad"],
    image: IMG.grilled,
    pricePerPlate: 1495,
  },
  {
    slug: "mutton-kunna",
    name: "Mutton Kunna",
    urdu: "مٹن کنّا",
    categoryId: "chef-special",
    summary: "Mutton simmered to the bone in a pale, deep-flavoured gravy.",
    description:
      "The old Lahori way: mutton on the bone cooked down for hours until the marrow gives and the gravy turns deep and soft, then finished with fried onion, green chilli and a little cream. Nothing is added at the end to hide what the pot has done — this one is a matter of time.",
    notes: [
      { label: "Cooking time", value: "Six to eight hours" },
      { label: "Gravy", value: "On the bone, marrow-thickened" },
      { label: "Served with", value: "Naan & salad" },
    ],
    pairings: ["plain-naan", "greek-salad"],
    image: IMG.karahi,
    pricePerPlate: 4095,
  },
  {
    slug: "mutton-dum-wala",
    name: "Mutton Dum Wala",
    urdu: "مٹن ڈم والا",
    categoryId: "chef-special",
    summary: "Sealed under dough, steam-cooked until it gives.",
    description:
      "Mutton layered with fried onions, whole spices and potatoes, the pan sealed under a flour dough and left on the lowest heat to steam in its own juices for hours. The seal is broken at the table; the first smell that comes off it is the reason this dish is on every wedding menu in the city.",
    notes: [
      { label: "Cooking time", value: "Four hours, sealed" },
      { label: "Sealed with", value: "Flour dough" },
      { label: "Served with", value: "Naan or rice" },
    ],
    pairings: ["garlic-naan", "junooni-kheer"],
    image: IMG.curry3,
    pricePerPlate: 6985,
  },
  {
    slug: "junooni-royal-platter",
    name: "Junooni Royal Platter",
    urdu: "جنونی رائل پلیٹر",
    categoryId: "chef-special",
    summary: "The full table — grill, handi, tandoor and meetha on one board.",
    description:
      "The kitchen's own table, laid out for the room: charcoal grill, a handi of mutton, breads off the tandoor, salad and a sweet to finish, arranged so everything is reached at once and nothing is passed around twice. The one to order when a table wants the whole restaurant in a single sitting.",
    notes: [
      { label: "Serves", value: "Four to six" },
      { label: "Includes", value: "Grill, handi, tandoor, salad, sweet" },
      { label: "Notice", value: "Twenty minutes' notice please" },
    ],
    pairings: ["mutton-kunna", "rasmalai"],
    image: IMG.meatBoard,
    pricePerPlate: 11495,
  },

  /* ------------------------------ Appetizers ------------------------------- */
  {
    slug: "fries",
    name: "Fries",
    urdu: "فرائز",
    categoryId: "appetizers",
    summary: "Thick-cut, double-fried, salted at the pass.",
    description:
      "Thick-cut potatoes fried twice for a crisp shell and a soft middle, salted and served in a paper-lined basket with ketchup and a garlic aioli. Simple, done properly, and the thing the table shares before anything else arrives.",
    notes: [
      { label: "Cut", value: "Thick, double-fried" },
      { label: "Served with", value: "Ketchup & garlic aioli" },
      { label: "Best with", value: "A cold Margarita" },
    ],
    pairings: ["bbq-wings", "lemonade-slush"],
    image: IMG.fries,
    pricePerPlate: 625,
  },
  {
    slug: "qeema-naan-chicken",
    name: "Qeema Naan Chicken",
    urdu: "کیما نان چکن",
    categoryId: "appetizers",
    summary: "Minced chicken baked inside the naan.",
    description:
      "The same stuffed-naan method as the tandoor's special, filled with slow-cooked minced chicken, green chilli and coriander, then baked and brushed with butter. Folded rather than sliced, so the first thing you do is pull it apart over the plate.",
    notes: [
      { label: "Filling", value: "Minced chicken & coriander" },
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Spice", value: "Medium" },
    ],
    pairings: ["lahori-fries", "chicken-corn-soup"],
    image: IMG.breadBasket,
    pricePerPlate: 845,
  },
  {
    slug: "cheese-naan",
    name: "Cheese Naan",
    urdu: "چیز نان",
    categoryId: "appetizers",
    summary: "Stuffed with a blend of mozzarella and cheddar.",
    description:
      "Naan stuffed with mozzarella and cheddar, sealed and baked until the cheese has melted completely and the bread outside has blistered. The cheese pulls in one long string, which is the whole point and the reason the table stops talking.",
    notes: [
      { label: "Filling", value: "Mozzarella & cheddar" },
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Bake", value: "Ninety seconds" },
    ],
    pairings: ["bbq-wings", "dahi-bhalay"],
    image: IMG.bakery,
    pricePerPlate: 865,
  },
  {
    slug: "qeema-naan-beef",
    name: "Qeema Naan Beef",
    urdu: "کیما نان بیف",
    categoryId: "appetizers",
    summary: "Slow-cooked minced beef, baked inside the naan.",
    description:
      "Minced beef cooked long and slow with onion, tomato and green chilli until it is dark and spiced, then baked inside the naan under the same hard heat as the rest of the tandoor. Richer and more strongly spiced than the chicken version, and ordered by the grown-ups.",
    notes: [
      { label: "Filling", value: "Slow-cooked minced beef" },
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Spice", value: "Medium-hot" },
    ],
    pairings: ["fries", "palak-paneer"],
    image: IMG.stuffedBread,
    pricePerPlate: 975,
  },
  {
    slug: "bbq-wings",
    name: "BBQ Wings",
    urdu: "بی بی کوونگز",
    categoryId: "appetizers",
    summary: "Charcoal-grilled, sticky glaze, six to an order.",
    description:
      "Wings marinated overnight, grilled over charcoal until the skin is lacquered and the edges catch, then tossed in a sticky barbecue glaze at the pass. Six to an order, served hot, and gone before the rest of the table has settled in.",
    notes: [
      { label: "Serving", value: "Six wings" },
      { label: "Cooked", value: "Charcoal grilled" },
      { label: "Glaze", value: "Barbecue, tossed at the pass" },
    ],
    pairings: ["fries", "russian-salad"],
    image: IMG.kebab,
    pricePerPlate: 1345,
  },

  /* ------------------------- Vegetables & Lentils ------------------------- */
  {
    slug: "dal-makhni",
    name: "Dal Makhni",
    urdu: "دال مکھنی",
    categoryId: "veg-lentils",
    summary: "Black lentils simmered overnight, finished with cream.",
    description:
      "Urad dal soaked, simmered slowly to a dark, thick paste and finished with butter and a long swirl of cream just before service. The tempering of garlic and chilli poured over at the table is the last thing that happens to it.",
    notes: [
      { label: "Cooked", value: "Overnight, to a thick paste" },
      { label: "Finish", value: "Butter & cream" },
      { label: "Served with", value: "Garlic naan or tandoori roti" },
    ],
    pairings: ["garlic-naan", "junooni-special-daal"],
    image: IMG.curry,
    pricePerPlate: 1355,
  },
  {
    slug: "palak-paneer",
    name: "Palak Paneer",
    urdu: "پالک پنیر",
    categoryId: "veg-lentils",
    summary: "House paneer in slow-cooked spinach.",
    description:
      "Spinach cooked down slowly so it keeps its colour, blended with ginger and garlic, then finished with a touch of butter and cream. The paneer is set in the kitchen each morning and cut in at the pass so it goes in whole.",
    notes: [
      { label: "Paneer", value: "Set in-house each morning" },
      { label: "Spice", value: "Mild" },
      { label: "Best with", value: "Tandoori roti or naan" },
    ],
    pairings: ["tandoori-pratha", "dal-makhni"],
    image: IMG.curry2,
    pricePerPlate: 1355,
  },
  {
    slug: "junooni-special-daal",
    name: "Junooni Special Daal",
    urdu: "جنونی اسپیشل دال",
    categoryId: "veg-lentils",
    summary: "The house dal — moong and masoor, butter and spice.",
    description:
      "Moong and masoor lentils cooked with tomato, ginger and a red chilli that is soaked rather than dried, then finished with butter, ghee and coriander. Ordered at almost every table in the house, and the reason the tandoor is kept so busy.",
    notes: [
      { label: "Base", value: "Moong & masoor" },
      { label: "Finish", value: "Butter, ghee, coriander" },
      { label: "Spice", value: "Medium" },
    ],
    pairings: ["tandoori-roti", "dal-makhni"],
    image: IMG.biryani,
    pricePerPlate: 1355,
  },

  /* --------------------------- Junooni Tandoor ----------------------------- */
  {
    slug: "tandoori-roti",
    name: "Tandoori Roti",
    urdu: "تندوری روٹی",
    categoryId: "junooni-tandoor",
    summary: "The everyday roti, straight from the clay.",
    description:
      "Flour, salt and water, rolled thin and pulled straight from the tandoor wall. Plain, hot and soft, and the bread the daal at this table is meant to be eaten with.",
    notes: [
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Bake", value: "Forty-five seconds" },
      { label: "Best with", value: "Daal, karahi and qorma" },
    ],
    pairings: ["junooni-special-daal", "dal-makhni"],
    image: IMG.flatbread,
    pricePerPlate: 95,
  },
  {
    slug: "plain-naan",
    name: "Plain Naan",
    urdu: "سادہ نان",
    categoryId: "junooni-tandoor",
    summary: "Rested overnight, blistered, pulled to order.",
    description:
      "Flour, yoghurt and a little mustard oil, rested overnight so the dough keeps its shape, then slapped onto the tandoor wall. Puffy in the middle, crisp at the edges, and the bread everything else on this menu is ordered with.",
    notes: [
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Bake", value: "Sixty seconds" },
      { label: "Made with", value: "Yoghurt & mustard oil" },
    ],
    pairings: ["mutton-kunna", "mutton-dum-wala"],
    image: IMG.breadRoll,
    pricePerPlate: 125,
  },
  {
    slug: "roghni-naan",
    name: "Roghni Naan",
    urdu: "روغنی نان",
    categoryId: "junooni-tandoor",
    summary: "Drizzled with ghee and folded in the tandoor.",
    description:
      "Naan brought out of the tandoor, drenched in ghee and folded back in for a few seconds so the ghee soaks through rather than sitting on the surface. Heavier, richer and more forgiving of a long dinner than plain naan.",
    notes: [
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Finish", value: "Ghee, folded and returned" },
      { label: "Best with", value: "Mutton and dry curries" },
    ],
    pairings: ["mutton-kunna", "roasted-mutton-joints"],
    image: IMG.flatbread,
    pricePerPlate: 165,
  },
  {
    slug: "garlic-naan",
    name: "Garlic Naan",
    urdu: "گارلک نان",
    categoryId: "junooni-tandoor",
    summary: "Garlic butter worked into the dough before baking.",
    description:
      "Garlic and coriander beaten into soft butter and worked into the naan before it goes near the tandoor, so the flavour is in the bread rather than brushed on afterwards. Pulled with a butter-soaked edge and a scatter of green coriander on top.",
    notes: [
      { label: "Preparation", value: "Garlic butter kneaded in" },
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Finish", value: "Butter & coriander" },
    ],
    pairings: ["dal-makhni", "palak-paneer"],
    image: IMG.bakery,
    pricePerPlate: 195,
  },
  {
    slug: "tandoori-pratha",
    name: "Tandoori Pratha",
    urdu: "تندوری پراٹھا",
    categoryId: "junooni-tandoor",
    summary: "Layered, ghee-soaked, cooked on the tandoor wall.",
    description:
      "A hundred and twenty layers folded by hand, rolled thin and cooked against the tandoor wall until the edges crisp and the layers separate. Served hot with a spoon of white butter, and the one the whole table shares before the mains.",
    notes: [
      { label: "Layers", value: "120, folded by hand" },
      { label: "Cooked on", value: "The tandoor wall" },
      { label: "Served with", value: "White butter" },
    ],
    pairings: ["qeema-naan-chicken", "karak-chai"],
    image: IMG.breadLoaves,
    pricePerPlate: 355,
  },

  /* --------------------------- Salads & Desserts --------------------------- */
  {
    slug: "raita",
    name: "Raita",
    urdu: "رائتہ",
    categoryId: "salads-desserts",
    summary: "Whisked yoghurt with cucumber, mint and roasted cumin.",
    description:
      "Yoghurt whisked smooth with cucumber, mint, green chilli and a spoon of roasted cumin, served cold in a small bowl. It goes on the table before anything else and is still there at the end of the meal.",
    notes: [
      { label: "Base", value: "Whisked yoghurt" },
      { label: "Contains", value: "Cucumber, mint, cumin" },
      { label: "Served", value: "Chilled" },
    ],
    pairings: ["junooni-special-daal", "mutton-dum-wala"],
    image: IMG.dahiBowl,
    pricePerPlate: 295,
  },
  {
    slug: "yogurt-salad",
    name: "Yogurt Salad",
    urdu: "یوگرٹ سالیڈ",
    categoryId: "salads-desserts",
    summary: "Beetroot, cucumber and fruit folded through yoghurt.",
    description:
      "Diced cucumber, beetroot, onion and a little fruit folded through thick yoghurt with mint and a squeeze of lime, so it is sweet and sharp at once. Served cold, and the one salad the children actually ask for again.",
    notes: [
      { label: "Base", value: "Yoghurt, beetroot, fruit" },
      { label: "Dressing", value: "Lime, no oil" },
      { label: "Served", value: "Chilled" },
    ],
    pairings: ["russian-salad", "bbq-wings"],
    image: IMG.salad,
    pricePerPlate: 305,
  },
  {
    slug: "junooni-kheer",
    name: "Junooni Kheer",
    urdu: "جنونی کھیر",
    categoryId: "salads-desserts",
    summary: "Rice pudding reduced for hours, saffron and nuts.",
    description:
      "Full-cream milk reduced with broken rice for hours until it thickens to a pale gold, then perfumed with saffron, cardamom and slivered almonds, and served chilled in small bowls. Made every morning in the same pot the kitchen has used for years.",
    notes: [
      { label: "Cooking time", value: "Reduced for four hours" },
      { label: "Served", value: "Chilled" },
      { label: "Flavouring", value: "Saffron, cardamom, almond" },
    ],
    pairings: ["green-tea", "gulab-jamun"],
    image: IMG.kulfi,
    pricePerPlate: 765,
  },
  {
    slug: "rasmalai",
    name: "Rasmalai",
    urdu: "رسمالائی",
    categoryId: "salads-desserts",
    summary: "Cottage-cheese dumplings in saffron milk.",
    description:
      "Chenna worked into soft, cheese-like dumplings, poached gently and served warm in rabri — milk reduced with saffron, cardamom and a little pistachio. Cold on top, sweet underneath, and finished as a proper dinner should be.",
    notes: [
      { label: "Base", value: "Chenna dumplings, poached" },
      { label: "Served in", value: "Saffron rabri" },
      { label: "Served", value: "Chilled, with a few pistachios" },
    ],
    pairings: ["junooni-kheer", "green-tea"],
    image: IMG.falooda,
    pricePerPlate: 765,
  },
  {
    slug: "san-sebastian-cheesecake",
    name: "San Sebastian Cheese Cake",
    urdu: "سین سیباسٹین چیز کیک",
    categoryId: "salads-desserts",
    summary: "Burnt on top, barely set, served near the centre.",
    description:
      "The Spanish style: a batter pushed almost to the top of a very hot tray, baked until the surface is scorched dark and the middle barely sets. Cut in thin wedges at the counter and served barely cold, which is the only temperature it is right at.",
    notes: [
      { label: "Style", value: "Basque — scorched top" },
      { label: "Bake", value: "Very hot tray, short time" },
      { label: "Served", value: "Barely chilled" },
    ],
    pairings: ["tiramisu", "green-tea"],
    image: IMG.cheesecake,
    pricePerPlate: 1145,
  },

  /* --------------------------------- Drinks -------------------------------- */
  {
    slug: "water",
    name: "Water",
    urdu: "پانی",
    categoryId: "drinks",
    summary: "Chilled mineral water, still or sparkling.",
    description:
      "Chilled mineral water in its bottle, still or sparkling, brought to the table with the order. Nothing about it needs explaining, which is why it is worth putting on the menu at all.",
    notes: [
      { label: "Served", value: "Chilled, in the bottle" },
      { label: "Options", value: "Still or sparkling" },
      { label: "Size", value: "500 ml or 1.5 litre" },
    ],
    pairings: ["karak-chai", "bbq-wings"],
    image: IMG.dahiBowl,
    pricePerPlate: 100,
  },
  {
    slug: "soft-drinks",
    name: "Soft Drinks",
    urdu: "سافٹ ڈرنکس",
    categoryId: "drinks",
    summary: "Cans and bottles, chilled to the temperature of the ice box.",
    description:
      "The usual selection of chilled soft drinks — cola, lemon-lime and orange — kept in the ice box rather than the fridge so they arrive at the temperature people actually want. Served in the can or with ice and a straw.",
    notes: [
      { label: "Served", value: "Ice-cold" },
      { label: "Options", value: "Cola, lemon-lime, orange" },
      { label: "Also", value: "With ice and a straw" },
    ],
    pairings: ["fries", "channa-chaat"],
    image: IMG.lemonade,
    pricePerPlate: 180,
  },
  {
    slug: "karak-chai",
    name: "Karak Chai",
    urdu: "کراک چائے",
    categoryId: "drinks",
    summary: "The pink one, pulled between two vessels.",
    description:
      "Loose-leaf tea boiled with milk and then pulled — poured high from one glass into another — until it froths and turns the colour of rose, with cardamom and sugar to the house standard. Served in a glass, and never in a pot.",
    notes: [
      { label: "Brewed", value: "Loose leaf, pulled to order" },
      { label: "Sweetness", value: "House standard" },
      { label: "Served", value: "In a glass" },
    ],
    pairings: ["tandoori-pratha", "gol-gappay"],
    image: IMG.tea,
    pricePerPlate: 220,
  },
  {
    slug: "mint-margarita",
    name: "Mint Margarita",
    urdu: "منٹ مارگریٹا",
    categoryId: "drinks",
    summary: "Tequila, lime and mint, shaken to order.",
    description:
      "The counter's welcome pour, made to the full measure: tequila shaken with fresh lime and mint until the glass frosts, poured over crushed ice and finished with a lime wheel. Order it long if the table is in the mood to stay a while.",
    notes: [
      { label: "Base", value: "Tequila, lime, mint" },
      { label: "Served", value: "Over crushed ice" },
      { label: "Strength", value: "Ask for it long" },
    ],
    pairings: ["fries", "bbq-wings"],
    image: IMG.cocktail,
    pricePerPlate: 680,
  },
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
  return dish.pairings
    .map((slug) => getDish(slug))
    .filter((paired): paired is Dish => Boolean(paired));
}

/**
 * The Signature section on the landing page holds exactly this many dishes.
 * Enforced in the admin panel and, as a backstop, by the
 * `menu_dishes_signature_limit` trigger in supabase/schema.sql.
 */
export const SIGNATURE_LIMIT = 4;

/**
 * The dishes that ship as signatures, and the fallback shown before the
 * catalogue has been seeded. Which dishes are actually featured is decided by
 * the `featured` column — this list is only the out-of-the-box default.
 *
 * Chosen one from each corner of the menu, so the Signatures strip reads as the
 * restaurant rather than four plates from one section: the chef's Mutton Kunna,
 * the grill's BBQ Wings, the street station's Shawarma, and the San Sebastian
 * cheesecake from the dessert list.
 */
export const SIGNATURE_SLUGS = [
  "mutton-kunna",
  "bbq-wings",
  "shawarma",
  "san-sebastian-cheesecake",
] as const;

/* ------------------------------------------------------------------ */
/* Delivery pricing                                                     */
/*                                                                     */
/* The per-plate price lives on the dish itself, so the guest menu, the */
/* delivery cart and the server-side total all read one number. The     */
/* function below is the fallback for a dish the owner has added       */
/* without pricing yet: the standard plate price, matching the rest of  */
/* the buffet.                                                         */
/* ------------------------------------------------------------------ */

export const DELIVERY_FEE = 150;
export const FREE_DELIVERY_THRESHOLD = 2500;

export function deliveryUnitPrice(slug: string): number {
  return DISHES.find((dish) => dish.slug === slug)?.pricePerPlate ?? 600;
}

/* ------------------------------------------------------------------ */
/* Traditional add-ons                                                 */
/*                                                                     */
/* These are the extras a guest adds alongside a main dish — naan from  */
/* the tandoor, raita and salad, lassi, and cold drinks. The catalogue  */
/* lives in the `menu_addons` Supabase table and is fully editable from  */
/* the admin panel; the list below is the fallback shown before the      */
/* table has been seeded, plus the four category headings.               */
/* ------------------------------------------------------------------ */

/** The four categories the add-on board renders, in display order. */
export const ADDON_GROUPS = [
  { id: "bread", label: "Breads & Naan", urdu: "روٹی و نان", icon: "🫓" },
  { id: "side", label: "Sides & Salads", urdu: "سالن و سلاد", icon: "🥗" },
  { id: "drink", label: "Drinks & Lassi", urdu: "مشروبات و لسی", icon: "🥤" },
  { id: "cold", label: "Cold Drinks", urdu: "کولڈ ڈرنک", icon: "🧊" },
] as const;

export type AddOnGroupId = (typeof ADDON_GROUPS)[number]["id"];

/** Add-ons that accompany any main dish order. */
export type AddOn = {
  id: string;
  name: string;
  urdu: string;
  price: number;
  group: AddOnGroupId;
  /** Chilled, so the board can nudge guests to add one. */
  chilled?: boolean;
};

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

/* ------------------------------------------------------------------ */
/* Pre-order catalogue                                                */
/*                                                                    */
/* Dishes that need ordering ahead — Dumpukht, Sajji, party platters.  */
/* The catalogue lives in the `pre_order_items` Supabase table and is   */
/* fully editable from the admin panel, with no cap on how many items   */
/* the team can add. This list is only the category headings.           */
/* ------------------------------------------------------------------ */

/** The categories a pre-order item can be filed under, in display order. */
export const PREORDER_CATEGORIES = [
  { id: "slow-cooked", label: "Slow-cooked & Handi", urdu: "دم پخت و ہانڈی" },
  { id: "grills", label: "Grills & Roast", urdu: "گرل و روسٹ" },
  { id: "platters", label: "Party Platters", urdu: "پارٹی پلیٹر" },
  { id: "sweets", label: "Desserts & Sweets", urdu: "میٹھا" },
] as const;

export type PreOrderCategoryId = (typeof PREORDER_CATEGORIES)[number]["id"];

/** Human label for a stored category id, with a safe fallback. */
export function preOrderCategoryLabel(id: string): string {
  return PREORDER_CATEGORIES.find((category) => category.id === id)?.label ?? "Pre-order";
}

/** Slugs for dishes that support weight/portion-based pricing. */
export const WEIGHTED_SLUGS = [
  "mutton-kunna",
  "mutton-dum-wala",
  "junooni-royal-platter",
] as const;

/** Default weight options for weighted dishes. */
export const DEFAULT_WEIGHTS: WeightOption[] = [
  { id: "half-kg", label: "Half KG", priceDelta: 0 },
  { id: "full-kg", label: "Full KG", priceDelta: 500 },
];

/** `850` → `"Rs 850"` */
export function formatRupees(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}
