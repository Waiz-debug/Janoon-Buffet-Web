import { AddToCartButton } from "@/components/tribe/AddToCartButton";
import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { CounterJumpBar } from "@/components/tribe/CounterJumpBar";
import { FullMenuDialog } from "@/components/tribe/FullMenuDialog";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { SmartImage } from "@/components/tribe/SmartImage";
import { useLiveSite, type LiveDish } from "@/hooks/use-live-site";
import { formatPkr, photoThumb, type MenuIcon } from "@/lib/menu";
import { motion } from "framer-motion";
import { useState } from "react";

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
  /** Which counter the jump bar last moved the guest to. */
  const [activeCounter, setActiveCounter] = useState<string | null>(null);

  // A counter with nothing but signature dishes under it belongs to the
  // à la carte board, not here — an empty card under a station's name reads as
  // a broken counter rather than one still being set up.
  const visible = counters.filter((counter) =>
    counter.items.some((dish) => !dish.featured),
  );

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
            <div className="lg:max-w-lg lg:pb-1 lg:justify-end">
              <CounterJumpBar
                items={visible.map((counter) => ({
                  id: counter.id,
                  name: counter.name,
                }))}
                activeId={activeCounter}
                onChange={setActiveCounter}
                allLabel="All counters"
              />
            </div>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm leading-relaxed text-muted-foreground">
            {menuReady
              ? "The counters are being restocked. Every station the kitchen publishes in the admin panel appears here the moment it is saved."
              : "Setting the courtyard…"}
          </p>
        ) : (
          <div className="mt-10 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((counter, index) => {
              const Icon = CATEGORY_ICONS[counter.icon];
              // Signature dishes are shown once, on the à la carte board, and
              // are deliberately kept out of the counters so nothing appears
              // twice.
              const dishes = counter.items.filter((dish) => !dish.featured);
              const face: LiveDish | undefined = dishes[0];
              // The station's own photograph when the owner uploaded one from
              // the admin panel; otherwise the face of the first dish on it, so
              // a counter is never shown as an empty tile.
              const hero =
                counterImage(counter.id) ||
                (face ? photoThumb(face.image ?? "", 800) : "");

              return (
                <motion.article
                  key={counter.id}
                  id={`counter-${counter.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.5,
                    delay: (index % 3) * 0.07,
                    ease: "easeOut",
                  }}
                  className="group flex h-fit scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 transition-colors hover:border-gold/35"
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

                    {/* The counter's own dishes, each one orderable from the
                        card. Capped at four: the rest of the section is one
                        click away in the full menu, and a card that lists
                        twenty dishes stops reading as a card. */}
                    <ul className="mt-1 flex flex-col divide-y divide-border/50 border-t border-border/50">
                      {dishes.slice(0, 4).map((dish) => {
                        const dishPrice = unitPrice(dish);
                        return (
                          <li
                            key={dish.slug}
                            className="flex items-center gap-2 py-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {dish.name}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-gold tabular-nums">
                              {dishPrice > 0
                                ? formatPkr(dishPrice)
                                : "Ask at the counter"}
                            </span>
                            <AddToCartButton
                              slug={dish.slug}
                              name={dish.name}
                              unitPrice={dishPrice}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    {dishes.length > 4 ? (
                      <p className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                        + {dishes.length - 4} more at this counter
                      </p>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                      <span className="text-xs text-muted-foreground">
                        {dishes.length}{" "}
                        {dishes.length === 1 ? "dish" : "dishes"} at this
                        counter
                      </span>
                      <FullMenuDialog
                        initialCounter={counter.id}
                        variant="link"
                      />
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
