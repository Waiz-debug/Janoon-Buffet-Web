import { OfferBadge, PromoAction, PromoCountdown } from "@/components/tribe/PromoBanner";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { SmartImage } from "@/components/tribe/SmartImage";
import { Button } from "@/components/ui/button";
import { usePromotions } from "@/hooks/use-live-db";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, Sparkles, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * The offers board — every live promotion, in one place.
 *
 * The banner strip above it surfaces the newest offer mid-scroll; this is the
 * part a guest reaches by scrolling further, so it holds the whole collection
 * rather than only the newest one. Both read the same `promotions` table, so
 * publishing an entry in the admin panel puts it on the strip *and* on this
 * board with no redeploy and no refresh on the guest's side.
 *
 * This is a guest surface and nothing else. It used to hide a "Manage
 * promotions" link behind an admin check, which put an editing control on the
 * public page for anyone who happened to be signed in as staff — the wrong place
 * for it, and one more thing to reason about on every page that renders this.
 * Promotions are now created and retired in the admin panel's Promotions tab
 * (Admin → Promotions) and nowhere else, so this component is purely a reader:
 * no session, no staff role, no link into the portal.
 */
export function PromotionsSection() {
  const promotions = usePromotions(true);

  // Expiry is checked on the guest's clock, so an offer whose time runs out
  // while the page is open leaves the board instead of sitting there until the
  // next reload. The query already excludes what had expired when it ran.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const live = useMemo(
    () =>
      (promotions ?? []).filter(
        (promo) => !promo.expiresAt || promo.expiresAt > now,
      ),
    [promotions, now],
  );

  // Still loading: say nothing rather than flash an empty board.
  if (promotions === undefined) return null;

  // Nothing running: the board is simply not on the page. There is no call to
  // action here — a guest is not the one publishing offers, and an empty
  // "add the first offer" panel with a link into the admin portal belongs in
  // the admin portal.
  if (live.length === 0) return null;

  return (
    <section id="offers" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Offers & specials"
          title="What's on this week"
          description="Family deals, seasonal platters and the late-night specials running at the terrace — each one live, and each one gone once its clock runs out."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((promo, index) => (
            <motion.article
              key={promo._id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{
                duration: 0.5,
                ease: "easeOut",
                delay: Math.min(index * 0.08, 0.32),
              }}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 transition-colors duration-300 hover:border-gold/40"
            >
              {/* Graphic. An entry without one still gets a themed tile and the
                  same layout, so the board never looks half-built. */}
              <div className="relative aspect-[16/10] overflow-hidden">
                <SmartImage
                  src={promo.imageUrl ?? ""}
                  alt={promo.headline}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent"
                />
                <div className="absolute top-3 left-3">
                  <OfferBadge />
                </div>
                {promo.expiresAt ? (
                  <div className="absolute top-3 right-3">
                    <PromoCountdown expiresAt={promo.expiresAt} />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <p className="flex items-center gap-2 text-[0.68rem] font-medium tracking-[0.18em] text-gold/80 uppercase">
                  <Tag className="size-3.5" aria-hidden />
                  {promo.title}
                </p>
                <h3 className="font-display text-lg leading-snug font-semibold text-balance">
                  {promo.headline}
                </h3>
                {promo.body ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {promo.body}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5 text-gold/70" aria-hidden />
                    {promo.expiresAt
                      ? `Ends ${new Date(promo.expiresAt).toLocaleDateString(
                          "en-PK",
                          { day: "numeric", month: "short" },
                        )}`
                      : "No end date"}
                  </span>
                  {/* The owner can point an offer anywhere; without a link the
                      card still leads to the buffet booking form. */}
                  {promo.linkUrl ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-gold hover:text-gold"
                    >
                      <PromoAction href={promo.linkUrl}>
                        View offer
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </PromoAction>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-gold hover:text-gold"
                    >
                      <a href="#reserve">
                        Book buffet
                        <Sparkles className="size-3.5" aria-hidden />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
