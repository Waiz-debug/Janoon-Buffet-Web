import { Button } from "@/components/ui/button";
import { usePricedCart } from "@/hooks/use-priced-cart";
import { formatRupees, FREE_DELIVERY_THRESHOLD } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router";

export function CartDrawer() {
  const {
    items,
    itemCount,
    itemsTotal,
    isOpen,
    closeCart,
    setCount,
    remove,
    clear,
  } = usePricedCart();

  const deliveryFee = itemsTotal >= FREE_DELIVERY_THRESHOLD ? 0 : 150;
  const total = itemsTotal + (items.length > 0 ? deliveryFee : 0);
  const toFree = FREE_DELIVERY_THRESHOLD - itemsTotal;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60]",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <button
        type="button"
        tabIndex={isOpen ? 0 : -1}
        aria-label="Close cart"
        onClick={closeCart}
        className={cn(
          "absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <aside
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border/70 bg-background shadow-2xl shadow-black/50 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-label="Delivery cart"
      >
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
              <ShoppingBag className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-base font-semibold">Your order</p>
              <p className="text-xs text-muted-foreground">
                {itemCount === 0
                  ? "Nothing added yet"
                  : `${itemCount} ${itemCount === 1 ? "plate" : "plates"}`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={closeCart}>
            Close
          </Button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-card/60 text-muted-foreground">
              <ShoppingBag className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              Add dishes from the menu and we will bring them to your door,
              anywhere in Lahore.
            </p>
            <Button asChild size="sm" className="mt-2">
              <Link to="/restaurant#menu" onClick={closeCart}>
                Browse the menu
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border/60 overflow-y-auto px-5">
              {items.map((line) => {
                const key = line.weight ? `${line.slug}:${line.weight}` : line.slug;
                const weightLabel = line.weight ? line.weight.replace(/-/g, " ") : null;
                return (
                <li key={key} className="flex items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {line.unitPrice > 0
                        ? `${formatRupees(line.unitPrice)} each`
                        : "Priced at the counter"}
                      {weightLabel ? (
                        <span className="ml-1.5 rounded-md border border-gold/20 bg-gold/[0.06] px-1.5 py-0.5 text-gold">
                          {weightLabel}
                        </span>
                      ) : null}
                    </p>
                    {line.addons && line.addons.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {line.addons.map((addon) => (
                          <span key={addon.id} className="rounded-md border border-border/60 px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
                            + {addon.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`One less ${line.name}`}
                      onClick={() => setCount(key, line.count - 1)}
                      className="flex size-7 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                    >
                      <Minus className="size-3" aria-hidden />
                    </button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">
                      {line.count}
                    </span>
                    <button
                      type="button"
                      aria-label={`One more ${line.name}`}
                      onClick={() => setCount(key, line.count + 1)}
                      className="flex size-7 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                    >
                      <Plus className="size-3" aria-hidden />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${line.name}`}
                    onClick={() => remove(key)}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-rose-300"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
                );
              })}
            </ul>

            <footer className="border-t border-border/70 px-5 py-4">
              {deliveryFee > 0 ? (
                <p className="mb-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-xs text-muted-foreground">
                  Add {formatRupees(toFree)} more for free delivery.
                </p>
              ) : (
                <p className="mb-3 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-gold">
                  Free delivery unlocked.
                </p>
              )}
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Items</dt>
                  <dd>{formatRupees(itemsTotal)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Delivery</dt>
                  <dd>{deliveryFee === 0 ? "Free" : formatRupees(deliveryFee)}</dd>
                </div>
                <div className="mt-1 flex justify-between font-display text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="text-gold">{formatRupees(total)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={clear}>
                  Clear
                </Button>
                <Button asChild className="flex-[2]">
                  <Link to="/order" onClick={closeCart}>
                    Checkout
                  </Link>
                </Button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
