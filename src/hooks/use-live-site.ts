import { api } from "@/convex/_generated/api";
import {
  DISHES as STATIC_DISHES,
  MENU_CATEGORIES as STATIC_CATEGORIES,
  deliveryUnitPrice,
  type CategoryId,
  type Dish,
  type MenuCategory,
} from "@/lib/menu";
import { useQuery } from "convex/react";
import { useMemo } from "react";

export type LiveCategory = MenuCategory & {
  sortOrder?: number;
  active?: boolean;
};

/** A menu dish as served to the UI — the live row carries the admin-managed
 *  per-plate price that overrides the static delivery table when present. */
export type LiveDish = Dish & {
  pricePerPlate?: number;
  imageStorageId?: string;
  active?: boolean;
  featured?: boolean;
  sortOrder?: number;
};

export type LiveMedia = Record<string, { url: string; caption?: string }>;

type MenuDoc = {
  id: string;
  name: string;
  urdu?: string;
  blurb?: string;
  icon: "flame" | "pot" | "bites" | "dessert";
};

type DishDoc = {
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
  active?: boolean;
  featured?: boolean;
  sortOrder?: number;
};

function toCategory(doc: MenuDoc): LiveCategory {
  const staticCategory = STATIC_CATEGORIES.find((c) => c.id === doc.id);
  return {
    id: doc.id as CategoryId,
    name: doc.name,
    urdu: doc.urdu || staticCategory?.urdu || "",
    blurb: doc.blurb || staticCategory?.blurb || "",
    icon: doc.icon,
    sortOrder: (doc as { sortOrder?: number }).sortOrder,
    active: (doc as { active?: boolean }).active,
  };
}

function toDish(doc: DishDoc): LiveDish {
  const staticDish = STATIC_DISHES.find((d) => d.slug === doc.slug);
  return {
    slug: doc.slug,
    name: doc.name,
    urdu: doc.urdu || staticDish?.urdu || "",
    categoryId: doc.categoryId as CategoryId,
    summary: doc.summary || staticDish?.summary || "",
    description: doc.description || staticDish?.description || "",
    notes: doc.notes?.length ? doc.notes : (staticDish?.notes ?? []),
    pairings: doc.pairings?.length ? doc.pairings : (staticDish?.pairings ?? []),
    // Uploaded photo first; then the legacy image URL; then the static photo
    // for known dishes; finally empty (SmartImage shows the themed tile).
    image: doc.image || staticDish?.image || "",
    imageStorageId: doc.imageStorageId,
    pricePerPlate: doc.pricePerPlate,
    active: doc.active ?? true,
    featured: doc.featured ?? false,
    sortOrder: doc.sortOrder ?? 0,
  };
}

/**
 * Live site content. Subscribes to the admin-managed menu and media slots;
 * every admin save appears here without a reload. While the first query is
 * in flight (or before the menu has ever been seeded) the static catalog is
 * returned so the public site always paints instantly.
 */
export function useLiveSite() {
  const live = useQuery(api.menu.publicMenu);
  const mediaRows = useQuery(api.menu.publicSiteMedia);

  const media = useMemo<LiveMedia>(() => {
    const map: LiveMedia = {};
    for (const row of mediaRows ?? []) {
      map[row.slot] = { url: row.url, caption: row.caption };
    }
    return map;
  }, [mediaRows]);

  const data = useMemo(() => {
    const staticFallback = {
      categories: STATIC_CATEGORIES as LiveCategory[],
      dishes: STATIC_DISHES as LiveDish[],
      isLive: false,
    };
    if (!live) return staticFallback;
    const categories = live.categories.map(toCategory);
    const dishes = live.dishes.map(toDish);
    // Nothing seeded yet — keep showing the built-in catalog rather than an
    // empty menu on a fresh deployment.
    const unseeded = categories.length === 0 && dishes.length === 0;
    if (unseeded) return staticFallback;
    return { categories, dishes, isLive: true };
  }, [live]);

  const bySlug = useMemo(() => {
    const map = new Map<string, LiveDish>();
    for (const dish of data.dishes) map.set(dish.slug, dish);
    return map;
  }, [data]);

  const getDish = (slug: string): LiveDish | undefined => bySlug.get(slug);

  const dishesByCategory = (categoryId: string): LiveDish[] =>
    data.dishes.filter((dish) => dish.categoryId === categoryId);

  /** Price shown for a plate: the admin-managed price when set, otherwise
   *  the static delivery table. Mirrors the server-side rule exactly. */
  const unitPrice = (dish: { slug: string; pricePerPlate?: number }): number =>
    dish.pricePerPlate && dish.pricePerPlate > 0
      ? dish.pricePerPlate
      : deliveryUnitPrice(dish.slug);

  const heroImage = media["hero"]?.url;
  const gallery = [1, 2, 3, 4, 5, 6].map((index) => media[`gallery-${index}`]);

  return {
    ...data,
    media,
    heroImage,
    gallery,
    bySlug,
    getDish,
    dishesByCategory,
    unitPrice,
  };
}
