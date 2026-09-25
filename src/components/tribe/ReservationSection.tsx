import { ReservationForm } from "@/components/tribe/ReservationForm";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { useLiveSite } from "@/hooks/use-live-site";
import { RESTAURANT } from "@/lib/restaurant";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarCheck,
  Crown,
  Phone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { Link } from "react-router";

/**
 * What a private gathering actually gets. Written as the three things a host
 * asks about — the room, the sitting, and who is looking after the table —
 * rather than as features.
 */
const GATHERING_FEATURES = [
  {
    icon: Crown,
    title: "The Shahi Dewan",
    body: "A private chamber curtained off from the courtyard, seating six to eight on a single dastarkhwan.",
  },
  {
    icon: UtensilsCrossed,
    title: "Afternoon Darbar",
    body: "Royal High Tea in two sittings, 03:30–05:00 pm and 05:15–06:45 pm, with all nine counters open to your party.",
  },
  {
    icon: Sparkles,
    title: "Attendant at the table",
    body: "Continuous multi-course hosting, refills and table-side attention from the moment your guests arrive.",
  },
] as const;

/**
 * The Royal Sanctuaire — private dining, and the booking form itself.
 *
 * The form is the same `ReservationForm` the rest of the site uses, so a table
 * booked here is written by the same `create_reservation` call, lands in the
 * same reservations desk, and can be managed or cancelled at `/manage`.
 */
export function ReservationSection() {
  const { content } = useLiveSite();
  const highTeaOffer = content["high-tea-offer"];

  return (
    <section
      id="reserve"
      className="hearth-texture scroll-mt-24 border-y border-border/60 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-gold/20 bg-card/50 p-6 sm:p-10">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="flex flex-col gap-8 lg:sticky lg:top-28">
              <SectionHeading
                eyebrow="Royal sanctuaire"
                title="Host your courtly gathering at Junoon"
                description="From intimate High Tea sittings to lavish celebrations, our team arranges every detail with imperial grace — a curated Shahi spread, a chamber of your own, and an attendant who keeps the dastarkhwan flowing."
              />

              <div className="flex flex-col gap-3">
                {GATHERING_FEATURES.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{
                      duration: 0.45,
                      delay: index * 0.07,
                      ease: "easeOut",
                    }}
                    className="flex gap-4 rounded-2xl border border-border/70 bg-background/40 p-5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                      <feature.icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-display text-base font-semibold">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {feature.body}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {highTeaOffer ? (
                <p className="rounded-2xl border border-gold/25 bg-gold/[0.07] px-4 py-3 text-xs leading-relaxed text-gold/90">
                  {highTeaOffer}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <a
                  href={RESTAURANT.phoneHref}
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-gold"
                >
                  <Phone className="size-3.5 text-gold" aria-hidden />
                  {RESTAURANT.phoneDisplay}
                </a>
                <Link
                  to="/manage"
                  className="inline-flex items-center gap-2 text-gold underline-offset-4 hover:underline"
                >
                  <ArrowUpRight className="size-4" aria-hidden />
                  Already booked? Manage or cancel
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-gold/25 bg-background/50 p-5 sm:p-7">
              <header className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.6rem] tracking-[0.28em] text-gold/80 uppercase">
                    Table reservation
                  </p>
                  <h3 className="mt-1 font-display text-xl font-semibold">
                    Secure your courtly table
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    No deposit — pay per guest at the counter on arrival.
                  </p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                  <CalendarCheck className="size-5" aria-hidden />
                </span>
              </header>
              <ReservationForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
