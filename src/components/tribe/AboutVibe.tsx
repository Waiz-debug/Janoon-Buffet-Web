import { SmartImage } from "@/components/tribe/SmartImage";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { useLiveSite } from "@/hooks/use-live-site";
import { EXPERIENCE_MEDIA, RESTAURANT } from "@/lib/restaurant";
import { motion } from "framer-motion";
import { CalendarCheck, Truck, UtensilsCrossed } from "lucide-react";

/**
 * What the house actually does, in three lines.
 *
 * This section used to describe an open-air courtyard of a given size, a
 * scratch kitchen and a private chamber — none of it confirmed by the
 * restaurant. What is left is only what the product itself proves: the menu is
 * published counter by counter, tables are booked online, and dishes are
 * ordered for delivery. The photographs come from the admin-managed Experience
 * slots, so the owner replaces them with real pictures of the house.
 */
const FACTS = [
  {
    icon: UtensilsCrossed,
    title: "One menu, counter by counter",
    body: "Every dish is filed under the counter that serves it, and the full menu opens section by section — the same rows the kitchen publishes and repriced from its own admin panel.",
  },
  {
    icon: CalendarCheck,
    title: "Tables booked online",
    body: "Send a reservation request and it lands on the restaurant's own desk, where the team keeps the table and can reach you back on the number you left.",
  },
  {
    icon: Truck,
    title: "Dishes delivered",
    body: "Priced dishes can be ordered for delivery, with the total worked out from the menu on the server rather than from anything the page states.",
  },
] as const;

export function AboutVibe() {
  // Photos are owner-managed in the admin panel.
  const { mediaOr } = useLiveSite();

  return (
    <section id="heritage" className="hearth-texture scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="flex flex-col gap-10">
            <SectionHeading
              eyebrow="About the restaurant"
              title={`${RESTAURANT.name} — a Pakistani kitchen in ${RESTAURANT.cityLine}`}
              description={`The restaurant cooks and serves its own menu at ${RESTAURANT.address}, and everything published on this site comes from the house: the dishes, the prices and the photographs are edited by the restaurant itself.`}
            />

            <div className="flex flex-col gap-4">
              {FACTS.map((fact, index) => (
                <motion.div
                  key={fact.title}
                  initial={{ opacity: 0, x: -18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
                  className="flex gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-colors hover:border-gold/30"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <fact.icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">
                      {fact.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {fact.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Two photographs of the house, both owner-managed. */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            <SmartImage
              src={mediaOr(
                EXPERIENCE_MEDIA.ambiance.slot,
                EXPERIENCE_MEDIA.ambiance.url,
              )}
              alt={`${RESTAURANT.name}, ${RESTAURANT.cityLine}`}
              className="h-52 w-full rounded-3xl border border-border/70 object-cover sm:h-64"
            />
            <SmartImage
              src={mediaOr(
                EXPERIENCE_MEDIA.food.slot,
                EXPERIENCE_MEDIA.food.url,
              )}
              alt={`A dish from the ${RESTAURANT.name} kitchen`}
              className="h-40 w-full rounded-3xl border border-border/70 object-cover sm:h-48"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
