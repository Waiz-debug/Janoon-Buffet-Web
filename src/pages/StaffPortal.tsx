import { DeliveryOrderCard } from "@/components/tribe/DeliveryOrderCard";
import { PortalFrame } from "@/components/tribe/PortalFrame";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { DeliveryStatus } from "@/convex/schema";
import { RESTAURANT } from "@/lib/restaurant";
import { useMutation, useQuery } from "convex/react";
import {
  Bike,
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  Loader2,
  PackageCheck,
  PackageOpen,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type DeliveryOrder = Doc<"deliveryOrders">;

function StatCard({
  icon: Icon,
  value,
  label,
  pulse,
}: {
  icon: typeof Bike;
  value: string;
  label: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold ${
          pulse ? "animate-pulse" : ""
        }`}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl leading-tight font-semibold">
          {value}
        </p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function StaffPortal() {
  const orders = useQuery(api.delivery.list);
  const stats = useQuery(api.delivery.stats);
  const advanceStatus = useMutation(api.delivery.advanceStatus);
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    document.title = `Staff portal · ${RESTAURANT.name}`;
  }, []);

  // Announce incoming orders: the first load seeds the baseline, every new
  // id afterwards is a fresh checkout from the public site.
  useEffect(() => {
    if (!orders) return;
    const ids = orders.map((o) => o._id as unknown as string);
    if (knownIds.current === null) {
      knownIds.current = new Set(ids);
      return;
    }
    const fresh = orders.filter(
      (o) => !knownIds.current!.has(o._id as unknown as string),
    );
    if (fresh.length > 0) {
      const order = fresh[0];
      toast.success("New delivery order received", {
        description: `${order.customerName} · ${order.items.length} ${
          order.items.length === 1 ? "item" : "items"
        }`,
      });
      knownIds.current = new Set(ids);
    }
  }, [orders]);

  const setStatus = async (order: DeliveryOrder, status: DeliveryStatus) => {
    setBusyId(order._id);
    try {
      await advanceStatus({ id: order._id, status });
      const label = status === "confirmed" ? "confirmed" : "delivered";
      toast.success(`${order.reference} → ${label}`);
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

  const all = orders ?? [];
  const active = all.filter((o) => o.status !== "delivered");
  const completed = all.filter((o) => o.status === "delivered");

  return (
    <PortalFrame
      badge="Staff portal"
      title="The floor desk"
      description="Everything the evening team needs while the terrace is full — the live delivery feed, order totals and the bookings desk, in one place."
    >
      {/* Live counters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          value={stats ? String(stats.active) : "—"}
          label="Active orders"
          pulse={(stats?.pending ?? 0) > 0}
        />
        <StatCard
          icon={Timer}
          value={stats ? String(stats.pending) : "—"}
          label="Waiting for confirmation"
        />
        <StatCard
          icon={PackageOpen}
          value={stats ? String(stats.placedToday) : "—"}
          label="Placed today"
        />
        <StatCard
          icon={IndianRupee}
          value={
            stats ? `Rs ${stats.earnedToday.toLocaleString("en-PK")}` : "—"
          }
          label="Collected today"
        />
      </div>

      {/* Dedicated Deliveries section — realtime feed */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold">
            <Bike className="size-5 text-gold" aria-hidden />
            Deliveries
            <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
              {active.length} active
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-xs text-emerald-300"
              aria-hidden
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              live
            </span>
          </h2>
          <Link
            to="/deliveries"
            className="rounded-lg border border-border/70 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Full delivery desk
          </Link>
        </div>

        {orders === undefined ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Connecting to the live order feed…
          </p>
        ) : active.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
            No orders in the kitchen right now. New checkouts from the public
            site appear here instantly.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((order) => (
              <DeliveryOrderCard
                key={order._id}
                order={order}
                onConfirm={(o) => setStatus(o, "confirmed")}
                onDeliver={(o) => setStatus(o, "delivered")}
                busy={busyId === order._id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed — collapsed for reference */}
      {completed.length > 0 ? (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-muted-foreground">
            <PackageCheck className="size-4" aria-hidden />
            Completed
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium">
              {completed.length}
            </span>
          </h2>
          <div className="mt-4 grid gap-4 opacity-70 md:grid-cols-2 xl:grid-cols-3">
            {completed.slice(0, 6).map((order) => (
              <DeliveryOrderCard
                key={order._id}
                order={order}
                onConfirm={() => {}}
                onDeliver={() => {}}
                busy={false}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Reservations desk link */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <CalendarCheck className="size-5 text-gold" aria-hidden />
          Reservations desk
        </h2>
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-6 sm:max-w-md">
          <h3 className="font-display text-base font-semibold">
            Tonight's bookings
          </h3>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
            Confirm arrivals, seat parties and flag no-shows from the
            reservations desk — it signs in with your staff email.
          </p>
          <Link
            to="/dashboard"
            className="w-fit gap-2 rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Open reservations desk →
          </Link>
        </div>
      </section>
    </PortalFrame>
  );
}
