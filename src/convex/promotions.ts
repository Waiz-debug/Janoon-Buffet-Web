import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";

type Promotion = Doc<"promotions">;

/** Public: active, non-expired promotions visible on the customer site. */
export const active = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("promotions")
      .withIndex("by_visible", (q) => q.eq("visible", true))
      .collect();
    // Filter out expired promotions server-side
    return rows
      .filter((p) => !p.expiresAt || p.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt) as Promotion[];
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

/** Step 1: mint a short-lived direct-upload URL for banner images. */
export const generateBannerUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Admin: create a new promotion (optionally with an image). */
export const create = mutation({
  args: {
    title: v.string(),
    headline: v.string(),
    body: v.optional(v.string()),
    visible: v.boolean(),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Resolve image URL from storage id if provided
    let resolvedImageUrl = args.imageUrl?.trim() || undefined;
    let resolvedStorageId = args.imageStorageId;
    if (args.imageStorageId) {
      const url = await ctx.storage.getUrl(args.imageStorageId);
      if (!url) throw new Error("Could not resolve the uploaded image URL.");
      resolvedImageUrl = url;
    }

    const now = Date.now();
    const id = await ctx.db.insert("promotions", {
      title: args.title.trim(),
      headline: args.headline.trim(),
      body: args.body?.trim() || undefined,
      visible: args.visible,
      imageUrl: resolvedImageUrl,
      imageStorageId: resolvedStorageId,
      expiresAt: args.expiresAt || undefined,
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
    visible: v.optional(v.boolean()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Promotion not found.");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.headline !== undefined) patch.headline = args.headline.trim();
    if (args.body !== undefined) patch.body = args.body?.trim() || undefined;
    if (args.visible !== undefined) patch.visible = args.visible;

    // Handle image upload
    if (args.imageStorageId) {
      const url = await ctx.storage.getUrl(args.imageStorageId);
      if (!url) throw new Error("Could not resolve the uploaded image URL.");
      // Clean up old image from storage
      if (existing.imageStorageId) {
        await ctx.storage.delete(existing.imageStorageId);
      }
      patch.imageUrl = url;
      patch.imageStorageId = args.imageStorageId;
    } else if (args.imageUrl !== undefined) {
      patch.imageUrl = args.imageUrl;
    }

    // Handle expiry — explicit null clears it, undefined leaves it unchanged
    if (args.expiresAt !== undefined) {
      patch.expiresAt = args.expiresAt || undefined;
    }

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

/** Admin: delete a promotion permanently and clean up its storage image. */
export const remove = mutation({
  args: { id: v.id("promotions") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Promotion not found.");
    // Clean up storage
    if (existing.imageStorageId) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});

/** Admin: remove a promotion's banner image. */
export const removeImage = mutation({
  args: { id: v.id("promotions") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Promotion not found.");
    if (existing.imageStorageId) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.patch(args.id, {
      imageUrl: undefined,
      imageStorageId: undefined,
      updatedAt: Date.now(),
    });
    return { id: args.id };
  },
});
