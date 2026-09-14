import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Megaphone, X } from "lucide-react";
import { useQuery } from "convex/react";
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

const ACCENT_CLASSES: Record<string, string> = {
  gold: "border-gold/20 bg-gradient-to-r from-gold/10 via-gold/[0.06] to-ember/10",
  emerald: "border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/[0.06] to-emerald-500/5",
  ember: "border-red-500/20 bg-gradient-to-r from-red-500/10 via-red-500/[0.06] to-red-500/5",
};

const ACCENT_ICON: Record<string, string> = {
  gold: "text-gold",
  emerald: "text-emerald-400",
  ember: "text-red-400",
};

/**
 * Live promotional banners at the top of the public site. Each active
 * promotion from the admin portal appears as its own dismissible strip.
 * Dismissal is per-promotion via localStorage so the user can close one
 * without losing the others.
 */
export function PromoBanner() {
  const activePromos = useQuery(api.promotions.active);
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
        {visible.map((promo) => {
          const accent = promo.accent ?? "gold";
          return (
            <motion.div
              key={promo._id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`overflow-hidden border-b ${ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.gold}`}
            >
              <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2.5 text-center sm:px-6">
                {accent === "emerald" ? (
                  <Megaphone
                    className={`size-3.5 shrink-0 animate-pulse ${ACCENT_ICON[accent]}`}
                    aria-hidden
                  />
                ) : (
                  <Flame
                    className={`size-3.5 shrink-0 animate-pulse ${ACCENT_ICON[accent]}`}
                    aria-hidden
                  />
                )}
                <p className="text-xs font-medium text-foreground sm:text-sm">
                  <span className="font-semibold">{promo.headline}</span>
                  {promo.body ? <> — {promo.body}</> : null}
                </p>
                <button
                  type="button"
                  onClick={() => handleDismiss(promo._id)}
                  aria-label="Dismiss promotion"
                  className="ml-2 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
