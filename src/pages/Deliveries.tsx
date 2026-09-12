import type { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { DeliveryStatus } from "@/convex/schema";
import { formatRupees } from "@/lib/menu";
import { RESTAURANT } from "@/lib/restaurant";
import { useMutation, useQuery } from "convex/react";
import {
  Bike,
  ChefHat,
  CheckCircle2,
  ClipboardList,
  Flame,
  MapPin,
  PackageCheck,
  Phone,
  Receipt,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type DeliveryOrder = Doc<"deliveryOrders">;

const STATUS_FLOW: Record<
  DeliveryStatus,
  Exclude<DeliveryStatus, "placed"> | null
> = {
  placed: "confirmed",
  confirmed: "cooking",
  cooking: "out-for-delivery",
  "out-for-delivery": "delivered",
  delivered: null,
};

const STATUS_META: Record<
  DeliveryStatus,
  { label: string; className: string }
> = {
  placed: {
    label: "Placed",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  confirmed: {
    label: "Confirmed",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
  cooking: {
    label: "Cooking",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  },
  "out-for-delivery": {
    label: "Out for delivery",
    className: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  },
  delivered: {
    label: "Delivered",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
};

const ADVANCE_LABELS: Partial<Record<DeliveryStatus, string>> = {
  placed: "Confirm order",
  confirmed: "Send to kitchen",
  cooking: "Dispatch rider",
  "out-for-delivery": "Mark delivered",
};

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] uppercase ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function DeliveryCard({
  order,
  onAdvance,
  busy,
}: {
  order: DeliveryOrder;
  onAdvance: (
    order: DeliveryOrder,
    status: Exclude<DeliveryStatus, "placed">,
  ) => void;
  busy: boolean;
}) {
  const next = STATUS_FLOW[order.status];

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
        <StatusBadge status={order.status} />
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
            Delivery: {order.deliveryFee === 0 ? "Free" : formatRupees(order.deliveryFee)}
          </span>
          <span className="font-semibold text-gold">
            {formatRupees(order.total)}
          </span>
        </li>
      </ul>

      {order.notes ? (
        <p className="rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-xs text-muted-foreground">
          “{order.notes}”
        </p>
      ) : null}

      {next ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAdvance(order, next)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-gold/15 disabled:opacity-50"
        >
          {order.status === "cooking" ? (
            <Bike className="size-4" aria-hidden />
          ) : order.status === "out-for-delivery" ? (
            <PackageCheck className="size-4" aria-hidden />
          ) : (
            <ChefHat className="size-4" aria-hidden />
          )}
          {ADVANCE_LABELS[order.status]}
        </button>
      ) : (
        <p className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden />
          Completed
        </p>
      )}
    </article>
  );
}

export default function Deliveries() {
  const orders = useQuery(api.delivery.list);
  const advanceStatus = useMutation(api.delivery.advanceStatus);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Delivery desk · ${RESTAURANT.name}`;
  }, []);

  const handleAdvance = async (
    order: DeliveryOrder,
    status: Exclude<DeliveryStatus, "placed">,
  ) => {
    setBusyId(order._id);
    try {
      await advanceStatus({ id: order._id, status });
      toast.success(`${order.reference} → ${STATUS_META[status].label.toLowerCase()}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.split("\n")[0]
          : "Could not update that order.";
      toast.error("Update failed", { description: message });
    } finally {
      setBusyId(null);
    }
  };

  const active = (orders ?? []).filter((order) => order.status !== "delivered");
  const done = (orders ?? []).filter((order) => order.status === "delivered");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
              <Bike className="size-4" aria-hidden />
            </span>
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
        {orders === undefined ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            Loading the delivery feed…
          </p>
        ) : (
          <>
            <section>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <ClipboardList className="size-5 text-gold" aria-hidden />
                Active orders
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                  {active.length}
                </span>
              </h2>
              {active.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                  No orders in the kitchen right now.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {active.map((order) => (
                    <DeliveryCard
                      key={order._id}
                      order={order}
                      onAdvance={handleAdvance}
                      busy={busyId === order._id}
                    />
                  ))}
                </div>
              )}
            </section>

            {done.length > 0 ? (
              <section className="mt-10">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-muted-foreground">
                  <Receipt className="size-5" aria-hidden />
                  Delivered today
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium">
                    {done.length}
                  </span>
                </h2>
                <div className="mt-4 grid gap-4 opacity-70 md:grid-cols-2 xl:grid-cols-3">
                  {done.slice(0, 6).map((order) => (
                    <DeliveryCard
                      key={order._id}
                      order={order}
                      onAdvance={handleAdvance}
                      busy={busyId === order._id}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
