import { usePromotions } from "@/hooks/use-live-db";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Flame, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSED_PREFIX = "tribe-of-taste:promo-dismissed:";

/** Every promotion id this browser has already dismissed. */
function readDismissedIds(): Set<string> {
  const ids = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(DISMISSED_PREFIX)) {
        ids.add(key.slice(DISMISSED_PREFIX.length));
      }
    }
  } catch {
    /* Private browsing — nothing is remembered between visits. */
  }
  return ids;
}

function dismiss(id: string): void {
  try {
    window.localStorage.setItem(DISMISSED_PREFIX + id, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Human-readable countdown from a target timestamp.
 * Returns e.g. "2h 15m left" or null if expired.
 */
function useCountdown(expiresAt: number | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    // No expiry means nothing to count down to, and the render below already
    // returns null — no state needs clearing here.
    if (!expiresAt) return;

    const compute = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setLabel(null);
        return;
      }
      const totalMin = Math.floor(diff / 60_000);
      const days = Math.floor(totalMin / 1440);
      const hours = Math.floor((totalMin % 1440) / 60);
      const mins = totalMin % 60;

      if (days > 0) {
        setLabel(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setLabel(`${hours}h ${mins}m left`);
      } else {
        setLabel(`${mins}m left`);
      }
    };

    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

/** Bold, always-visible countdown pill — part of the offer, not a footnote. */
function PromoCountdown({ expiresAt }: { expiresAt?: number }) {
  const label = useCountdown(expiresAt);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-background/60 px-3 py-1 text-[0.7rem] font-semibold tracking-wide text-gold uppercase backdrop-blur sm:text-xs">
      <Clock className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Small eyebrow chip that flags the strip as an offer. */
function OfferBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[0.65rem] font-bold tracking-[0.2em] text-gold uppercase">
      <Flame className="size-3" aria-hidden />
      Limited offer
    </span>
  );
}

/**
 * Live promotional banners at the top of the public site.
 *
 * Deliberately big: this is the first thing a guest sees, so it renders as a
 * full-width hero strip rather than a thin notice bar. Each active promotion
 * from the admin portal appears as its own dismissible banner, supporting an
 * uploaded banner image, a bold headline, a countdown to the expiry time, and
 * automatic removal once that time passes — the `usePromotions(true)` feed
 * never returns an expired banner in the first place.
 */
export function PromoBanner() {
  const activePromos = usePromotions(true);
  // Read once at mount and then only ever grow: a promotion that arrives while
  // the guest is browsing has not been dismissed yet, so it must show.
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissedIds);

  const handleDismiss = (id: string) => {
    dismiss(id);
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const visible = (activePromos ?? []).filter((p) => !dismissed.has(p._id));

  if (visible.length === 0) return null;

  return (
    <div className="relative z-[60] flex flex-col">
      <AnimatePresence>
        {visible.map((promo) => (
          <motion.div
            key={promo._id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="overflow-hidden border-b border-gold/30 shadow-[0_10px_40px_rgba(212,168,83,0.12)]"
          >
            {promo.imageUrl ? (
              /* Image banner: full-bleed graphic with a large text overlay. */
              <div className="relative">
                <img
                  src={promo.imageUrl}
                  alt={promo.headline}
                  className="h-32 w-full object-cover sm:h-44 lg:h-52"
                  loading="eager"
                />
                {/* Layered overlay keeps the text crisp over any artwork. */}
                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40" />
                <div className="absolute inset-0 flex items-center">
                  <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      <OfferBadge />
                      <p className="font-display text-lg leading-tight font-bold text-balance text-foreground drop-shadow sm:text-2xl lg:text-3xl">
                        {promo.headline}
                      </p>
                      {promo.body ? (
                        <p className="max-w-2xl text-xs leading-relaxed text-foreground/80 sm:text-sm">
                          {promo.body}
                        </p>
                      ) : null}
                      <PromoCountdown expiresAt={promo.expiresAt} />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDismiss(promo._id)}
                      aria-label="Dismiss promotion"
                      className="shrink-0 rounded-lg border border-border/70 bg-background/70 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:border-gold/40 hover:text-foreground"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Text-only banner: rich gold gradient, same prominent scale. */
              <div className="border-gold/25 bg-gradient-to-r from-gold/20 via-gold/10 to-ember/20">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6 sm:py-8">
                  <div className="flex min-w-0 flex-col items-start gap-2">
                    <OfferBadge />
                    <p className="font-display text-lg leading-tight font-bold text-balance text-foreground sm:text-2xl lg:text-3xl">
                      {promo.headline}
                    </p>
                    {promo.body ? (
                      <p className="max-w-2xl text-xs leading-relaxed text-foreground/80 sm:text-sm">
                        {promo.body}
                      </p>
                    ) : null}
                    <PromoCountdown expiresAt={promo.expiresAt} />
                  </div>
                  <span
                    className="hidden shrink-0 text-gold/60 sm:block"
                    aria-hidden
                  >
                    <Sparkles className="size-8" />
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDismiss(promo._id)}
                    aria-label="Dismiss promotion"
                    className="shrink-0 rounded-lg border border-border/70 bg-background/60 p-1.5 text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
