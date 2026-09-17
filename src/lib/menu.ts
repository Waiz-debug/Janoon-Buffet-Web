/**
 * The Tribe of Taste menu — every dish is a first-class item with its own
 * detail page at `/menu/:slug`, so the landing page list and the dish pages
 * share one source of truth.
 */

export type CategoryId = "bbq" | "handi" | "fast-bites" | "desserts";

export type MenuCategory = {
  id: CategoryId;
  name: string;
  urdu: string;
  blurb: string;
  icon: "flame" | "pot" | "bites" | "dessert";
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
  /** Weight/portion options (e.g. Half KG / Full KG) for shareable dishes. */
  weights?: WeightOption[];
};

const unsplash = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;

const IMAGES = {
  kebab: unsplash("photo-1555939594-58d7cb561ad1"),
  grill: unsplash("photo-1600891964092-4316c288032e"),
  bbq: unsplash("photo-1544025162-d76694265947"),
  tikka: unsplash("photo-1585937421612-70a008356fbe"),
  handi: unsplash("photo-1563379091339-03b21ab4a4f8"),
  curry: unsplash("photo-1517248135467-4c7edcad34c4"),
  snacks: unsplash("photo-1414235077428-338989a2e8c0"),
  sweets: unsplash("photo-1563379091339-03b21ab4a4f8"),
} as const;

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: "bbq",
    name: "BBQ & Grills",
    urdu: "باری بی کیو",
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
    id: "fast-bites",
    name: "Fast Bites",
    urdu: "فاسٹ بائٹس",
    blurb:
      "Lahori street plates and lighter bites for children, cousins and the midnight crowd.",
    icon: "bites",
  },
  {
    id: "desserts",
    name: "Desi Desserts",
    urdu: "دیسی میٹھا",
    blurb:
      "Warm mithai lifted straight from the degh, served until the last table leaves.",
    icon: "dessert",
  },
];

export const DISHES: Dish[] = [
  /* ---------------------------------- BBQ ---------------------------------- */
  {
    slug: "beef-seekh-kebab",
    name: "Beef Seekh Kebab",
    urdu: "بیف سیخ کباب",
    categoryId: "bbq",
    summary: "Hand-pressed minced beef, grilled over open charcoal.",
    description:
      "Our signature kebab since the first night we opened: finely minced beef worked by hand with green chilli, coriander and toasted spice, pressed onto flat skewers and grilled over open charcoal until the edges catch. It is served the traditional way, with mint chutney, sliced onion and tandoor bread straight from the oven.",
    notes: [
      { label: "Counter", value: "Live charcoal grill" },
      { label: "Marination", value: "Twelve hours, pressed by hand" },
      { label: "Served with", value: "Mint chutney & tandoor bread" },
    ],
    pairings: ["chicken-malai-boti", "mutton-nihari"],
    image: IMAGES.kebab,
  },
  {
    slug: "chicken-malai-boti",
    name: "Chicken Malai Boti",
    urdu: "چکن ملائی بوٹی",
    categoryId: "bbq",
    summary: "Cream-marinated chicken, grilled soft with a faint smoke.",
    description:
      "Boneless chicken rests overnight in cream, cheddar and white pepper, then meets the coals just long enough to colour without drying. The result is the mildest kebab on our counter — soft, rich and the usual first request from younger guests.",
    notes: [
      { label: "Counter", value: "Live charcoal grill" },
      { label: "Spice", value: "Mild" },
      { label: "Served with", value: "Garlic yoghurt & salad" },
    ],
    pairings: ["beef-seekh-kebab", "chicken-shashlik"],
    image: IMAGES.grill,
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
    image: IMAGES.tikka,
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
    image: IMAGES.bbq,
  },

  /* --------------------------------- Handi -------------------------------- */
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
    image: IMAGES.handi,
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
    image: IMAGES.curry,
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
    image: IMAGES.handi,
  },
  {
    slug: "palak-paneer",
    name: "Palak Paneer",
    urdu: "پالک پنیر",
    categoryId: "handi",
    summary: "House-made paneer folded through slow-cooked spinach.",
    description:
      "Spinach is cooked gently so it keeps its colour, then brightened with ginger, garlic and a touch of cream. The paneer is set in our own kitchen each morning and cubed into the gravy just before service.",
    notes: [
      { label: "Paneer", value: "Set in-house each morning" },
      { label: "Spice", value: "Mild" },
      { label: "Best with", value: "Tandoori naan or sheermal" },
    ],
    pairings: ["mutton-nihari", "chicken-karahi"],
    image: IMAGES.curry,
  },

  /* ------------------------------- Fast Bites ------------------------------ */
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
    image: IMAGES.snacks,
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
    image: IMAGES.snacks,
  },
  {
    slug: "samosa-pakora",
    name: "Samosa & Pakora Counter",
    urdu: "سموسہ اور پکوڑا",
    categoryId: "fast-bites",
    summary: "Fried in small batches so they always arrive crisp.",
    description:
      "Potato and pea samosas, onion pakoras and spring rolls are fried in small batches through the night so nothing sits under a lamp. Served with imli and mint chutneys, and best eaten while they are still too hot.",
    notes: [
      { label: "Counter", value: "Fryer, small batches" },
      { label: "Served with", value: "Imli & mint chutney" },
      { label: "Availability", value: "All hours" },
    ],
    pairings: ["chicken-shashlik", "kulfi-falooda"],
    image: IMAGES.snacks,
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
      { label: "Served", value: "On the skewer" },
    ],
    pairings: ["chicken-malai-boti", "samosa-pakora"],
    image: IMAGES.grill,
  },

  /* -------------------------------- Desserts ------------------------------- */
  {
    slug: "gajar-ka-halwa",
    name: "Gajar ka Halwa",
    urdu: "گاجر کا حلوہ",
    categoryId: "desserts",
    summary: "Winter carrots cooked down with khoya and ghee.",
    description:
      "Grated carrots are cooked slowly in ghee until the moisture lifts, then finished with khoya, sugar and a handful of Pistachio. The halwa is kept warm on the counter and served in thick spoonfuls.",
    notes: [
      { label: "Cooking time", value: "Three hours, stirred by hand" },
      { label: "Served", value: "Warm" },
      { label: "Richness", value: "Khoya and pure ghee" },
    ],
    pairings: ["shahi-kheer", "kulfi-falooda"],
    image: IMAGES.sweets,
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
    pairings: ["gulab-jamun", "dahi-baray"],
    image: IMAGES.sweets,
  },
  {
    slug: "kulfi-falooda",
    name: "Kulfi Falooda",
    urdu: "قلفی فالودہ",
    categoryId: "desserts",
    summary: "Dense kulfi over falooda, rabri and rose syrup.",
    description:
      "House-made kulfi is set in metal moulds until dense and slow-melting, then turned out over falooda threads, thickened rabri and a measure of rose syrup. It is the coldest, richest way to finish a long dinner.",
    notes: [
      { label: "Kulfi", value: "Made in-house daily" },
      { label: "Served", value: "Frozen, with rabri" },
      { label: "Flavouring", value: "Rose syrup & pistachio" },
    ],
    pairings: ["gajar-ka-halwa", "chicken-karahi"],
    image: IMAGES.bbq,
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
    image: IMAGES.sweets,
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
 * The four dishes that ship as signatures, and the fallback shown before the
 * catalogue has been seeded. Which dishes are actually featured is decided by
 * the `featured` column — this list is only the out-of-the-box default.
 */
export const SIGNATURE_SLUGS = [
  "beef-seekh-kebab",
  "mutton-nihari",
  "grilled-fish",
  "kulfi-falooda",
] as const;


/* ------------------------------------------------------------------ */
/* Delivery pricing — mirrors the table in convex/delivery.ts, which  */
/* computes the authoritative total server-side at order time.        */
/* ------------------------------------------------------------------ */

export const DELIVERY_FEE = 150;
export const FREE_DELIVERY_THRESHOLD = 2500;

/** Per-plate delivery prices in whole rupees. */
const DELIVERY_PRICES: Record<string, number> = {
  "beef-seekh-kebab": 850,
  "chicken-malai-boti": 750,
  "chicken-tikka": 700,
  "grilled-fish": 1200,
  "mutton-nihari": 950,
  "chicken-karahi": 1100,
  "chicken-haleem": 650,
  "palak-paneer": 600,
  "lahori-chana-chaat": 400,
  "dahi-baray": 400,
  "samosa-pakora": 350,
  "chicken-shashlik": 750,
  "gajar-ka-halwa": 450,
  "shahi-kheer": 450,
  "kulfi-falooda": 500,
  "gulab-jamun": 400,
};

export function deliveryUnitPrice(slug: string): number {
  return DELIVERY_PRICES[slug] ?? 600;
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
