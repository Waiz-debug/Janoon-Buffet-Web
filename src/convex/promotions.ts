import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

type Promotion = Doc<"promotions">;

/** Public: active promotions visible on the customer site. */
export const active = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("promotions")
      .withIndex("by_visible", (q) => q.eq("visible", true))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt) as Promotion[];
  },
});

/** Admin: every promotion, newest first. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("promotions").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt) as Promotion[];
  },
});

/** Admin: create a new promotion. */
export const create = mutation({
  args: {
    title: v.string(),
    headline: v.string(),
    body: v.optional(v.string()),
    accent: v.union(
      v.literal("gold"),
      v.literal("emerald"),
      v.literal("ember"),
    ),
    visible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("promotions", {
      title: args.title.trim(),
      headline: args.headline.trim(),
      body: args.body?.trim() || undefined,
      accent: args.accent,
      visible: args.visible,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

/** Admin: update an existing promotion. */
export const update = mutation({
  args: {
    id: v.id("promotions"),
    title: v.optional(v.string()),
    headline: v.optional(v.string()),
    body: v.optional(v.string()),
    accent: v.optional(
      v.union(v.literal("gold"), v.literal("emerald"), v.literal("ember")),
    ),
    visible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Promotion not found.");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.headline !== undefined) patch.headline = args.headline.trim();
    if (args.body !== undefined) patch.body = args.body?.trim() || undefined;
    if (args.accent !== undefined) patch.accent = args.accent;
    if (args.visible !== undefined) patch.visible = args.visible;
    await ctx.db.patch(args.id, patch);
    return { id: args.id };
  },
});

/** Admin: toggle visibility on/off. */
export const toggleVisibility = mutation({
  args: { id: v.id("promotions") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Promotion not found.");
    await ctx.db.patch(args.id, {
      visible: !row.visible,
      updatedAt: Date.now(),
    });
    return { id: args.id, visible: !row.visible };
  },
});

/** Admin: delete a promotion permanently. */
export const remove = mutation({
  args: { id: v.id("promotions") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Promotion not found.");
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});
