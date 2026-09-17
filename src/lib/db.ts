import {
  ADDON_GROUPS,
  ADDONS,
  DISHES,
  MENU_CATEGORIES,
  PREORDER_CATEGORIES,
  SIGNATURE_LIMIT,
  SIGNATURE_SLUGS,
  type AddOnGroupId,
  type PreOrderCategoryId,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
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
  category: AddOnGroupId;
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

/** Short, unambiguous reference a guest can read over the phone. */
function makeReference(prefix: string, length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${out}`;
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");

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
    console.warn(`[tribe] "${table}" read failed: ${error.message}`);
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
      "The Supabase tables are missing. Run supabase/schema.sql in the Supabase SQL editor, then try again.",
    );
  }
  throw new Error(message || fallback);
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
  id: string;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: CategoryIcon;
  sortOrder: number;
  active: boolean;
};

export async function upsertCategory(input: CategoryInput): Promise<void> {
  const { error } = await supabase.from(TABLES.categories).upsert(
    {
      id: input.id,
      name: input.name,
      urdu: input.urdu ?? null,
      blurb: input.blurb ?? null,
      icon: input.icon,
      sort_order: input.sortOrder,
      active: input.active,
    },
    { onConflict: "id" },
  );
  fail(error, "Could not save the counter.");
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

const ADDON_CATEGORY_IDS = new Set<string>(
  ADDON_GROUPS.map((group) => group.id),
);

function toAddOn(row: AddOnDb): AddOnRow {
  const category = (
    ADDON_CATEGORY_IDS.has(row.category) ? row.category : "bread"
  ) as AddOnGroupId;
  return {
    id: row.id,
    name: row.name,
    urdu: row.urdu ?? undefined,
    price: row.price,
    category,
    image: row.image || mediaUrl(row.image_path) || "",
    imageStorageId: row.image_path ?? undefined,
    active: row.active,
    demo: row.demo ?? false,
    sortOrder: row.sort_order,
    chilled: category === "cold",
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
  category: AddOnGroupId;
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

const HIDE_DELIVERED_AFTER_MS = 30 * 60 * 1000;

/** The guest-facing feed: delivered orders drop off after 30 minutes. */
export async function fetchVisibleDeliveryOrders(): Promise<DeliveryOrder[]> {
  const orders = await fetchDeliveryOrders();
  const now = Date.now();
  return orders.filter((order) => {
    if (order.status !== "delivered") return true;
    if (order.deliveredAt && now - order.deliveredAt > HIDE_DELIVERED_AFTER_MS) {
      return false;
    }
    return true;
  });
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
  id: string;
  reference: string;
  total: number;
  deliveryFee: number;
}> {
  const customerName = input.customerName.trim();
  const phoneDigits = digitsOnly(input.phone);
  const address = input.address.trim();
  const area = input.area.trim();

  if (customerName.length < 2) {
    throw new Error("Please enter the name for the order.");
  }
  if (phoneDigits.length < 10 || phoneDigits.length > 12) {
    throw new Error("Please enter a valid phone number.");
  }
  if (address.length < 8) {
    throw new Error("Please enter a full delivery address in Lahore.");
  }
  if (!area) throw new Error("Please choose your area in Lahore.");

  // Prices are read back from the database rather than trusted from the
  // browser, and the add-on table counts too — a naan, a raita or a cold drink
  // has no row in `menu_dishes`, so without this lookup every extra would be
  // billed at the default per-plate price instead of its own.
  const [pricedDishes, pricedAddOns] = await Promise.all([
    selectRows<{ slug: string; price_per_plate: number | null }>(
      TABLES.dishes,
      undefined,
      "slug, price_per_plate",
    ),
    selectRows<{ id: string; price: number | null }>(
      TABLES.addons,
      undefined,
      "id, price",
    ),
  ]);

  const managed = new Map<string, number>();
  for (const dish of pricedDishes) {
    if ((dish.price_per_plate ?? 0) > 0) {
      managed.set(dish.slug, dish.price_per_plate as number);
    }
  }
  for (const addon of pricedAddOns) {
    if ((addon.price ?? 0) > 0) managed.set(addon.id, addon.price as number);
  }

  const lines: DeliveryOrderLine[] = [];
  for (const item of input.items) {
    const count = Math.floor(Number(item.count));
    if (!item.slug || count < 1) continue;
    lines.push({
      slug: item.slug,
      name: item.name.trim().slice(0, 80),
      count: Math.min(count, 20),
      unitPrice: managed.get(item.slug) ?? deliveryUnitPrice(item.slug),
    });
  }
  if (lines.length === 0) {
    throw new Error("Your cart is empty — add a dish before ordering.");
  }

  const itemsTotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.count,
    0,
  );
  const deliveryFee = itemsTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = itemsTotal + deliveryFee;
  const reference = makeReference("DLV", 6);

  const { data, error } = await supabase
    .from(TABLES.deliveryOrders)
    .insert({
      reference,
      customer_name: customerName,
      phone: phoneDigits,
      address,
      area,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 300) : null,
      items: lines,
      items_total: itemsTotal,
      delivery_fee: deliveryFee,
      total,
      status: "placed",
      created_at: Date.now(),
    })
    .select("id, reference, total, delivery_fee")
    .single();
  if (error || !data) fail(error, "Could not place the order. Please try again.");

  return {
    id: data.id as string,
    reference: data.reference as string,
    total: data.total as number,
    deliveryFee: data.delivery_fee as number,
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
  const rows = await selectRows<ReservationDb>(TABLES.reservations, (q) =>
    q.eq("reference", reference.trim().toUpperCase()).limit(1),
  );
  const row = rows[0];
  if (!row) return null;
  const wanted = digitsOnly(phone);
  const stored = digitsOnly(row.phone);
  if (wanted.length >= 6 && stored !== wanted) return null;
  return toReservation(row);
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
  const reference = makeReference("TT", 4);
  const { error } = await supabase.from(TABLES.reservations).insert({
    reference,
    name: input.name.trim(),
    phone: input.phone.trim(),
    party_size: Math.max(1, Math.round(input.partySize)),
    date: input.date,
    time: input.time,
    seating: input.seating,
    notes: input.notes?.trim() ? input.notes.trim().slice(0, 400) : null,
    status: "pending",
    created_at: Date.now(),
  });
  fail(error, "We could not save your booking. Please try again.");
  return { reference };
}

/** Guest-initiated cancellation, guarded by the phone on the booking. */
export async function cancelReservationByGuest(
  reference: string,
  phone: string,
): Promise<void> {
  const booking = await fetchReservation(reference, phone);
  if (!booking) throw new Error("We could not find that booking.");
  if (booking.status === "cancelled") {
    throw new Error("That reservation is already cancelled.");
  }
  await setReservationStatus(booking._id, "cancelled");
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
  const customerName = input.customerName.trim();
  const phoneDigits = digitsOnly(input.phone);
  if (customerName.length < 2) {
    throw new Error("Please enter the name for the pre-order.");
  }
  // Accept any local or international formatting — 03XX… or +92 3XX… — as long
  // as there are enough digits to call back on.
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    throw new Error("Enter a valid phone number we can reach you on.");
  }
  if (!input.dish.trim()) throw new Error("Please choose a dish to pre-order.");
  if (!input.pickupDate || !input.pickupTime) {
    throw new Error("Please choose a pickup date and time.");
  }

  const reference = makeReference("PRE", 5);
  const { error } = await supabase.from(TABLES.preorders).insert({
    reference,
    customer_name: customerName,
    phone: phoneDigits,
    dish: input.dish.trim(),
    quantity: Math.min(Math.max(1, Math.round(input.quantity ?? 1)), 20),
    pickup_date: input.pickupDate,
    pickup_time: input.pickupTime,
    notes: input.notes?.trim() ? input.notes.trim().slice(0, 300) : null,
    status: "pending",
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  fail(error, "We could not save your pre-order. Please try again.");
  return { reference };
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
    expiresAt: ms(row.expires_at),
    createdAt: ms(row.created_at) ?? 0,
    updatedAt: ms(row.updated_at) ?? 0,
  };
}

export async function fetchPromotions(
  options: { activeOnly?: boolean } = {},
): Promise<Promotion[]> {
  const rows = await selectRows<PromotionDb>(TABLES.promotions, (q) =>
    q.order("created_at", { ascending: false }),
  );
  const now = Date.now();
  return rows
    .map(toPromotion)
    // Expired banners disable and remove themselves the moment the clock runs
    // out — no cleanup job required.
    .filter((promo) => !promo.expiresAt || promo.expiresAt > now)
    .filter((promo) => (options.activeOnly ? promo.visible : true));
}

export type PromotionInput = {
  id?: string;
  title: string;
  headline: string;
  body?: string;
  visible: boolean;
  imagePath?: string;
  imageUrl?: string;
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
  if (input.id) {
    const { error } = await supabase
      .from(TABLES.promotions)
      .update(row)
      .eq("id", input.id);
    fail(error, "Could not save the promotion.");
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
  const { error } = await supabase
    .from(TABLES.promotions)
    .update({ image_path: null, image_url: null, updated_at: Date.now() })
    .eq("id", id);
  fail(error, "Could not remove the image.");
}

export async function deletePromotion(id: string): Promise<void> {
  const { error } = await supabase.from(TABLES.promotions).delete().eq("id", id);
  fail(error, "Could not delete the promotion.");
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
    visible: boolean;
    demo: boolean | null;
    expires_at: number | string | null;
  }>(TABLES.promotions, undefined, "visible, demo, expires_at");

  const now = Date.now();
  const live = existing.some(
    (row) => row.visible && (ms(row.expires_at) ?? now + 1) > now,
  );
  const onlyOurDemos = existing.every((row) => row.demo ?? false);
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

export { HIDE_DELIVERED_AFTER_MS };
