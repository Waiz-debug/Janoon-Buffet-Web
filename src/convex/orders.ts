import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./reservations";
import { ORDER_STATUSES, type OrderStatus } from "./schema";
import { reservationStatusValidator } from "./schema";
import { seatingValidator } from "./schema";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";

type OrderDoc = Doc<"orders">;

type MenuSlug = string;

/** Convex-safe menu validator. In production these slugs should be kept in one
 *  place with the public menu; for now they are mirrored here so the convex
 *  runtime can validate an incoming order without importing the React side.
 */
const MENU_SLUGS: ReadonlySet<MenuSlug> = new Set([
  "beef-seekh-kebab",
  "chicken-malai-boti",
  "chicken-tikka",
  "grilled-fish",
  "mutton-nihari",
  "chicken-karahi",
  "chicken-haleem",
  "palak-paneer",
  "lahori-chana-chaat",
  "dahi-baray",
  "samosa-pakora",
  "chicken-shashlik",
  "gajar-ka-halwa",
  "shahi-kheer",
  "kulfi-falooda",
  "gulab-jamun",
]);

function qualifyDish(slug: string): MenuSlug | null {
  const key = slug.trim().toLowerCase();
  if (MENU_SLUGS.has(key)) return key;
  return null;
}

/** Guest-placed order, validated at the boundaries, then stored. */
export const create = mutation({
  args: {
    reference: v.string(),
    guestName: v.string(),
    partySize: v.number(),
    dishes: v.array(
      v.object({
        slug: v.string(),
        count: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    seating: v.union(v.literal("outdoor"), v.literal("indoor")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const reference = args.reference.trim().toUpperCase();
    if (!reference) throw new Error("Attach the order to a booking reference.");

    const dishList = Array.isArray(args.dishes) ? args.dishes : [];
    const valid: [MenuSlug, number][] = [];

    for (const line of dishList) {
      const slug = line.slug;
      const count = line.count;
      if (typeof slug !== "string" || !slug.trim()) continue;
      const qualified = qualifyDish(slug.trim());
      if (!qualified) {
        throw new Error(
          `One line item was not on the menu today: "${slug.trim()}". Please edit and try again.`,
        );
      }
      const units = Number(count);
      if (!Number.isFinite(units) || units < 1) {
        throw new Error("Each dish line must have at least 1 plate.");
      }
      if (valid.length >= 12) break;
      if (units > 20) {
        throw new Error("No single dish can be ordered for more than 20 plates at once.");
      }
      valid.push([qualified, units]);
    }

    if (valid.length === 0) {
      throw new Error(
        "Place at least one dish from the menu to attend the buffet later.",
      );
    }

    const now = args.createdAt > 0 ? args.createdAt : Date.now() / 1000;
    const stored = {
      reference,
      guestName: args.guestName.trim(),
      partySize: Math.min(Math.max(Math.floor(args.partySize) || 1, 1), 30),
      createdAt: now,
      seating: args.seating,
      dishes: valid,
      notes: args.notes?.trim() ? args.notes.trim().slice(0, 300) : undefined,
      status: ORDER_STATUSES.PENDING,
    };

    const id = await ctx.db.insert("orders", stored);
    return { id, ...stored };
  },
});

/** Realtime feed — newest first, desk-only. */
export const list = query({
  args: {},
  handler: async (_ctx) => {
    await requireStaff(_ctx);
    const orders = await _ctx.db.query("orders").collect();
    return orders.sort((a, b) => b.createdAt - a.createdAt) as OrderDoc[];
  },
});

/** How many orders are currently in a non-terminal state. */
export const unfulfilledCount = query({
  args: {},
  handler: async (_ctx) => {
    await requireStaff(_ctx);
    const orders = await _ctx.db.query("orders").collect();
    return orders.filter(
      (o: OrderDoc) =>
        o.status !== ORDER_STATUSES.SERVED &&
        o.status !== ORDER_STATUSES.PENDING,
    ).length;
  },
});

/** Move an order through the counter flow. Desk only. */
export const advanceStatus = mutation({
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal(ORDER_STATUSES.PREPARING),
      v.literal(ORDER_STATUSES.READY),
      v.literal(ORDER_STATUSES.SERVED),
    ),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const order = await ctx.db.get(args.id) as OrderDoc | null;
    if (!order) throw new Error("That order no longer exists.");

    if (args.status === ORDER_STATUSES.SERVED && !order.servedAt) {
      await ctx.db.patch(args.id, {
        status: args.status,
        servedAt: Math.floor(Date.now() / 1000),
      });
    } else {
      await ctx.db.patch(args.id, {
        status: args.status as OrderStatus,
      });
    }
    return { id: args.id, status: args.status };
  },
});

/** Quick lookup for the public settling-in page. */
export const findByReference = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex(
        "by_reference",
        (q) => q.eq("reference", args.reference.trim().toUpperCase()),
      )
      .unique();
  },
});
