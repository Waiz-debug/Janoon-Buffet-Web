import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { deliveryStatusValidator } from "./schema";
import type { Doc } from "./_generated/dataModel";

type DeliveryOrder = Doc<"deliveryOrders">;

/** Mirrors DELIVERY_PRICES in src/lib/menu.ts — the Convex runtime only
 *  bundles files inside convex/, so the table is duplicated here and must
 *  be kept in sync (same convention as MENU_SLUGS in orders.ts). */
const DELIVERY_FEE = 150;
const FREE_DELIVERY_THRESHOLD = 2500;

function deliveryUnitPrice(slug: string): number {
  const prices: Record<string, number> = {
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
  return prices[slug.trim().toLowerCase()] ?? 600;
}

const LAHORE_AREAS = [
  "DHA Phase 1-6",
  "Gulberg",
  "Johar Town",
  "Model Town",
  "Bahria Town",
  "Cantt",
  "Faisal Town",
  "Askari",
  "Wapda Town",
  "Valencia",
] as const;

/** Public: place a delivery order. Prices are computed server-side so the
 *  client can never post a total that understates the real one. */
export const placeOrder = mutation({
  args: {
    customerName: v.string(),
    phone: v.string(),
    address: v.string(),
    area: v.string(),
    notes: v.optional(v.string()),
    items: v.array(
      v.object({
        slug: v.string(),
        name: v.string(),
        count: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const customerName = args.customerName.trim();
    const phoneDigits = args.phone.replace(/\D/g, "");
    const address = args.address.trim();
    const area = args.area.trim();

    if (customerName.length < 2) {
      throw new Error("Please enter the name for the order.");
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 12) {
      throw new Error("Please enter a valid phone number.");
    }
    if (address.length < 8) {
      throw new Error("Please enter a full delivery address in Lahore.");
    }
    if (!area) {
      throw new Error("Please choose your area in Lahore.");
    }

    const lines = [];
    for (const item of args.items) {
      const count = Math.floor(Number(item.count));
      if (!item.slug || count < 1) continue;
      lines.push({
        slug: item.slug,
        name: item.name.trim().slice(0, 80),
        count: Math.min(count, 20),
        unitPrice: deliveryUnitPrice(item.slug),
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

    const reference = `DLV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const now = Date.now();

    const id = await ctx.db.insert("deliveryOrders", {
      reference,
      customerName,
      phone: phoneDigits,
      address,
      area,
      notes: args.notes?.trim() ? args.notes.trim().slice(0, 300) : undefined,
      items: lines,
      itemsTotal,
      deliveryFee,
      total,
      status: "placed",
      createdAt: now,
    });

    return { id, reference, total, deliveryFee };
  },
});

/** Delivery desk feed, newest first. Access is enforced client-side by the
 *  PIN-gated /deliveries route (same model as the public reservation lookups). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("deliveryOrders").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt) as DeliveryOrder[];
  },
});

/** Headline numbers for the staff portal header strip. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("deliveryOrders").collect();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const placedToday = rows.filter((o) => o.createdAt >= todayStart.getTime());
    const active = rows.filter((o) => o.status !== "delivered");
    return {
      /** Live orders in the kitchen or on a bike right now. */
      active: active.length,
      /** Orders placed since midnight, delivered or not. */
      placedToday: placedToday.length,
      /** Money collected from delivered orders today. */
      earnedToday: placedToday
        .filter((o) => o.status === "delivered")
        .reduce((sum, o) => sum + o.total, 0),
      /** Orders waiting for the counter to confirm. */
      pending: rows.filter((o) => o.status === "placed").length,
    };
  },
});

/** Advance an order through the delivery lifecycle. Invoked only from the
 *  PIN-gated delivery desk. */
export const advanceStatus = mutation({
  args: {
    id: v.id("deliveryOrders"),
    status: deliveryStatusValidator,
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("That order no longer exists.");
    if (order.status === "delivered") {
      throw new Error("That order is already delivered.");
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      deliveredAt: args.status === "delivered" ? Date.now() : undefined,
    });
    return { id: args.id, status: args.status };
  },
});
