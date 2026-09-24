import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { FullMenuDialog } from "@/components/tribe/FullMenuDialog";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { SmartImage } from "@/components/tribe/SmartImage";
import { useCart } from "@/hooks/use-cart";
import { useLiveSite } from "@/hooks/use-live-site";
import { formatRupees, photoThumb } from "@/lib/menu";
import { BUFFET_INCLUDES, BUFFET_TIERS } from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Plus, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router";

function DishRow({
  dish,
  unitPrice,
  add,
}: {
  dish: {
    slug: string;
    name: string;
    summary: string;
    image: string;
    weights?: { id: string; label: string; priceDelta: number }[];
  };
  unitPrice: (dish: { slug: string; pricePerPlate?: number | null }) => number;
  add: (item: { slug: string; name: string; unitPrice: number; weight?: string }) => void;
}) {
  const base = unitPrice(dish);
  const hasWeights = dish.weights && dish.weights.length > 0;
  const [selectedWeight, setSelectedWeight] = useState(
    hasWeights ? dish.weights![0].id : undefined,
  );
  const weightOption = hasWeights
    ? dish.weights!.find((w) => w.id === selectedWeight)
    : undefined;
  const price = base + (weightOption?.priceDelta ?? 0);

  return (
    <li className="flex flex-col gap-2 py-3 last:pb-0">
      <div className="flex items-center gap-3">
        <Link
          to={`/menu/${dish.slug}`}
          className="group flex min-w-0 flex-1 items-center gap-3"
        >
          {/* The dish itself next to its name, or the house tile when the
              kitchen has not photographed it yet — see SmartImage. */}
          <SmartImage
            src={photoThumb(dish.image)}
            alt={dish.name}
            className="size-14 shrink-0 rounded-xl object-cover"
            glyphClassName="size-4"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium transition-colors group-hover:text-gold">
              {dish.name}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
              {dish.summary}
            </span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-gold" />
        </Link>
        {price > 0 ? (
          <button
            type="button"
            onClick={() =>
              add({
                slug: dish.slug,
                name: dish.name,
                unitPrice: price,
                weight: selectedWeight,
              })
            }
            className="my-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-gold/25 px-2 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/10"
            aria-label={`Add ${dish.name} to delivery order`}
          >
            <Plus className="size-3" aria-hidden />
            {formatRupees(price)}
          </button>
        ) : (
          <span className="my-1 shrink-0 rounded-lg border border-gold/20 px-2 py-1 text-[0.65rem] text-gold/80">
            High Tea included
          </span>
        )}
      </div>
      {hasWeights ? (
        <div className="flex items-center gap-2 pl-[4.25rem]">
          <Scale className="size-3 text-gold/60" aria-hidden />
          <div className="flex gap-1.5">
            {dish.weights!.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeight(w.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[0.65rem] font-medium transition-colors",
                  selectedWeight === w.id
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-border/70 text-muted-foreground hover:border-gold/20 hover:text-foreground",
                )}
              >
                {w.label}
                {w.priceDelta > 0 ? ` +${formatRupees(w.priceDelta)}` : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function MenuSection() {
  const { add } = useCart();
  const { counters, getDish, hasPublishedMenu, signatures, unitPrice } =
    useLiveSite();

  const special = getDish("junooni-royal-platter");

  /**
   * The counters with something to show. A counter the owner has created but
   * not filled yet is left off the page entirely — an empty card under a
   * heading reads as a broken menu. Filtered here rather than inside the map so
   * the empty state below can tell "nothing is published yet" from "this one
   * counter is still being set up".
   */
  const visibleCounters = counters.filter((counter) =>
    counter.items.some((dish) => !dish.featured),
  );
  const counterCount = visibleCounters.length;

  return (
    <section id="menu" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Menu & Pricing"
          title="One price, every counter, served without limit"
          description="Seasons Special High Tea is Rs 1,895 + tax, served 03:30–05:00 pm and 05:15–06:45 pm across nine live counters. The official à la carte menu follows below, prepared with home-made desi ghee and ordered by the table."
          align="center"
        />

        {/* Full catalog — the entire menu, one click away */}
        <div className="mt-8 flex justify-center">
          <FullMenuDialog />
        </div>

        {/* Pricing */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {BUFFET_TIERS.map((tier, index) => {
            const featured = index === 1;
            return (
              <motion.div
                key={tier.label}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
                className={cn(
                  "relative flex flex-col gap-2 rounded-2xl border p-6 text-center",
                  featured
                    ? "border-gold/40 bg-gold/[0.07]"
                    : "border-border/70 bg-card/40",
                )}
              >
                {featured ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-gold/40 bg-background px-3 py-1 text-[0.65rem] tracking-[0.18em] text-gold uppercase">
                    Most requested
                  </span>
                ) : null}
                <span className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
                  {tier.label}
                </span>
                <span className="font-display text-3xl font-semibold text-gold">
                  {tier.price}
                </span>
                <span className="text-xs text-muted-foreground">{tier.note}</span>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            {BUFFET_INCLUDES.map((include) => (
              <div key={include} className="flex items-center gap-2.5 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-gold/30 text-gold">
                  <Check className="size-3" aria-hidden />
                </span>
                <span className="text-muted-foreground">{include}</span>
              </div>
            ))}
          </div>
          <p className="shrink-0 rounded-xl border border-border/70 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:max-w-[14rem]">
            Children under six dine free, ages six to ten at half price. Group
            bookings above twelve are arranged by our floor team.
          </p>
        </div>

        {/* Signatures */}
        <div className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <h3 className="font-display text-2xl font-semibold">Signatures</h3>
            <span className="hidden text-xs tracking-[0.18em] text-muted-foreground uppercase sm:block">
              Prepared to order
            </span>
          </div>
          {signatures.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
              {hasPublishedMenu
                ? "Our signature dishes are being updated. The counters below hold the full spread."
                : "The menu is being updated — please check back shortly."}
            </p>
          ) : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {signatures.map((dish, index) => (
              <motion.div
                key={dish.slug}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: index * 0.06, ease: "easeOut" }}
              >
                <Link
                  to={`/menu/${dish.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/50 transition-colors hover:border-gold/35"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <SmartImage
                      src={dish.image}
                      alt={dish.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute top-3 left-3 rounded-full border border-gold/30 bg-background/85 px-2.5 py-1 text-[0.6rem] tracking-[0.16em] text-gold uppercase backdrop-blur">
                      Included
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <h4 className="font-display text-base font-semibold">
                      {dish.name}
                    </h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {dish.summary}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <button
                        type="button"
                        onClick={() =>
                          add({
                            slug: dish.slug,
                            name: dish.name,
                            unitPrice: unitPrice(dish),
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/15"
                        aria-label={`Add ${dish.name} to delivery order`}
                      >
                        <Plus className="size-3.5" aria-hidden />
                        {formatRupees(unitPrice(dish))}
                      </button>
                      <Link
                        to={`/menu/${dish.slug}`}
                        className="inline-flex items-center gap-1.5 text-[0.7rem] tracking-[0.16em] text-gold uppercase"
                      >
                        View dish
                        <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </Link>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Counters — one section per counter, straight from Supabase */}
        <div className="mt-16 flex items-end justify-between gap-4">
          <h3 className="font-display text-2xl font-semibold">The official menu</h3>
          {counterCount > 0 ? (
            <span className="hidden text-xs tracking-[0.18em] text-muted-foreground uppercase sm:block">
              {counterCount} section{counterCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        {counterCount === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm leading-relaxed text-muted-foreground">              Tonight&apos;s counters are being updated. Every section and dish
              published in the admin panel appears here — and refreshes on its own
              — the moment it is saved.
          </p>
        ) : null}
        {/* `items-start` keeps a short counter — a two-dish station beside a
            twelve-dish one — wrapped tight around its own dishes instead of
            being stretched to the height of the row and left hanging over a
            pocket of empty space. */}
        <div className="mt-5 grid items-start gap-5 md:grid-cols-2">
          {visibleCounters.map((counter, index) => {
            const Icon = CATEGORY_ICONS[counter.icon];
            // Signature dishes are shown once, in the section above, and are
            // deliberately kept out of the counters so nothing appears twice.
            // The items themselves come straight from the counter, so a dish
            // sits under the section it was filed on in the admin panel.
            const dishes = counter.items.filter((dish) => !dish.featured);
            return (
              <motion.article
                key={counter.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: (index % 2) * 0.08, ease: "easeOut" }}
                className="flex h-fit flex-col rounded-2xl border border-border/70 bg-card/50 p-5"
              >
                <header className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold">
                      {counter.name}
                    </h3>
                    <p className="text-xs text-gold/70">{counter.urdu}</p>
                  </div>
                </header>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {counter.blurb}
                </p>

                <ul className="mt-4 flex flex-col divide-y divide-border/60 border-t border-border/60">
                  {dishes.map((dish) => (
                    <DishRow key={dish.slug} dish={dish} unitPrice={unitPrice} add={add} />
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>

        {/* Chef's table — highlights the full platter when it is live */}
        {special ? (
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gold/25 bg-gold/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 text-gold">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Chef&apos;s table · {special.name}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {special.summary}
                </p>
              </div>
            </div>
            <Link
              to={`/menu/${special.slug}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gold/30 px-4 py-2.5 text-xs tracking-[0.16em] text-gold uppercase transition-colors hover:bg-gold/10"
            >
              View the dish
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
