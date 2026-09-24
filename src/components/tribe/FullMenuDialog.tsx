import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { SmartImage } from "@/components/tribe/SmartImage";
import { useCart } from "@/hooks/use-cart";
import { useLiveSite, type LiveDish } from "@/hooks/use-live-site";
import { formatRupees } from "@/lib/menu";
import { BUFFET_TIERS } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, Plus, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

function DishCard({ dish, price }: { dish: LiveDish; price: number }) {
  const { add } = useCart();

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/50 transition-colors hover:border-gold/35">
      <div className="relative aspect-[5/3] overflow-hidden">
        <SmartImage
          src={dish.image}
          alt={dish.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-sm font-semibold leading-snug">
            {dish.name}
          </h4>
          <span className="shrink-0 text-xs font-medium text-gold tabular-nums">
            {formatRupees(price)}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {dish.summary}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <button
            type="button"
            onClick={() =>
              add({ slug: dish.slug, name: dish.name, unitPrice: price })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/20"
            aria-label={`Add ${dish.name} to delivery order`}
          >
            <Plus className="size-3.5" aria-hidden />
            Add to cart
          </button>
          <Link
            to={`/menu/${dish.slug}`}
            className="text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-gold"
          >
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}

export function FullMenuDialog() {
  const { counters, menuItemCount, unitPrice } = useLiveSite();
  /** `null` shows every counter — what the guest sees on opening. */
  const [only, setOnly] = useState<string | null>(null);
  /**
   * Counters that actually hold a published dish, and the dishes on show.
   * A counter the owner has created but not filled yet is not offered as a
   * filter and not drawn as a heading: an empty section under a station's name
   * reads as a broken menu rather than as a counter still being set up.
   */
  const groups = counters.filter((counter) => counter.items.length > 0);
  const shown = only ? groups.filter((counter) => counter.id === only) : groups;
  const shownCount = shown.reduce(
    (total, counter) => total + counter.items.length,
    0,
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="lg"
          className="h-12 gap-2 shadow-lg shadow-black/30"
        >
          <UtensilsCrossed className="size-4" aria-hidden />
          View Full Menu
          <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs font-medium">
            {menuItemCount} dishes
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="gap-1.5 border-b border-border/70 px-6 py-5 text-left">
          <DialogTitle className="font-display text-xl font-semibold">
            The complete menu
          </DialogTitle>
          <DialogDescription>
            Every dish across our counters — all included in the dine-in
            buffet, or available for Lahore delivery at the prices shown.
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {BUFFET_TIERS.map((tier) => (
              <span
                key={tier.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.08] px-3 py-1 text-xs text-muted-foreground"
              >
                <Check className="size-3 text-gold" aria-hidden />
                Dine-in buffet {tier.price} · {tier.label}
              </span>
            ))}
          </div>

          {/* One chip per counter, so a guest can read a single station — the
              charcoal grill — without scrolling the whole spread. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={only === null}
              onClick={() => setOnly(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                only === null
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border/70 text-muted-foreground hover:border-gold/30 hover:text-foreground",
              )}
            >
              All counters
            </button>
            {groups.map((counter) => (
              <button
                key={counter.id}
                type="button"
                aria-pressed={only === counter.id}
                onClick={() => setOnly(counter.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  only === counter.id
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border/70 text-muted-foreground hover:border-gold/30 hover:text-foreground",
                )}
              >
                {counter.name}
                <span className="ml-1.5 opacity-70">{counter.items.length}</span>
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-10">
            {shown.map((counter) => {
              const Icon = CATEGORY_ICONS[counter.icon];
              const catDishes = counter.items;
              return (
                <section key={counter.id} aria-label={counter.name}>
                  <header className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold">
                        {counter.name}
                      </h3>
                      <p className="text-xs text-gold/70">{counter.urdu}</p>
                    </div>
                  </header>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {catDishes.map((dish) => (
                      <DishCard
                        key={dish.slug}
                        dish={dish}
                        price={unitPrice(dish)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          {shownCount === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {menuItemCount === 0
                ? "The menu is being updated — please check back shortly."
                : "Nothing is published at this counter yet."}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
