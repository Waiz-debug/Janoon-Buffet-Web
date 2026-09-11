import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/tribe/SmartImage";
import { Embers, HearthScene } from "@/components/tribe/HearthScene";
import { RESTAURANT } from "@/lib/restaurant";
import { scrollToSection } from "@/lib/scroll";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Flame,
  MapPin,
  Star,
  UtensilsCrossed,
} from "lucide-react";

const HERO_STATS = [
  {
    icon: Star,
    value: `${RESTAURANT.rating} ★`,
    label: `${RESTAURANT.reviewCount}+ Google reviews`,
  },
  { icon: UtensilsCrossed, value: RESTAURANT.buffetRange, label: "per person, unlimited" },
  { icon: Clock, value: "Open 24/7", label: "even at 3 AM" },
  { icon: MapPin, value: "Open air", label: "near DHA Phase 5" },
] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24 pb-16 sm:pt-28"
    >
      {/* Warm hearth backdrop: photo (if available) under the heritage scene art */}
      <div aria-hidden className="absolute inset-0 -z-20">
        <SmartImage
          src={RESTAURANT.heroImage}
          alt=""
          loading="eager"
          className="h-full w-full object-cover opacity-30"
        />
      </div>
      <HearthScene className="absolute inset-x-0 bottom-0 -z-10 h-full w-full opacity-80" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/40 to-background"
      />
      <Embers count={16} />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex max-w-3xl flex-col items-start gap-6"
        >
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-background/60 px-3.5 py-1.5 text-[0.7rem] font-medium tracking-[0.18em] text-gold uppercase backdrop-blur"
          >
            <Flame className="size-3.5" aria-hidden />
            Natha Singh Wala · Near DHA Phase 5, Lahore
          </motion.span>

          <motion.h1
            variants={item}
            className="font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl"
          >
            Authentic Pakistani{" "}
            <span className="bg-gradient-to-r from-gold via-primary to-ember bg-clip-text text-transparent italic">
              BBQ &amp; handi
            </span>
            , served around the clock.
          </motion.h1>

          <motion.p
            variants={item}
            className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            An all-you-can-eat open-air buffet at {RESTAURANT.name} — charcoal
            grills, clay-pot handi and desi desserts, laid out every hour of the
            day for families who like to eat late. Reserve your table ahead and
            walk straight in.
          </motion.p>

          <motion.div
            variants={item}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
          >
            <Button
              type="button"
              size="lg"
              onClick={() => scrollToSection("reserve")}
              className="group h-12 w-full gap-2 bg-gradient-to-r from-primary to-ember text-primary-foreground shadow-lg shadow-ember/20 transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Book Buffet
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => scrollToSection("menu")}
              className="h-12 w-full border-gold/30 bg-background/40 backdrop-blur hover:bg-secondary/60 sm:w-auto"
            >
              View Menu
            </Button>
          </motion.div>

          <motion.p
            variants={item}
            className="text-xs text-muted-foreground/90 sm:text-sm"
          >
            Tonight&apos;s special:{" "}
            <span className="text-gold">charcoal-grilled fish</span> · Kids under 6
            dine free · Free to reserve, no deposit
          </motion.p>

          <motion.dl
            variants={item}
            className="mt-4 grid w-full grid-cols-2 gap-3 border-t border-border/70 pt-6 sm:grid-cols-4"
          >
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="flex items-start gap-2.5">
                <stat.icon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                <div>
                  <dt className="text-sm font-semibold text-foreground">
                    {stat.value}
                  </dt>
                  <dd className="text-xs leading-snug text-muted-foreground">
                    {stat.label}
                  </dd>
                </div>
              </div>
            ))}
          </motion.dl>
        </motion.div>
      </div>
    </section>
  );
}
