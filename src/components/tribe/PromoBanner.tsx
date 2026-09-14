import { AnimatePresence, motion } from "framer-motion";
import { Flame, X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "tribe-of-taste:promo-banner-dismissed";

/**
 * Dismissible promotional banner pinned to the top of the public site.
 * Shows seasonal offers, live BBQ nights, or family package deals.
 * Dismissal persists in localStorage so it doesn't reappear on reload.
 */
export function PromoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // Private browsing — show the banner
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden border-b border-gold/20 bg-gradient-to-r from-gold/10 via-gold/[0.06] to-ember/10"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2.5 text-center sm:px-6">
            <Flame
              className="size-3.5 shrink-0 animate-pulse text-gold"
              aria-hidden
            />
            <p className="text-xs font-medium text-foreground sm:text-sm">
              <span className="font-semibold text-gold">
                Eid Special Buffet
              </span>{" "}
              — Family of 4 eats for Rs 7,500 this weekend. Book your table
              now!
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss promotion"
              className="ml-2 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
