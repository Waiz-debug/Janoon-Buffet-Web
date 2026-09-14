import { Button } from "@/components/ui/button";
import { RESTAURANT } from "@/lib/restaurant";
import {
  Car,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";

const MAPS_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3401.2!2d74.378!3d31.469!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3919011a98e0b1b1%3A0x42e5b3b3b3b3b3b3!2sNatha%20Singh%20Wala%2C%20DHA%20Phase%205%2C%20Lahore!5e0!3m2!1sen!2spk!4v1";

const INFO_ITEMS = [
  {
    icon: MapPin,
    title: "Find us",
    lines: [
      "Natha Singh Wala, near DHA Phase 5",
      "Lahore, Punjab, Pakistan",
    ],
    action: {
      label: "Open in Google Maps",
      href: RESTAURANT.mapsUrl,
    },
  },
  {
    icon: Car,
    title: "Parking",
    lines: [
      "Free parking alongside the open-air terrace",
      "Additional street parking on the main road",
    ],
  },
  {
    icon: Phone,
    title: "Contact",
    lines: [RESTAURANT.phoneDisplay, "WhatsApp available on the same number"],
    action: {
      label: "Call now",
      href: RESTAURANT.phoneHref,
    },
  },
  {
    icon: Clock,
    title: "Hours",
    lines: ["Open 24 hours, every day", "Sehri · Lunch · Dinner · Late night"],
  },
] as const;

export function LocationMap() {
  return (
    <section id="visit" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1.3fr_1fr] lg:gap-10">
          {/* Map embed */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/40">
            <iframe
              title="Tribe of Taste location on Google Maps"
              src={MAPS_EMBED_URL}
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[320px] w-full sm:h-[400px]"
            />
            {/* Overlay CTA */}
            <a
              href={RESTAURANT.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/90 px-4 py-3 text-sm font-medium backdrop-blur-xl transition-colors hover:border-gold/40 hover:text-gold sm:left-auto sm:right-4 sm:w-fit"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Get directions
            </a>
          </div>

          {/* Info cards */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
                <MapPin className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-display text-lg font-semibold">
                  Visit us in DHA Phase 5
                </p>
                <p className="text-xs text-muted-foreground">
                  Open-air terrace with parking alongside
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {INFO_ITEMS.map((item) => {
                const action = "action" in item ? item.action : undefined;
                const content = (
                  <>
                    <item.icon
                      className="size-4 shrink-0 text-gold"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.1em] uppercase">
                        {item.title}
                      </p>
                      {item.lines.map((line) => (
                        <p
                          key={line}
                          className="mt-0.5 text-sm text-muted-foreground"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </>
                );

                return action ? (
                  <a
                    key={item.title}
                    href={action.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/40 p-4 transition-colors hover:border-gold/30"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/40 p-4"
                  >
                    {content}
                  </div>
                );
              })}
            </div>

            {/* Trust signal */}
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400" aria-hidden />
              <p className="text-xs text-emerald-300">
                {RESTAURANT.rating}/5 from {RESTAURANT.reviewCount}+ Google
                reviews · Verified restaurant listing
              </p>
            </div>

            <Button asChild variant="outline" className="w-fit gap-2">
              <a href={RESTAURANT.phoneHref}>
                <Phone className="size-3.5" aria-hidden />
                Questions? Call {RESTAURANT.phoneDisplay}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
