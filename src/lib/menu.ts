/**
 * The JUNOON demo menu — the catalogue the app ships with, and the exact rows
 * the admin panel writes into Supabase.
 *
 * This is the single place the demo menu is written down. `seedMenuCatalog()`
 * copies it into `menu_categories` (the counters) and `menu_dishes` (the
 * items), after which every row is the owner's to edit: names, prices, photos,
 * which counter an item sits on and whether guests see it at all. Nothing on the
 * guest site reads this file once the database has rows — it is the source for
 * the seed, and the fallback while the first read is still in flight.
 *
 * Ids are stable and meaningful (`bbq`, `handi`, `tandoor`, `fast-bites`,
 * `desserts`) so re-seeding updates the same rows instead of creating a second
 * set of counters beside the first. Four dishes are `SIGNATURE_SLUGS`, which is
 * also the most the database allows — the guest page shows them once, in the
 * Signatures strip, and withholds them from the counter sections so nothing
 * appears twice.
 */

export type CategoryId =
  | "bbq"
  | "handi"
  | "tandoor"
  | "fast-bites"
  | "desserts";

/** The badge a counter carries. Kept in step with `CATEGORY_ICONS`. */
export type MenuIcon = "flame" | "pot" | "bread" | "bites" | "dessert";

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
 * Demo photography, one named entry per dish family.
 *
 * Every id here resolves to a real Unsplash image (a bogus id 404s, so this
 * list was checked), and a dish is only ever pointed at a photo from its own
 * family — skewers on the grill counter, curry in the handi, bread by the
 * tandoor, mithai and glasses on the last. They are placeholders for the real
 * kitchen photography: any of them can be swapped in the admin panel, which
 * clears the row's photo outright when a file is uploaded.
 */
const IMG = {
  kebabSkewers: unsplash("photo-1555939594-58d7cb561ad1"),
  grillPlate: unsplash("photo-1600891964092-4316c288032e"),
  skewers: unsplash("photo-1544025162-d76694265947"),
  tandooriChicken: unsplash("photo-1585937421612-70a008356fbe"),
  grilledSteak: unsplash("photo-1504674900247-0877df9cc836"),
  grilledMeat: unsplash("photo-1585032226651-759b368d7246"),
  meatBoard: unsplash("photo-1541529086526-db283c563270"),
  kebabPlate: unsplash("photo-1512058564366-18510be2db19"),
  beefPlate: unsplash("photo-1606491956689-2ea866880c84"),
  fish: unsplash("photo-1467003909585-2f8a72700288"),
  fishCurry: unsplash("photo-1631452180519-c014fe946bc7"),
  curry: unsplash("photo-1563379091339-03b21ab4a4f8"),
  curry2: unsplash("photo-1517248135467-4c7edcad34c4"),
  curry3: unsplash("photo-1565557623262-b51c2513a641"),
  butterChicken: unsplash("photo-1603894584373-5ac82b2ae398"),
  rice: unsplash("photo-1603133872878-684f208fb84b"),
  breadLoaves: unsplash("photo-1509440159596-0249088772ff"),
  bakery: unsplash("photo-1495521821757-a1efb6729352"),
  flatbread: unsplash("photo-1549931319-a545dcf3bc73"),
  breadBasket: unsplash("photo-1608039755401-742074f0548d"),
  chaat: unsplash("photo-1414235077428-338989a2e8c0"),
  streetFood: unsplash("photo-1599487488170-d11ec9c172f0"),
  bowl: unsplash("photo-1476224203421-9ac39bcb3327"),
  saladBowl: unsplash("photo-1546069901-ba9599a7e63c"),
  mithai: unsplash("photo-1551024506-0bccd828d307"),
  mithai2: unsplash("photo-1488900128323-21503983a07e"),
  iceCream: unsplash("photo-1501443762994-82bd5dace89a"),
  kulfi: unsplash("photo-1621263764928-df1444c5e859"),
  falooda: unsplash("photo-1563805042-7684c019e1cb"),
  juice: unsplash("photo-1546173159-315724a31696"),
  drinks: unsplash("photo-1544145945-f90425340c7e"),
} as const;

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: "bbq",
    name: "Barbecue & Grill",
    urdu: "باریکو اور گرل",
    blurb:
      "Charcoal counters that stay lit all night, working from recipes the family has grilled for years.",
    icon: "flame",
  },
  {
    id: "handi",
    name: "Traditional Handi",
    urdu: "روایتی ہانڈی",
    blurb:
      "Slow clay-pot cooking that begins before dawn and simmers until the first guests sit down.",
    icon: "pot",
  },
  {
    id: "tandoor",
    name: "Tandoor & Naan",
    urdu: "تندور اور نان",
    blurb:
      "A tandoor banked at opening and never let go out — breads pulled to order and blistered in the heat.",
    icon: "bread",
  },
  {
    id: "fast-bites",
    name: "Fast Bites & Chaat",
    urdu: "فاسٹ بائٹس اور چات",
    blurb:
      "Lahori street plates and lighter bites, built in front of you so the crunch survives the walk to the table.",
    icon: "bites",
  },
  {
    id: "desserts",
    name: "Desserts & Drinks",
    urdu: "میٹھا اور مشروبات",
    blurb:
      "Warm mithai lifted straight from the degh, and the glasses to wash it down — served until the last table leaves.",
    icon: "dessert",
  },
];

export const DISHES: Dish[] = [
  /* ------------------------------ Barbecue & Grill -------------------------- */
  {
    slug: "beef-seekh-kebab",
    name: "Beef Seekh Kebab",
    urdu: "بیف سیخ کباب",
    categoryId: "bbq",
    summary: "Hand-pressed minced beef, grilled over open charcoal.",
    description:
      "Our signature kebab since the first night we opened: finely minced beef worked by hand with green chilli, coriander and toasted spice, pressed onto flat skewers and grilled over open charcoal until the edges catch. Served the traditional way, with mint chutney, sliced onion and tandoor bread straight from the oven.",
    notes: [
      { label: "Counter", value: "Live charcoal grill" },
      { label: "Marination", value: "Twelve hours, pressed by hand" },
      { label: "Served with", value: "Mint chutney & tandoor bread" },
    ],
    pairings: ["chicken-malai-boti", "mutton-nihari"],
    image: IMG.kebabSkewers,
    pricePerPlate: 1250,
  },
  {
    slug: "chicken-malai-boti",
    name: "Chicken Malai Boti",
    urdu: "چکن ملائی بوٹی",
    categoryId: "bbq",
    summary: "Cream-marinated chicken, grilled soft with a faint smoke.",
    description:
      "Boneless chicken rests overnight in cream, cheddar and white pepper, then meets the coals just long enough to colour without drying. The mildest kebab on our counter — soft, rich and the usual first request from younger guests.",
    notes: [
      { label: "Counter", value: "Live charcoal grill" },
      { label: "Spice", value: "Mild" },
      { label: "Served with", value: "Garlic yoghurt & salad" },
    ],
    pairings: ["beef-seekh-kebab", "samosa-pakora"],
    image: IMG.grillPlate,
    pricePerPlate: 1150,
  },
  {
    slug: "grilled-fish",
    name: "Charcoal Grilled Fish",
    urdu: "گرل شدہ مچھلی",
    categoryId: "bbq",
    summary: "Our daily special — whole fish, marinated overnight.",
    description:
      "A whole freshwater fish is scored, rubbed with ajwain, turmeric and crushed coriander, and left to marinate overnight before an unhurried turn over the coals. It is carved at the counter and served with imli chutney and lemon. Laid out fresh from seven in the evening, while it lasts.",
    notes: [
      { label: "Availability", value: "Daily special, from 7 PM" },
      { label: "Marination", value: "Overnight, ajwain & turmeric" },
      { label: "Served with", value: "Imli chutney & lemon" },
    ],
    pairings: ["chicken-tikka", "shahi-kheer"],
    image: IMG.fish,
    pricePerPlate: 1800,
  },
  {
    slug: "chicken-tikka",
    name: "Charcoal Chicken Tikka",
    urdu: "چکن تکہ",
    categoryId: "bbq",
    summary: "Bone-in tikka with a deep red chilli and yoghurt marinade.",
    description:
      "Whole leg pieces are scored, soaked in a chilli, yoghurt and mustard-oil marinade, and turned slowly over charcoal until the skin blisters. Sharp, smoky and unapologetically Lahori — ask for extra imli chutney.",
    notes: [
      { label: "Counter", value: "Live charcoal grill" },
      { label: "Spice", value: "Medium to hot" },
      { label: "Cut", value: "Bone-in leg and thigh" },
    ],
    pairings: ["beef-seekh-kebab", "lahori-chana-chaat"],
    image: IMG.tandooriChicken,
    pricePerPlate: 950,
  },
  {
    slug: "lamb-chop",
    name: "Lamb Chops",
    urdu: "گوشت کے ٹکڑے",
    categoryId: "bbq",
    summary: "French-trimmed lamb on the bone, salt-crusted and charred.",
    description:
      "Lamb racks trimmed to the bone, crusted in coarse salt with rosemary and cracked pepper, then grilled hard on the outside and rested in the foil so the juices stay in the meat. Cut into chops at the counter — two per plate, bread and chutney alongside.",
    notes: [
      { label: "Counter", value: "Live charcoal grill" },
      { label: "Resting", value: "Eight minutes, wrapped" },
      { label: "Served with", value: "Rosemary jus & bread" },
    ],
    pairings: ["chicken-malai-boti", "beef-qorma"],
    image: IMG.grilledSteak,
    pricePerPlate: 1650,
  },
  {
    slug: "beher-tikka",
    name: "Beher Tikka",
    urdu: "بہری ٹکہ",
    categoryId: "bbq",
    summary: "Firm river fish in a yoghurt marinade, kissed by the coals.",
    description:
      "Chunks of firm fish marinated in yoghurt, ginger and green chilli, threaded with onion and capsicum and finished over charcoal so the outside takes colour while the inside stays moist. The lighter of the two fish dishes, and the one to order if you want the smoke without the whole fish.",
    notes: [
      { label: "Counter", value: "Live charcoal grill" },
      { label: "Spice", value: "Medium" },
      { label: "Served with", value: "Imli chutney & salad" },
    ],
    pairings: ["grilled-fish", "plain-naan"],
    image: IMG.fishCurry,
    pricePerPlate: 1250,
  },

  /* ------------------------------ Traditional Handi ------------------------- */
  {
    slug: "mutton-nihari",
    name: "Mutton Nihari",
    urdu: "مٹن نہاری",
    categoryId: "handi",
    summary: "Simmered overnight until the meat gives way to the spoon.",
    weights: [
      { id: "half-kg", label: "Half KG", priceDelta: 0 },
      { id: "full-kg", label: "Full KG", priceDelta: 600 },
    ],
    description:
      "Bone-in mutton is sealed in its own stock at dawn and left to simmer through the day with a slow-roasted spice blend and marrow. By nightfall the gravy is glossy and the meat collapses at a touch of the spoon — best mopped up with a hot tandoori naan.",
    notes: [
      { label: "Cooking time", value: "Eight to ten hours" },
      { label: "Spice", value: "Medium" },
      { label: "Served with", value: "Ginger, chilli & lemon" },
    ],
    pairings: ["beef-seekh-kebab", "palak-paneer"],
    image: IMG.curry,
    pricePerPlate: 1450,
  },
  {
    slug: "chicken-karahi",
    name: "Chicken Karahi",
    urdu: "چکن کڑاہی",
    categoryId: "handi",
    summary: "Tomato, ginger and green chilli, finished in the wok.",
    weights: [
      { id: "half-kg", label: "Half KG", priceDelta: 0 },
      { id: "full-kg", label: "Full KG", priceDelta: 500 },
    ],
    description:
      "Cooked to order in a black iron karahi, our chicken is tossed with crushed tomato, julienned ginger and whole green chillies until the oil separates and the sauce turns deep red. Nothing is pre-cooked, so it arrives at the table still catching its breath.",
    notes: [
      { label: "Cooked", value: "Made to order" },
      { label: "Spice", value: "Medium, adjustable" },
      { label: "Served with", value: "Tandoori naan" },
    ],
    pairings: ["palak-paneer", "kulfi-falooda"],
    image: IMG.curry2,
    pricePerPlate: 1250,
  },
  {
    slug: "chicken-haleem",
    name: "Chicken Haleem",
    urdu: "چکن حلیم",
    categoryId: "handi",
    summary: "Wheat, lentils and chicken pounded into a velvet porridge.",
    weights: [
      { id: "half-kg", label: "Half KG", priceDelta: 0 },
      { id: "full-kg", label: "Full KG", priceDelta: 400 },
    ],
    description:
      "Cracked wheat and five lentils are cooked down with shredded chicken for hours, then pounded smooth with a wooden masher until the texture turns silken. It is finished with crisp fried onions, ginger and a squeeze of lemon.",
    notes: [
      { label: "Cooking time", value: "Six hours of pounding" },
      { label: "Texture", value: "Silken, spoon-thick" },
      { label: "Toppings", value: "Fried onion, ginger, lemon" },
    ],
    pairings: ["beef-seekh-kebab", "gulab-jamun"],
    image: IMG.curry3,
    pricePerPlate: 750,
  },
  {
    slug: "beef-qorma",
    name: "Beef Shahi Qorma",
    urdu: "بیف شاہی قورمہ",
    categoryId: "handi",
    summary: "Yoghurt and nut gravy, mild enough for the whole table.",
    description:
      "Beef shank braised until it gives, then folded into a pale gravy of whisked yoghurt, almond and cashew, browned onion and a whisper of cardamom. Finished with cream and silver leaf at the pass — the dish to order when the table wants something gentle and rich at once.",
    notes: [
      { label: "Cooking time", value: "Six hours, sealed" },
      { label: "Spice", value: "Mild" },
      { label: "Served with", value: "Sheermal or naan" },
    ],
    pairings: ["mutton-nihari", "lamb-chop"],
    image: IMG.butterChicken,
    pricePerPlate: 1150,
  },
  {
    slug: "mutton-paya",
    name: "Mutton Paya",
    urdu: "مٹن پایا",
    categoryId: "handi",
    summary: "Trotters slow-cooked with marrow and whole spices.",
    description:
      "Trotters, hoof and shin, scalded clean and simmered with ginger, black cardamom and a little vinegar until the marrow softens and thickens the broth. Eaten with a spoon, the way it should be, and ordered early — it takes all afternoon and all night to get right.",
    notes: [
      { label: "Cooking time", value: "Twelve hours" },
      { label: "Spice", value: "Medium-hot" },
      { label: "Best with", value: "Tandoori naan" },
    ],
    pairings: ["mutton-nihari", "special-naan"],
    image: IMG.beefPlate,
    pricePerPlate: 950,
  },
  {
    slug: "palak-paneer",
    name: "Palak Paneer",
    urdu: "پالک پنیر",
    categoryId: "handi",
    summary: "House-made paneer folded through slow-cooked spinach.",
    description:
      "Spinach cooked gently so it keeps its colour, then brightened with ginger, garlic and a touch of cream. The paneer is set in our own kitchen each morning and cubed into the gravy just before service.",
    notes: [
      { label: "Paneer", value: "Set in-house each morning" },
      { label: "Spice", value: "Mild" },
      { label: "Best with", value: "Tandoori naan or sheermal" },
    ],
    pairings: ["chicken-karahi", "special-naan"],
    image: IMG.rice,
    pricePerPlate: 700,
  },

  /* ------------------------------ Tandoor & Naan ---------------------------- */
  {
    slug: "special-naan",
    name: "Special Naan",
    urdu: "اسپیشل نان",
    categoryId: "tandoor",
    summary: "Stuffed, brushed with ghee and blistered in the tandoor.",
    description:
      "A hand-knotted naan filled with minced mutton, onion and coriander, sealed and slapped against the inside of the tandoor wall until the top chars in spots and the base stays soft. Brushed with ghee the moment it comes out and torn at the table.",
    notes: [
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Bake", value: "Ninety seconds" },
      { label: "Best within", value: "Ten minutes of the oven" },
    ],
    pairings: ["mutton-nihari", "chicken-karahi"],
    image: IMG.breadLoaves,
    pricePerPlate: 320,
  },
  {
    slug: "tandoori-naan",
    name: "Tandoori Naan",
    urdu: "تندوری نان",
    categoryId: "tandoor",
    summary: "The everyday bread, pulled to order.",
    description:
      "Flour, yoghurt and a little mustard oil, rested overnight so the dough keeps its shape, then slapped onto the tandoor wall. Puffy in the middle, crisp at the edges, and the one every curry on this menu is eaten with.",
    notes: [
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Bake", value: "Sixty seconds" },
      { label: "Made with", value: "Yoghurt & mustard oil" },
    ],
    pairings: ["chicken-karahi", "mutton-paya"],
    image: IMG.bakery,
    pricePerPlate: 130,
  },
  {
    slug: "plain-naan",
    name: "Plain Naan",
    urdu: "سادہ نان",
    categoryId: "tandoor",
    summary: "The plain one, for the table that likes it simple.",
    description:
      "No filling, no ghee, nothing to hide behind — flour, salt, water and a little yeast, blistered until the top freckles. Ordered by the dozen on a table that has run out of everything else, and the correct thing to mop a karahi with.",
    notes: [
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Bake", value: "Sixty seconds" },
      { label: "Best with", value: "Karahi & qorma" },
    ],
    pairings: ["chicken-karahi", "beef-qorma"],
    image: IMG.flatbread,
    pricePerPlate: 80,
  },
  {
    slug: "keema-naan",
    name: "Keema Naan",
    urdu: "کیما نان",
    categoryId: "tandoor",
    summary: "Spiced minced beef baked inside the bread.",
    description:
      "The same stuffed naan technique, filled with slow-cooked minced beef, green chilli and a little tomato, then baked and finished with coriander. Richer and more strongly spiced than the special naan, and the one children fight over.",
    notes: [
      { label: "Oven", value: "Clay tandoor, 480°C" },
      { label: "Spice", value: "Medium" },
      { label: "Bake", value: "Ninety seconds" },
    ],
    pairings: ["grilled-fish", "dahi-baray"],
    image: IMG.breadBasket,
    pricePerPlate: 380,
  },
  {
    slug: "lachha-paratha",
    name: "Lachha Paratha",
    urdu: "لچھا پراٹھا",
    categoryId: "tandoor",
    summary: "Layered, flaky and ghee-soaked.",
    description:
      "A hundred and twenty layers folded into the dough by hand, rolled thin and cooked on the griddle until each layer separates and the edges crisp. Served hot with a spoon of white butter and a cup of chai — breakfast, or the perfect ending to a barbecue.",
    notes: [
      { label: "Layers", value: "120, folded by hand" },
      { label: "Cooked on", value: "Flat iron griddle" },
      { label: "Served with", value: "White butter" },
    ],
    pairings: ["kashmiri-chai", "dahi-baray"],
    image: IMG.flatbread,
    pricePerPlate: 180,
  },

  /* ---------------------------- Fast Bites & Chaat -------------------------- */
  {
    slug: "lahori-chana-chaat",
    name: "Lahori Chana Chaat",
    urdu: "لاہوری چنا چاٹ",
    categoryId: "fast-bites",
    summary: "Chickpeas, tamarind and yoghurt, built to order.",
    description:
      "Boiled chickpeas arrive sharp with chaat masala, imli water, mint yoghurt, chopped onion and crisp papri. It is assembled in front of you so the papri never has time to soften.",
    notes: [
      { label: "Counter", value: "Chaat station" },
      { label: "Served", value: "Assembled to order" },
      { label: "Spice", value: "Medium, tangy" },
    ],
    pairings: ["dahi-baray", "samosa-pakora"],
    image: IMG.chaat,
    pricePerPlate: 420,
  },
  {
    slug: "dahi-baray",
    name: "Dahi Baray",
    urdu: "دہی بڑے",
    categoryId: "fast-bites",
    summary: "Lentil dumplings under cool whipped yoghurt.",
    description:
      "Soft lentil dumplings are soaked in water until pillowy, then dressed with thick whipped yoghurt, imli chutney and a dusting of roasted cumin. Cool, tangy and the calmest thing on the table.",
    notes: [
      { label: "Counter", value: "Chaat station" },
      { label: "Served", value: "Chilled" },
      { label: "Spice", value: "Mild" },
    ],
    pairings: ["lahori-chana-chaat", "shahi-kheer"],
    image: IMG.bowl,
    pricePerPlate: 420,
  },
  {
    slug: "samosa-pakora",
    name: "Samosa & Pakora",
    urdu: "سموسہ اور پکوڑا",
    categoryId: "fast-bites",
    summary: "Fried in small batches so they always arrive crisp.",
    description:
      "Potato and pea samosas, onion pakoras and bread rolls are fried in small batches through the night so nothing sits under a lamp. Served with imli and mint chutneys, and best eaten while they are still too hot to share politely.",
    notes: [
      { label: "Counter", value: "Fryer, small batches" },
      { label: "Served with", value: "Imli & mint chutney" },
      { label: "Availability", value: "All hours" },
    ],
    pairings: ["chicken-shashlik", "kulfi-falooda"],
    image: IMG.streetFood,
    pricePerPlate: 380,
  },
  {
    slug: "chicken-paratha-roll",
    name: "Chicken Paratha Roll",
    urdu: "چکن پراٹھا رول",
    categoryId: "fast-bites",
    summary: "The lunch everyone orders, wrapped in two minutes.",
    description:
      "Shredded chicken tikka folded into a flaky paratha with onion, imli chutney and a line of chilli sauce, rolled tight and pressed on the griddle for a moment so it holds together. Wrapped in paper, eaten on the street.",
    notes: [
      { label: "Counter", value: "Roll station" },
      { label: "Served", value: "Wrapped to go" },
      { label: "Spice", value: "Medium" },
    ],
    pairings: ["mango-lassi", "samosa-pakora"],
    image: IMG.saladBowl,
    pricePerPlate: 350,
  },
  {
    slug: "chicken-shashlik",
    name: "Chicken Shashlik Sticks",
    urdu: "چکن شاشلک",
    categoryId: "fast-bites",
    summary: "Skewered chicken with peppers, onion and a soy glaze.",
    description:
      "Cubes of chicken are threaded with onion, capsicum and tomato, grilled quickly and brushed with a light soy and chilli glaze. A straightforward plate that suits children as much as anyone looking for something quick between buffet rounds.",
    notes: [
      { label: "Counter", value: "Grill station" },
      { label: "Spice", value: "Mild" },
      { label: "Served with", value: "On the skewer" },
    ],
    pairings: ["samosa-pakora", "mango-lassi"],
    image: IMG.kebabPlate,
    pricePerPlate: 800,
  },

  /* ---------------------------- Desserts & Drinks --------------------------- */
  {
    slug: "kulfi-falooda",
    name: "Kulfi Falooda",
    urdu: "قلفی فالودہ",
    categoryId: "desserts",
    summary: "Dense kulfi over falooda, rabri and rose syrup.",
    description:
      "House-made kulfi is set in metal moulds until dense and slow-melting, then turned out over falooda threads, thickened rabri and a measure of rose syrup. The coldest, richest way to finish a long dinner.",
    notes: [
      { label: "Kulfi", value: "Made in-house daily" },
      { label: "Served", value: "Frozen, with rabri" },
      { label: "Flavouring", value: "Rose syrup & pistachio" },
    ],
    pairings: ["chicken-karahi", "gulab-jamun"],
    image: IMG.kulfi,
    pricePerPlate: 550,
  },
  {
    slug: "shahi-kheer",
    name: "Shahi Kheer",
    urdu: "شاہی کھیر",
    categoryId: "desserts",
    summary: "Rice pudding reduced slowly with saffron and nuts.",
    description:
      "Full-cream milk is reduced with broken rice for hours until it thickens to a pale gold, then perfumed with saffron, cardamom and slivered almonds. Served chilled, in the small bowls it has always been served in.",
    notes: [
      { label: "Cooking time", value: "Reduced for four hours" },
      { label: "Served", value: "Chilled" },
      { label: "Flavouring", value: "Saffron & cardamom" },
    ],
    pairings: ["gulab-jamun", "grilled-fish"],
    image: IMG.mithai,
    pricePerPlate: 450,
  },
  {
    slug: "gulab-jamun",
    name: "Gulab Jamun & Rabri",
    urdu: "گلاب جامن",
    categoryId: "desserts",
    summary: "Warm milk dumplings under thickened rabri.",
    description:
      "Khoya dumplings are fried to a deep amber and soaked in cardamom syrup until they double in size, then served warm with a spoon of rabri over the top.",
    notes: [
      { label: "Fried", value: "To order, small batches" },
      { label: "Served", value: "Warm with rabri" },
      { label: "Syrup", value: "Cardamom & rose water" },
    ],
    pairings: ["shahi-kheer", "chicken-haleem"],
    image: IMG.mithai2,
    pricePerPlate: 420,
  },
  {
    slug: "mango-lassi",
    name: "Mango Lassi",
    urdu: "آم کا لاسی",
    categoryId: "desserts",
    summary: "Thick, cold and made with the season's mango.",
    description:
      "Yoghurt whisked with chilled mango pulp, a little sugar and a pinch of black salt, poured over crushed ice. The glass that goes with everything on this menu, and the one that disappears fastest in summer.",
    notes: [
      { label: "Made with", value: "Yoghurt & seasonal mango" },
      { label: "Served", value: "Over crushed ice" },
      { label: "Best with", value: "Anything off the grill" },
    ],
    pairings: ["chicken-paratha-roll", "samosa-pakora"],
    image: IMG.juice,
    pricePerPlate: 420,
  },
  {
    slug: "kashmiri-chai",
    name: "Kashmiri Chai",
    urdu: "کشمیری چائے",
    categoryId: "desserts",
    summary: "Pink, sweet and pulled until it foams.",
    description:
      "Loose-leaf tea boiled with milk, then whisked between two vessels until it turns the colour of rose. Sugar to the house standard, a pinch of cardamom, and a glass rather than a cup — the way it is served at every table in Lahore.",
    notes: [
      { label: "Brewed", value: "Loose leaf, pulled to order" },
      { label: "Served", value: "In a glass" },
      { label: "Sweetness", value: "House standard" },
    ],
    pairings: ["lachha-paratha", "gulab-jamun"],
    image: IMG.drinks,
    pricePerPlate: 180,
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
 */
export const SIGNATURE_SLUGS = [
  "beef-seekh-kebab",
  "chicken-malai-boti",
  "mutton-nihari",
  "special-naan",
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
  "chicken-karahi",
  "mutton-nihari",
  "chicken-haleem",
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
