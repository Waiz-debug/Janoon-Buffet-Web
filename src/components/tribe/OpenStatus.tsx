import { RESTAURANT } from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

/**
 * Live open/closed indicator, read against the house's published service
 * window: the dastarkhwan runs 12:00 pm to 12:00 am every day, so the kitchen is
 * closed through the morning.
 *
 * This used to be a hardcoded `true` with the label "Open now · 24/7", which was
 * a claim the restaurant does not make — a guest reading it at 9 am on their way
 * over would have found the doors shut. The hours come from `RESTAURANT`, so
 * correcting them corrects this badge too.
 */
const OPEN_HOUR = 12;
const CLOSE_HOUR = 24;

export function OpenStatus({ className }: { className?: string }) {
  const hour = new Date().getHours();
  const isOpen = hour >= OPEN_HOUR && hour < CLOSE_HOUR;

  return (
    <div
      title={`Service hours: ${RESTAURANT.hours}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        isOpen
          ? "border-gold/30 bg-gold/10 text-gold"
          : "border-border/70 bg-card/60 text-muted-foreground",
        className,
      )}
    >
      <span className="relative flex size-2">
        {isOpen ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            isOpen ? "bg-gold" : "bg-muted-foreground/50",
          )}
        />
      </span>
      <Clock className="size-3" aria-hidden />
      {isOpen ? "Open now · till 12 am" : "Closed · opens 12 pm"}
    </div>
  );
}
