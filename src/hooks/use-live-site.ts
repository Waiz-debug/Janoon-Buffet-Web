import {
  usePublicAddOnCategories,
  usePublicAddOns,
  usePublicMenu,
  useSiteContent,
  useSiteMedia,
} from "@/hooks/use-live-db";
import {
  groupByCounter,
  groupedItemCount,
  type CounterGroup,
} from "@/lib/counters";
import {
  ADDONS as STATIC_ADDONS,
  ADDON_GROUPS,
  DISHES as STATIC_DISHES,
  MENU_CATEGORIES as STATIC_CATEGORIES,
  SIGNATURE_LIMIT,
  SIGNATURE_SLUGS,
  deliveryUnitPrice,
  type AddOn,
  type CategoryId,
  type Dish,
  type MenuCategory,
} from "@/lib/menu";
import type {
  AddOnCategoryRow,
  MenuCategoryRow,
  MenuDishRow,
} from "@/lib/db";
import { GALLERY, HERO_MEDIA, SITE_CONTENT_DEFAULTS } from "@/lib/restaurant";
import { mediaUrl } from "@/lib/supabase";
import { useMemo } from "react";

export type LiveCategory = MenuCategory & {
  sortOrder?: number;
  active?: boolean;
};

/** A menu dish as served to the UI — the live row carries the admin-managed
 *  per-plate price that overrides the built-in price when present, and may carry
 *  no price at all: a dish the owner added and has not priced yet falls back to
 *  the standard plate price. */
export type LiveDish = Omit<Dish, "pricePerPlate"> & {
  pricePerPlate?: number | null;
  imageStorageId?: string;
  active?: boolean;
  featured?: boolean;
  sortOrder?: number;
};

export type LiveMedia = Record<string, { url: string; caption?: string }>;

/** A traditional add-on as served to the UI — the live row may carry an
 *  admin-uploaded photo that the built-in list does not have, and its category
 *  is whatever the admin has created rather than a fixed set. */
export type LiveAddOn = Omit<AddOn, "group"> & {
  group: string;
  image?: string;
  imageStorageId?: string;
  demo?: boolean;
  active?: boolean;
};

/** One tile of the gallery strip, in render order. */
export type LiveGalleryItem = {
  slot: string;
  url: string;
  caption: string;
};

function toCategory(row: MenuCategoryRow): LiveCategory {
  const staticCategory = STATIC_CATEGORIES.find((c) => c.id === row.id);
  return {
    id: row.id as CategoryId,
    name: row.name,
    urdu: row.urdu || staticCategory?.urdu || "",
    blurb: row.blurb || staticCategory?.blurb || "",
    icon: row.icon,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

function toDish(row: MenuDishRow): LiveDish {
  const staticDish = STATIC_DISHES.find((d) => d.slug === row.slug);
  const weights = staticDish?.weights;
  return {
    slug: row.slug,
    name: row.name,
    urdu: row.urdu || staticDish?.urdu || "",
    categoryId: row.categoryId as CategoryId,
    summary: row.summary || staticDish?.summary || "",
    description: row.description || staticDish?.description || "",
    notes: row.notes?.length ? row.notes : (staticDish?.notes ?? []),
    pairings: row.pairings?.length ? row.pairings : (staticDish?.pairings ?? []),
    // The row owns the photo outright — seeded placeholders are copied into
    // the row at seed time, so clearing it in the admin panel actually clears
    // it on the site instead of resurrecting the demo image. Empty falls
    // through to SmartImage's themed tile.
    image: row.image || "",
    imageStorageId: row.imageStorageId,
    pricePerPlate: row.pricePerPlate,
    active: row.active,
    featured: row.featured,
    sortOrder: row.sortOrder,
    weights,
  };
}

/**
 * Live site content. Subscribes to the admin-managed menu and media slots in
 * Supabase; every admin save appears here without a reload.
 *
 * The built-in catalogue is a first-paint placeholder and nothing more. The
 * moment both published tables have been read, Supabase is the whole truth for
 * the guest site — including when it is empty. Returning the hardcoded menu
 * whenever the published result set happened to come back empty was the bug:
 * the admin panel edits `menu_categories` and `menu_dishes`, so a project whose
 * counters are all switched off — or whose only category row is the
 * `uncategorized` placeholder — fell back to the built-in list, and the guest
 * page showed a menu the owner could not edit while their panel showed the real
 * thing.
 */
export function useLiveSite() {
  const { categories: liveCategories, dishes: liveDishes } = usePublicMenu();
  const mediaRows = useSiteMedia();
  const contentRows = useSiteContent();
  const addonRows = usePublicAddOns();
  const addonCategoryRows = usePublicAddOnCategories();

  const media = useMemo<LiveMedia>(() => {
    const map: LiveMedia = {};
    for (const row of mediaRows ?? []) {
      const url = row.url || mediaUrl(row.imageStorageId);
      if (!url) continue;
      map[row.slot] = { url, caption: row.caption };
    }
    return map;
  }, [mediaRows]);

  const data = useMemo(() => {
    const firstPaint = {
      categories: STATIC_CATEGORIES as LiveCategory[],
      dishes: STATIC_DISHES as LiveDish[],
      isLive: false,
    };
    // Only until the first read resolves — see the note above this hook.
    if (!liveCategories || !liveDishes) return firstPaint;
    return {
      categories: liveCategories.map(toCategory),
      dishes: liveDishes.map(toDish),
      isLive: true,
    };
  }, [liveCategories, liveDishes]);

  const bySlug = useMemo(() => {
    const map = new Map<string, LiveDish>();
    for (const dish of data.dishes) map.set(dish.slug, dish);
    return map;
  }, [data]);

  const getDish = (slug: string): LiveDish | undefined => bySlug.get(slug);

  const dishesByCategory = (categoryId: string): LiveDish[] =>
    data.dishes.filter((dish) => dish.categoryId === categoryId);

  /**
   * The counter a dish is filed under, named and iconed exactly as the owner
   * set it up. The dish page reads its station badge from here, so a counter
   * created in the admin panel appears there too instead of falling back to the
   * built-in four.
   */
  const getCounter = (categoryId: string): LiveCategory | undefined =>
    data.categories.find((category) => category.id === categoryId);

  /**
   * The counters, each with the items filed under it, in menu order.
   *
   * Built from the same two lists the page renders, so a section can never be
   * drawn from one array while a heading is counted from another — an item
   * whose counter was deleted is simply not in any section, rather than being
   * counted in a total that no longer has a place to show it.
   */
  const counters = useMemo<CounterGroup<LiveDish>[]>(
    () => groupByCounter(data.categories, data.dishes),
    [data],
  );

  /** Menu items the counters above actually show — the honest total. */
  const menuItemCount = useMemo(() => groupedItemCount(counters), [counters]);

  /**
   * True once both published tables have been read, so "nothing is published"
   * (an empty menu, reported honestly) can be told apart from "not read yet"
   * (the built-in first paint).
   */
  const menuReady = data.isLive;

  /** True when the published counters hold at least one dish to show. */
  const hasPublishedMenu = menuItemCount > 0;

  /** Price shown for a plate: the admin-managed price when set, otherwise
   *  the static delivery table. Mirrors the rule used at order time. */
  const unitPrice = (dish: { slug: string; pricePerPlate?: number | null }): number =>
    dish.pricePerPlate && dish.pricePerPlate > 0
      ? dish.pricePerPlate
      : deliveryUnitPrice(dish.slug);

  /** The admin-uploaded photo for a slot, or the built-in default. */
  const mediaOr = (slot: string, fallback: string): string =>
    media[slot]?.url ?? fallback;

  /**
   * The gallery strip — a fixed six tiles, one per `gallery-N` slot. Each tile
   * shows the admin's published photo for its slot or falls back to the
   * matching built-in photo, so the public gallery and the admin's six upload
   * slots are always the same list.
   */
  const gallery = useMemo<LiveGalleryItem[]>(() => {
    return GALLERY.map((post, index) => {
      const slot = `gallery-${index + 1}`;
      const live = media[slot];
      return {
        slot,
        url: live?.url ?? post.image,
        caption: live?.caption ?? post.caption,
      };
    });
  }, [media]);

  /** Owner-editable copy, with the built-in wording as the fallback. */
  const content = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { ...SITE_CONTENT_DEFAULTS };
    for (const row of contentRows ?? []) {
      if (row.value.trim()) map[row.key] = row.value;
    }
    return map;
  }, [contentRows]);

  /**
   * The Signature strip: exactly the dishes marked `featured`, capped at four.
   * Those same dishes are withheld from the category counters below, so a
   * signature dish appears once on the page. While the first read is in flight
   * the built-in four stand in; after that the strip is exactly what is featured
   * in Supabase.
   */
  const signatures = useMemo<LiveDish[]>(() => {
    if (data.isLive) {
      return data.dishes
        .filter((dish) => dish.featured)
        .slice(0, SIGNATURE_LIMIT);
    }
    return SIGNATURE_SLUGS.map((slug) => bySlug.get(slug)).filter(
      (dish): dish is LiveDish => Boolean(dish),
    );
  }, [data, bySlug]);

  /**
   * The add-on headings, straight from the admin panel so a category the owner
   * creates appears on the public board immediately. The built-in four stand in
   * until the table has been seeded.
   */
  const addonGroups = useMemo<AddOnCategoryRow[]>(() => {
    const list: AddOnCategoryRow[] =
      addonCategoryRows && addonCategoryRows.length > 0
        ? addonCategoryRows.map((category) => ({ ...category }))
        : ADDON_GROUPS.map((group, index) => ({
            id: group.id,
            name: group.label,
            urdu: group.urdu,
            icon: group.icon,
            sortOrder: index + 1,
            active: true,
          }));

    // A heading removed while add-ons still point at it would otherwise hide
    // those items from the board entirely — they get a trailing heading
    // instead of disappearing.
    const known = new Set(list.map((category) => category.id));
    const orphans = [...new Set((addonRows ?? []).map((row) => row.category))]
      .filter((id) => id && !known.has(id))
      .map((id, index) => ({
        id,
        name: id,
        urdu: undefined,
        icon: "\uD83C\uDF7D",
        sortOrder: 900 + index,
        active: true,
      }));

    return [...list, ...orphans].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [addonCategoryRows, addonRows]);

  /**
   * The Traditional Add-ons board, ordered by category then by the admin's sort
   * order. Before the add-on table has been seeded the built-in list — which
   * already includes the cold drinks — stands in.
   */
  const addons = useMemo<LiveAddOn[]>(() => {
    if (!addonRows || addonRows.length === 0) return STATIC_ADDONS;
    const rank = new Map<string, number>(
      addonGroups.map((group, index) => [group.id, index]),
    );

    return [...addonRows]
      .sort((a, b) => {
        const byGroup =
          (rank.get(a.category) ?? 0) - (rank.get(b.category) ?? 0);
        return byGroup !== 0 ? byGroup : a.sortOrder - b.sortOrder;
      })
      .map((row) => ({
        id: row.id,
        name: row.name,
        urdu: row.urdu ?? "",
        price: row.price,
        group: row.category,
        chilled: row.chilled,
        image: row.image,
        imageStorageId: row.imageStorageId,
        active: row.active,
        demo: row.demo,
      }));
  }, [addonRows, addonGroups]);

  return {
    ...data,
    counters,
    menuItemCount,
    menuReady,
    hasPublishedMenu,
    media,
    heroImage: media[HERO_MEDIA.slot]?.url,
    mediaOr,
    addons,
    addonGroups,
    content,
    gallery,
    signatures,
    bySlug,
    getDish,
    getCounter,
    dishesByCategory,
    unitPrice,
  };
}
