import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

/**
 * The "+" on a dish row — every dish on the counters and on the menu board
 * carries one.
 *
 * It is client state only, on purpose: the tap adds the line to the cart, shows
 * how many of that dish are already in the bag, and never navigates, so a guest
 * reading the menu does not lose their place to order from it. The price that
 * travels with the line is a hint, not a fact — the cart re-prices every line
 * from the live menu (see `usePricedCart()`) and `place_delivery_order()`
 * prices the order again on the server, so nothing here is a source of truth.
 *
 * **Every dish gets a control.** A dish the kitchen has not given a price of
 * its own — a High Tea plate, say, which is served as part of a sitting — used
 * to render nothing at all, which left a dead row on the board: a guest could
 * see the dish, could not order it, and had no way of telling that from a
 * broken button. It now adds like any other dish, at no price, and says so:
 * the pill reads "ask", the accessible name says the price is settled at the
 * counter, and the cart and the order summary both print the line as "priced at
 * the counter" instead of inventing a number for it.
 */
export function AddToCartButton({
  slug,
  name,
  unitPrice,
  weight,
  className,
}: {
  slug: string;
  name: string;
  unitPrice: number;
  /** Weight variant id, e.g. "half-kg". Undefined = standard portion. */
  weight?: string;
  className?: string;
}) {
  const { add, items } = useCart();

  const key = weight ? `${slug}:${weight}` : slug;
  const count =
    items.find((line) => {
      const lineKey = line.weight ? `${line.slug}:${line.weight}` : line.slug;
      return lineKey === key;
    })?.count ?? 0;

  const unpriced = unitPrice <= 0;

  return (
    <button
      type="button"
      onClick={() => add({ slug, name, unitPrice, weight })}
      aria-label={
        count > 0
          ? `Add another ${name} — ${count} already in your order${
              unpriced ? ", price settled at the counter" : ""
            }`
          : `Add ${name} to your order${
              unpriced ? " — price settled at the counter" : ""
            }`
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[0.65rem] font-semibold tracking-[0.14em] uppercase transition-colors",
        count > 0
          ? "border-gold/60 bg-gold/20 text-gold"
          : "border-border/70 text-muted-foreground hover:border-gold/50 hover:bg-gold/10 hover:text-gold",
        className,
      )}
    >
      {count > 0 ? (
        <span className="tabular-nums">{count}</span>
      ) : (
        <Plus className="size-3.5" aria-hidden />
      )}
      {/* The word only earns its space on a wide row; the icon alone carries it
          on the dense counter cards and on a phone. */}
      <span className="hidden sm:inline">
        {count > 0 ? "added" : unpriced ? "ask" : "add"}
      </span>
    </button>
  );
}
