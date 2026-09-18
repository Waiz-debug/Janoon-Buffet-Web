import { OfferBadge, PromoCountdown } from "@/components/tribe/PromoBanner";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { SmartImage } from "@/components/tribe/SmartImage";
import { Button } from "@/components/ui/button";
import { usePromotions } from "@/hooks/use-live-db";
import { useStaffAuth } from "@/hooks/use-staff-auth";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, Sparkles, Tag, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

/** Where the admin panel's promotions manager lives. */
const MANAGE_HREF = "/admin?tab=promos";

/**
 * The offers board — every live promotion, in one place.
 *
 * The banner at the very top is for the offer that cannot be missed; this is
 * the part a guest reaches by scrolling, so it holds the whole collection rather
 * than only the newest one. Both read the same `promotions` table, so publishing
 * an entry in the admin panel puts it on the strip *and* on this board with no
 * redeploy and no refresh on the guest's side.
 *
 * Nothing here is an admin surface: the manage link only appears for an account
 * whose `staff_members` row says `role = 'admin'`, and the route behind it is
 * guarded by the database as well.
 */
export function PromotionsSection() {
  const promotions = usePromotions(true);
  const { session } = useStaffAuth();
  const isAdmin = session?.role === "admin";

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

  // Nothing published, and no reason for a guest to know that. The owner does
  // get told, with a way straight to the manager.
  if (live.length === 0) {
    if (!isAdmin) return null;
    return (
      <section id="offers" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Offers & specials"
            title="No offers are running right now"
            description="Promotions you publish appear on this board and on the banner at the top of the page. Each one can carry its own graphic and an expiry time that removes it automatically."
          />
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-card/40 p-6">
            <span className="flex size-11 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
              <Ticket className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold">
                Add the first offer
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a banner graphic, write the headline, set the end time.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="gap-2 border-gold/30 hover:border-gold/60"
            >
              <Link to={MANAGE_HREF}>
                Manage promotions
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="offers" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Offers & specials"
            title="What's on this week"
            description="Family deals, seasonal platters and the late-night specials running at the terrace — each one live, and each one gone once its clock runs out."
          />

          {isAdmin ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2 border-gold/30 hover:border-gold/60"
              >
                <Link to={MANAGE_HREF}>
                  Manage promotions
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </motion.div>
          ) : null}
        </div>

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
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
