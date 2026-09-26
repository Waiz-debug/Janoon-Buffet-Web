import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/tribe/SmartImage";
import { Embers, HearthScene } from "@/components/tribe/HearthScene";
import { useLiveSite } from "@/hooks/use-live-site";
import { RESTAURANT } from "@/lib/restaurant";
import { scrollToSection } from "@/lib/scroll";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, Flame } from "lucide-react";

/**
 * The hero leads with the house's own name and two numbers the menu itself
 * publishes — how many counters are running and how many dishes are on them —
 * counted live, so the strip can never state something the kitchen is not
 * serving. There are no prices, timings or superlatives here: an invented one
 * is worse than an absent one.
 */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

/**
 * The hero: the admin-managed backdrop photograph, the house name, and the
 * two calls to action. The backdrop is the `hero` media slot, so the photo the
 * owner uploads in the panel is the photo that greets every guest — no
 * redeploy, and it changes on the site the moment it is saved.
 */
export function Hero() {
  const { heroImage, counters, dishes } = useLiveSite();
  const backdrop = heroImage ?? RESTAURANT.heroImage;
  /** What the menu actually holds right now, counted rather than claimed. */
  const facts = [
    {
      value: String(counters.length),
      label: counters.length === 1 ? "Live counter" : "Live counters",
    },
    {
      value: String(dishes.length),
      label: dishes.length === 1 ? "Dish on the menu" : "Dishes on the menu",
    },
  ];

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden pt-28 pb-14 sm:pt-36"
    >
      {/* The feast itself, under a heavy vignette so the type always reads. */}
      <div aria-hidden className="absolute inset-0 -z-20">
        <SmartImage
          src={backdrop}
          alt=""
          loading="eager"
          className="h-full w-full object-cover opacity-70"
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-background/85 via-background/55 to-background"
      />
      <HearthScene className="absolute inset-x-0 bottom-0 -z-10 h-1/2 w-full opacity-30" />
      <Embers count={14} />

      <div className="relative mx-auto w-full max-w-5xl px-4 text-center sm:px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center gap-5"
        >
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-background/50 px-3.5 py-1.5 text-[0.65rem] font-medium tracking-[0.24em] text-gold uppercase backdrop-blur"
          >
            <Flame className="size-3.5" aria-hidden />
            {RESTAURANT.cuisine} · {RESTAURANT.cityNames}
          </motion.span>

          <motion.h1
            variants={item}
            className="font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl"
          >
            {RESTAURANT.name}
          </motion.h1>

          <motion.p
            variants={item}
            className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            A Pakistani restaurant in Gulberg, {RESTAURANT.cityNames} — its own
            kitchen and its own menu, from live counters and a full priced board
            through to the sweets counter, with tables booked online and dishes
            ordered for delivery.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-1 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
          >
            <Button
              type="button"
              size="lg"
              onClick={() => scrollToSection("counters")}
              className="group h-12 w-full gap-2 shadow-lg shadow-black/40 sm:w-auto"
            >
              Explore the Live Counters
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => scrollToSection("reserve")}
              className="h-12 w-full gap-2 border-gold/30 bg-background/40 backdrop-blur hover:bg-secondary/60 sm:w-auto"
            >
              <CalendarCheck className="size-4" aria-hidden />
              Reserve a Table
            </Button>
          </motion.div>
        </motion.div>

        <motion.dl
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
          className="mx-auto mt-12 grid max-w-md grid-cols-2 gap-6 border-t border-border/60 pt-8"
        >
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex flex-col items-center gap-1.5 px-2 text-center"
            >
              <dt className="font-display text-xl font-semibold text-gold sm:text-2xl">
                {fact.value}
              </dt>
              <dd className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                {fact.label}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
