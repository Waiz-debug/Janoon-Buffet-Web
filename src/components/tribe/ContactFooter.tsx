import { JanoonMark } from "@/components/tribe/JanoonMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGoToSection } from "@/hooks/use-go-to-section";
import { subscribeToDispatch } from "@/lib/db";
import { RESTAURANT, LOCATIONS } from "@/lib/restaurant";
import {
  ArrowRight,
  CalendarCheck,
  Facebook,
  Instagram,
  Loader2,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

/**
 * The dispatch — occasional news from the house, kept in the same database the
 * rest of the site reads.
 *
 * The write goes through `subscribe_to_dispatch` in Postgres: the table itself
 * is closed to the public, so the address is validated and throttled on the
 * server and a duplicate signup quietly updates the existing row instead of
 * failing. See `supabase/newsletter.sql`.
 */
function RoyalDispatch() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !email.trim()) return;
    setSaving(true);
    try {
      await subscribeToDispatch(email);
      setJoined(true);
      setEmail("");
      toast.success("Welcome to the dispatch", {
        description: "We will write when there is something to tell you.",
      });
    } catch (error) {
      toast.error("Could not add you", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Occasional news from the restaurant — new dishes and what the kitchen is
        serving. Your address is only used for this, and you can leave the list
        at any time.
      </p>
      {joined ? (
        <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-gold">
          You are on the list. We will write when there is something to tell
          you.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="royal-dispatch" className="sr-only">
            Email address
          </label>
          <Input
            id="royal-dispatch"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11"
          />
          <Button
            type="submit"
            size="icon"
            disabled={saving}
            aria-label="Join the newsletter"
            className="size-11 shrink-0"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="size-4" aria-hidden />
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * The footer: the house, the address, the booking links and the dispatch,
 * over a brass rule with the contact links beneath it.
 *
 * Everything contactable here is real — the phone, the address and the map all
 * come from `RESTAURANT`, so there is one place to change them.
 */
export function ContactFooter() {
  const goToSection = useGoToSection();

  const socials = [
    { href: RESTAURANT.instagramUrl, label: "Instagram", Icon: Instagram },
    { href: RESTAURANT.facebookUrl, label: "Facebook", Icon: Facebook },
    { href: RESTAURANT.tiktokUrl, label: "TikTok", Icon: Music2 },
    { href: RESTAURANT.whatsappUrl, label: "WhatsApp", Icon: MessageCircle },
  ];

  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* The house */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex items-center gap-3">
              <JanoonMark className="size-11" />
              <div>
                <p className="font-display text-lg font-semibold">
                  {RESTAURANT.name}
                </p>
                <p className="text-[0.6rem] tracking-[0.24em] text-gold/80 uppercase">
                  {RESTAURANT.descriptor}
                </p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              A Pakistani restaurant in {RESTAURANT.cityLine}, serving its own
              menu — live counters and a full priced board, with tables booked
              online and dishes ordered for delivery.
            </p>
            <div className="flex items-center gap-2.5">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
                >
                  <Icon className="size-4" aria-hidden />
                </a>
              ))}
            </div>
          </div>

          {/* Where the house is */}
          <div className="flex flex-col gap-5">
            <h3 className="font-display text-sm font-semibold tracking-[0.18em] text-gold uppercase">
              Find us
            </h3>
            <div className="flex flex-col gap-3 text-sm">
              {/* Straight from `LOCATIONS` — the address and the map pin a
                  guest reads here are the same values the reservation desk and
                  the map section use, so a second house would appear in all
                  three without touching a component. */}
              {LOCATIONS.map((venue, index) => (
                <div
                  key={venue.id}
                  className={index > 0 ? "border-t border-border/60 pt-3" : undefined}
                >
                  <p className="font-medium">{venue.name}</p>
                  <p className="mt-1 text-muted-foreground">{venue.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {venue.note}
                  </p>
                  {venue.phoneDisplay ? (
                    <a
                      href={venue.phoneHref}
                      className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-gold"
                    >
                      <Phone className="size-3.5 text-gold/70" aria-hidden />
                      {venue.phoneDisplay}
                    </a>
                  ) : (
                    <a
                      href={RESTAURANT.phoneHref}
                      className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-gold"
                    >
                      <Phone className="size-3.5 text-gold/70" aria-hidden />
                      Central reservations · {RESTAURANT.phoneDisplay}
                    </a>
                  )}
                  <a
                    href={venue.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-gold underline-offset-4 hover:underline"
                  >
                    <MapPin className="size-3.5" aria-hidden />
                    Open in Google Maps
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* The booking links */}
          <div className="flex flex-col gap-5">
            <h3 className="font-display text-sm font-semibold tracking-[0.18em] text-gold uppercase">
              Book &amp; order
            </h3>
            <div className="flex flex-col gap-3 text-sm">
              <button
                type="button"
                onClick={() => goToSection("reserve")}
                className="inline-flex items-center gap-2 text-left text-muted-foreground transition-colors hover:text-gold"
              >
                <CalendarCheck className="size-3.5 text-gold/70" aria-hidden />
                Reserve a table
              </button>
              <Link
                to="/manage"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-gold"
              >
                <ArrowRight className="size-3.5 text-gold/70" aria-hidden />
                Manage a reservation
              </Link>
              <Link
                to="/order"
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-gold"
              >
                <ArrowRight className="size-3.5 text-gold/70" aria-hidden />
                Order delivery
              </Link>
              <a
                href={RESTAURANT.phoneHref}
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-gold"
              >
                <Phone className="size-3.5 text-gold/70" aria-hidden />
                {RESTAURANT.phoneDisplay}
              </a>
            </div>
          </div>

          {/* The dispatch */}
          <div className="flex flex-col gap-5">
            <h3 className="font-display text-sm font-semibold tracking-[0.18em] text-gold uppercase">
              Newsletter
            </h3>
            <RoyalDispatch />
            <a
              href={RESTAURANT.phoneHref}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-gold"
            >
              <Phone className="size-3.5 text-gold" aria-hidden />
              Call us · {RESTAURANT.phoneDisplay}
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 pb-20 text-xs text-muted-foreground sm:flex-row sm:items-center sm:pb-0">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => goToSection("heritage")}
              className="transition-colors hover:text-foreground"
            >
              Our heritage
            </button>
            <Link
              to="/manage"
              className="transition-colors hover:text-foreground"
            >
              Manage a reservation
            </Link>
            <a
              href={RESTAURANT.phoneHref}
              className="transition-colors hover:text-foreground"
            >
              Call us
            </a>
            <Link
              to="/dashboard"
              className="transition-colors hover:text-foreground"
            >
              Staff &amp; admin
            </Link>
          </nav>
          <p>
            © {new Date().getFullYear()} {RESTAURANT.legalName} · {RESTAURANT.cityLine}
          </p>
        </div>
      </div>
    </footer>
  );
}
