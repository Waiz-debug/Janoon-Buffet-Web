import { CATEGORY_ICONS } from "@/components/tribe/category-icons";
import { FullMenuDialog } from "@/components/tribe/FullMenuDialog";
import {
  SectionDivider,
  SectionHeading,
} from "@/components/tribe/SectionHeading";
import { useLiveSite, type LiveDish } from "@/hooks/use-live-site";
import { MAIN_MENU_IDS, formatPkr } from "@/lib/menu";
import { motion } from "framer-motion";
import { Link } from "react-router";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

/**
 * The small brass tags under a dish: what it is, and how it is sold.
 *
 * Everything here comes from the row the owner actually edits — `featured` is
 * the Signature switch, `weights` the half/full kilo choice, `notes` the
 * kitchen's own remark — so a tag can never claim something the panel does not
 * say. At most three, so a long note cannot push a price row out of shape.
 */
function tagsFor(dish: LiveDish, price: number): string[] {
  const tags: string[] = [];
  if (dish.featured) tags.push("Signature");
  if (dish.weights?.length) {
    tags.push(dish.weights.map((weight) => weight.label).join(" · "));
  }
  if (price <= 0) tags.push("Included in High Tea");
  const note = dish.notes?.[0]?.label;
  if (note) tags.push(note);
  return tags.slice(0, 3);
}

/**
 * The Imperial À La Carte — the seven priced sections, as chapters.
 *
 * The chapters are the live main-menu sections in menu order, and the dishes
 * inside them are the live rows, so the board is exactly what the kitchen has
 * published: a dish the owner prices in the panel shows its price here on the
 * next render, and a section they switch off leaves the board entirely.
 */
export function MenuSection() {
  const { counters, unitPrice, menuReady } = useLiveSite();

  const chapters = MAIN_MENU_IDS.map((id) =>
    counters.find((counter) => counter.id === id),
  ).filter((chapter): chapter is (typeof counters)[number] => Boolean(chapter));

  const withDishes = chapters.filter((chapter) => chapter.items.length > 0);

  return (
    <section id="menu" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          align="center"
          eyebrow="Grand menu"
          title="The Imperial À La Carte"
          description="Each creation is crafted strictly according to courtly royal taste, cooked in brass and copper and fired over angith coal — priced per dish for the table."
        />

        <div className="mt-7 flex justify-center">
          <FullMenuDialog />
        </div>

        <div className="mt-10">
          <SectionDivider label="Dastarkhwan" />
        </div>

        {withDishes.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm leading-relaxed text-muted-foreground">
            {menuReady
              ? "The à la carte board is being rewritten. Every section the kitchen publishes in the admin panel appears here the moment it is saved."
              : "Setting the board…"}
          </p>
        ) : (
          <div className="mt-10 grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
            {withDishes.map((chapter, index) => {
              const Icon = CATEGORY_ICONS[chapter.icon];
              // Signature dishes belong on this board too — they are priced
              // here, and the counters deliberately leave them out so nothing
              // appears twice on the page.
              const dishes = chapter.items;
              return (
                <motion.article
                  key={chapter.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{
                    duration: 0.5,
                    delay: (index % 3) * 0.07,
                    ease: "easeOut",
                  }}
                  className="flex h-fit flex-col rounded-2xl border border-border/70 bg-card/40"
                >
                  <header className="flex items-start gap-3 border-b border-border/60 p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.6rem] tracking-[0.28em] text-gold/70 uppercase">
                        Chapter {ROMAN[index] ?? index + 1}
                      </p>
                      <h3 className="font-display text-lg font-semibold">
                        {chapter.name}
                      </h3>
                      {chapter.urdu ? (
                        <p dir="rtl" className="text-xs text-gold/70">
                          {chapter.urdu}
                        </p>
                      ) : null}
                    </div>
                  </header>

                  <ul className="flex flex-col divide-y divide-border/50 px-5">
                    {dishes.map((dish) => {
                      const price = unitPrice(dish);
                      const tags = tagsFor(dish, price);
                      return (
                        <li key={dish.slug} className="flex flex-col gap-1.5 py-4">
                          <div className="flex items-baseline justify-between gap-4">
                            <Link
                              to={`/menu/${dish.slug}`}
                              className="font-display text-base leading-snug font-medium transition-colors hover:text-gold"
                            >
                              {dish.name}
                            </Link>
                            <span className="shrink-0 text-sm font-medium text-gold tabular-nums">
                              {price > 0 ? formatPkr(price) : "Included"}
                            </span>
                          </div>
                          {dish.summary ? (
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {dish.summary}
                            </p>
                          ) : null}
                          {tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-gold/20 bg-gold/[0.06] px-2 py-0.5 text-[0.6rem] tracking-[0.14em] text-gold/80 uppercase"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
