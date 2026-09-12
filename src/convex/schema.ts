import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// reservation lifecycle used by the buffet bookings desk
export const RESERVATION_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SEATED: "seated",
  CANCELLED: "cancelled",
} as const;

export const reservationStatusValidator = v.union(
  v.literal(RESERVATION_STATUSES.PENDING),
  v.literal(RESERVATION_STATUSES.CONFIRMED),
  v.literal(RESERVATION_STATUSES.SEATED),
  v.literal(RESERVATION_STATUSES.CANCELLED),
);
export type ReservationStatus = Infer<typeof reservationStatusValidator>;

export const seatingValidator = v.union(
  v.literal("outdoor"),
  v.literal("indoor"),
);
export type Seating = Infer<typeof seatingValidator>;

/** Delivery lifecycle for à-la-carte orders brought to a guest's address. */
export const DELIVERY_STATUSES = {
  PLACED: "placed",
  CONFIRMED: "confirmed",
  COOKING: "cooking",
  OUT_FOR_DELIVERY: "out-for-delivery",
  DELIVERED: "delivered",
} as const;

export const deliveryStatusValidator = v.union(
  v.literal(DELIVERY_STATUSES.PLACED),
  v.literal(DELIVERY_STATUSES.CONFIRMED),
  v.literal(DELIVERY_STATUSES.COOKING),
  v.literal(DELIVERY_STATUSES.OUT_FOR_DELIVERY),
  v.literal(DELIVERY_STATUSES.DELIVERED),
);
export type DeliveryStatus = Infer<typeof deliveryStatusValidator>;

// "Buffet orders" placed at the settling-in counter. Kept separate from
// reservations because an order is per-person plates, not a table booking.
export const ORDER_STATUSES = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
} as const;

export const orderStatusValidator = v.union(
  v.literal(ORDER_STATUSES.PENDING),
  v.literal(ORDER_STATUSES.PREPARING),
  v.literal(ORDER_STATUSES.READY),
  v.literal(ORDER_STATUSES.SERVED),
);
export type OrderStatus = Infer<typeof orderStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Buffet table reservations submitted from the public booking form.
    reservations: defineTable({
      name: v.string(),
      phone: v.string(),
      partySize: v.number(),
      /** Local service date, ISO `YYYY-MM-DD`. */
      date: v.string(),
      /** Local service time, 24h `HH:mm`. */
      time: v.string(),
      seating: seatingValidator,
      notes: v.optional(v.string()),
      status: reservationStatusValidator,
      reference: v.string(),
    })
      .index("by_date", ["date"])
      .index("by_status", ["status"])
      .index("by_reference", ["reference"])
      .index("by_phone", ["phone"]),

    /** Buffet orders placed by guests at the settling-in counter or via a
     *  pre-order link. Each order is tied to a single table reservation. */
    orders: defineTable({
      reference: v.string(),
      /** Short human name the order is referred to on boarding. */
      guestName: v.string(),
      partySize: v.number(),
      /** Timestamp when the order was placed, seconds since epoch. */
      createdAt: v.number(),
      seating: seatingValidator,
      /** Each dish line: [slug, unit count] */
      dishes: v.array(
        v.object({
          slug: v.string(),
          count: v.number(),
        }),
      ),
      notes: v.optional(v.string()),
      status: orderStatusValidator,
      /** The settling-in counter stamp when an order reaches "served". Optional. */
      servedAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_reference", ["reference"])
      .index("by_guestName", ["guestName"]),

    // ------------------------------------------------------------------ //
    // Menu management — editable from the admin portal at runtime.         //
    // The public frontend reads from these tables via Convex queries so    //
    // any change here is reflected on the live site without redeploy.      //
    // ------------------------------------------------------------------ //

    /** Ordered categories that group dishes on the public buffet menu. */
    menuCategories: defineTable({
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
    })
      .index("by_sortOrder", ["sortOrder"])
      .index("by_categoryId", ["id"]),

    /** Individual buffet dishes. Image URLs should point at uploaded assets. */
    menuDishes: defineTable({
      slug: v.string(),
      name: v.string(),
      urdu: v.optional(v.string()),
      categoryId: v.string(),
      summary: v.optional(v.string()),
      description: v.optional(v.string()),
      notes: v.optional(v.array(v.object({ label: v.string(), value: v.string() }))),
      pairings: v.optional(v.array(v.string())),
      image: v.optional(v.string()),
      /** When true the dish is visible on the public menu. */
      active: v.boolean(),
      featured: v.boolean(),
      sortOrder: v.number(),
      pricePerPlate: v.optional(v.number()),
    })
      .index("by_categoryId", ["categoryId"])
      .index("by_slug", ["slug"])
      .index("by_sortOrder", ["sortOrder"])
      .index("by_active", ["active"]),

    /** Media library entries uploaded by admin staff. */
    menuAssets: defineTable({
      assetId: v.string(),
      originalName: v.string(),
      mimeType: v.string(),
      /** Local relative path when stored on the same host, or a remote URL. */
      url: v.string(),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      bytes: v.number(),
      uploadedById: v.string(),
      uploadedAt: v.number(),
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
    })
      .index("by_assetId", ["assetId"])
      .index("by_uploadedById", ["uploadedById"])
      .index("by_url", ["url"]),

    /** À-la-carte delivery orders placed from the public cart. Pricing is
     *  computed server-side at placement time and stored on the order. */
    deliveryOrders: defineTable({
      reference: v.string(),
      customerName: v.string(),
      /** Digits only, e.g. 03228543333. */
      phone: v.string(),
      address: v.string(),
      area: v.string(),
      notes: v.optional(v.string()),
      items: v.array(
        v.object({
          slug: v.string(),
          name: v.string(),
          count: v.number(),
          unitPrice: v.number(),
        }),
      ),
      itemsTotal: v.number(),
      deliveryFee: v.number(),
      total: v.number(),
      status: deliveryStatusValidator,
      createdAt: v.number(),
      deliveredAt: v.optional(v.number()),
    })
      .index("by_status", ["status"])
      .index("by_reference", ["reference"])
      .index("by_createdAt", ["createdAt"]),

    // add other tables here
  },
  {
    schemaValidation: false,
  },
);

export default schema;
