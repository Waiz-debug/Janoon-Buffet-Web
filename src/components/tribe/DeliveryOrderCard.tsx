import type { Doc } from "@/convex/_generated/dataModel";
import type { DeliveryStatus } from "@/convex/schema";
import { formatRupees } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { CheckCircle2, MapPin, PackageCheck, Phone } from "lucide-react";

type DeliveryOrder = Doc<"deliveryOrders">;

export function DeliveryOrderCard({
  order,
  onConfirm,
  onDeliver,
  busy,
}: {
  order: DeliveryOrder;
  onConfirm: (order: DeliveryOrder) => void;
  onDeliver: (order: DeliveryOrder) => void;
  busy: boolean;
}) {
  const isPlaced = order.status === "placed";
  const isConfirmed = order.status === "confirmed";
  const isDelivered = order.status === "delivered";

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.14em] text-gold">
            {order.reference}
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {order.customerName}
          </p>
        </div>
        {isDelivered ? (
          <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] text-emerald-300 uppercase">
            Completed
          </span>
        ) : isConfirmed ? (
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] text-gold uppercase">
            Confirmed
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] text-amber-300 uppercase">
            Pending
          </span>
        )}
      </header>

      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <a
          href={`tel:+92${order.phone.replace(/^0/, "")}`}
          className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
        >
          <Phone className="size-3.5 text-gold" aria-hidden />
          {order.phone}
        </a>
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
          <span>
            {order.address}, {order.area}
          </span>
        </p>
      </div>

      <ul className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/40 p-3 text-sm">
        {order.items.map((line) => (
          <li key={line.slug} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {line.count} × {line.name}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatRupees(line.unitPrice * line.count)}
            </span>
          </li>
        ))}
        <li className="flex justify-between gap-3 border-t border-border/60 pt-1.5 text-xs">
          <span className="text-muted-foreground">
            Delivery:{" "}
            {order.deliveryFee === 0 ? "Free" : formatRupees(order.deliveryFee)}
          </span>
          <span className="font-semibold text-gold">{formatRupees(order.total)}</span>
        </li>
      </ul>

      {order.notes ? (
        <p className="rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-xs text-muted-foreground">
          "{order.notes}"
        </p>
      ) : null}

      {/* Two-step action buttons */}
      {!isDelivered && (
        <div className="flex gap-2">
          {isPlaced && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(order)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-50",
              )}
            >
              <CheckCircle2 className="size-4" aria-hidden />
              Confirm Order
            </button>
          )}
          {isConfirmed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDeliver(order)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50",
              )}
            >
              <PackageCheck className="size-4" aria-hidden />
              Mark Delivered
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/** Compact variant for dense boards — details collapsed to one line each. */
export function DeliveryOrderRow({ order }: { order: DeliveryOrder }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {order.customerName} · {order.items.length}{" "}
          {order.items.length === 1 ? "item" : "items"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {order.reference} · {order.area}
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-gold">
        {formatRupees(order.total)}
      </span>
    </div>
  );
}
