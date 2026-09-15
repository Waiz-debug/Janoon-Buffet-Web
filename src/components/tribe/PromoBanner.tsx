import { usePromotions } from "@/hooks/use-live-db";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Flame, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSED_PREFIX = "tribe-of-taste:promo-dismissed:";

function isDismissed(id: string): boolean {
  try {
    return !!window.localStorage.getItem(DISMISSED_PREFIX + id);
  } catch {
    return false;
  }
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
    if (!expiresAt) {
      setLabel(null);
      return;
    }

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

function PromoCountdown({ expiresAt }: { expiresAt?: number }) {
  const label = useCountdown(expiresAt);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-gold/80">
      <Clock className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Live promotional banners at the top of the public site. Each active
 * promotion from the admin portal appears as its own dismissible strip.
 * Supports banner images, expiry dates, and live countdown timers.
 * Auto-removal of expired promotions is handled in the data layer: the
 * `usePromotions(true)` feed never returns an expired banner.
 */
export function PromoBanner() {
  const activePromos = usePromotions(true);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!activePromos) return;
    const d = new Set<string>();
    for (const p of activePromos) {
      if (isDismissed(p._id)) d.add(p._id);
    }
    setDismissed(d);
  }, [activePromos]);

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
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden border-b border-gold/20"
          >
            {promo.imageUrl ? (
              /* Image banner: full-bleed graphic with text overlay */
              <div className="relative">
                <img
                  src={promo.imageUrl}
                  alt={promo.headline}
                  className="h-16 w-full object-cover sm:h-20"
                  loading="eager"
                />
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-0 flex items-center justify-center gap-3 px-4 text-center sm:px-6">
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-xs font-bold text-white drop-shadow sm:text-sm">
                      {promo.headline}
                    </p>
                    {promo.body && (
                      <p className="text-[0.65rem] text-white/70 sm:text-xs">
                        {promo.body}
                      </p>
                    )}
                    <PromoCountdown expiresAt={promo.expiresAt} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDismiss(promo._id)}
                    aria-label="Dismiss promotion"
                    className="ml-2 shrink-0 rounded-lg p-1 text-white/60 transition-colors hover:text-white"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ) : (
              /* Text-only banner (gold gradient fallback) */
              <div className="border-gold/20 bg-gradient-to-r from-gold/10 via-gold/[0.06] to-ember/10">
                <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2.5 text-center sm:px-6">
                  <Flame
                    className="size-3.5 shrink-0 animate-pulse text-gold"
                    aria-hidden
                  />
                  <div className="flex flex-col items-center gap-0.5">
                    <p className="text-xs font-medium text-foreground sm:text-sm">
                      <span className="font-semibold">{promo.headline}</span>
                      {promo.body ? <> — {promo.body}</> : null}
                    </p>
                    <PromoCountdown expiresAt={promo.expiresAt} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDismiss(promo._id)}
                    aria-label="Dismiss promotion"
                    className="ml-2 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden />
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
