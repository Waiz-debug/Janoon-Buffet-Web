import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/tribe/SmartImage";
import { Embers, HearthScene } from "@/components/tribe/HearthScene";
import { useLiveSite } from "@/hooks/use-live-site";
import { RESTAURANT } from "@/lib/restaurant";
import { scrollToSection } from "@/lib/scroll";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, Clock, Flame } from "lucide-react";

/**
 * The four claims the house leads with. They are deliberately about method
 * rather than about the price: the price is on the High Tea band below and is
 * editable in the admin panel, while these are the reasons it costs what it
 * costs.
 */
const HERO_STATS = [
  { value: "16+ hours", label: "Slow-cooked, never rushed" },
  { value: "100%", label: "Asli desi ghee" },
  { value: "Kashmir", label: "Single-source saffron" },
  { value: "Live coal", label: "Angith roast" },
] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

/**
 * The imperial hero: one photograph of the dastarkhwan, the house name in Urdu
 * over it, and the four claims under a brass rule.
 *
 * The backdrop is the admin-managed `hero` media slot, so the photo the owner
 * uploads in the panel is the photo that greets every guest — no redeploy, and
 * it changes on the site the moment it is saved.
 */
export function Hero() {
  const { heroImage, content } = useLiveSite();
  const backdrop = heroImage ?? RESTAURANT.heroImage;
  const highTeaOffer = content["high-tea-offer"];

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
            Mughlai haute cuisine · Gulberg, Lahore
          </motion.span>

          <motion.p
            variants={item}
            dir="rtl"
            className="font-display text-lg text-gold/85 sm:text-xl"
          >
            جنون · شاہی دسترخوان
          </motion.p>

          <motion.h1
            variants={item}
            className="font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl"
          >
            An Ode to Mughal Gastronomy
          </motion.h1>

          <motion.p
            variants={item}
            className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Immerse yourself in the royal pageantry of a shahi dastarkhwan —
            nihari left to simmer overnight, kebabs roasted over angith coal and
            saffron-perfumed biryani, served on brass and copper in the open air
            of Gulberg, Lahore.
          </motion.p>

          {highTeaOffer ? (
            <motion.span
              variants={item}
              className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-gold/20 bg-card/60 px-4 py-1.5 text-xs text-gold/90 backdrop-blur"
            >
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {highTeaOffer}
            </motion.span>
          ) : null}

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
              Explore royal counters
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
              Reserve dastarkhwan
            </Button>
          </motion.div>
        </motion.div>

        <motion.dl
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
          className="mt-12 grid grid-cols-2 gap-y-6 border-t border-border/60 pt-8 sm:grid-cols-4 sm:divide-x sm:divide-border/60"
        >
          {HERO_STATS.map((stat) => (
            <div
              key={stat.value}
              className="flex flex-col items-center gap-1.5 px-2 text-center"
            >
              <dt className="font-display text-xl font-semibold text-gold sm:text-2xl">
                {stat.value}
              </dt>
              <dd className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                {stat.label}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
