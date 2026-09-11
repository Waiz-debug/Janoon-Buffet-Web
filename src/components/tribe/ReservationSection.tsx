import { ReservationForm } from "@/components/tribe/ReservationForm";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { BOOKING_PROMISES, RESTAURANT } from "@/lib/restaurant";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock, MapPin, Phone } from "lucide-react";
import { Link } from "react-router";

export function ReservationSection() {
  return (
    <section
      id="reserve"
      className="hearth-texture scroll-mt-24 border-y border-border/60 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="flex flex-col gap-8 lg:sticky lg:top-28">
            <SectionHeading
              eyebrow="Reservations"
              title="Reserve your table in advance"
              description="Families reserve ahead so the table is ready on arrival, which matters most on Friday and Saturday evenings. Tell us who is coming and how many seats you need — our floor team confirms every booking by phone."
            />

            <div className="flex flex-col gap-3">
              {BOOKING_PROMISES.map((promise, index) => (
                <motion.div
                  key={promise.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.45, delay: index * 0.07, ease: "easeOut" }}
                  className="rounded-2xl border border-border/70 bg-card/50 p-5"
                >
                  <h3 className="font-display text-base font-semibold">
                    {promise.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {promise.body}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={RESTAURANT.phoneHref}
                className="flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/10 p-4 transition-colors hover:border-gold/40"
              >
                <Phone className="mt-0.5 size-4 text-gold" aria-hidden />
                <span>
                  <span className="block text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Call us
                  </span>
                  <span className="block text-sm font-medium">
                    {RESTAURANT.phoneDisplay}
                  </span>
                </span>
              </a>
              <a
                href={RESTAURANT.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-gold/30"
              >
                <MapPin className="mt-0.5 size-4 text-gold" aria-hidden />
                <span>
                  <span className="block text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Find us
                  </span>
                  <span className="block text-sm font-medium">
                    {RESTAURANT.address}
                  </span>
                </span>
              </a>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/50 p-4 text-sm">
              <Clock className="size-4 shrink-0 text-gold" aria-hidden />
              <span className="text-muted-foreground">
                {RESTAURANT.hours} — breakfast, sehri, lunch and dinner are all
                buffet service.
              </span>
            </div>

            <Link
              to="/manage"
              className="inline-flex items-center gap-2 text-sm text-gold underline-offset-4 hover:underline"
            >
              <ArrowUpRight className="size-4" aria-hidden />
              Already booked? Manage or cancel a reservation
            </Link>
          </div>

          <ReservationForm />
        </div>
      </div>
    </section>
  );
}
