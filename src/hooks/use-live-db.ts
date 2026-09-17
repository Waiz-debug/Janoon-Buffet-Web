import {
  fetchAddOnCategories,
  fetchAddOns,
  fetchCategories,
  fetchDeliveryOrders,
  fetchDishes,
  fetchPreorders,
  fetchPromotions,
  fetchPublicAddOnCategories,
  fetchPublicAddOns,
  fetchPublicCategories,
  fetchPublicDishes,
  fetchReservation,
  fetchReservations,
  fetchSiteContent,
  fetchSiteMedia,
  fetchVisibleDeliveryOrders,
  fetchPublicPreOrderItems,
  fetchAllPreOrderItems,
  type AddOnCategoryRow,
  type AddOnRow,
  type DeliveryOrder,
  type MenuCategoryRow,
  type MenuDishRow,
  type PreOrderItemRow,
  type Preorder,
  type Promotion,
  type Reservation,
  type SiteContentRow,
  type SiteMediaRow,
} from "@/lib/db";
import { getLiveRows, liveCacheKey, subscribeLive } from "@/lib/live-sync";
import { TABLES } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Subscribe to a Postgres table and keep a local copy in sync.
 *
 * All of the work happens in `src/lib/live-sync.ts`: one Realtime channel for
 * the whole app, one fetch per table per variant no matter how many components
 * ask for it, and automatic recovery when a socket reconnects or the tab
 * regains focus. Values stay `undefined` until the first read resolves, so
 * callers can show a loading state instead of an empty page on first paint.
 *
 * `variant` separates readers of the same table that want different slices —
 * the public menu wants published rows, the admin portal wants every row — so
 * they never collide in the shared cache while still riding one subscription.
 */
export function useLiveTable<T>(
  table: string,
  load: () => Promise<T[]>,
  variant = "default",
): T[] | undefined {
  // Held in a ref so a reader written inline at the call site — which is a new
  // function identity every render — cannot tear down the subscription.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const cacheKey = liveCacheKey(table, variant);
  const stableLoad = useCallback(() => loadRef.current(), []);

  const subscribe = useCallback(
    (onChange: () => void) => subscribeLive<T>(cacheKey, table, stableLoad, onChange),
    [cacheKey, table, stableLoad],
  );
  const getSnapshot = useCallback(
    () => getLiveRows<T>(cacheKey),
    [cacheKey],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

/* -------------------------------------------------------------- menu ----- */

export type AdminMenu = {
  categories: MenuCategoryRow[];
  dishes: MenuDishRow[];
  /** True once both tables have been read at least once. */
  loaded: boolean;
  /** True when Supabase holds no catalogue yet (needs seeding). */
  isEmpty: boolean;
};

/** The editable catalogue for the admin portal — hidden rows included. */
export function useAdminMenu(): AdminMenu {
  const categories = useLiveTable<MenuCategoryRow>(
    TABLES.categories,
    fetchCategories,
    "admin",
  );
  const dishes = useLiveTable<MenuDishRow>(TABLES.dishes, fetchDishes, "admin");

  const loaded = categories !== undefined && dishes !== undefined;

  return {
    categories: categories ?? [],
    dishes: dishes ?? [],
    loaded,
    isEmpty: loaded && categories.length === 0 && dishes.length === 0,
  };
}

/** The published catalogue for the public site. */
export function usePublicMenu() {
  const categories = useLiveTable<MenuCategoryRow>(
    TABLES.categories,
    fetchPublicCategories,
    "public",
  );
  const dishes = useLiveTable<MenuDishRow>(
    TABLES.dishes,
    fetchPublicDishes,
    "public",
  );
  return { categories, dishes };
}

export function useSiteMedia(): SiteMediaRow[] | undefined {
  return useLiveTable<SiteMediaRow>(TABLES.siteMedia, fetchSiteMedia, "public");
}

/** The published add-on board for the public site. */
export function usePublicAddOns(): AddOnRow[] | undefined {
  return useLiveTable<AddOnRow>(TABLES.addons, fetchPublicAddOns, "public");
}

/** Every add-on for the admin panel — hidden rows included. */
export function useAdminAddOns(): AddOnRow[] | undefined {
  return useLiveTable<AddOnRow>(TABLES.addons, fetchAddOns, "admin");
}

/* --------------------------------------------------- add-on categories --- */

/** The add-on headings shown to guests, in display order. */
export function usePublicAddOnCategories(): AddOnCategoryRow[] | undefined {
  return useLiveTable<AddOnCategoryRow>(
    TABLES.addonCategories,
    fetchPublicAddOnCategories,
    "public",
  );
}

/** Every add-on heading for the admin panel — hidden ones included. */
export function useAdminAddOnCategories(): AddOnCategoryRow[] | undefined {
  return useLiveTable<AddOnCategoryRow>(
    TABLES.addonCategories,
    fetchAddOnCategories,
    "admin",
  );
}

/** Editable copy set from the admin panel (seating counter, notes). */
export function useSiteContent(): SiteContentRow[] | undefined {
  return useLiveTable<SiteContentRow>(TABLES.siteContent, fetchSiteContent, "public");
}

/* ------------------------------------------------------------ orders ----- */

/** Staff desk: every order, newest first, live. */
export function useDeliveryOrders(): DeliveryOrder[] | undefined {
  return useLiveTable<DeliveryOrder>(
    TABLES.deliveryOrders,
    fetchDeliveryOrders,
    "all",
  );
}

/** Guest tracker: delivered orders hidden 30 minutes after delivery. */
export function useVisibleDeliveryOrders(): DeliveryOrder[] | undefined {
  return useLiveTable<DeliveryOrder>(
    TABLES.deliveryOrders,
    fetchVisibleDeliveryOrders,
    "visible",
  );
}

/* ------------------------------------------------------ reservations ----- */

/** Live bookings desk feed for the admin portal. */
export function useReservations(): Reservation[] | undefined {
  return useLiveTable<Reservation>(TABLES.reservations, fetchReservations, "all");
}

/**
 * A single booking, re-read whenever the reservations table changes so a
 * status change made at the desk shows up on the guest's page immediately.
 *
 * `undefined` means "still looking", `null` means "no such booking" — the two
 * states the guest's confirmation panel needs to tell apart.
 */
export function useReservationLookup(
  reference: string | null,
  phone: string,
): Reservation | null | undefined {
  const wanted = reference
    ? `${reference.trim().toUpperCase()}|${phone}`
    : null;

  // Pinned to the reference so a changed lookup reads as "loading" rather than
  // briefly showing the previous booking's details.
  const load = useCallback(async () => {
    if (!wanted) return [] as Reservation[];
    const separator = wanted.indexOf("|");
    const found = await fetchReservation(
      wanted.slice(0, separator),
      wanted.slice(separator + 1),
    );
    return found ? [found] : [];
  }, [wanted]);

  const cacheKey = liveCacheKey(TABLES.reservations, `lookup:${wanted ?? "none"}`);
  const subscribe = useCallback(
    (onChange: () => void) =>
      wanted
        ? subscribeLive<Reservation>(cacheKey, TABLES.reservations, load, onChange)
        : () => {},
    [cacheKey, load, wanted],
  );
  const getSnapshot = useCallback(
    () => getLiveRows<Reservation>(cacheKey),
    [cacheKey],
  );
  const rows = useSyncExternalStore(subscribe, getSnapshot, () => undefined);

  // No reference means there is nothing to look up — never a loading state.
  if (!wanted) return null;
  if (rows === undefined) return undefined;
  return rows[0] ?? null;
}

/* ----------------------------------------------- pre_order_items ------- */

/** Public pre-order form: active items only. */
export function usePublicPreOrderItems(): PreOrderItemRow[] | undefined {
  return useLiveTable<PreOrderItemRow>(
    TABLES.preOrderItems,
    fetchPublicPreOrderItems,
    "public",
  );
}

/** Admin panel: all pre-order items including hidden ones. */
export function useAdminPreOrderItems(): PreOrderItemRow[] | undefined {
  return useLiveTable<PreOrderItemRow>(
    TABLES.preOrderItems,
    fetchAllPreOrderItems,
    "admin",
  );
}

/* --------------------------------------------------------- preorders ----- */

/** Staff & admin desk: every pre-order, newest first, live. */
export function usePreorders(): Preorder[] | undefined {
  return useLiveTable<Preorder>(TABLES.preorders, fetchPreorders, "all");
}

/* -------------------------------------------------------- promotions ----- */

/**
 * Promotions. `activeOnly` drops anything switched off or past its expiry —
 * the admin list asks for every row, the public banner only for live offers.
 */
export function usePromotions(activeOnly: boolean): Promotion[] | undefined {
  return useLiveTable<Promotion>(
    TABLES.promotions,
    () => fetchPromotions({ activeOnly }),
    activeOnly ? "active" : "all",
  );
}
