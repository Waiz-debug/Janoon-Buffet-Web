import { Button } from "@/components/ui/button";
import { useGoToSection } from "@/hooks/use-go-to-section";
import { RESTAURANT } from "@/lib/restaurant";
import { Clock, Facebook, Flame, Instagram, MapPin, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

type ContactCard = {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  hint?: string;
};

const CONTACT_CARDS: ContactCard[] = [
  {
    icon: Phone,
    label: "Call or WhatsApp",
    value: RESTAURANT.phoneDisplay,
    href: RESTAURANT.phoneHref,
    hint: "Reservations, large family tables, takeaway",
  },
  {
    icon: MapPin,
    label: "Where we are",
    value: RESTAURANT.address,
    href: RESTAURANT.mapsUrl,
    hint: "Open-air terrace with parking alongside",
  },
  {
    icon: Clock,
    label: "Opening hours",
    value: RESTAURANT.hours,
    hint: "Sehri, lunch, dinner and midnight buffet",
  },
];

export function ContactFooter() {
  const goToSection = useGoToSection();

  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        {/* Final call to action */}
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-gold/25 bg-card/50 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold text-balance sm:text-3xl">
              Hungry tonight? The coals are already lit.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Reserve a family table in under a minute — no deposit, no account,
              just your name and arrival time.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => goToSection("reserve")}
            className="h-12 shrink-0 gap-2"
          >
            <Flame className="size-4" aria-hidden />
            Book Buffet
          </Button>
        </div>

        {/* Contact grid */}
        <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
                <Flame className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-display text-lg font-semibold">
                  {RESTAURANT.name}
                </p>
                <p className="text-[0.7rem] tracking-[0.2em] text-gold/80 uppercase">
                  {RESTAURANT.tagline}
                </p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              All-you-can-eat Pakistani BBQ, traditional handi, Lahori fast bites
              and desi desserts — served in the open air beside Natha Singh Wala,
              minutes from DHA Phase 5.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={RESTAURANT.instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex size-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
              >
                <Instagram className="size-4" />
              </a>
              <a
                href={RESTAURANT.facebookUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex size-10 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
              >
                <Facebook className="size-4" />
              </a>
              <a
                href={RESTAURANT.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-gold"
              >
                {RESTAURANT.instagramHandle}
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {CONTACT_CARDS.map((card) => {
              const content = (
                <>
                  <card.icon className="size-4 text-gold" aria-hidden />
                  <span className="mt-3 block text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
                    {card.label}
                  </span>
                  <span className="mt-1 block text-sm font-medium">{card.value}</span>
                  {card.hint ? (
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {card.hint}
                    </span>
                  ) : null}
                </>
              );
              return card.href ? (
                <a
                  key={card.label}
                  href={card.href}
                  target={card.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="rounded-2xl border border-border/70 bg-background/40 p-5 transition-colors hover:border-gold/30"
                >
                  {content}
                </a>
              ) : (
                <div
                  key={card.label}
                  className="rounded-2xl border border-border/70 bg-background/40 p-5"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 pb-20 text-xs text-muted-foreground sm:flex-row sm:items-center sm:pb-0">
          <p>
            © {new Date().getFullYear()} {RESTAURANT.name} · {RESTAURANT.address}
          </p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => goToSection("menu")}
              className="transition-colors hover:text-foreground"
            >
              Menu &amp; Pricing
            </button>
            <Link
              to="/manage"
              className="transition-colors hover:text-foreground"
            >
              Manage a reservation
            </Link>
            <Link
              to="/"
              className="transition-colors hover:text-foreground"
            >
              Staff &amp; admin access
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
