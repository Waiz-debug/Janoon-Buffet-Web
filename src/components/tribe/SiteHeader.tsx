import { JanoonMark } from "@/components/tribe/JanoonMark";
import { useGoToSection } from "@/hooks/use-go-to-section";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { RESTAURANT } from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, Menu, Phone, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

/**
 * The public nav, in the order the page is read: the counters first, then the
 * priced board, the gallery, the reservation form and the note about the
 * restaurant.
 *
 * Every destination is a section that exists on the restaurant page, and
 * `useGoToSection` carries a guest there from anywhere in the app. Nothing is
 * linked that is not rendered — a nav entry pointing at a section the page no
 * longer has would scroll a guest into empty space.
 *
 * The labels themselves follow fine-dining house style: one or two words each,
 * never a sentence, and no word that merely repeats the section heading the
 * guest is about to land on. "À la carte" *is* the menu — "À la carte menu"
 * said it twice and was the only entry long enough to throw the row out of
 * alignment. Each label is written title case and set in caps by the styles
 * below, so the accented À keeps its diacritic instead of being flattened to
 * "A la carte".
 */
const NAV_LINKS = [
  { label: "Counters", id: "counters" },
  { label: "À la carte", id: "menu" },
  { label: "Gallery", id: "gallery" },
  { label: "Reservations", id: "reserve" },
  { label: "About", id: "heritage" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { itemCount, openCart } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goToSection = useGoToSection();
  const goTo = (id: string) => {
    setOpen(false);
    goToSection(id);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/70 bg-background/85 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <button
          type="button"
          onClick={() => goTo("top")}
          className="flex items-center gap-3 text-left"
        >
          <JanoonMark className="size-10" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.1rem] font-semibold tracking-[0.12em]">
              {RESTAURANT.name}
            </span>
            <span className="mt-1 text-[0.55rem] tracking-[0.24em] text-gold/80 uppercase">
              {RESTAURANT.descriptor}
            </span>
          </span>
        </button>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => goTo(link.id)}
              className="rounded-lg px-3 py-2 text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open delivery cart (${itemCount} items)`}
            className="relative flex size-10 items-center justify-center rounded-xl border border-border/70 text-foreground transition-colors hover:border-gold/40"
          >
            <ShoppingBag className="size-4" aria-hidden />
            {itemCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] font-semibold text-background">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            ) : null}
          </button>
          <a
            href={RESTAURANT.phoneHref}
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground xl:inline-flex"
          >
            <Phone className="size-3.5" aria-hidden />
            {RESTAURANT.phoneDisplay}
          </a>
          <Button
            type="button"
            onClick={() => goTo("reserve")}
            className="hidden h-11 gap-2 bg-primary px-5 text-[0.7rem] font-semibold tracking-[0.16em] text-primary-foreground uppercase shadow-lg shadow-black/25 hover:bg-primary/90 sm:inline-flex"
          >
            <CalendarCheck className="size-4" aria-hidden />
            Reserve a Table
          </Button>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex size-10 items-center justify-center rounded-xl border border-border/70 text-foreground lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-border/70 bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => goTo(link.id)}
                  className="rounded-lg px-3 py-3 text-left text-[0.75rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  {link.label}
                </button>
              ))}
              <div className="mt-2 flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => goTo("reserve")}
                  className="h-11 w-full gap-2"
                >
                  <CalendarCheck className="size-4" aria-hidden />
                  Reserve a Table
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    openCart();
                  }}
                  className="w-full gap-2"
                >
                  <ShoppingBag className="size-4" aria-hidden />
                  Delivery cart{itemCount > 0 ? ` (${itemCount})` : ""}
                </Button>
                <Button asChild variant="outline" className="w-full gap-2">
                  <a href={RESTAURANT.phoneHref}>
                    <Phone className="size-4" aria-hidden />
                    Call {RESTAURANT.phoneDisplay}
                  </a>
                </Button>
                <Link
                  to="/manage"
                  className="w-full rounded-xl border border-border/70 px-4 py-2.5 text-center text-sm text-muted-foreground transition-colors hover:border-gold/30 hover:text-foreground"
                >
                  Manage a reservation
                </Link>
                <Link
                  to="/dashboard"
                  className="px-1 pt-1 text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Staff sign in
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
