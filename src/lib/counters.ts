/**
 * Counters — the restaurant's live cooking stations (Barbecue & Grill, Charcoal
 * Counter, Traditional Handi…) and the items filed under them.
 *
 * A counter is a row in `menu_categories`; an item belongs to exactly one of
 * them through `menu_dishes.category_id`. The admin panel edits both, so both
 * sides of the app group them with the code below rather than each filtering
 * the arrays its own way.
 *
 * The one rule that matters: **a counter section is built from the same list
 * the counter count is read from.** Anything filed under a counter that is not
 * in the list — a deleted counter, a hidden one, the `uncategorized` home — is
 * either folded into a visible place or reported, never silently dropped while
 * still being counted in a heading. That mismatch is what makes a menu look
 * wrong to an owner who has just deleted something.
 */
import type { CategoryIcon } from "@/lib/db";

/** A counter, as either the admin rows or the public rows present it. */
export type CounterLike = {
  id: string;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: CategoryIcon;
  sortOrder?: number;
  active?: boolean;
};

/** The least an item has to expose to be filed under a counter. */
export type CounteredItem = {
  slug: string;
  name: string;
  categoryId: string;
  active?: boolean;
  featured?: boolean;
  sortOrder?: number;
};

/** One counter with the items that belong under it, in display order. */
export type CounterGroup<Item> = {
  id: string;
  name: string;
  urdu: string;
  blurb: string;
  icon: CategoryIcon;
  sortOrder: number;
  active: boolean;
  /** The items to render, already filtered and sorted. */
  items: Item[];
  /** Stored here but switched off — counted, never rendered. */
  hidden: number;
};

export type GroupOptions = {
  /** Keep counters switched off in the admin panel. Off on the public site. */
  includeHiddenCounters?: boolean;
  /** Keep items switched off (the admin panel needs them to re-publish). */
  includeHiddenItems?: boolean;
  /** Leave the Signature dishes out, so they are not shown twice. */
  excludeFeatured?: boolean;
  /**
   * Give items whose counter no longer exists their own trailing group, so a
   * stranded dish can still be seen and re-filed instead of vanishing.
   */
  includeOrphans?: boolean;
};

const order = (a: { sortOrder?: number }, b: { sortOrder?: number }) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

/** The name a stranded item's group is shown under. */
export function counterLabel(id: string): string {
  return id === "uncategorized" ? "Other" : id;
}

/**
 * File every item under its counter.
 *
 * Counters come back in menu order, each with its items already sorted and
 * filtered by the options. Items are matched by `categoryId`, so the caller
 * never has to keep a second filtered copy of `dishes` in step with this one.
 */
export function groupByCounter<Item extends CounteredItem>(
  counters: readonly CounterLike[],
  items: readonly Item[],
  options: GroupOptions = {},
): CounterGroup<Item>[] {
  const {
    includeHiddenCounters = false,
    includeHiddenItems = false,
    excludeFeatured = false,
    includeOrphans = false,
  } = options;

  const keep = (item: Item) =>
    (includeHiddenItems || item.active !== false) &&
    !(excludeFeatured && item.featured === true);

  const known = new Set(counters.map((counter) => counter.id));

  const visible = [...counters]
    .filter((counter) => includeHiddenCounters || counter.active !== false)
    .sort((a, b) => order(a, b) || a.name.localeCompare(b.name));

  const groups: CounterGroup<Item>[] = visible.map((counter) => {
    const filed = items.filter((item) => item.categoryId === counter.id);
    return {
      id: counter.id,
      name: counter.name,
      urdu: counter.urdu ?? "",
      blurb: counter.blurb ?? "",
      icon: counter.icon,
      sortOrder: counter.sortOrder ?? 0,
      active: counter.active !== false,
      items: filed.filter(keep).sort((a, b) => order(a, b) || a.name.localeCompare(b.name)),
      hidden: filed.filter((item) => item.active === false).length,
    };
  });

  if (!includeOrphans) return groups;

  // Anything pointing at a counter that is not in `counters` at all. Filed
  // last, and never published, because there is no section on the guest site
  // that could show it — the owner has to move it to a real counter.
  const stranded = [...new Set(items.map((item) => item.categoryId))].filter(
    (id) => id && !known.has(id),
  );

  stranded.forEach((id, index) => {
    const filed = items.filter((item) => item.categoryId === id);
    groups.push({
      id,
      name: counterLabel(id),
      urdu: "",
      blurb: "This counter no longer exists — move these items to a counter to publish them again.",
      icon: "flame",
      sortOrder: 900 + index,
      active: false,
      items: filed.filter(keep).sort((a, b) => order(a, b) || a.name.localeCompare(b.name)),
      hidden: filed.filter((item) => item.active === false).length,
    });
  });

  return groups;
}

/** How many items the groups above actually render. */
export function groupedItemCount<Item>(groups: readonly CounterGroup<Item>[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

/** The counters as `{ id, name }`, for the pickers that map an item across. */
export function counterChoices(counters: readonly CounterLike[]) {
  return [...counters]
    .sort((a, b) => order(a, b) || a.name.localeCompare(b.name))
    .map((counter) => ({ id: counter.id, name: counter.name }));
}
