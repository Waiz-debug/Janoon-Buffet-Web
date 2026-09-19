import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

/**
 * Live open/closed indicator. Janoon LHR Gulberg is 24/7, so this always shows
 * "Open now" with a pulsing green dot. Built as a standalone component so
 * it can be dropped into the header or anywhere else, and easily extended
 * if hours change in the future.
 */
export function OpenStatus({ className }: { className?: string }) {
  // Janoon LHR Gulberg is open 24 hours — no closing logic needed.
  const isOpen = true;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        isOpen
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-border/70 bg-card/60 text-muted-foreground",
        className,
      )}
    >
      <span className="relative flex size-2">
        {isOpen ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            isOpen ? "bg-emerald-500" : "bg-muted-foreground/50",
          )}
        />
      </span>
      <Clock className="size-3" aria-hidden />
      {isOpen ? "Open now · 24/7" : "Closed"}
    </div>
  );
}
