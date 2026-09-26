import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { FullMenuDialog } from "@/components/tribe/FullMenuDialog";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { SmartImage } from "@/components/tribe/SmartImage";
import { useCart } from "@/hooks/use-cart";
import { useLiveSite, type LiveDish } from "@/hooks/use-live-site";
import { formatPkr, photoThumb, type MenuIcon } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * The station name a counter wears on its card. It is read from the counter's
 * badge icon, so a counter the owner creates in the panel is labelled without
 * anyone having to name the station twice.
 */
const STATION_BADGE: Record<MenuIcon, string> = {
  flame: "Grill",
  pot: "Handi",
  bread: "Tandoor",
  soup: "Soup",
  salad: "Salad",
  bites: "Street food",
  dessert: "Dessert",
  drink: "Drinks",
};

/**
 * Live counters — every section of the menu, straight from `menu_categories` /
 * `menu_dishes`.
 *
 * Each card is one counter with the first dish filed under it as its face, the
 * station it runs from as a badge, and the price of that dish ready to order.
 * The chips filter the board to a single counter, so a guest can read the grill
 * without scrolling the spread.
 */
export function LiveCounters() {
  const { counters, unitPrice, menuReady, counterImage } = useLiveSite();
  const { add } = useCart();
  /** `null` shows every counter — what the guest sees on opening. */
  const [only, setOnly] = useState<string | null>(null);

  // A counter with nothing but signature dishes under it belongs to the
  // à la carte board, not here — an empty card under a station's name reads as
  // a broken counter rather than one still being set up.
  const visible = counters.filter((counter) =>
    counter.items.some((dish) => !dish.featured),
  );
  const shown = only
    ? visible.filter((counter) => counter.id === only)
    : visible;

  return (
    <section id="counters" className="hearth-texture scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Heading on the left, the counter chips on the right — the board a
            guest scans before deciding which station to walk to first. */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="The menu"
            title="Live counters"
            description="The kitchen's counters as the menu files them — one card per section, with each station's dishes and the price of the dish it leads with. Prices are shown where the dish is sold on its own; where a dish is served as part of a counter, ask at the counter."
          />
          {visible.length > 0 ? (
            <div className="flex flex-wrap gap-2 lg:max-w-lg lg:justify-end">
              <FilterChip active={only === null} onClick={() => setOnly(null)}>
                All counters
              </FilterChip>
              {visible.map((counter) => (
                <FilterChip
                  key={counter.id}
                  active={only === counter.id}
                  onClick={() => setOnly(counter.id)}
                >
                  {counter.name}
                </FilterChip>
              ))}
            </div>
          ) : null}
        </div>

        {shown.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm leading-relaxed text-muted-foreground">
            {menuReady
              ? "The counters are being restocked. Every station the kitchen publishes in the admin panel appears here the moment it is saved."
              : "Setting the courtyard…"}
          </p>
        ) : (
          <div className="mt-10 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((counter, index) => {
              const Icon = CATEGORY_ICONS[counter.icon];
              // Signature dishes are shown once, on the à la carte board, and
              // are deliberately kept out of the counters so nothing appears
              // twice.
              const dishes = counter.items.filter((dish) => !dish.featured);
              const face: LiveDish | undefined = dishes[0];
              const price = face ? unitPrice(face) : 0;
              // The station's own photograph when the owner uploaded one from
              // the admin panel; otherwise the face of the first dish on it, so
              // a counter is never shown as an empty tile.
              const hero =
                counterImage(counter.id) ||
                (face ? photoThumb(face.image ?? "", 800) : "");

              return (
                <motion.article
                  key={counter.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.5,
                    delay: (index % 3) * 0.07,
                    ease: "easeOut",
                  }}
                  className="group flex h-fit flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 transition-colors hover:border-gold/35"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <SmartImage
                      src={hero}
                      alt={face?.name ?? counter.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent"
                    />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-background/80 px-2.5 py-1 text-[0.6rem] tracking-[0.18em] text-gold uppercase backdrop-blur">
                      <Icon className="size-3" aria-hidden />
                      {STATION_BADGE[counter.icon]}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <h3 className="font-display text-xl font-semibold">
                      {counter.name}
                    </h3>
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {counter.blurb}
                    </p>

                    {face ? (
                      <div className="mt-1 flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/10 text-gold">
                          <Check className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {face.name}
                          </span>
                          <span className="block text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                            {dishes.length}{" "}
                            {dishes.length === 1 ? "dish" : "dishes"} at this
                            counter
                          </span>
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                      <span className="font-display text-sm font-semibold text-gold tabular-nums">
                        {price > 0 ? formatPkr(price) : "Ask at the counter"}
                      </span>
                      {face && price > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            add({
                              slug: face.slug,
                              name: face.name,
                              unitPrice: price,
                            })
                          }
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[0.65rem] font-medium tracking-[0.14em] text-accent-foreground uppercase transition-opacity hover:opacity-90"
                        >
                          <Plus className="size-3.5" aria-hidden />
                          Add to order
                        </button>
                      ) : null}
                    </div>

                    <div className="flex justify-center pt-1">
                      <FullMenuDialog initialCounter={counter.id} variant="link" />
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-[0.7rem] tracking-[0.14em] uppercase transition-colors",
        active
          ? "border-gold/50 bg-gold/15 text-gold"
          : "border-border/70 text-muted-foreground hover:border-gold/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
