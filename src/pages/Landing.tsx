import { AboutVibe } from "@/components/tribe/AboutVibe";
import { ContactFooter } from "@/components/tribe/ContactFooter";
import { Hero } from "@/components/tribe/Hero";
import { LocationMap } from "@/components/tribe/LocationMap";
import { MenuSection } from "@/components/tribe/MenuSection";
import { PreOrderSection } from "@/components/tribe/PreOrderSection";
import { PromoBanner } from "@/components/tribe/PromoBanner";
import { ReservationSection } from "@/components/tribe/ReservationSection";
import { SiteHeader } from "@/components/tribe/SiteHeader";
import { SocialProof } from "@/components/tribe/SocialProof";
import { AddOnsStrip } from "@/components/tribe/AddOnsStrip";
import { Button } from "@/components/ui/button";
import { useGoToSection } from "@/hooks/use-go-to-section";
import { RESTAURANT } from "@/lib/restaurant";
import { CalendarCheck, Phone } from "lucide-react"

export default function Landing() {
  const goToSection = useGoToSection();

  return (
    <div className="min-h-screen bg-background">
      <PromoBanner />
      <SiteHeader />

      <main className="pb-20 sm:pb-0">
        <Hero />
        <AboutVibe />
        <MenuSection />
        <AddOnsStrip />
        <PreOrderSection />
        <SocialProof />
        <div className="py-16 sm:py-20">
          <LocationMap />
        </div>
        <ReservationSection />
      </main>

      <ContactFooter />

      {/* Mobile-first booking bar — the primary CTA never leaves the screen */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl sm:hidden">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="h-11 flex-1 gap-2"
            onClick={() => goToSection("reserve")}
          >
            <CalendarCheck className="size-4" aria-hidden />
            Book Buffet
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
