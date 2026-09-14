import { api } from "@/convex/_generated/api";
import { formatRupees } from "@/lib/menu";
import { useQuery } from "convex/react";
import { CheckCircle2, Clock, Loader2, MapPin, Phone } from "lucide-react";

const HIDE_DELIVERED_MS = 30 * 60 * 1000;

/**
 * Live order tracker shown to the customer after checkout. Subscribes to the
 * public `listVisible` feed and filters client-side for the 30-minute auto-hide
 * on the user's phone (the backend `listVisible` already handles this, but this
 * adds a client-side double-check for instant responsiveness).
 */
export function OrderTracker({
  customerPhone,
}: {
  customerPhone?: string;
}) {
  const allOrders = useQuery(api.delivery.listVisible);

  if (allOrders === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Connecting to live order feed…
      </div>
    );
  }

  const now = Date.now();
  const orders = allOrders
    .filter((o) => {
      if (customerPhone && o.phone !== customerPhone.replace(/\D/g, ""))
        return false;
      if (o.status === "delivered" && o.deliveredAt) {
        if (now - o.deliveredAt > HIDE_DELIVERED_MS) return false;
      }
      return true;
    })
    .slice(0, 5);

  if (orders.length === 0) return null;

  return (
    <section className="mt-8">
      <h3 className="font-display text-lg font-semibold">Your orders</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Live status — delivered orders hide automatically after 30 minutes.
      </p>
      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <article
            key={order._id}
            className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs tracking-[0.14em] text-gold">
                {order.reference}
              </span>
              <StatusBadge status={order.status} />
            </div>

            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Phone className="size-3.5 text-gold" aria-hidden />
                {order.phone}
              </p>
              <p className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 size-3.5 shrink-0 text-gold"
                  aria-hidden
                />
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
                  {order.deliveryFee === 0
                    ? "Free"
                    : formatRupees(order.deliveryFee)}
                </span>
                <span className="font-semibold text-gold">
                  {formatRupees(order.total)}
                </span>
              </li>
            </ul>

            {order.status === "delivered" && order.deliveredAt ? (
              <p className="text-xs text-emerald-400">
                Delivered — this tracking hides automatically in{" "}
                {Math.max(
                  0,
                  Math.round(
                    (HIDE_DELIVERED_MS - (now - order.deliveredAt)) / 60_000,
                  ),
                )}{" "}
                minutes.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] text-emerald-300 uppercase">
        <CheckCircle2 className="size-3" aria-hidden />
        Delivered
      </span>
    );
  }
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] text-gold uppercase">
        <Clock className="size-3" aria-hidden />
        Confirmed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] text-amber-300 uppercase">
      <Clock className="size-3" aria-hidden />
      Pending
    </span>
  );
}
