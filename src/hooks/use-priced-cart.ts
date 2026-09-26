import { useCart } from "@/hooks/use-cart";
import { useLiveSite } from "@/hooks/use-live-site";
import { useMemo } from "react";

/**
 * The cart, priced from the live menu.
 *
 * The bag is a device-side convenience — it survives a refresh because it is
 * held in `localStorage` — and it is never the source of truth for a price.
 * Every line is re-priced here from the row the kitchen publishes, so a price
 * the owner changed in the admin panel (or a hand-edited storage entry) cannot
 * reach the totals a guest is shown. `place_delivery_order()` then prices the
 * order again on the server, and that is the number that is actually charged.
 *
 * A weight variant is priced as the dish's own price plus the variant's delta,
 * matching how the full menu dialog adds it. A line whose dish is no longer on
 * the published menu keeps the price it was added with, so a dish switched off
 * mid-visit still shows in the bag instead of silently dropping out of it.
 */
export function usePricedCart() {
  const cart = useCart();
  const { dishes, unitPrice } = useLiveSite();

  const items = useMemo(
    () =>
      cart.items.map((line) => {
        const dish = dishes.find((candidate) => candidate.slug === line.slug);
        if (!dish) return line;
        const base = unitPrice(dish);
        const variant = line.weight
          ? dish.weights?.find((option) => option.id === line.weight)
          : undefined;
        const next = variant ? base + variant.priceDelta : base;
        return next === line.unitPrice ? line : { ...line, unitPrice: next };
      }),
    [cart.items, dishes, unitPrice],
  );

  const itemsTotal = items.reduce(
    (sum, line) => sum + line.unitPrice * line.count,
    0,
  );

  return { ...cart, items, itemsTotal };
}
