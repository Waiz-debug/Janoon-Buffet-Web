import {
  ADDONS,
  DISHES,
  MENU_CATEGORIES,
  PREORDER_CATEGORIES,
  SIGNATURE_LIMIT,
  SIGNATURE_SLUGS,
  type PreOrderCategoryId,
  deliveryUnitPrice,
  type CategoryId,
} from "@/lib/menu";
import { GALLERY } from "@/lib/restaurant";
import { MEDIA_BUCKET, TABLES, mediaUrl, supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types — rows are shaped exactly like the components expect, so the  */
/* UI reads the same fields it always has (`_id`, camelCase, ms time). */
/* ------------------------------------------------------------------ */

export type DeliveryStatus = "placed" | "confirmed" | "delivered";
export type ReservationStatus = "pending" | "confirmed" | "seated" | "cancelled";
export type Seating = "outdoor" | "indoor";
export type CategoryIcon = "flame" | "pot" | "bites" | "dessert";

export type DeliveryOrderLine = {
  slug: string;
  name: string;
  count: number;
  unitPrice: number;
};

export type DeliveryOrder = {
  _id: string;
  reference: string;
  customerName: string;
  phone: string;
  address: string;
  area: string;
  notes?: string;
  items: DeliveryOrderLine[];
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  status: DeliveryStatus;
  createdAt: number;
  deliveredAt?: number;
};

export type Reservation = {
  _id: string;
  reference: string;
  name: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  seating: Seating;
  notes?: string;
  status: ReservationStatus;
  createdAt: number;
};

export type PreorderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "collected"
  | "cancelled";

export type Preorder = {
  _id: string;
  reference: string;
  customerName: string;
  phone: string;
  dish: string;
  quantity: number;
  /** Pickup day as `YYYY-MM-DD` — the field the Today/History split reads. */
  pickupDate: string;
  pickupTime: string;
  notes?: string;
  status: PreorderStatus;
  createdAt: number;
};

export type Promotion = {
  _id: string;
  title: string;
  headline: string;
  body?: string;
  visible: boolean;
  imageUrl?: string;
  imagePath?: string;
  /** Optional action for the offer's button — an in-app path or a full URL. */
  linkUrl?: string;
  /** Position on the offers board — lower first. */
  sortOrder: number;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type SiteMediaRow = {
  _id: string;
  slot: string;
  caption?: string;
  url?: string;
  imageStorageId?: string;
  /** Still the seeded placeholder rather than a real upload. */
  demo: boolean;
};

/** One traditional add-on, as the admin panel and the public board see it. */
export type AddOnRow = {
  id: string;
  name: string;
  urdu?: string;
  price: number;
  /** id of the `addon_categories` row this item sits under. */
  category: string;
  image?: string;
  imageStorageId?: string;
  active: boolean;
  /** Still the seeded placeholder rather than a real upload. */
  demo: boolean;
  sortOrder: number;
  chilled: boolean;
};

/** One item available for pre-order (Dumpukht, Sajji, platters, etc.). */
export type PreOrderItemRow = {
  id: string;
  name: string;
  urdu?: string;
  description?: string;
  price: number;
  category: PreOrderCategoryId;
  serves?: string;
  image?: string;
  imagePath?: string;
  active: boolean;
  demo: boolean;
  sortOrder: number;
};

/** One editable line of copy in `site_content`. */
export type SiteContentRow = {
  key: string;
  value: string;
};

export type MenuCategoryRow = {
  id: CategoryId;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: CategoryIcon;
  sortOrder: number;
  active: boolean;
};

export type MenuDishRow = {
  slug: string;
  name: string;
  urdu?: string;
  categoryId: string;
  summary?: string;
  description?: string;
  notes?: { label: string; value: string }[];
  pairings?: string[];
  image?: string;
  imageStorageId?: string;
  pricePerPlate?: number;
  active: boolean;
  featured: boolean;
  /** Still the seeded placeholder photo rather than a real upload. */
  demo: boolean;
  sortOrder: number;
};

export type UploadedImage = {
  /** Storage object path inside the media bucket. */
  storageId: string;
  /** Publicly readable URL for immediate preview. */
  url: string;
  name: string;
  mimeType: string;
  bytes: number;
};

/* ------------------------------------------------------------------ */
/* Row shapes as stored in Postgres (snake_case).                      */
/* ------------------------------------------------------------------ */

type DeliveryOrderDb = {
  id: string;
  reference: string;
  customer_name: string;
  phone: string;
  address: string;
  area: string;
  notes: string | null;
  items: DeliveryOrderLine[] | null;
  items_total: number;
  delivery_fee: number;
  total: number;
  status: DeliveryStatus;
  created_at: number | string;
  delivered_at: number | string | null;
};

type ReservationDb = {
  id: string;
  reference: string;
  name: string;
  phone: string;
  party_size: number;
  date: string;
  time: string;
  seating: Seating;
  notes: string | null;
  status: ReservationStatus;
  created_at: number | string;
};

type PreorderDb = {
  id: string;
  reference: string;
  customer_name: string;
  phone: string;
  dish: string;
  quantity: number;
  pickup_date: string;
  pickup_time: string;
  notes: string | null;
  status: PreorderStatus;
  created_at: number | string;
};

type PromotionDb = {
  id: string;
  title: string;
  headline: string;
  body: string | null;
  visible: boolean;
  image_url: string | null;
  image_path: string | null;
  link_url: string | null;
  sort_order: number | null;
  expires_at: number | string | null;
  created_at: number | string;
  updated_at: number | string;
};

type SiteMediaDb = {
  slot: string;
  caption: string | null;
  url: string | null;
  image_path: string | null;
  demo: boolean | null;
};

type AddOnDb = {
  id: string;
  name: string;
  urdu: string | null;
  price: number;
  category: string;
  image: string | null;
  image_path: string | null;
  active: boolean;
  demo: boolean | null;
  sort_order: number;
};

type SiteContentDb = {
  key: string;
  value: string | null;
};

type CategoryDb = {
  id: string;
  name: string;
  urdu: string | null;
  blurb: string | null;
  icon: CategoryIcon;
  sort_order: number;
  active: boolean;
};

type DishDb = {
  slug: string;
  name: string;
  urdu: string | null;
  category_id: string;
  summary: string | null;
  description: string | null;
  notes: { label: string; value: string }[] | null;
  pairings: string[] | null;
  image: string | null;
  image_path: string | null;
  price_per_plate: number | null;
  active: boolean;
  featured: boolean;
  demo: boolean | null;
  sort_order: number;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ms = (value: number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Reads never throw: if a table is missing (the SQL has not been run yet) or
 * the network is down, the caller gets an empty list and the site falls back
 * to its built-in catalogue instead of breaking.
 */
/** The slice of the PostgREST builder the readers actually use. */
type RowQuery = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  eq: (column: string, value: unknown) => RowQuery;
  order: (column: string, options?: { ascending?: boolean }) => RowQuery;
  limit: (count: number) => RowQuery;
};

async function selectRows<Row>(
  table: string,
  configure?: (query: RowQuery) => RowQuery,
  columns = "*",
): Promise<Row[]> {
  const base = supabase.from(table).select(columns) as unknown as RowQuery;
  const query = configure ? configure(base) : base;
  const { data, error } = await query;
  if (error) {
    console.warn(`[Janoon] "${table}" read failed: ${error.message}`);
    return [];
  }
  return Array.isArray(data) ? (data as Row[]) : [];
}

/**
 * Surface a mutation failure. A missing table almost always means the schema
 * has not been applied yet, so that case gets an actionable message instead of
 * a raw Postgres string.
 */
function fail(error: { message: string } | null, fallback: string): never {
  const message = error?.message ?? "";
  if (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("Could not find the table")
  ) {
    throw new Error(
      "A Supabase table or column is missing. Run supabase/schema.sql in the Supabase SQL editor, then try again.",
    );
  }
  throw new Error(message || fallback);
}

/**
 * Unwrap a value a `security definer` function promised to return.
 *
 * Written as a function rather than an inline `if (!value) throw` because
 * `fail()` above is typed `never`: everything after a call to it is
 * unreachable as far as TypeScript's flow analysis is concerned, and narrowing
 * inside unreachable code does not happen. Reading the value through here keeps
 * the call sites honest without depending on that.
 */
function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

/* ------------------------------------------------------------------ */
/* Menu & site media                                                   */
/* ------------------------------------------------------------------ */

function toDish(row: DishDb): MenuDishRow {
  return {
    slug: row.slug,
    name: row.name,
    urdu: row.urdu ?? undefined,
    categoryId: row.category_id,
    summary: row.summary ?? undefined,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    pairings: row.pairings ?? undefined,
    image: row.image || mediaUrl(row.image_path) || "",
    imageStorageId: row.image_path ?? undefined,
    pricePerPlate: row.price_per_plate ?? undefined,
    active: row.active,
    featured: row.featured,
    demo: row.demo ?? false,
    sortOrder: row.sort_order,
  };
}

function toCategory(row: CategoryDb): MenuCategoryRow {
  return {
    id: row.id as CategoryId,
    name: row.name,
    urdu: row.urdu ?? undefined,
    blurb: row.blurb ?? undefined,
    icon: row.icon,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

/** Every category, live first — used by the admin portal. */
export async function fetchCategories(): Promise<MenuCategoryRow[]> {
  const rows = await selectRows<CategoryDb>(TABLES.categories, (q) =>
    q.order("sort_order", { ascending: true }),
  );
  return rows.map(toCategory);
}

/** Only the counters shown on the public menu. */
export async function fetchPublicCategories(): Promise<MenuCategoryRow[]> {
  const rows = await selectRows<CategoryDb>(TABLES.categories, (q) =>
    q.eq("active", true).order("sort_order", { ascending: true }),
  );
  return rows.map(toCategory);
}

/** Every dish, hidden ones included — used by the admin portal. */
export async function fetchDishes(): Promise<MenuDishRow[]> {
  const rows = await selectRows<DishDb>(TABLES.dishes, (q) =>
    q.order("sort_order", { ascending: true }),
  );
  return rows.map(toDish);
}

/** Only the dishes published to guests. */
export async function fetchPublicDishes(): Promise<MenuDishRow[]> {
  const rows = await selectRows<DishDb>(TABLES.dishes, (q) =>
    q.eq("active", true).order("sort_order", { ascending: true }),
  );
  return rows.map(toDish);
}

export async function fetchSiteMedia(): Promise<SiteMediaRow[]> {
  const rows = await selectRows<SiteMediaDb>(TABLES.siteMedia);
  return rows.map((row) => ({
    _id: row.slot,
    slot: row.slot,
    caption: row.caption ?? undefined,
    url: row.url || mediaUrl(row.image_path) || undefined,
    imageStorageId: row.image_path ?? undefined,
    demo: row.demo ?? false,
  }));
}

/**
 * Copy the built-in catalogue into Supabase. Runs once, from the admin portal,
 * so the public menu becomes admin-editable the first time it is opened.
 */
export async function seedMenuCatalog(): Promise<void> {
  const categories = MENU_CATEGORIES.map((category, index) => ({
    id: category.id,
    name: category.name,
    urdu: category.urdu,
    blurb: category.blurb,
    icon: category.icon,
    sort_order: index + 1,
    active: true,
  }));
  const { error: categoryError } = await supabase
    .from(TABLES.categories)
    .upsert(categories, { onConflict: "id" });
  fail(categoryError, "Could not seed the menu counters.");

  const dishes = DISHES.map((dish, index) => ({
    slug: dish.slug,
    name: dish.name,
    urdu: dish.urdu,
    category_id: dish.categoryId,
    summary: dish.summary,
    description: dish.description,
    notes: dish.notes,
    pairings: dish.pairings,
    image: dish.image,
    price_per_plate: deliveryUnitPrice(dish.slug),
    active: true,
    featured: (SIGNATURE_SLUGS as readonly string[]).includes(dish.slug),
    demo: true,
    sort_order: index + 1,
    updated_at: Date.now(),
  }));
  const { error: dishError } = await supabase
    .from(TABLES.dishes)
    .upsert(dishes, { onConflict: "slug" });
  fail(dishError, "Could not seed the menu dishes.");
}

/**
 * Publish the built-in gallery photos as `site_media` rows so the admin panel
 * lists the same six images the public site renders — as real, replaceable
 * items rather than a "default in use" placeholder.
 *
 * Slots that already hold a row are skipped, so a real upload is never
 * overwritten by re-running the seed. Returns how many slots were filled.
 */
export async function seedDemoGallery(): Promise<number> {
  const existing = await selectRows<{ slot: string }>(
    TABLES.siteMedia,
    undefined,
    "slot",
  );
  const taken = new Set(existing.map((row) => row.slot));
  const now = Date.now();

  const rows = GALLERY.map((post, index) => ({
    slot: `gallery-${index + 1}`,
    caption: post.caption,
    url: post.image,
    image_path: null,
    demo: true,
    updated_at: now,
  })).filter((row) => !taken.has(row.slot));

  if (rows.length === 0) return 0;
  const { error } = await supabase.from(TABLES.siteMedia).insert(rows);
  fail(error, "Could not seed the demo gallery.");
  return rows.length;
}

/**
 * Top up the Signature section to the full four dishes.
 *
 * Bases seeded before the four-dish rule existed can end up with fewer
 * featured dishes than the site needs, which leaves the public strip short and
 * the admin panel showing almost nothing. This restores the missing ones from
 * the built-in list, never overwrites a choice the team already made, and
 * never pushes past the limit. Returns how many dishes it featured.
 */
export async function ensureSignatureDishes(): Promise<number> {
  const rows = await selectRows<{ slug: string; featured: boolean }>(
    TABLES.dishes,
    undefined,
    "slug, featured",
  );
  if (rows.length === 0) return 0;

  const featured = new Set(
    rows.filter((row) => row.featured).map((row) => row.slug),
  );
  if (featured.size >= SIGNATURE_LIMIT) return 0;

  const missing = SIGNATURE_SLUGS.filter(
    (slug) => !featured.has(slug) && rows.some((row) => row.slug === slug),
  ).slice(0, SIGNATURE_LIMIT - featured.size);

  let restored = 0;
  for (const slug of missing) {
    const { error } = await supabase
      .from(TABLES.dishes)
      .update({ featured: true, updated_at: Date.now() })
      .eq("slug", slug);
    fail(error, "Could not restore the signature dishes.");
    restored += 1;
  }
  return restored;
}

export type CategoryInput = {
  /** Omitted when creating — the id is derived from the name. */
  id?: string;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: CategoryIcon;
  sortOrder?: number;
  active: boolean;
};

/**
 * Create a counter or update an existing one. On create the id is derived from
 * the name and appended to the end of the menu, so the owner only has to type
 * the name they want guests to see — the same approach as add-on categories.
 */
export async function upsertCategory(
  input: CategoryInput,
): Promise<{ id: string; created: boolean }> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Give the counter a name first.");

  const id =
    input.id ||
    `${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;

  const existing = input.id
    ? await selectRows<{ id: string }>(
        TABLES.categories,
        (q) => q.eq("id", input.id as string).limit(1),
        "id",
      )
    : [];

  const { error } = await supabase.from(TABLES.categories).upsert(
    {
      id,
      name,
      urdu: input.urdu?.trim() || null,
      blurb: input.blurb?.trim() || null,
      icon: input.icon,
      sort_order: input.sortOrder ?? 0,
      active: input.active,
    },
    { onConflict: "id" },
  );
  fail(error, "Could not save the counter.");
  return { id, created: existing.length === 0 };
}

export async function deleteCategory(id: string): Promise<void> {
  const { error: dishError } = await supabase
    .from(TABLES.dishes)
    .update({ category_id: "uncategorized", active: false })
    .eq("category_id", id);
  fail(dishError, "Could not move the dishes off that counter.");
  const { error } = await supabase.from(TABLES.categories).delete().eq("id", id);
  fail(error, "Could not delete the counter.");
}

export type DishInput = {
  slug?: string;
  name: string;
  urdu?: string;
  categoryId: string;
  summary?: string;
  description?: string;
  image?: string;
  imagePath?: string;
  pricePerPlate?: number;
  active: boolean;
  featured: boolean;
  sortOrder: number;
};

export async function upsertDish(
  input: DishInput,
): Promise<{ slug: string; updated: boolean }> {
  const slug =
    input.slug ||
    `${input.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = input.slug
    ? await selectRows<{ slug: string }>(
        TABLES.dishes,
        (q) => q.eq("slug", input.slug).limit(1),
        "slug",
      )
    : [];
  const row: Record<string, unknown> = {
    slug,
    name: input.name,
    urdu: input.urdu ?? null,
    category_id: input.categoryId,
    summary: input.summary ?? null,
    description: input.description ?? null,
    price_per_plate: input.pricePerPlate ?? null,
    active: input.active,
    featured: input.featured,
    sort_order: input.sortOrder,
    updated_at: Date.now(),
  };
  if (input.imagePath) {
    // An upload owns the photo outright — drop the external demo URL so it
    // cannot shadow the new object when the row is read back.
    row.image_path = input.imagePath;
    row.image = null;
    row.demo = false;
  } else if (input.image !== undefined) {
    row.image = input.image || null;
  }

  const { error } = await supabase
    .from(TABLES.dishes)
    .upsert(row, { onConflict: "slug" });
  fail(error, "Could not save the dish.");
  return { slug, updated: existing.length > 0 };
}

export async function deleteDish(slug: string): Promise<void> {
  const { error } = await supabase.from(TABLES.dishes).delete().eq("slug", slug);
  fail(error, "Could not delete the dish.");
}

export async function setDishImage(
  slug: string,
  imagePath: string,
): Promise<string> {
  const { error } = await supabase
    .from(TABLES.dishes)
    // Clearing `image` matters: an external demo URL left in place would
    // shadow the freshly uploaded object when the row is read back.
    .update({ image_path: imagePath, image: null, demo: false, updated_at: Date.now() })
    .eq("slug", slug);
  fail(error, "Could not attach the photo.");
  return mediaUrl(imagePath) ?? "";
}

export async function removeDishImage(slug: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.dishes)
    .update({ image_path: null, image: null, demo: false, updated_at: Date.now() })
    .eq("slug", slug);
  fail(error, "Could not remove the photo.");
}

export async function setSiteMedia(
  slot: string,
  imagePath: string,
  caption?: string,
): Promise<void> {
  const { error } = await supabase.from(TABLES.siteMedia).upsert(
    {
      slot,
      caption: caption ?? null,
      url: null,
      image_path: imagePath,
      demo: false,
      updated_at: Date.now(),
    },
    { onConflict: "slot" },
  );
  fail(error, "Could not publish the photo.");
}

export async function clearSiteMedia(slot: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.siteMedia)
    .delete()
    .eq("slot", slot);
  fail(error, "Could not clear the slot.");
}

/**
 * Editable copy (the seating counter and anything similar). Read as a list of
 * rows rather than a map so it can ride the same realtime table subscription
 * as every other admin-managed collection.
 */
export async function fetchSiteContent(): Promise<SiteContentRow[]> {
  const rows = await selectRows<SiteContentDb>(TABLES.siteContent);
  return rows
    .filter((row) => Boolean(row.value))
    .map((row) => ({ key: row.key, value: row.value as string }));
}

export async function setSiteContent(
  key: string,
  value: string,
): Promise<void> {
  const trimmed = value.trim();
  const { error } = await supabase.from(TABLES.siteContent).upsert(
    { key, value: trimmed, updated_at: Date.now() },
    { onConflict: "key" },
  );
  fail(error, "Could not save that text.");
}

/* ------------------------------------------------------------------ */
/* Traditional add-ons                                                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------- add-on categories ----- */

/** One heading on the Traditional Add-ons board, e.g. "Cold Drinks". */
export type AddOnCategoryRow = {
  id: string;
  name: string;
  urdu?: string;
  icon: string;
  sortOrder: number;
  active: boolean;
};

type AddOnCategoryDb = {
  id: string;
  name: string;
  urdu: string | null;
  icon: string | null;
  sort_order: number | null;
  active: boolean | null;
};

function toAddOnCategory(row: AddOnCategoryDb): AddOnCategoryRow {
  return {
    id: row.id,
    name: row.name,
    urdu: row.urdu ?? undefined,
    icon: row.icon || "\uD83C\uDF7D",
    sortOrder: row.sort_order ?? 0,
    active: row.active ?? true,
  };
}

/** Every heading, hidden ones included — the admin board. */
export async function fetchAddOnCategories(): Promise<AddOnCategoryRow[]> {
  const rows = await selectRows<AddOnCategoryDb>(TABLES.addonCategories, (q) =>
    q.order("sort_order", { ascending: true }),
  );
  return rows.map(toAddOnCategory);
}

/** Only the headings shown to guests, in display order. */
export async function fetchPublicAddOnCategories(): Promise<AddOnCategoryRow[]> {
  const rows = await selectRows<AddOnCategoryDb>(TABLES.addonCategories, (q) =>
    q.eq("active", true).order("sort_order", { ascending: true }),
  );
  return rows.map(toAddOnCategory);
}

export type AddOnCategoryInput = {
  id?: string;
  name: string;
  urdu?: string;
  icon?: string;
  sortOrder?: number;
  active: boolean;
};

/**
 * Create a heading or rename an existing one. On create the id is derived from
 * the name, so the admin never has to invent a slug.
 */
export async function upsertAddOnCategory(
  input: AddOnCategoryInput,
): Promise<{ id: string; created: boolean }> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Give the category a name first.");

  const id =
    input.id ||
    `${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = input.id
    ? await selectRows<{ id: string }>(
        TABLES.addonCategories,
        (q) => q.eq("id", input.id as string).limit(1),
        "id",
      )
    : [];

  const { error } = await supabase.from(TABLES.addonCategories).upsert(
    {
      id,
      name,
      urdu: input.urdu?.trim() || null,
      icon: input.icon?.trim() || "\uD83C\uDF7D",
      sort_order: input.sortOrder ?? 0,
      active: input.active,
      updated_at: Date.now(),
    },
    { onConflict: "id" },
  );
  fail(error, "Could not save the category.");
  return { id, created: existing.length === 0 };
}

function toAddOn(row: AddOnDb): AddOnRow {
  return {
    id: row.id,
    name: row.name,
    urdu: row.urdu ?? undefined,
    price: row.price,
    category: row.category,
    image: row.image || mediaUrl(row.image_path) || "",
    imageStorageId: row.image_path ?? undefined,
    active: row.active,
    demo: row.demo ?? false,
    sortOrder: row.sort_order,
    chilled: row.category === "cold",
  };
}

/** Every add-on, hidden ones included — the admin board. */
export async function fetchAddOns(): Promise<AddOnRow[]> {
  const rows = await selectRows<AddOnDb>(TABLES.addons, (q) =>
    q.order("sort_order", { ascending: true }),
  );
  return rows.map(toAddOn);
}

/** Only the add-ons published to guests. */
export async function fetchPublicAddOns(): Promise<AddOnRow[]> {
  const rows = await selectRows<AddOnDb>(TABLES.addons, (q) =>
    q.eq("active", true).order("sort_order", { ascending: true }),
  );
  return rows.map(toAddOn);
}

/**
 * Copy the built-in add-on list into Supabase, including the cold drinks.
 * Existing rows are left untouched — `ignoreDuplicates` means a re-run never
 * overwrites a price or photo the team has already changed. Returns how many
 * new rows were created.
 */
export async function seedAddOns(): Promise<number> {
  const existing = await selectRows<{ id: string }>(
    TABLES.addons,
    undefined,
    "id",
  );
  const taken = new Set(existing.map((row) => row.id));
  const now = Date.now();

  const rows = ADDONS.filter((addon) => !taken.has(addon.id)).map(
    (addon, index) => ({
      id: addon.id,
      name: addon.name,
      urdu: addon.urdu,
      price: addon.price,
      category: addon.group,
      active: true,
      demo: true,
      sort_order: index + 1,
      updated_at: now,
    }),
  );
  if (rows.length === 0) return 0;

  const { error } = await supabase.from(TABLES.addons).insert(rows);
  fail(error, "Could not seed the add-ons.");
  return rows.length;
}

export type AddOnInput = {
  id?: string;
  name: string;
  urdu?: string;
  price: number;
  category: string;
  active: boolean;
  sortOrder: number;
};

function addOnSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function upsertAddOn(
  input: AddOnInput,
): Promise<{ id: string; updated: boolean }> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Give the add-on a name first.");
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error("Enter a price in rupees.");
  }

  const id = input.id || `${addOnSlug(name)}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = input.id
    ? await selectRows<{ id: string }>(
        TABLES.addons,
        (q) => q.eq("id", input.id as string).limit(1),
        "id",
      )
    : [];

  const { error } = await supabase.from(TABLES.addons).upsert(
    {
      id,
      name,
      urdu: input.urdu?.trim() || null,
      price: Math.max(0, Math.round(input.price)),
      category: input.category,
      active: input.active,
      sort_order: input.sortOrder,
      updated_at: Date.now(),
    },
    { onConflict: "id" },
  );
  fail(error, "Could not save the add-on.");
  return { id, updated: existing.length > 0 };
}

export async function deleteAddOn(id: string): Promise<void> {
  const { error } = await supabase.from(TABLES.addons).delete().eq("id", id);
  fail(error, "Could not delete the add-on.");
}

export async function setAddOnImage(
  id: string,
  imagePath: string,
): Promise<string> {
  const { error } = await supabase
    .from(TABLES.addons)
    // Clearing `image` matters: an external demo URL left in place would shadow
    // the freshly uploaded object when the row is read back.
    .update({ image_path: imagePath, image: null, demo: false, updated_at: Date.now() })
    .eq("id", id);
  fail(error, "Could not attach the photo.");
  return mediaUrl(imagePath) ?? "";
}

export async function removeAddOnImage(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.addons)
    .update({ image_path: null, image: null, demo: false, updated_at: Date.now() })
    .eq("id", id);
  fail(error, "Could not remove the photo.");
}

/* ------------------------------------------------------------------ */
/* Delivery orders                                                     */
/* ------------------------------------------------------------------ */

function toDeliveryOrder(row: DeliveryOrderDb): DeliveryOrder {
  return {
    _id: row.id,
    reference: row.reference,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    area: row.area,
    notes: row.notes ?? undefined,
    items: row.items ?? [],
    itemsTotal: row.items_total,
    deliveryFee: row.delivery_fee,
    total: row.total,
    status: row.status,
    createdAt: ms(row.created_at) ?? 0,
    deliveredAt: ms(row.delivered_at),
  };
}

/** Everything, newest first — the staff delivery desk. */
export async function fetchDeliveryOrders(): Promise<DeliveryOrder[]> {
  const rows = await selectRows<DeliveryOrderDb>(TABLES.deliveryOrders, (q) =>
    q.order("created_at", { ascending: false }),
  );
  return rows.map(toDeliveryOrder);
}

/**
 * Look one delivery order up by its reference, verifying the phone it was
 * placed with.
 *
 * This replaces a "public delivery feed" that returned every order to every
 * visitor: a guest's browser could read the whole book of customers — names,
 * phones and home addresses — and the tracker's client-side phone filter fell
 * back to showing all of them whenever the field was still empty, which is the
 * state the page loads in.
 *
 * A short phone is treated as a failed check rather than a skipped one, so an
 * empty or partial number can never unlock someone else's order.
 */
export async function fetchDeliveryOrder(
  reference: string,
  phone: string,
): Promise<DeliveryOrder | null> {
  // A `security definer` function in Postgres: guests have no SELECT policy on
  // delivery_orders at all, so the reference *and* the phone must match in the
  // database before a single row is returned.
  const { data, error } = await supabase.rpc("lookup_delivery_order", {
    p_reference: reference.trim().toUpperCase(),
    p_phone: phone,
  });
  if (error) {
    console.warn(`[Janoon] order lookup failed: ${error.message}`);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | DeliveryOrderDb
    | undefined;
  return row ? toDeliveryOrder(row) : null;
}

export type PlaceOrderInput = {
  customerName: string;
  phone: string;
  address: string;
  area: string;
  notes?: string;
  items: { slug: string; name: string; count: number }[];
};

/**
 * Place a delivery order. Prices are re-derived here from the live menu rather
 * than trusted from the browser, so a doctored cart total cannot be submitted.
 */
export async function placeDeliveryOrder(input: PlaceOrderInput): Promise<{
  reference: string;
  total: number;
  deliveryFee: number;
}> {
  // The browser sends what is being bought and nothing else — no prices, no
  // totals. `place_delivery_order` in schema.sql re-prices every line from
  // `menu_dishes` / `menu_addons`, applies the delivery fee and the free
  // delivery threshold, throttles the caller, mints the reference and writes
  // the row. The number that comes back is therefore the number that was
  // charged, and a doctored cart cannot underpay.
  const { data, error } = await supabase.rpc("place_delivery_order", {
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_address: input.address,
    p_area: input.area,
    p_items: input.items.map((item) => ({
      slug: item.slug,
      name: item.name,
      count: Math.floor(Number(item.count)),
    })),
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
  });
  fail(error, "Could not place the order. Please try again.");

  // The function returns the reference and the totals it decided on. They are
  // read back rather than recomputed here, so what the guest is shown is what
  // Postgres wrote.
  const result = data as {
    reference?: string;
    total?: number;
    deliveryFee?: number;
  } | null;

  return {
    reference: required(
      result?.reference,
      "Could not place the order. Please try again.",
    ),
    total: result?.total ?? 0,
    deliveryFee: result?.deliveryFee ?? 0,
  };
}

/** The two-step staff workflow: placed → confirmed → delivered. */
export async function advanceDeliveryStatus(
  id: string,
  status: DeliveryStatus,
): Promise<void> {
  const rows = await selectRows<{ status: DeliveryStatus }>(
    TABLES.deliveryOrders,
    (q) => q.eq("id", id).limit(1),
    "status",
  );
  const current = rows[0]?.status;
  if (!current) throw new Error("That order no longer exists.");
  if (current === "delivered") throw new Error("That order is already delivered.");

  const allowed: Record<string, DeliveryStatus[]> = {
    placed: ["confirmed"],
    confirmed: ["delivered"],
  };
  if (!allowed[current]?.includes(status)) {
    throw new Error(`Cannot move from "${current}" to "${status}".`);
  }

  const patch: Record<string, unknown> = { status };
  if (status === "delivered") patch.delivered_at = Date.now();

  const { error } = await supabase
    .from(TABLES.deliveryOrders)
    .update(patch)
    .eq("id", id);
  fail(error, "Could not update that order.");
}

/* ------------------------------------------------------------------ */
/* Reservations                                                        */
/* ------------------------------------------------------------------ */

function toReservation(row: ReservationDb): Reservation {
  return {
    _id: row.id,
    reference: row.reference,
    name: row.name,
    phone: row.phone,
    partySize: row.party_size,
    date: row.date,
    time: row.time,
    seating: row.seating,
    notes: row.notes ?? undefined,
    status: row.status,
    createdAt: ms(row.created_at) ?? 0,
  };
}

export async function fetchReservations(): Promise<Reservation[]> {
  const rows = await selectRows<ReservationDb>(TABLES.reservations, (q) =>
    q.order("created_at", { ascending: false }),
  );
  return rows.map(toReservation);
}

/** Look a booking up by reference, verifying the phone it was made with. */
export async function fetchReservation(
  reference: string,
  phone: string,
): Promise<Reservation | null> {
  // Same shape as the order lookup: guests cannot read the table, so the match
  // happens inside a `security definer` function that insists on both values.
  const { data, error } = await supabase.rpc("lookup_reservation", {
    p_reference: reference.trim().toUpperCase(),
    p_phone: phone,
  });
  if (error) {
    console.warn(`[Janoon] reservation lookup failed: ${error.message}`);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as ReservationDb | undefined;
  return row ? toReservation(row) : null;
}

export type CreateReservationInput = {
  name: string;
  phone: string;
  partySize: number;
  date: string;
  time: string;
  seating: Seating;
  notes?: string;
};

export async function createReservation(
  input: CreateReservationInput,
): Promise<{ reference: string }> {
  // One atomic call: Postgres validates the booking, throttles the caller,
  // mints a reference that is checked against the table and writes the row.
  // Guests have no direct INSERT policy on `reservations`, so this is the only
  // path into the desk's book.
  const { data, error } = await supabase.rpc("create_reservation", {
    p_name: input.name,
    p_phone: input.phone,
    p_party_size: Math.max(1, Math.round(input.partySize)),
    p_date: input.date,
    p_time: input.time,
    p_seating: input.seating,
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
  });
  fail(error, "We could not save your booking. Please try again.");

  return {
    reference: required(
      (data as { reference?: string } | null)?.reference,
      "We could not save your booking. Please try again.",
    ),
  };
}

/** Guest-initiated cancellation, guarded by the phone on the booking. */
export async function cancelReservationByGuest(
  reference: string,
  phone: string,
): Promise<void> {
  // One atomic call: the function re-checks the phone, refuses an already
  // cancelled booking and flips the status. Guests have no UPDATE policy on the
  // table at all, so this is the only path available to them.
  const { error } = await supabase.rpc("cancel_reservation", {
    p_reference: reference.trim().toUpperCase(),
    p_phone: phone,
  });
  if (error) fail(error, "We could not cancel that booking.");
}

export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.reservations)
    .update({ status })
    .eq("id", id);
  fail(error, "Could not update that reservation.");
}

/* ------------------------------------------------------------------ */
/* Pre-orders (takeaway / slow-cooked specialties)                     */
/* ------------------------------------------------------------------ */

function toPreorder(row: PreorderDb): Preorder {
  return {
    _id: row.id,
    reference: row.reference,
    customerName: row.customer_name,
    phone: row.phone,
    dish: row.dish,
    quantity: row.quantity,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    notes: row.notes ?? undefined,
    status: row.status,
    createdAt: ms(row.created_at) ?? 0,
  };
}

/* --------------------------------------------------- pre_order_items ----- */

const PREORDER_CATEGORY_IDS = new Set<string>(
  PREORDER_CATEGORIES.map((category) => category.id),
);

function toPreOrderItemRow(row: {
  id: string;
  name: string;
  urdu: string | null;
  description: string | null;
  price: number | null;
  category: string | null;
  serves: string | null;
  image: string | null;
  image_path: string | null;
  active: boolean | null;
  demo: boolean | null;
  sort_order: number | null;
}): PreOrderItemRow {
  const category = (
    PREORDER_CATEGORY_IDS.has(row.category ?? "") ? row.category : "slow-cooked"
  ) as PreOrderCategoryId;
  return {
    id: row.id,
    name: row.name,
    urdu: row.urdu ?? undefined,
    description: row.description ?? undefined,
    price: row.price ?? 0,
    category,
    serves: row.serves ?? undefined,
    // Prefer an external URL, otherwise resolve the uploaded object.
    image: row.image || mediaUrl(row.image_path) || undefined,
    imagePath: row.image_path ?? undefined,
    active: row.active ?? true,
    demo: row.demo ?? false,
    sortOrder: row.sort_order ?? 0,
  };
}

/** Public list: active items only, sorted for the pre-order form. */
export async function fetchPublicPreOrderItems(): Promise<PreOrderItemRow[]> {
  const { data, error } = await supabase
    .from(TABLES.preOrderItems)
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("Could not read pre_order_items, using static list.", error.message);
    return [];
  }
  return (data ?? []).map(toPreOrderItemRow);
}

/** Admin list: all items including hidden ones. */
export async function fetchAllPreOrderItems(): Promise<PreOrderItemRow[]> {
  const { data, error } = await supabase
    .from(TABLES.preOrderItems)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("Could not read pre_order_items.", error.message);
    return [];
  }
  return (data ?? []).map(toPreOrderItemRow);
}

/** Create a new pre-order item (admin only). */
export async function createPreOrderItem(
  item: Omit<PreOrderItemRow, "id">,
): Promise<PreOrderItemRow> {
  const { data, error } = await supabase
    .from(TABLES.preOrderItems)
    .insert({
      name: item.name,
      urdu: item.urdu ?? null,
      description: item.description ?? null,
      price: item.price,
      category: item.category,
      serves: item.serves ?? null,
      image: item.image ?? null,
      active: item.active,
      sort_order: item.sortOrder,
      demo: false,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toPreOrderItemRow(data);
}

/** Update an existing pre-order item (admin only). */
export async function updatePreOrderItem(
  id: string,
  patch: Partial<Omit<PreOrderItemRow, "id">>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.urdu !== undefined) dbPatch.urdu = patch.urdu ?? null;
  if (patch.description !== undefined) dbPatch.description = patch.description ?? null;
  if (patch.price !== undefined) dbPatch.price = patch.price;
  if (patch.category !== undefined) dbPatch.category = patch.category;
  if (patch.serves !== undefined) dbPatch.serves = patch.serves ?? null;
  if (patch.active !== undefined) dbPatch.active = patch.active;
  if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder;
  const { error } = await supabase
    .from(TABLES.preOrderItems)
    .update(dbPatch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Set the image for a pre-order item via Supabase Storage. */
export async function setPreOrderItemImage(
  id: string,
  storageId: string,
): Promise<string> {
  const url = mediaUrl(storageId);
  const { error } = await supabase
    .from(TABLES.preOrderItems)
    .update({ image: url, image_path: storageId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return url ?? "";
}

/** Clear the image from a pre-order item. */
export async function removePreOrderItemImage(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.preOrderItems)
    .update({ image: null, image_path: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Delete a pre-order item entirely (admin only). */
export async function deletePreOrderItem(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.preOrderItems)
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Every pre-order, newest first — the staff and admin desks. */
export async function fetchPreorders(): Promise<Preorder[]> {
  const rows = await selectRows<PreorderDb>(TABLES.preorders, (q) =>
    q.order("created_at", { ascending: false }),
  );
  return rows.map(toPreorder);
}

export type CreatePreorderInput = {
  customerName: string;
  phone: string;
  dish: string;
  quantity?: number;
  pickupDate: string;
  pickupTime: string;
  notes?: string;
};

/**
 * Save a pre-order request. It lands on the staff desk the moment the row is
 * inserted — realtime pushes it there without a refresh.
 */
export async function createPreorder(
  input: CreatePreorderInput,
): Promise<{ reference: string }> {
  // Same shape as booking a table: validated, throttled and written inside
  // Postgres, with the reference decided there.
  const { data, error } = await supabase.rpc("create_preorder", {
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_dish: input.dish,
    p_quantity: input.quantity ?? 1,
    p_pickup_date: input.pickupDate,
    p_pickup_time: input.pickupTime,
    p_notes: input.notes?.trim() ? input.notes.trim() : null,
  });
  fail(error, "We could not save your pre-order. Please try again.");

  return {
    reference: required(
      (data as { reference?: string } | null)?.reference,
      "We could not save your pre-order. Please try again.",
    ),
  };
}

/** Staff workflow: pending → confirmed → ready → collected (or cancelled). */
export async function setPreorderStatus(
  id: string,
  status: PreorderStatus,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.preorders)
    .update({ status, updated_at: Date.now() })
    .eq("id", id);
  fail(error, "Could not update that pre-order.");
}

/* ------------------------------------------------------------------ */
/* Promotions                                                          */
/* ------------------------------------------------------------------ */

function toPromotion(row: PromotionDb): Promotion {
  return {
    _id: row.id,
    title: row.title,
    headline: row.headline,
    body: row.body ?? undefined,
    visible: row.visible,
    imageUrl: row.image_url || mediaUrl(row.image_path) || undefined,
    imagePath: row.image_path ?? undefined,
    linkUrl: row.link_url ?? undefined,
    sortOrder: row.sort_order ?? PROMO_DEFAULT_ORDER,
    expiresAt: ms(row.expires_at),
    createdAt: ms(row.created_at) ?? 0,
    updatedAt: ms(row.updated_at) ?? 0,
  };
}

/** Where a promotion sits on the offers board when the owner has not chosen. */
export const PROMO_DEFAULT_ORDER = 100;

export async function fetchPromotions(
  options: { activeOnly?: boolean } = {},
): Promise<Promotion[]> {
  const rows = await selectRows<PromotionDb>(TABLES.promotions, (q) =>
    q.order("created_at", { ascending: false }),
  );
  const now = Date.now();
  const promos = rows
    .map(toPromotion)
    // Expired banners disable and remove themselves the moment the clock runs
    // out — no cleanup job required.
    .filter((promo) => !promo.expiresAt || promo.expiresAt > now)
    .filter((promo) => (options.activeOnly ? promo.visible : true));

  // Board position is applied here rather than in the query: ordering by
  // `sort_order` server-side would fail — and so hide every promotion — on a
  // database that has not run the migration adding the column yet.
  return promos.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || b.createdAt - a.createdAt,
  );
}

export type PromotionInput = {
  id?: string;
  title: string;
  headline: string;
  body?: string;
  visible: boolean;
  imagePath?: string;
  imageUrl?: string;
  /** Empty string clears the offer's action link. */
  linkUrl?: string;
  sortOrder?: number;
  expiresAt?: number;
};

export async function savePromotion(input: PromotionInput): Promise<void> {
  const now = Date.now();
  const row: Record<string, unknown> = {
    title: input.title.trim(),
    headline: input.headline.trim(),
    body: input.body?.trim() ? input.body.trim() : null,
    visible: input.visible,
    expires_at: input.expiresAt ?? null,
    updated_at: now,
  };
  if (input.imagePath) {
    row.image_path = input.imagePath;
    row.image_url = null;
  }
  if (input.linkUrl !== undefined) {
    const link = input.linkUrl.trim();
    row.link_url = link ? link : null;
  }
  if (input.sortOrder !== undefined) {
    row.sort_order = Number.isFinite(input.sortOrder)
      ? input.sortOrder
      : PROMO_DEFAULT_ORDER;
  }
  if (input.id) {
    // The file a replaced graphic used to point at is about to lose its only
    // reference, so read it now and drop it from the bucket once the row is on
    // the new one.
    const previous = input.imagePath
      ? await selectRows<{ image_path: string | null }>(
          TABLES.promotions,
          (q) => q.eq("id", input.id as string).limit(1),
          "image_path",
        )
      : [];

    const { error } = await supabase
      .from(TABLES.promotions)
      .update(row)
      .eq("id", input.id);
    fail(error, "Could not save the promotion.");

    const oldPath = previous[0]?.image_path;
    if (oldPath && oldPath !== input.imagePath) {
      await removeStoredObject(oldPath);
    }
    return;
  }
  const { error } = await supabase
    .from(TABLES.promotions)
    .insert({ ...row, created_at: now });
  fail(error, "Could not create the promotion.");
}

export async function togglePromotion(id: string): Promise<boolean> {
  const rows = await selectRows<{ visible: boolean }>(
    TABLES.promotions,
    (q) => q.eq("id", id).limit(1),
    "visible",
  );
  if (!rows[0]) throw new Error("That promotion no longer exists.");
  const next = !rows[0].visible;
  const { error } = await supabase
    .from(TABLES.promotions)
    .update({ visible: next, updated_at: Date.now() })
    .eq("id", id);
  fail(error, "Could not toggle the promotion.");
  return next;
}

export async function removePromotionImage(id: string): Promise<void> {
  // Read the stored path first: clearing the row is what drops the only
  // reference to the file, so the object has to go in the same breath or it
  // sits in the bucket forever.
  const rows = await selectRows<{ image_path: string | null }>(
    TABLES.promotions,
    (q) => q.eq("id", id).limit(1),
    "image_path",
  );
  await removeStoredObject(rows[0]?.image_path);

  const { error } = await supabase
    .from(TABLES.promotions)
    .update({ image_path: null, image_url: null, updated_at: Date.now() })
    .eq("id", id);
  fail(error, "Could not remove the image.");
}

export async function deletePromotion(id: string): Promise<void> {
  const rows = await selectRows<{ image_path: string | null }>(
    TABLES.promotions,
    (q) => q.eq("id", id).limit(1),
    "image_path",
  );
  const { error } = await supabase.from(TABLES.promotions).delete().eq("id", id);
  fail(error, "Could not delete the promotion.");

  // The row is gone; its uploaded graphic should not be left behind in the
  // public bucket with nothing pointing at it.
  await removeStoredObject(rows[0]?.image_path);
}

/**
 * Keep one sample promotional banner live so the public site always has
 * something to broadcast out of the box. Expires seven days out, after which
 * the `active` filter removes it automatically.
 *
 * It re-seeds when nothing is currently showing and the only rows on record
 * are demo banners of its own — so a lapsed sample is replaced, while a
 * promotion the team wrote (even one they have switched off or let expire) is
 * never overwritten or joined by a demo.
 */
export async function seedDemoPromotion(): Promise<boolean> {
  const existing = await selectRows<{
    id: string;
    visible: boolean;
    demo: boolean | null;
    expires_at: number | string | null;
    created_at: number | string | null;
  }>(TABLES.promotions, undefined, "id, visible, demo, expires_at, created_at");

  const now = Date.now();
  const liveRows = existing.filter(
    (row) => row.visible && (ms(row.expires_at) ?? now + 1) > now,
  );
  const live = liveRows.length > 0;
  const onlyOurDemos = existing.every((row) => row.demo ?? false);

  // An earlier version of this seeder could add its sample more than once, and
  // two identical banners show up twice on the offers board. When the only live
  // rows are our own samples, keep the newest and clear the rest. A promotion
  // the team wrote is never touched — `onlyOurDemos` has to be true first.
  const liveDemos = liveRows.filter((row) => row.demo ?? false);
  if (onlyOurDemos && liveDemos.length > 1) {
    const sorted = [...liveDemos].sort(
      (a, b) => (ms(b.created_at) ?? 0) - (ms(a.created_at) ?? 0),
    );
    const duplicates = sorted
      .slice(1)
      .map((row) => row.id)
      .filter(Boolean);
    if (duplicates.length > 0) {
      const { error } = await supabase
        .from(TABLES.promotions)
        .delete()
        .in("id", duplicates);
      if (!error) return false;
    }
  }

  if (live || !onlyOurDemos) return false;
  const { error } = await supabase.from(TABLES.promotions).insert({
    title: "Weekend Live BBQ Nights",
    headline: "Live BBQ Nights — family of four dines for Rs 7,500",
    body: "Valid Friday to Sunday, 7 PM onwards. Dine-in only.",
    visible: true,
    demo: true,
    expires_at: now + 7 * 24 * 60 * 60 * 1000,
    created_at: now,
    updated_at: now,
  });
  fail(error, "Could not seed the demo promotion.");
  return true;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** Upload an admin photo to the public media bucket. */
export async function uploadImage(
  file: File,
  folder = "uploads",
): Promise<UploadedImage> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, GIF or AVIF images are allowed.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 5 MB or smaller.");
  }
  const extension = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new Error(
      error.message.includes("Bucket not found")
        ? "The tribe-media storage bucket is missing — run supabase/schema.sql."
        : error.message,
    );
  }

  return {
    storageId: path,
    url: mediaUrl(path) ?? "",
    name: file.name,
    mimeType: file.type,
    bytes: file.size,
  };
}

/**
 * Best-effort removal of an uploaded file.
 *
 * Called when a graphic is replaced, removed or its promotion deleted. A
 * missing object (already gone, or a legacy row holding a plain URL rather than
 * a bucket path) must never fail the row write that prompted the cleanup, so
 * the outcome is logged and nothing is thrown.
 */
async function removeStoredObject(
  path: string | null | undefined,
): Promise<void> {
  if (!path) return;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) {
    console.warn(`[Janoon] could not delete "${path}": ${error.message}`);
  }
}


/* ------------------------------------------------------------------ */
/* Health check                                                        */
/* ------------------------------------------------------------------ */

/** Every table the app reads or writes. A missing one means
 *  `supabase/schema.sql` has not been run on this project — the single reason
 *  nothing can sync. */
const REQUIRED_TABLES: { table: string; label: string }[] = [
  { table: TABLES.categories, label: "Menu counters" },
  { table: TABLES.dishes, label: "Menu dishes" },
  { table: TABLES.addons, label: "Add-ons" },
  { table: TABLES.addonCategories, label: "Add-on categories" },
  { table: TABLES.siteMedia, label: "Site photos" },
  { table: TABLES.siteContent, label: "Editable copy" },
  { table: TABLES.promotions, label: "Promotions" },
  { table: TABLES.preOrderItems, label: "Pre-order items" },
  { table: TABLES.preorders, label: "Pre-orders" },
  { table: TABLES.reservations, label: "Reservations" },
  { table: TABLES.deliveryOrders, label: "Delivery orders" },
  { table: TABLES.staffMembers, label: "Staff accounts" },
];

export type SchemaStatus = {
  /** Every table present, every guest-write function installed, bucket up. */
  ready: boolean;
  /** The tables that are missing, with a label a human recognises. */
  missing: { table: string; label: string }[];
  /**
   * Guest-write functions the database does not have. Their tables can all be
   * present while these are absent, which is what running an older copy of
   * `schema.sql` looks like — and every booking, pre-order and delivery would
   * then be rejected.
   */
  missingFunctions: string[];
  storageReady: boolean;
  storageMessage?: string;
  /** The project could not be reached at all (offline, wrong URL). */
  unreachable: boolean;
};

function looksMissing(message: string): boolean {
  return /does not exist|schema cache|Could not find the table/i.test(message);
}

/**
 * The `security definer` functions the site calls, probed for existence.
 *
 * The write probes are called with deliberately invalid arguments, so each one
 * raises on its first validation check — before the throttle is consulted and
 * long before any row is written. `staff_bootstrap_state` takes no arguments
 * and writes nothing: it answers a boolean, and is here because a project whose
 * schema predates the one-time owner setup would otherwise look completely
 * ready while quietly hiding the setup form.
 *
 * What is being read is which *kind* of error comes back: PostgREST answers a
 * function it cannot find with PGRST202, while our own validation raises an
 * ordinary message. Nothing is created either way.
 */
async function probeExpectedFunctions(): Promise<string[]> {
  const probes: { name: string; args: Record<string, unknown> }[] = [
    {
      name: "create_reservation",
      args: {
        p_name: "",
        p_phone: "",
        p_party_size: 0,
        p_date: "",
        p_time: "",
        p_seating: "",
        p_notes: null,
      },
    },
    {
      name: "create_preorder",
      args: {
        p_customer_name: "",
        p_phone: "",
        p_dish: "",
        p_quantity: 0,
        p_pickup_date: "",
        p_pickup_time: "",
        p_notes: null,
      },
    },
    {
      name: "place_delivery_order",
      args: {
        p_customer_name: "",
        p_phone: "",
        p_address: "",
        p_area: "",
        p_items: [],
        p_notes: null,
      },
    },
    // Safe to call for real: a read-only count of `staff_members`, returned as
    // a boolean. It is what the Admin Portal uses to offer owner setup.
    { name: "staff_bootstrap_state", args: {} },
    // Both refuse an anonymous caller with our own 42501, which is exactly the
    // answer that proves they exist — a missing one reads PGRST202 instead.
    // Neither writes anything on the way to that refusal.
    { name: "staff_sync_email", args: {} },
    { name: "admin_list_staff", args: {} },
  ];

  const absent: string[] = [];
  for (const probe of probes) {
    const { error } = await supabase.rpc(probe.name, probe.args);
    if (!error) continue;
    const message = error.message ?? "";
    if (error.code === "PGRST202" || /Could not find the function/i.test(message)) {
      absent.push(probe.name);
    }
  }
  return absent;
}

/**
 * Probe the project for every table the portals write to, plus the media
 * bucket. The portals used to swallow these failures, which made a project with
 * no schema at all look like a site that simply refused to update.
 */
export async function checkSupabaseSchema(): Promise<SchemaStatus> {
  let unreachable = false;
  const missing: { table: string; label: string }[] = [];

  const [, missingFunctions] = await Promise.all([
    Promise.all(
      REQUIRED_TABLES.map(async ({ table, label }) => {
        const { error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (!error) return;
        if (looksMissing(error.message)) missing.push({ table, label });
        else unreachable = true;
      }),
    ),
    probeExpectedFunctions(),
  ]);

  let storageReady = true;
  let storageMessage: string | undefined;
  const { error: storageError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list("", { limit: 1 });
  if (storageError) {
    storageReady = false;
    storageMessage = storageError.message;
  }

  return {
    ready:
      missing.length === 0 &&
      missingFunctions.length === 0 &&
      storageReady &&
      !unreachable,
    missing: missing.sort((a, b) => a.table.localeCompare(b.table)),
    missingFunctions: missingFunctions.sort(),
    storageReady,
    storageMessage,
    unreachable,
  };
}
