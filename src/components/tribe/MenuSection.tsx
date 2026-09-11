import { SectionHeading } from "@/components/tribe/SectionHeading";
import {
  BUFFET_INCLUDES,
  BUFFET_TIERS,
  MENU_CATEGORIES,
} from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  CakeSlice,
  Check,
  CookingPot,
  Flame,
  Sandwich,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  pot: CookingPot,
  bites: Sandwich,
  dessert: CakeSlice,
};

export function MenuSection() {
  return (
    <section id="menu" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Menu & pricing"
          title="One price, four counters, endless refills"
          description="Every seat includes the full spread — live BBQ, traditional handi, Lahori fast bites and the dessert degh. Weekend and festive nights add extra cuts, including our charcoal-grilled fish."
          align="center"
        />

        {/* Pricing tiers */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {BUFFET_TIERS.map((tier, index) => {
            const featured = index === 1;
            return (
              <motion.div
                key={tier.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
                className={cn(
                  "relative flex flex-col gap-2 rounded-3xl border p-6 text-center",
                  featured
                    ? "border-gold/40 bg-gradient-to-b from-gold/15 to-card/60 shadow-xl shadow-ember/10"
                    : "border-border/70 bg-card/60",
                )}
              >
                {featured ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-gold/40 bg-background px-3 py-1 text-[0.65rem] tracking-[0.18em] text-gold uppercase">
                    Most booked
                  </span>
                ) : null}
                <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
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

        {/* What the buffet includes */}
        <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/40 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            {BUFFET_INCLUDES.map((include) => (
              <div key={include} className="flex items-center gap-2.5 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Check className="size-3" aria-hidden />
                </span>
                <span className="text-muted-foreground">{include}</span>
              </div>
            ))}
          </div>
          <p className="shrink-0 rounded-2xl bg-secondary/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:max-w-[13rem]">
            Kids under 6 eat free · 6–10 years at half price · Zakat-friendly
            family portions
          </p>
        </div>

        {/* Live counters */}
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {MENU_CATEGORIES.map((category, index) => {
            const Icon = ICONS[category.icon] ?? Flame;
            return (
              <motion.article
                key={category.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: (index % 2) * 0.1, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-6 transition-colors hover:border-gold/35"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-24 -right-16 size-48 rounded-full bg-ember/10 opacity-70 blur-3xl transition-opacity group-hover:opacity-100"
                />
                <header className="relative flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/20 to-ember/15 text-gold">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-semibold">
                        {category.name}
                      </h3>
                      <p className="text-xs text-gold/70">{category.urdu}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-border/70 px-2.5 py-1 text-[0.6rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Unlimited
                  </span>
                </header>

                <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">
                  {category.blurb}
                </p>

                <ul className="relative mt-5 flex flex-col divide-y divide-border/60 border-t border-border/60">
                  {category.items.map((dish) => (
                    <li
                      key={dish}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="text-foreground/90">{dish}</span>
                      <span className="text-[0.7rem] tracking-wide text-gold/70 uppercase">
                        Included
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>

        {/* Daily special */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-6 flex flex-col gap-4 rounded-3xl border border-gold/30 bg-gradient-to-r from-ember/15 via-card/60 to-card/40 p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">
                Daily special · Charcoal-grilled fish
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Whole fish marinated overnight, grilled to order and served with
                imli chutney — laid out fresh from 7 PM while it lasts.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-2xl border border-gold/30 bg-background/50 px-4 py-2 text-xs tracking-[0.16em] text-gold uppercase">
            Included tonight
          </span>
        </motion.div>
      </div>
    </section>
  );
}
