import { JanoonMark } from "@/components/tribe/JanoonMark";
import { RecordsDesk } from "@/components/tribe/RecordsDesk";
import { RESTAURANT } from "@/lib/restaurant";
import { Phone } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

export default function Deliveries() {
  useEffect(() => {
    document.title = `Delivery desk · ${RESTAURANT.name}`;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <JanoonMark className="size-10" />
            <div>
              <p className="font-display text-lg font-semibold">Delivery desk</p>
              <p className="text-[0.65rem] tracking-[0.2em] text-gold/80 uppercase">
                {RESTAURANT.name}
              </p>
            </div>
          </div>
          <Link
            to="/staff"
            className="rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Back to portals
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-semibold">
            Online deliveries
          </h1>
          <p className="text-sm text-muted-foreground">
            Today&apos;s live orders and the complete searchable delivery
            history — filter by year, month or an exact date.
          </p>
        </div>

        <RecordsDesk kinds={["deliveries"]} />

        <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Phone className="size-3.5 text-gold" aria-hidden />
          Customer questions? Call the floor on {RESTAURANT.phoneDisplay}.
        </p>
      </main>
    </div>
  );
}
