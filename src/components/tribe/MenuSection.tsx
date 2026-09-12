import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { SmartImage } from "@/components/tribe/SmartImage";
import { useCart } from "@/hooks/use-cart";
import {
  MENU_CATEGORIES,
  SIGNATURE_SLUGS,
  dishesByCategory,
  deliveryUnitPrice,
  formatRupees,
  getDish,
} from "@/lib/menu";
import { BUFFET_INCLUDES, BUFFET_TIERS } from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router";

export function MenuSection() {
  const { add } = useCart();

  const signatures = SIGNATURE_SLUGS.map((slug) => getDish(slug)).filter(
    (dish): dish is NonNullable<typeof dish> => Boolean(dish),
  );

  return (
    <section id="menu" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Menu & Pricing"
          title="One price, four counters, served without limit"
          description="Every seat includes the full spread — live charcoal BBQ, slow-cooked handi, Lahori fast bites and dessert straight from the degh. Weekend and festive nights add further cuts, including our charcoal-grilled fish. Select any dish to read how it is prepared."
          align="center"
        />

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

        <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-border/70 bg-card/40 p-6 sm:flex-row sm:items-center sm:justify-between">
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
                            unitPrice: deliveryUnitPrice(dish.slug),
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/15"
                        aria-label={`Add ${dish.name} to delivery order`}
                      >
                        <Plus className="size-3.5" aria-hidden />
                        {formatRupees(deliveryUnitPrice(dish.slug))}
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

        {/* Counters */}
        <div className="mt-16 grid gap-5 md:grid-cols-2">
          {MENU_CATEGORIES.map((category, index) => {
            const Icon = CATEGORY_ICONS[category.icon];
            const dishes = dishesByCategory(category.id);
            return (
              <motion.article
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: (index % 2) * 0.08, ease: "easeOut" }}
                className="flex flex-col rounded-2xl border border-border/70 bg-card/50 p-6"
              >
                <header className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold">
                      {category.name}
                    </h3>
                    <p className="text-xs text-gold/70">{category.urdu}</p>
                  </div>
                </header>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {category.blurb}
                </p>

                <ul className="mt-4 flex flex-col divide-y divide-border/60 border-t border-border/60">
                  {dishes.map((dish) => (
                    <li key={dish.slug} className="flex items-center gap-3">
                      <Link
                        to={`/menu/${dish.slug}`}
                        className="group flex min-w-0 flex-1 items-start justify-between gap-4 py-3"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium transition-colors group-hover:text-gold">
                            {dish.name}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {dish.summary}
                          </span>
                        </span>
                        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-gold" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          add({
                            slug: dish.slug,
                            name: dish.name,
                            unitPrice: deliveryUnitPrice(dish.slug),
                          })
                        }
                        className="my-2 inline-flex shrink-0 items-center gap-1 rounded-lg border border-gold/25 px-2 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                        aria-label={`Add ${dish.name} to delivery order`}
                      >
                        <Plus className="size-3" aria-hidden />
                        {formatRupees(deliveryUnitPrice(dish.slug))}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gold/25 bg-gold/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 text-gold">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">
                Daily special · Charcoal-grilled fish
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Whole fish marinated overnight, grilled to order and carved at the
                counter, laid out fresh from seven in the evening while it lasts.
              </p>
            </div>
          </div>
          <Link
            to="/menu/grilled-fish"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gold/30 px-4 py-2.5 text-xs tracking-[0.16em] text-gold uppercase transition-colors hover:bg-gold/10"
          >
            View the dish
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
