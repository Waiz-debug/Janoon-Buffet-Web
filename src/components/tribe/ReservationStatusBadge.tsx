import type { ReservationStatus } from "@/lib/db";
import { cn } from "@/lib/utils";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  seated: "Seated",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<ReservationStatus, string> = {
  pending: "border-gold/40 bg-gold/15 text-gold",
  confirmed: "border-gold/30 bg-gold/15 text-gold",
  seated: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  cancelled: "border-rose-500/30 bg-rose-500/15 text-rose-300",
};

export function ReservationStatusBadge({
  status,
  className,
}: {
  status: ReservationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[0.7rem] font-medium tracking-wide uppercase",
        STATUS_STYLES[status],
        className,
      )}
    >
      {RESERVATION_STATUS_LABELS[status]}
    </span>
  );
}
