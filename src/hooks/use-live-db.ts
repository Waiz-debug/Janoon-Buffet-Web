import {
  fetchAddOnCategories,
  fetchAddOns,
  fetchCategories,
  fetchCounterMedia,
  fetchDeliveryOrder,
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
  fetchPublicPreOrderItems,
  fetchAllPreOrderItems,
  type AddOnCategoryRow,
  type AddOnRow,
  type CounterMediaRow,
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
import {
  getLiveRows,
  liveCacheKey,
  refreshLive,
  subscribeLive,
} from "@/lib/live-sync";
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

/**
 * The hero image attached to each counter. Subscribes to the same realtime
 * channel as the rest of the admin-managed catalogue, so a replacement uploaded
 * from the admin panel shows up on the guest site without a reload.
 */
export function useCounterMedia(): CounterMediaRow[] | undefined {
  return useLiveTable<CounterMediaRow>(
    TABLES.counterMedia,
    fetchCounterMedia,
    "public",
  );
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

/**
 * How often a guest's own record is re-read while its page is open.
 *
 * Realtime cannot cover this case. `reservations`, `preorders` and
 * `delivery_orders` deliberately have no SELECT policy for guests, so Supabase
 * sends a guest no change events — not even for their own row. That is the
 * trade that keeps other customers' names, phone numbers and addresses off
 * their screen. Polling is the safe half of it: the browser re-runs the same
 * one-row lookup that demands the reference *and* the phone, so the guest sees
 * the desk's confirmation within seconds while still never receiving anyone
 * else's record.
 */
const GUEST_LOOKUP_POLL_MS = 15_000;

/**
 * One row of a table, re-read whenever that table changes.
 *
 * `undefined` means "still looking", `null` means "no such row" — the two
 * states a confirmation panel has to tell apart. Shared by the reservation and
 * delivery lookups so both ride the same channel and cache.
 *
 * `pollMs` adds the guest fallback above: a timed re-read that is skipped
 * entirely while the tab is in the background, so a forgotten tab is not
 * quietly querying the database all day.
 */
function useRowLookup<T>(
  table: string,
  /** The lookup key, or null when the caller has not supplied one yet. */
  wanted: string | null,
  load: () => Promise<T[]>,
  pollMs?: number,
): T | null | undefined {
  const cacheKey = liveCacheKey(table, `lookup:${wanted ?? "none"}`);
  const subscribe = useCallback(
    (onChange: () => void) =>
      wanted ? subscribeLive<T>(cacheKey, table, load, onChange) : () => {},
    [cacheKey, load, table, wanted],
  );
  const getSnapshot = useCallback(
    () => getLiveRows<T>(cacheKey),
    [cacheKey],
  );
  const rows = useSyncExternalStore(subscribe, getSnapshot, () => undefined);

  useEffect(() => {
    if (!wanted || !pollMs) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshLive(cacheKey);
    }, pollMs);
    return () => window.clearInterval(id);
  }, [cacheKey, pollMs, wanted]);

  if (!wanted) return null;
  if (rows === undefined) return undefined;
  return rows[0] ?? null;
}

/**
 * A single delivery order, verified against the phone it was placed with.
 *
 * Deliberately not a feed: the guest's tracker must only ever see their own
 * order, and the check happens in the query rather than in the browser.
 */
export function useDeliveryOrderLookup(
  reference: string | null,
  phone: string,
): DeliveryOrder | null | undefined {
  const wanted = reference
    ? `${reference.trim().toUpperCase()}|${phone}`
    : null;

  const load = useCallback(async () => {
    if (!wanted) return [] as DeliveryOrder[];
    const separator = wanted.indexOf("|");
    const found = await fetchDeliveryOrder(
      wanted.slice(0, separator),
      wanted.slice(separator + 1),
    );
    return found ? [found] : [];
  }, [wanted]);

  return useRowLookup<DeliveryOrder>(
    TABLES.deliveryOrders,
    wanted,
    load,
    GUEST_LOOKUP_POLL_MS,
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

  return useRowLookup<Reservation>(
    TABLES.reservations,
    wanted,
    load,
    GUEST_LOOKUP_POLL_MS,
  );
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
 *
 * Seeded demo offers are excluded from every guest feed by default; the admin
 * panel passes `includeDemo` so the team can see and delete them.
 */
export function usePromotions(
  activeOnly: boolean,
  includeDemo = false,
): Promotion[] | undefined {
  return useLiveTable<Promotion>(
    TABLES.promotions,
    () => fetchPromotions({ activeOnly, includeDemo }),
    activeOnly ? "active" : "all",
  );
}
