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

type Id<T extends string> = string;

function collisionAvoid(reference: string, ctx: any, table: string, field: string) {
  const existing = ctx.db
    .query(table)
    .withIndex(field, (q) => q.eq(field, reference))
    .unique();
  if (existing) {
    throw new Error(
      `A record with that identifier already exists. Please choose another.`,
    );
  }
}

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
        .withIndex("by_id", (q) => q.eq("id", args.id))
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
    icon: v.union(v.literal("flame"), v.literal("pot"), v.literal("bites"), v.literal("dessert")),
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
    const existing = await ctx.db  .query("menuCategories")
      .withIndex("by_categoryId", (q) => q.eq("id", args.id))
      .unique();
    if (!existing) throw new Error("Category not found.");

    // Move any dishes in this category into a hidden "uncategorized" bucket.
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
    notes: v.optional(v.array(v.object({ label: v.string(), value: v.string() }))),
    pairings: v.optional(v.array(v.string())),
    image: v.optional(v.string()),
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

    // Ensure the target category exists.
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

    if (existing && (args._id ? existing._id !== args._id : true)) {
      throw new Error(
        `A dish with the slug "${targetSlug}" already exists. Use a different name or edit the existing dish.`,
      );
    }

    const dishDoc = {
      slug: targetSlug,
      name: args.name.trim(),
      urdu: args.urdu?.trim() || undefined,
      categoryId: args.categoryId,
      summary: args.summary?.trim() || undefined,
      description: args.description?.trim() || undefined,
      notes: args.notes?.length
        ? args.notes.map((n) => ({ label: n.label.trim(), value: n.value.trim() }))
        : undefined,
      pairings: args.pairings?.length ? args.pairings.map((p) => p.trim()) : undefined,
      image: args.image?.trim() || undefined,
      active: args.active,
      featured: args.featured,
      sortOrder: args.sortOrder,
      pricePerPlate: args.pricePerPlate != null ? args.pricePerPlate : undefined,
    };

    let id: Id<"menuDishes">;
    if (existing) {
      await ctx.db.patch(existing._id, dishDoc);
      id = existing._id;
    } else {
      id = (await ctx.db.insert("menuDishes", dishDoc)) as Id<"menuDishes">;
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
// Media asset upload + management
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
    collisionAvoid(args.assetId, ctx, "menuAssets", "assetId");

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

    // Remove references from dishes that point at this asset.
    const linkedDishes = await ctx.db
      .query("menuDishes")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    for (const dish of linkedDishes) {
      if (dish.image === existing.url) {
        await ctx.db.patch(dish._id, { image: undefined });
      }
    }

    await ctx.db.delete(existing._id);
    return { deleted: true };
  },
});

// ------------------------------------------------------------------ //
// Admin helpers — seed + reset
// ------------------------------------------------------------------ //

export const ensureSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    const existingCategories = await ctx.db.query("menuCategories").collect();
    if (existingCategories.length > 0) {
      return { seeded: false, reason: "Menu already contains categories." };
    }

    const now = Date.now();
    const adminId = (await ctx.db.query("users").first())?._id ?? "seed";
    const assetId = `seed-hero-${Date.now()}`;

    // Register a placeholder hero asset if no real image has been uploaded yet.
    await ctx.db.insert("menuAssets", {
      assetId,
      originalName: "placeholder-hero.jpg",
      mimeType: "image/jpeg",
      url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=70",
      bytes: 0,
      uploadedById: adminId,
      uploadedAt: now,
      usedBy: ["hero"],
    });

    const categories = [
      { id: "bbq", name: "BBQ & Grills", urdu: "باری بی کیو", blurb: "Charcoal counters that stay lit all night, working from recipes the family has grilled for years.", icon: "flame", sortOrder: 1, active: true },
      { id: "handi", name: "Traditional Handi", urdu: "روایتی ہانڈی", blurb: "Slow clay-pot cooking that begins before dawn and simmers until the first guests sit down.", icon: "pot", sortOrder: 2, active: true },
      { id: "fast-bites", name: "Fast Bites", urdu: "فاسٹ بائٹس", blurb: "Lahori street plates and lighter bites for children, cousins and the midnight crowd.", icon: "bites", sortOrder: 3, active: true },
      { id: "desserts", name: "Desi Desserts", urdu: "دیسی میٹھا", blurb: "Warm mithai lifted straight from the degh, served until the last table leaves.", icon: "dessert", sortOrder: 4, active: true },
    ];

    for (const c of categories) {
      await ctx.db.insert("menuCategories", {
        ...c,
        icon: validateIcon(c.icon),
      });
    }

    const dishes: any[] = [
      { slug: "beef-seekh-kebab", name: "Beef Seekh Kebab", urdu: "بیف سیخ کباب", categoryId: "bbq", summary: "Hand-pressed minced beef, grilled over open charcoal.", description: "Our signature kebab since the first night we opened: finely minced beef worked by hand with green chilli, coriander and toasted spice, pressed onto flat skewers and grilled over open charcoal until the edges catch.", notes: [{ label: "Counter", value: "Live charcoal grill" }, { label: "Marination", value: "Twelve hours, pressed by hand" }, { label: "Served with", value: "Mint chutney & tandoor bread" }], pairings: ["chicken-malai-boti","mutton-nihari"], image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=70", active: true, featured: true, sortOrder: 1, pricePerPlate: 0 },
      { slug: "chicken-malai-boti", name: "Chicken Malai Boti", urdu: "چکن ملائی بوٹی", categoryId: "bbq", summary: "Cream-marinated chicken, grilled soft with a faint smoke.", description: "Boneless chicken rests overnight in cream, cheddar and white pepper, then meets the coals just long enough to colour without drying.", notes: [{ label: "Counter", value: "Live charcoal grill" }, { label: "Spice", value: "Mild" }, { label: "Served with", value: "Garlic yoghurt & salad" }], pairings: ["beef-seekh-kebab","chicken-shashlik"], image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=70", active: true, featured: true, sortOrder: 2, pricePerPlate: 0 },
      { slug: "chicken-tikka", name: "Charcoal Chicken Tikka", urdu: "چکن تکہ", categoryId: "bbq", summary: "Bone-in tikka with a deep red chilli and yoghurt marinade.", description: "Whole leg pieces are scored, soaked in a chilli, yoghurt and mustard-oil marinade, and turned slowly over charcoal until the skin blisters.", notes: [{ label: "Counter", value: "Live charcoal grill" }, { label: "Spice", value: "Medium to hot" }, { label: "Cut", value: "Bone-in leg and thigh" }], pairings: ["beef-seekh-kebab","lahori-chana-chaat"], image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 3, pricePerPlate: 0 },
      { slug: "grilled-fish", name: "Charcoal Grilled Fish", urdu: "گرل شدہ مچھلی", categoryId: "bbq", summary: "Our daily special — whole fish, marinated overnight.", description: "A whole freshwater fish is scored, rubbed with ajwain, turmeric and crushed coriander, and left to marinate overnight before an unhurried turn over the coals.", notes: [{ label: "Availability", value: "Daily special, from 7 PM" }, { label: "Marination", value: "Overnight, ajwain & turmeric" }, { label: "Served with", value: "Imli chutney & lemon" }], pairings: ["chicken-tikka","shahi-kheer"], image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=70", active: true, featured: true, sortOrder: 4, pricePerPlate: 0 },
      { slug: "mutton-nihari", name: "Mutton Nihari", urdu: "مٹن نہاری", categoryId: "handi", summary: "Simmered overnight until the meat gives way to the spoon.", description: "Bone-in mutton is sealed in its own stock at dawn and left to simmer through the day with a slow-roasted spice blend and marrow.", notes: [{ label: "Cooking time", value: "Eight to ten hours" }, { label: "Spice", value: "Medium" }, { label: "Served with", value: "Ginger, chilli & lemon" }], pairings: ["beef-seekh-kebab","palak-paneer"], image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=70", active: true, featured: true, sortOrder: 1, pricePerPlate: 0 },
      { slug: "chicken-karahi", name: "Chicken Karahi", urdu: "چکن کڑاہی", categoryId: "handi", summary: "Tomato, ginger and green chilli, finished in the wok.", description: "Cooked to order in a black iron karahi, our chicken is tossed with crushed tomato, julienned ginger and whole green chillies until the oil separates.", notes: [{ label: "Cooked", value: "Made to order" }, { label: "Spice", value: "Medium, adjustable" }, { label: "Served with", value: "Tandoori naan" }], pairings: ["palak-paneer","kulfi-falooda"], image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 2, pricePerPlate: 0 },
      { slug: "chicken-haleem", name: "Chicken Haleem", urdu: "چکن حلیم", categoryId: "handi", summary: "Wheat, lentils and chicken pounded into a velvet porridge.", description: "Cracked wheat and five lentils are cooked down with shredded chicken for hours, then pounded smooth with a wooden masher until the texture turns silken.", notes: [{ label: "Cooking time", value: "Six hours of pounding" }, { label: "Texture", value: "Silken, spoon-thick" }, { label: "Toppings", value: "Fried onion, ginger, lemon" }], pairings: ["beef-seekh-kebab","gulab-jamun"], image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 3, pricePerPlate: 0 },
      { slug: "palak-paneer", name: "Palak Paneer", urdu: "پالک پنیر", categoryId: "handi", summary: "House-made paneer folded through slow-cooked spinach.", description: "Spinach is cooked gently so it keeps its colour, then brightened with ginger, garlic and a touch of cream.", notes: [{ label: "Paneer", value: "Set in-house each morning" }, { label: "Spice", value: "Mild" }, { label: "Best with", value: "Tandoori naan or sheermal" }], pairings: ["mutton-nihari","chicken-karahi"], image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 4, pricePerPlate: 0 },
      { slug: "lahori-chana-chaat", name: "Lahori Chana Chaat", urdu: "لاہوری چنا چاٹ", categoryId: "fast-bites", summary: "Chickpeas, tamarind and yoghurt, built to order.", description: "Boiled chickpeas arrive sharp with chaat masala, imli water, mint yoghurt, chopped onion and crisp papri.", notes: [{ label: "Counter", value: "Chaat station" }, { label: "Served", value: "Assembled to order" }, { label: "Spice", value: "Medium, tangy" }], pairings: ["dahi-baray","samosa-pakora"], image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 1, pricePerPlate: 0 },
      { slug: "dahi-baray", name: "Dahi Baray", urdu: "دہی بڑے", categoryId: "fast-bites", summary: "Lentil dumplings under cool whipped yoghurt.", description: "Soft lentil dumplings are soaked in water until pillowy, then dressed with thick whipped yoghurt, imli chutney and a dusting of roasted cumin.", notes: [{ label: "Counter", value: "Chaat station" }, { label: "Served", value: "Chilled" }, { label: "Spice", value: "Mild" }], pairings: ["lahori-chana-chaat","shahi-kheer"], image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 2, pricePerPlate: 0 },
      { slug: "samosa-pakora", name: "Samosa & Pakora Counter", urdu: "سموسہ اور پکوڑا", categoryId: "fast-bites", summary: "Fried in small batches so they always arrive crisp.", description: "Potato and pea samosas, onion pakoras and spring rolls are fried in small batches through the night so nothing sits under a lamp.", notes: [{ label: "Counter", value: "Fryer, small batches" }, { label: "Served with", value: "Imli & mint chutney" }, { label: "Availability", value: "All hours" }], pairings: ["chicken-shashlik","kulfi-falooda"], image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 3, pricePerPlate: 0 },
      { slug: "chicken-shashlik", name: "Chicken Shashlik Sticks", urdu: "چکن شاشلک", categoryId: "fast-bites", summary: "Skewered chicken with peppers, onion and a soy glaze.", description: "Cubes of chicken are threaded with onion, capsicum and tomato, grilled quickly and brushed with a light soy and chilli glaze.", notes: [{ label: "Counter", value: "Grill station" }, { label: "Spice", value: "Mild" }, { label: "Served", value: "On the skewer" }], pairings: ["chicken-malai-boti","samosa-pakora"], image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 4, pricePerPlate: 0 },
      { slug: "gajar-ka-halwa", name: "Gajar ka Halwa", urdu: "گاجر کا حلوہ", categoryId: "desserts", summary: "Winter carrots cooked down with khoya and ghee.", description: "Grated carrots are cooked slowly in ghee until the moisture lifts, then finished with khoya, sugar and a handful of Pistachio.", notes: [{ label: "Cooking time", value: "Three hours, stirred by hand" }, { label: "Served", value: "Warm" }, { label: "Richness", value: "Khoya and pure ghee" }], pairings: ["shahi-kheer","kulfi-falooda"], image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 1, pricePerPlate: 0 },
      { slug: "shahi-kheer", name: "Shahi Kheer", urdu: "شاہی کھیر", categoryId: "desserts", summary: "Rice pudding reduced slowly with saffron and nuts.", description: "Full-cream milk is reduced with broken rice for hours until it thickens to a pale gold, then perfumed with saffron, cardamom and slivered almonds.", notes: [{ label: "Cooking time", value: "Reduced for four hours" }, { label: "Served", value: "Chilled" }, { label: "Flavouring", value: "Saffron & cardamom" }], pairings: ["gulab-jamun","dahi-baray"], image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 2, pricePerPlate: 0 },
      { slug: "kulfi-falooda", name: "Kulfi Falooda", urdu: "قلفی فالودہ", categoryId: "desserts", summary: "Dense kulfi over falooda, rabri and rose syrup.", description: "House-made kulfi is set in metal moulds until dense and slow-melting, then turned out over falooda threads, thickened rabri and a measure of rose syrup.", notes: [{ label: "Kulfi", value: "Made in-house daily" }, { label: "Served", value: "Frozen, with rabri" }, { label: "Flavouring", value: "Rose syrup & pistachio" }], pairings: ["gajar-ka-halwa","chicken-karahi"], image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=70", active: true, featured: true, sortOrder: 3, pricePerPlate: 0 },
      { slug: "gulab-jamun", name: "Gulab Jamun & Rabri", urdu: "گلاب جامن", categoryId: "desserts", summary: "Warm milk dumplings under thickened rabri.", description: "Khoya dumplings are fried to a deep amber and soaked in cardamom syrup until they double in size, then served warm with a spoon of rabri over the top.", notes: [{ label: "Fried", value: "To order, small batches" }, { label: "Served", value: "Warm with rabri" }, { label: "Syrup", value: "Cardamom & rose water" }], pairings: ["shahi-kheer","chicken-haleem"], image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=70", active: true, featured: false, sortOrder: 4, pricePerPlate: 0 },
    ];

    for (const dish of dishes) {
      await ctx.db.insert("menuDishes", dish);
    }

    return { seeded: true };
  },
});
