import { ReferenceCode } from "@/components/tribe/ReferenceCode";
import { useDeliveryOrderLookup } from "@/hooks/use-live-db";
import { formatRupees } from "@/lib/menu";
import { CheckCircle2, Clock, Loader2, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";

const HIDE_DELIVERED_MS = 30 * 60 * 1000;

/**
 * Live tracker for the order that was just placed.
 *
 * It looks up exactly one order, by reference and the phone it was placed with,
 * and renders nothing until both are known. An earlier version subscribed to a
 * public feed of every delivery and filtered it in the browser — which meant a
 * guest's page showed other customers' names, phone numbers and home addresses
 * whenever the phone field happened to be empty, the state the page loads in.
 * The check now happens in the query, so the browser never receives anyone
 * else's order at all.
 */
export function OrderTracker({
  reference,
  phone,
}: {
  reference: string;
  phone: string;
}) {
  const order = useDeliveryOrderLookup(reference, phone);

  // A delivered order retires itself on the clock and its countdown has to
  // keep counting, so the component reads the time from state rather than
  // calling Date.now() during render. One ticker covers both.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (order === undefined) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Connecting to the live order feed…
      </div>
    );
  }

  // No order for this reference and phone — nothing to show.
  if (!order) return null;

  const deliveredAgo = order.deliveredAt ? now - order.deliveredAt : 0;
  // Delivered long enough ago: the tracking retires itself.
  if (order.status === "delivered" && deliveredAgo > HIDE_DELIVERED_MS) {
    return null;
  }

  return (
    <section className="mt-10 w-full">
      <h3 className="font-display text-lg font-semibold">Your order</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Live status — delivery tracking hides itself 30 minutes after delivery.
      </p>

      <article className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReferenceCode code={order.reference} size="sm" />
          <StatusBadge status={order.status} />
        </div>

        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Phone className="size-3.5 text-gold" aria-hidden />
            {order.phone}
          </p>
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
            <span className="font-semibold text-gold">
              {formatRupees(order.total)}
            </span>
          </li>
        </ul>

        {order.status === "delivered" && order.deliveredAt ? (
          <p className="text-xs text-gold">
            Delivered — this tracking hides automatically in{" "}
            {Math.max(
              0,
              Math.round((HIDE_DELIVERED_MS - deliveredAgo) / 60_000),
            )}{" "}
            minutes.
          </p>
        ) : null}
      </article>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] text-gold uppercase">
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
