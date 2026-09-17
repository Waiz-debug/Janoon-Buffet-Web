import {
  fetchAddOns,
  fetchCategories,
  fetchDeliveryOrders,
  fetchDishes,
  fetchPreorders,
  fetchPromotions,
  fetchPublicAddOns,
  fetchPublicCategories,
  fetchPublicDishes,
  fetchReservation,
  fetchReservations,
  fetchSiteMedia,
  fetchSiteContent,
  fetchVisibleDeliveryOrders,
  type DeliveryOrder,
  type MenuCategoryRow,
  type MenuDishRow,
  type Preorder,
  type Promotion,
  type Reservation,
  type SiteMediaRow,
  type SiteContentRow,
  type AddOnRow,
  type PreOrderItemRow,
  fetchPublicPreOrderItems,
  fetchAllPreOrderItems,
} from "@/lib/db";
import { TABLES, supabase } from "@/lib/supabase";
import { useEffect, useRef, useState } from "react";

/** Stable empty arrays — a fresh `[]` every render would thrash consumers. */
const NO_CATEGORIES: MenuCategoryRow[] = [];
const NO_DISHES: MenuDishRow[] = [];

/**
 * Subscribe to a Postgres table and keep a local copy in sync.
 *
 * Values are `undefined` until the first read resolves, which lets callers
 * show a loading state instead of an empty page on first paint.
 */
export function useLiveTable<T>(
  table: string,
  load: () => Promise<T[]>,
  deps: unknown[] = [],
): T[] | undefined {
  const [rows, setRows] = useState<T[] | undefined>(undefined);
  const loadRef = useRef(load);

  // Keep the latest reader available to the realtime callback without making
  // the subscription depend on a function identity that changes every render.
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void loadRef.current().then((next) => {
        if (active) setRows(next);
      });
    };

    refresh();
    // Convex-style reactivity: every insert/update/delete on the table pushes
    // a fresh snapshot, so both portals and the public site stay live.
    const channel = supabase
      .channel(`tribe-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => refresh(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ...deps]);

  return rows;
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
  );
  const dishes = useLiveTable<MenuDishRow>(TABLES.dishes, fetchDishes);

  const loaded = categories !== undefined && dishes !== undefined;

  return {
    categories: categories ?? NO_CATEGORIES,
    dishes: dishes ?? NO_DISHES,
    loaded,
    isEmpty: loaded && categories.length === 0 && dishes.length === 0,
  };
}

/** The published catalogue for the public site. */
export function usePublicMenu() {
  const categories = useLiveTable<MenuCategoryRow>(
    TABLES.categories,
    fetchPublicCategories,
  );
  const dishes = useLiveTable<MenuDishRow>(TABLES.dishes, fetchPublicDishes);
  return { categories, dishes };
}

export function useSiteMedia(): SiteMediaRow[] | undefined {
  return useLiveTable<SiteMediaRow>(TABLES.siteMedia, fetchSiteMedia);
}

/** The published add-on board for the public site. */
export function usePublicAddOns(): AddOnRow[] | undefined {
  return useLiveTable<AddOnRow>(TABLES.addons, fetchPublicAddOns);
}

/** Every add-on for the admin panel — hidden rows included. */
export function useAdminAddOns(): AddOnRow[] | undefined {
  return useLiveTable<AddOnRow>(TABLES.addons, fetchAddOns);
}

/** Editable copy set from the admin panel (seating counter, notes). */
export function useSiteContent(): SiteContentRow[] | undefined {
  return useLiveTable<SiteContentRow>(TABLES.siteContent, fetchSiteContent);
}

/* ------------------------------------------------------------ orders ----- */

/** Staff desk: every order, newest first, live. */
export function useDeliveryOrders(): DeliveryOrder[] | undefined {
  return useLiveTable<DeliveryOrder>(TABLES.deliveryOrders, fetchDeliveryOrders);
}

/** Guest tracker: delivered orders hidden 30 minutes after delivery. */
export function useVisibleDeliveryOrders(): DeliveryOrder[] | undefined {
  return useLiveTable<DeliveryOrder>(
    TABLES.deliveryOrders,
    fetchVisibleDeliveryOrders,
  );
}

/* ------------------------------------------------------ reservations ----- */

/** Live bookings desk feed for the admin portal. */
export function useReservations(): Reservation[] | undefined {
  return useLiveTable<Reservation>(TABLES.reservations, fetchReservations);
}

/**
 * A single booking, re-read whenever the reservations table changes so a
 * status change made at the desk shows up on the guest's page immediately.
 */
export function useReservationLookup(
  reference: string | null,
  phone: string,
): Reservation | null | undefined {
  // The result is tagged with the lookup it answers, so a changed reference
  // reads as "loading" without a synchronous state reset in an effect.
  const [result, setResult] = useState<{
    key: string;
    value: Reservation | null;
  } | null>(null);

  const key = reference ? `${reference.trim().toUpperCase()}|${phone}` : null;
  const wanted = key;

  useEffect(() => {
    if (!wanted) return;
    let active = true;
    const refresh = () => {
      const separator = wanted.indexOf("|");
      void fetchReservation(
        wanted.slice(0, separator),
        wanted.slice(separator + 1),
      ).then((next) => {
        if (active) setResult({ key: wanted, value: next });
      });
    };
    refresh();
    const channel = supabase
      .channel(`tribe-booking-${wanted.replace(/[^A-Za-z0-9|]/g, "")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES.reservations },
        () => refresh(),
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [wanted]);

  // No reference means there is nothing to look up — never a loading state.
  if (!wanted) return null;
  if (!result || result.key !== wanted) return undefined;
  return result.value;
}

/* ----------------------------------------------- pre_order_items ------ */

/** Public pre-order form: active items only. */
export function usePublicPreOrderItems(): PreOrderItemRow[] | undefined {
  return useLiveTable<PreOrderItemRow>(TABLES.preOrderItems, fetchPublicPreOrderItems);
}

/** Admin panel: all pre-order items including hidden ones. */
export function useAdminPreOrderItems(): PreOrderItemRow[] | undefined {
  return useLiveTable<PreOrderItemRow>(TABLES.preOrderItems, fetchAllPreOrderItems);
}

/* --------------------------------------------------------- preorders ----- */

/** Staff & admin desk: every pre-order, newest first, live. */
export function usePreorders(): Preorder[] | undefined {
  return useLiveTable<Preorder>(TABLES.preorders, fetchPreorders);
}

/* -------------------------------------------------------- promotions ----- */

export function usePromotions(activeOnly: boolean): Promotion[] | undefined {
  return useLiveTable<Promotion>(
    TABLES.promotions,
    () => fetchPromotions({ activeOnly }),
    [activeOnly],
  );
}
