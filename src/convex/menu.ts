import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** Validate a category icon against the known set. */
function validateIcon(icon: string): "flame" | "pot" | "bites" | "dessert" {
  if (
    icon === "flame" ||
    icon === "pot" ||
    icon === "bites" ||
    icon === "dessert"
  ) {
    return icon as "flame" | "pot" | "bites" | "dessert";
  }
  throw new Error(
    `Unknown category icon "${icon}". Allowed: flame, pot, bites, dessert.`,
  );
}

/** Generate a URL-friendly slug from a dish name. */
function slugify(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  if (!cleaned) throw new Error("Dish name must produce a valid slug.");
  return cleaned;
}

/** Media slots the public site reads. `hero` backs the landing page; gallery
 *  slots 1-6 fill the Instagram-style grid on the reviews section. */
export const MEDIA_SLOTS = [
  "hero",
  "gallery-1",
  "gallery-2",
  "gallery-3",
  "gallery-4",
  "gallery-5",
  "gallery-6",
] as const;

function isValidSlot(slot: string): slot is (typeof MEDIA_SLOTS)[number] {
  return (MEDIA_SLOTS as readonly string[]).includes(slot);
}

// ------------------------------------------------------------------ //
// Live public reads — the customer site subscribes to these, so any   //
// admin edit is reflected without a redeploy.                         //
// ------------------------------------------------------------------ //

/** Whether the menu has been seeded (drives the admin portal's first-run
 *  auto-seed). Deliberately cheap: a single category count. */
export const seedState = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("menuCategories").collect();
    return { seeded: categories.length > 0 };
  },
});

/** The complete live menu: active categories with their active dishes. */
export const publicMenu = query({
  args: {},
  handler: async (ctx) => {
    const [categories, dishes] = await Promise.all([
      ctx.db.query("menuCategories").collect(),
      ctx.db.query("menuDishes").collect(),
    ]);
    return {
      categories: categories
        .filter((c) => c.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      dishes: dishes
        .filter((d) => d.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    };
  },
});

/** Hero and gallery imagery for the public site. Rows without a URL are
 *  omitted — the frontend then falls back to its themed default. */
export const publicSiteMedia = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("siteMedia").collect();
    const media: { slot: string; url: string; caption?: string }[] = [];
    for (const row of rows) {
      if (!row.url) continue;
      media.push({ slot: row.slot, url: row.url, caption: row.caption });
    }
    return media;
  },
});

/** Resolve a Convex storage id to a servable URL (used by the admin portal). */
export const imageUrlFor = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/** Admin view of all site media slots, including their storage ids. */
export const listSiteMedia = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("siteMedia").collect();
    return rows.sort((a, b) => a.slot.localeCompare(b.slot));
  },
});

// ------------------------------------------------------------------ //
// Category CRUD
// ------------------------------------------------------------------ //

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("menuCategories").collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getCategory = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return (
      await ctx.db
        .query("menuCategories")
        .withIndex("by_categoryId", (q) => q.eq("id", args.id))
        .unique()
    );
  },
});

export const upsertCategory = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    urdu: v.optional(v.string()),
    blurb: v.optional(v.string()),
    icon: v.union(
      v.literal("flame"),
      v.literal("pot"),
      v.literal("bites"),
      v.literal("dessert"),
    ),
    sortOrder: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const icon = validateIcon(args.icon);
    const existing = await ctx.db
      .query("menuCategories")
      .withIndex("by_categoryId", (q) => q.eq("id", args.id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name.trim(),
        urdu: args.urdu?.trim() || undefined,
        blurb: args.blurb?.trim() || undefined,
        icon,
        sortOrder: args.sortOrder,
        active: args.active,
      });
      return { id: existing._id, updated: true };
    }

    const id = await ctx.db.insert("menuCategories", {
      id: args.id,
      name: args.name.trim(),
      urdu: args.urdu?.trim() || undefined,
      blurb: args.blurb?.trim() || undefined,
      icon,
      sortOrder: args.sortOrder,
      active: args.active,
    });
    return { id, updated: false };
  },
});

export const deleteCategory = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("menuCategories")
      .withIndex("by_categoryId", (q) => q.eq("id", args.id))
      .unique();
    if (!existing) throw new Error("Category not found.");

    const orphaned = await ctx.db
      .query("menuDishes")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.id))
      .collect();
    for (const dish of orphaned) {
      await ctx.db.patch(dish._id, { categoryId: "uncategorized" });
    }

    await ctx.db.delete(existing._id);
    return { deleted: true };
  },
});

// ------------------------------------------------------------------ //
// Dish CRUD
// ------------------------------------------------------------------ //

export const listDishes = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("menuDishes").collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const getDish = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return (
      await ctx.db
        .query("menuDishes")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .unique()
    );
  },
});

export const upsertDish = mutation({
  args: {
    slug: v.optional(v.string()),
    name: v.string(),
    urdu: v.optional(v.string()),
    categoryId: v.string(),
    summary: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(
      v.array(v.object({ label: v.string(), value: v.string() })),
    ),
    pairings: v.optional(v.array(v.string())),
    image: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    active: v.boolean(),
    featured: v.boolean(),
    sortOrder: v.number(),
    pricePerPlate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let targetSlug = args.slug;
    if (!targetSlug) {
      targetSlug = slugify(args.name);
    } else {
      targetSlug = targetSlug.trim().toLowerCase();
    }
    if (!targetSlug) throw new Error("Dish must have a valid slug.");

    const category = await ctx.db
      .query("menuCategories")
      .withIndex("by_categoryId", (q) => q.eq("id", args.categoryId))
      .unique();
    if (!category) {
      throw new Error(
        `Category "${args.categoryId}" does not exist. Create it first.`,
      );
    }

    const existing = await ctx.db
      .query("menuDishes")
      .withIndex("by_slug", (q) => q.eq("slug", targetSlug))
      .unique();

    // Creating a new dish whose generated slug collides with an existing one
    // is an error; passing an explicit slug means we are editing that dish.
    if (existing && !args.slug) {
      throw new Error(
        `A dish with the slug "${targetSlug}" already exists. Use a different name or edit the existing dish.`,
      );
    }

    // A freshly uploaded photo arrives as a storage id; resolve it to its
    // servable URL server-side so no temporary client URL is ever stored.
    let resolvedImage = args.image?.trim() || undefined;
    if (args.imageStorageId) {
      const uploadedUrl = await ctx.storage.getUrl(args.imageStorageId);
      if (!uploadedUrl) {
        throw new Error("Could not resolve the uploaded image URL.");
      }
      resolvedImage = uploadedUrl;
    }

    const dishDoc = {
      slug: targetSlug,
      name: args.name.trim(),
      urdu: args.urdu?.trim() || undefined,
      categoryId: args.categoryId,
      summary: args.summary?.trim() || undefined,
      description: args.description?.trim() || undefined,
      notes:
        args.notes?.length
          ? args.notes.map((n) => ({
              label: n.label.trim(),
              value: n.value.trim(),
            }))
          : undefined,
      pairings:
        args.pairings?.length
          ? args.pairings.map((p) => p.trim())
          : undefined,
      image: resolvedImage,
      imageStorageId: args.imageStorageId,
      active: args.active,
      featured: args.featured,
      sortOrder: args.sortOrder,
      pricePerPlate:
        args.pricePerPlate != null ? args.pricePerPlate : undefined,
    };

    let id: Id<"menuDishes">;
    if (existing) {
      // Preserve notes/pairings when the edit form omits them (the admin
      // editor does not yet manage those fields).
      const { notes: _notes, pairings: _pairings, ...patchDoc } = dishDoc;
      await ctx.db.patch(existing._id, {
        ...patchDoc,
        notes: args.notes?.length ? dishDoc.notes : existing.notes,
        pairings: args.pairings?.length ? dishDoc.pairings : existing.pairings,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("menuDishes", dishDoc);
    }

    return { id, slug: targetSlug, updated: !!existing };
  },
});

export const deleteDish = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("menuDishes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!existing) throw new Error("Dish not found.");
    await ctx.db.delete(existing._id);
    return { deleted: true };
  },
});

// ------------------------------------------------------------------ //
// Image uploads — real files, kept in Convex file storage.            //
// ------------------------------------------------------------------ //

/** Step 1 of an upload: mint a short-lived direct-upload URL for the client. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function getUrlForStorage(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  storageId: Id<"_storage"> | undefined,
): Promise<string | undefined> {
  if (!storageId) return undefined;
  const url = await ctx.storage.getUrl(storageId);
  return url ?? undefined;
}

/** Attach an uploaded image to a dish. The file is stored in Convex file
 *  storage; the dish keeps both the storage id and its servable URL. */
export const uploadDishImage = mutation({
  args: {
    slug: v.string(),
    storageId: v.id("_storage"),
    originalName: v.string(),
    mimeType: v.string(),
    bytes: v.number(),
  },
  handler: async (ctx, args) => {
    if (!IMAGE_MIME.has(args.mimeType)) {
      throw new Error("Only JPEG, PNG, WebP, GIF or AVIF images are allowed.");
    }
    if (args.bytes > MAX_IMAGE_BYTES) {
      throw new Error("Images must be 5 MB or smaller.");
    }

    const dish = await ctx.db
      .query("menuDishes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!dish) throw new Error("Dish not found.");

    // Detach any previous in-app image so storage does not accumulate.
    if (dish.imageStorageId) {
      await ctx.storage.delete(dish.imageStorageId);
    }

    const url = await getUrlForStorage(ctx, args.storageId);
    if (!url) throw new Error("Could not resolve the uploaded image URL.");

    await ctx.db.patch(dish._id, {
      image: url,
      imageStorageId: args.storageId,
    });

    // Best-effort registry entry for the media library view.
    const known = await ctx.db
      .query("menuAssets")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.storageId))
      .unique();
    if (!known) {
      await ctx.db.insert("menuAssets", {
        assetId: args.storageId,
        originalName: args.originalName.trim().slice(0, 120),
        mimeType: args.mimeType,
        url,
        bytes: args.bytes,
        uploadedById: "admin",
        uploadedAt: Date.now(),
        usedBy: ["dish"],
      });
    }

    return { slug: args.slug, url };
  },
});

/** Remove a dish's uploaded photo (falls the card back to its themed tile). */
export const removeDishImage = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const dish = await ctx.db
      .query("menuDishes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!dish) throw new Error("Dish not found.");
    if (dish.imageStorageId) {
      await ctx.storage.delete(dish.imageStorageId);
    }
    await ctx.db.patch(dish._id, { image: undefined, imageStorageId: undefined });
    return { slug: args.slug };
  },
});

/** Publish an uploaded image into a site media slot (hero or gallery). */
export const setSiteMedia = mutation({
  args: {
    slot: v.string(),
    storageId: v.id("_storage"),
    originalName: v.string(),
    mimeType: v.string(),
    bytes: v.number(),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isValidSlot(args.slot)) {
      throw new Error(`Unknown media slot "${args.slot}".`);
    }
    if (!IMAGE_MIME.has(args.mimeType)) {
      throw new Error("Only JPEG, PNG, WebP, GIF or AVIF images are allowed.");
    }
    if (args.bytes > MAX_IMAGE_BYTES) {
      throw new Error("Images must be 5 MB or smaller.");
    }

    const url = await getUrlForStorage(ctx, args.storageId);
    if (!url) throw new Error("Could not resolve the uploaded image URL.");

    const existing = await ctx.db
      .query("siteMedia")
      .withIndex("by_slot", (q) => q.eq("slot", args.slot))
      .unique();

    if (existing?.imageStorageId) {
      await ctx.storage.delete(existing.imageStorageId);
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        url,
        imageStorageId: args.storageId,
        caption: args.caption?.trim() || existing.caption,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("siteMedia", {
        slot: args.slot,
        url,
        imageStorageId: args.storageId,
        caption: args.caption?.trim() || undefined,
        updatedAt: Date.now(),
      });
    }
    return { slot: args.slot, url };
  },
});

/** Clear a media slot — the public site returns to its themed default. */
export const clearSiteMedia = mutation({
  args: { slot: v.string() },
  handler: async (ctx, args) => {
    if (!isValidSlot(args.slot)) {
      throw new Error(`Unknown media slot "${args.slot}".`);
    }
    const existing = await ctx.db
      .query("siteMedia")
      .withIndex("by_slot", (q) => q.eq("slot", args.slot))
      .unique();
    if (!existing) return { cleared: false };
    if (existing.imageStorageId) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.delete(existing._id);
    return { cleared: true };
  },
});

// ------------------------------------------------------------------ //
// Media library
// ------------------------------------------------------------------ //

export const listAssets = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("menuAssets").collect();
    return rows.sort((a, b) => b.uploadedAt - a.uploadedAt);
  },
});

export const registerAsset = mutation({
  args: {
    assetId: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    url: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    bytes: v.number(),
    uploadedById: v.string(),
    usedBy: v.optional(
      v.array(
        v.union(
          v.literal("hero"),
          v.literal("dish"),
          v.literal("category"),
          v.literal("social"),
        ),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const existingAsset = await ctx.db
      .query("menuAssets")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .unique();
    if (existingAsset) {
      throw new Error("That image has already been registered.");
    }

    const id = await ctx.db.insert("menuAssets", {
      assetId: args.assetId,
      originalName: args.originalName.trim(),
      mimeType: args.mimeType.trim(),
      url: args.url.trim(),
      width: args.width,
      height: args.height,
      bytes: args.bytes,
      uploadedById: args.uploadedById,
      uploadedAt: Date.now(),
      usedBy: args.usedBy?.length ? args.usedBy : undefined,
    });
    return { id, assetId: args.assetId };
  },
});

export const deleteAsset = mutation({
  args: { assetId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("menuAssets")
      .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
      .unique();
    if (!existing) throw new Error("Asset not found.");

    const linkedDishes = await ctx.db
      .query("menuDishes")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    for (const dish of linkedDishes) {
      if (dish.image === existing.url) {
        await ctx.db.patch(dish._id, { image: undefined, imageStorageId: undefined });
      }
    }

    await ctx.db.delete(existing._id);
    return { deleted: true };
  },
});

// ------------------------------------------------------------------ //
// Admin helpers — seed (with real delivery prices) + reset            //
// ------------------------------------------------------------------ //

const SEED_PRICES: Record<string, number> = {
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

/** Seed categories + dishes on first run. Prices seed the per-plate delivery
 *  pricing so admins can adjust it in the portal from day one. */
export const ensureSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingCategories = await ctx.db.query("menuCategories").collect();
    if (existingCategories.length > 0) {
      return { seeded: false, reason: "Menu already contains categories." };
    }

    const categories = [
      {
        id: "bbq",
        name: "BBQ & Grills",
        urdu: "باری بی کیو",
        blurb: "Charcoal counters that stay lit all night, working from recipes the family has grilled for years.",
        icon: "flame" as const,
        sortOrder: 1,
        active: true,
      },
      {
        id: "handi",
        name: "Traditional Handi",
        urdu: "روایتی ہانڈی",
        blurb: "Slow clay-pot cooking that begins before dawn and simmers until the first guests sit down.",
        icon: "pot" as const,
        sortOrder: 2,
        active: true,
      },
      {
        id: "fast-bites",
        name: "Fast Bites",
        urdu: "فاسٹ بائٹس",
        blurb: "Lahori street plates and lighter bites for children, cousins and the midnight crowd.",
        icon: "bites" as const,
        sortOrder: 3,
        active: true,
      },
      {
        id: "desserts",
        name: "Desi Desserts",
        urdu: "دیسی میٹھا",
        blurb: "Warm mithai lifted straight from the degh, served until the last table leaves.",
        icon: "dessert" as const,
        sortOrder: 4,
        active: true,
      },
    ];

    for (const c of categories) {
      await ctx.db.insert("menuCategories", c);
    }

    const dishes: {
      slug: string;
      name: string;
      urdu: string;
      categoryId: string;
      summary: string;
      description: string;
      notes: { label: string; value: string }[];
      pairings: string[];
      active: boolean;
      featured: boolean;
      sortOrder: number;
      pricePerPlate: number;
    }[] = [
      {
        slug: "beef-seekh-kebab",
        name: "Beef Seekh Kebab",
        urdu: "بیف سیخ کباب",
        categoryId: "bbq",
        summary: "Hand-pressed minced beef, grilled over open charcoal.",
        description:
          "Our signature kebab since the first night we opened: finely minced beef worked by hand with green chilli, coriander and toasted spice, pressed onto flat skewers and grilled over open charcoal until the edges catch.",
        notes: [
          { label: "Counter", value: "Live charcoal grill" },
          { label: "Marination", value: "Twelve hours, pressed by hand" },
          { label: "Served with", value: "Mint chutney & tandoor bread" },
        ],
        pairings: ["chicken-malai-boti", "mutton-nihari"],
        active: true,
        featured: true,
        sortOrder: 1,
        pricePerPlate: 850,
      },
      {
        slug: "chicken-malai-boti",
        name: "Chicken Malai Boti",
        urdu: "چکن ملائی بوٹی",
        categoryId: "bbq",
        summary: "Cream-marinated chicken, grilled soft with a faint smoke.",
        description:
          "Boneless chicken rests overnight in cream, cheddar and white pepper, then meets the coals just long enough to colour without drying.",
        notes: [
          { label: "Counter", value: "Live charcoal grill" },
          { label: "Spice", value: "Mild" },
          { label: "Served with", value: "Garlic yoghurt & salad" },
        ],
        pairings: ["beef-seekh-kebab", "chicken-shashlik"],
        active: true,
        featured: true,
        sortOrder: 2,
        pricePerPlate: 750,
      },
      {
        slug: "chicken-tikka",
        name: "Charcoal Chicken Tikka",
        urdu: "چکن تکہ",
        categoryId: "bbq",
        summary: "Bone-in tikka with a deep red chilli and yoghurt marinade.",
        description:
          "Whole leg pieces are scored, soaked in a chilli, yoghurt and mustard-oil marinade, and turned slowly over charcoal until the skin blisters.",
        notes: [
          { label: "Counter", value: "Live charcoal grill" },
          { label: "Spice", value: "Medium to hot" },
          { label: "Cut", value: "Bone-in leg and thigh" },
        ],
        pairings: ["beef-seekh-kebab", "lahori-chana-chaat"],
        active: true,
        featured: false,
        sortOrder: 3,
        pricePerPlate: 700,
      },
      {
        slug: "grilled-fish",
        name: "Charcoal Grilled Fish",
        urdu: "گرل شدہ مچھلی",
        categoryId: "bbq",
        summary: "Our daily special — whole fish, marinated overnight.",
        description:
          "A whole freshwater fish is scored, rubbed with ajwain, turmeric and crushed coriander, and left to marinate overnight before an unhurried turn over the coals.",
        notes: [
          { label: "Availability", value: "Daily special, from 7 PM" },
          { label: "Marination", value: "Overnight, ajwain & turmeric" },
          { label: "Served with", value: "Imli chutney & lemon" },
        ],
        pairings: ["chicken-tikka", "shahi-kheer"],
        active: true,
        featured: true,
        sortOrder: 4,
        pricePerPlate: 1200,
      },
      {
        slug: "mutton-nihari",
        name: "Mutton Nihari",
        urdu: "مٹن نہاری",
        categoryId: "handi",
        summary: "Simmered overnight until the meat gives way to the spoon.",
        description:
          "Bone-in mutton is sealed in its own stock at dawn and left to simmer through the day with a slow-roasted spice blend and marrow.",
        notes: [
          { label: "Cooking time", value: "Eight to ten hours" },
          { label: "Spice", value: "Medium" },
          { label: "Served with", value: "Ginger, chilli & lemon" },
        ],
        pairings: ["beef-seekh-kebab", "palak-paneer"],
        active: true,
        featured: true,
        sortOrder: 1,
        pricePerPlate: 950,
      },
      {
        slug: "chicken-karahi",
        name: "Chicken Karahi",
        urdu: "چکن کڑاہی",
        categoryId: "handi",
        summary: "Tomato, ginger and green chilli, finished in the wok.",
        description:
          "Cooked to order in a black iron karahi, our chicken is tossed with crushed tomato, julienned ginger and whole green chillies until the oil separates.",
        notes: [
          { label: "Cooked", value: "Made to order" },
          { label: "Spice", value: "Medium, adjustable" },
          { label: "Served with", value: "Tandoori naan" },
        ],
        pairings: ["palak-paneer", "kulfi-falooda"],
        active: true,
        featured: false,
        sortOrder: 2,
        pricePerPlate: 1100,
      },
      {
        slug: "chicken-haleem",
        name: "Chicken Haleem",
        urdu: "چکن حلیم",
        categoryId: "handi",
        summary: "Wheat, lentils and chicken pounded into a velvet porridge.",
        description:
          "Cracked wheat and five lentils are cooked down with shredded chicken for hours, then pounded smooth with a wooden masher until the texture turns silken.",
        notes: [
          { label: "Cooking time", value: "Six hours of pounding" },
          { label: "Texture", value: "Silken, spoon-thick" },
          { label: "Toppings", value: "Fried onion, ginger, lemon" },
        ],
        pairings: ["beef-seekh-kebab", "gulab-jamun"],
        active: true,
        featured: false,
        sortOrder: 3,
        pricePerPlate: 650,
      },
      {
        slug: "palak-paneer",
        name: "Palak Paneer",
        urdu: "پالک پنیر",
        categoryId: "handi",
        summary: "House-made paneer folded through slow-cooked spinach.",
        description:
          "Spinach is cooked gently so it keeps its colour, then brightened with ginger, garlic and a touch of cream.",
        notes: [
          { label: "Paneer", value: "Set in-house each morning" },
          { label: "Spice", value: "Mild" },
          { label: "Best with", value: "Tandoori naan or sheermal" },
        ],
        pairings: ["mutton-nihari", "chicken-karahi"],
        active: true,
        featured: false,
        sortOrder: 4,
        pricePerPlate: 600,
      },
      {
        slug: "lahori-chana-chaat",
        name: "Lahori Chana Chaat",
        urdu: "لاہوری چنا چاٹ",
        categoryId: "fast-bites",
        summary: "Chickpeas, tamarind and yoghurt, built to order.",
        description:
          "Boiled chickpeas arrive sharp with chaat masala, imli water, mint yoghurt, chopped onion and crisp papri.",
        notes: [
          { label: "Counter", value: "Chaat station" },
          { label: "Served", value: "Assembled to order" },
          { label: "Spice", value: "Medium, tangy" },
        ],
        pairings: ["dahi-baray", "samosa-pakora"],
        active: true,
        featured: false,
        sortOrder: 1,
        pricePerPlate: 400,
      },
      {
        slug: "dahi-baray",
        name: "Dahi Baray",
        urdu: "دہی بڑے",
        categoryId: "fast-bites",
        summary: "Lentil dumplings under cool whipped yoghurt.",
        description:
          "Soft lentil dumplings are soaked in water until pillowy, then dressed with thick whipped yoghurt, imli chutney and a dusting of roasted cumin.",
        notes: [
          { label: "Counter", value: "Chaat station" },
          { label: "Served", value: "Chilled" },
          { label: "Spice", value: "Mild" },
        ],
        pairings: ["lahori-chana-chaat", "shahi-kheer"],
        active: true,
        featured: false,
        sortOrder: 2,
        pricePerPlate: 400,
      },
      {
        slug: "samosa-pakora",
        name: "Samosa & Pakora Counter",
        urdu: "سموسہ اور پکوڑا",
        categoryId: "fast-bites",
        summary: "Fried in small batches so they always arrive crisp.",
        description:
          "Potato and pea samosas, onion pakoras and spring rolls are fried in small batches through the night so nothing sits under a lamp.",
        notes: [
          { label: "Counter", value: "Fryer, small batches" },
          { label: "Served with", value: "Imli & mint chutney" },
          { label: "Availability", value: "All hours" },
        ],
        pairings: ["chicken-shashlik", "kulfi-falooda"],
        active: true,
        featured: false,
        sortOrder: 3,
        pricePerPlate: 350,
      },
      {
        slug: "chicken-shashlik",
        name: "Chicken Shashlik Sticks",
        urdu: "چکن شاشلک",
        categoryId: "fast-bites",
        summary: "Skewered chicken with peppers, onion and a soy glaze.",
        description:
          "Cubes of chicken are threaded with onion, capsicum and tomato, grilled quickly and brushed with a light soy and chilli glaze.",
        notes: [
          { label: "Counter", value: "Grill station" },
          { label: "Spice", value: "Mild" },
          { label: "Served", value: "On the skewer" },
        ],
        pairings: ["chicken-malai-boti", "samosa-pakora"],
        active: true,
        featured: false,
        sortOrder: 4,
        pricePerPlate: 750,
      },
      {
        slug: "gajar-ka-halwa",
        name: "Gajar ka Halwa",
        urdu: "گاجر کا حلوہ",
        categoryId: "desserts",
        summary: "Winter carrots cooked down with khoya and ghee.",
        description:
          "Grated carrots are cooked slowly in ghee until the moisture lifts, then finished with khoya, sugar and a handful of pistachio.",
        notes: [
          { label: "Cooking time", value: "Three hours, stirred by hand" },
          { label: "Served", value: "Warm" },
          { label: "Richness", value: "Khoya and pure ghee" },
        ],
        pairings: ["shahi-kheer", "kulfi-falooda"],
        active: true,
        featured: false,
        sortOrder: 1,
        pricePerPlate: 450,
      },
      {
        slug: "shahi-kheer",
        name: "Shahi Kheer",
        urdu: "شاہی کھیر",
        categoryId: "desserts",
        summary: "Rice pudding reduced slowly with saffron and nuts.",
        description:
          "Full-cream milk is reduced with broken rice for hours until it thickens to a pale gold, then perfumed with saffron, cardamom and slivered almonds.",
        notes: [
          { label: "Cooking time", value: "Reduced for four hours" },
          { label: "Served", value: "Chilled" },
          { label: "Flavouring", value: "Saffron & cardamom" },
        ],
        pairings: ["gulab-jamun", "dahi-baray"],
        active: true,
        featured: false,
        sortOrder: 2,
        pricePerPlate: 450,
      },
      {
        slug: "kulfi-falooda",
        name: "Kulfi Falooda",
        urdu: "قلفی فالودہ",
        categoryId: "desserts",
        summary: "Dense kulfi over falooda, rabri and rose syrup.",
        description:
          "House-made kulfi is set in metal moulds until dense and slow-melting, then turned out over falooda threads, thickened rabri and a measure of rose syrup.",
        notes: [
          { label: "Kulfi", value: "Made in-house daily" },
          { label: "Served", value: "Frozen, with rabri" },
          { label: "Flavouring", value: "Rose syrup & pistachio" },
        ],
        pairings: ["gajar-ka-halwa", "chicken-karahi"],
        active: true,
        featured: true,
        sortOrder: 3,
        pricePerPlate: 500,
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
        active: true,
        featured: false,
        sortOrder: 4,
        pricePerPlate: 400,
      },
    ];

    for (const dish of dishes) {
      await ctx.db.insert("menuDishes", dish);
    }

    return { seeded: true };
  },
});
