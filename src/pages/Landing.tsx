import { AboutVibe } from "@/components/tribe/AboutVibe";
import { AddOnsStrip } from "@/components/tribe/AddOnsStrip";
import { ContactFooter } from "@/components/tribe/ContactFooter";
import { Hero } from "@/components/tribe/Hero";
import { ImperialCounters } from "@/components/tribe/ImperialCounters";
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
 * The restaurant page, in the order the courtyard is walked: the dastarkhwan,
 * the nine live counters, the priced à la carte board, and the private chamber
 * to book it all from.
 *
 * Everything below the private-dining block is the rest of the house — the
 * heritage story, the offers the owner publishes, pre-orders for the slow
 * cooked dishes, the add-on board, reviews and the map. Each of those renders
 * nothing at all when there is nothing to show, so a house with no live offers
 * and no pre-orders never carries an empty band.
 */
export default function Landing() {
  const goToSection = useGoToSection();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <Hero />
        <ImperialCounters />
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
