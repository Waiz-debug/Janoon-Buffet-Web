import { SmartImage } from "@/components/tribe/SmartImage";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { RESTAURANT } from "@/lib/restaurant";
import { motion } from "framer-motion";
import { Moon, Quote, Trees, Users } from "lucide-react";

const VIBES = [
  {
    icon: Trees,
    title: "Open-air family seating",
    body: "Long tables under string lights and a night breeze — room for the cousins, the grandparents and the pram, with the grills working a few steps away.",
  },
  {
    icon: Users,
    title: "Cooked the slow, old way",
    body: "Nihari that starts at dawn, handi stirred in clay, seekh kebab pressed by hand. Nothing is rushed, which is exactly why it tastes like home.",
  },
  {
    icon: Moon,
    title: "Late-night cravings welcome",
    body: "The buffet never closes. Walk in at 2 AM or 5 AM after a wedding and find a full spread, hot naan and Kashmiri chai waiting.",
  },
] as const;

export function AboutVibe() {
  return (
    <section id="vibe" className="hearth-texture scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="flex flex-col gap-10">
            <SectionHeading
              eyebrow="The Experience"
              title="An open-air table in Lahore, served whenever your family is hungry"
              description="Tribe of Taste was built on a single idea: good desi cooking should not keep office hours. Arrive after a wedding, before a shift, or on a slow Friday night — the coals are always lit."
            />

            <div className="flex flex-col gap-4">
              {VIBES.map((vibe, index) => (
                <motion.div
                  key={vibe.title}
                  initial={{ opacity: 0, x: -18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
                  className="flex gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-colors hover:border-gold/30"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <vibe.icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">
                      {vibe.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {vibe.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Heritage collage */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative flex flex-col gap-4"
          >
            <div className="grid grid-cols-5 gap-3">
              <SmartImage
                src={RESTAURANT.heroImage}
                alt="Open-air seating at Tribe of Taste"
                className="col-span-5 h-52 w-full rounded-3xl border border-border/70 object-cover sm:h-64"
              />
              <SmartImage
                src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=700&q=70"
                alt="Seekh kebab on the charcoal grill"
                className="col-span-3 h-32 w-full rounded-3xl border border-border/70 object-cover sm:h-36"
              />
              <div className="col-span-2 flex h-32 flex-col justify-center gap-1 rounded-3xl border border-gold/25 bg-gold/[0.07] p-4 text-center sm:h-36">
                <span className="font-display text-2xl font-semibold text-gold">
                  4–20
                </span>
                <span className="text-[0.7rem] leading-snug tracking-wide text-muted-foreground uppercase">
                  seats per family table
                </span>
              </div>
            </div>

            <figure className="rounded-3xl border border-border/70 bg-card/70 p-6">
              <Quote className="size-5 text-gold/70" aria-hidden />
              <blockquote className="mt-3 font-display text-lg leading-relaxed text-balance italic">
                &ldquo;Feels less like a restaurant and more like a family
                courtyard in the old city — except the food never stops
                coming.&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-xs tracking-wide text-muted-foreground uppercase">
                A regular from DHA Phase 5
              </figcaption>
            </figure>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
