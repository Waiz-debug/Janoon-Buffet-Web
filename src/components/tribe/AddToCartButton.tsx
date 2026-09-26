import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

/**
 * The "+" on a dish row — every priced dish on the counters and the à la carte
 * board carries one.
 *
 * It is client state only, on purpose: the tap adds the line to the cart, shows
 * how many of that dish are already in the bag, and never navigates, so a guest
 * reading the menu does not lose their place to order from it. The price that
 * travels with the line is a hint, not a fact — the cart re-prices every line
 * from the live menu (see `usePricedCart()`) and `place_delivery_order()`
 * prices the order again on the server, so nothing here is a source of truth.
 *
 * A dish with no price of its own — a counter item served as part of a sitting
 * — renders nothing: the row already reads "Ask at the counter", and a button
 * that adds a plate the kitchen cannot price would be a lie.
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

  if (unitPrice <= 0) return null;

  return (
    <button
      type="button"
      onClick={() => add({ slug, name, unitPrice, weight })}
      aria-label={
        count > 0
          ? `Add another ${name} — ${count} already in your order`
          : `Add ${name} to your order`
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
        {count > 0 ? "added" : "add"}
      </span>
    </button>
  );
}
