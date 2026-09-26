import { AboutVibe } from "@/components/tribe/AboutVibe";
import { AddOnsStrip } from "@/components/tribe/AddOnsStrip";
import { ContactFooter } from "@/components/tribe/ContactFooter";
import { Hero } from "@/components/tribe/Hero";
import { LiveCounters } from "@/components/tribe/LiveCounters";
import { LocationMap } from "@/components/tribe/LocationMap";
import { MenuSection } from "@/components/tribe/MenuSection";
import { PreOrderSection } from "@/components/tribe/PreOrderSection";
import { PromoBanner } from "@/components/tribe/PromoBanner";
import { PromotionsSection } from "@/components/tribe/PromotionsSection";
import { ReservationSection } from "@/components/tribe/ReservationSection";
import { SiteHeader } from "@/components/tribe/SiteHeader";
import { SocialProof } from "@/components/tribe/SocialProof";
import { Button } from "@/components/ui/button";
import { useGoToSection } from "@/hooks/use-go-to-section";
import { RESTAURANT } from "@/lib/restaurant";
import { CalendarCheck, Phone } from "lucide-react";

/**
 * The restaurant page, in the order it is read: the counters the menu is filed
 * under, the priced à la carte board, the reservation form, the note about the
 * house, and then whatever the restaurant has published — offers, pre-orders,
 * add-ons and gallery — over the address and the map.
 *
 * Everything below the reservation block renders nothing at all when there is
 * nothing to show, so a restaurant with no live offers, no pre-orders and no
 * gallery photos never carries an empty band. The offer strip and the offers
 * board are the clearest case: the seeded demo promotion is filtered out in
 * `fetchPromotions()`, so nothing appears until the house publishes a real one.
 */
export default function Landing() {
  const goToSection = useGoToSection();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <Hero />
        <LiveCounters />
        <MenuSection />
        <ReservationSection />

        <AboutVibe />

        <PromoBanner />
        <PromotionsSection />
        <PreOrderSection />
        <AddOnsStrip />
        <SocialProof />

        <div className="py-16 sm:py-20">
          <LocationMap />
        </div>
      </main>

      <ContactFooter />

      {/* Mobile-first booking bar — the primary CTA never leaves the screen */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl sm:hidden">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="h-11 flex-1 gap-2 text-[0.7rem] tracking-[0.16em] uppercase"
            onClick={() => goToSection("reserve")}
          >
            <CalendarCheck className="size-4" aria-hidden />
            Reserve a Table
          </Button>
          <Button asChild variant="outline" className="h-11 shrink-0 gap-2">
            <a href={RESTAURANT.phoneHref} aria-label="Call the restaurant">
              <Phone className="size-4" aria-hidden />
              Call
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
