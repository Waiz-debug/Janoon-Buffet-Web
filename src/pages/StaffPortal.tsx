import { SetupNotice } from "@/components/admin/SetupNotice";
import { AccountSettings } from "@/components/staff/AccountSettings";
import { DeliveryOrderCard } from "@/components/tribe/DeliveryOrderCard";
import { PortalFrame } from "@/components/tribe/PortalFrame";
import { RecordsDesk } from "@/components/tribe/RecordsDesk";
import {
  useDeliveryOrders,
  usePreorders,
  useReservations,
} from "@/hooks/use-live-db";
import {
  advanceDeliveryStatus,
  type DeliveryOrder,
  type DeliveryStatus,
} from "@/lib/db";
import { RESTAURANT, formatDayLong, formatTime } from "@/lib/restaurant";
import {
  Bike,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  IndianRupee,
  Loader2,
  PackageCheck,
  PackageOpen,
  Timer,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

/** Play a short ascending two-tone chime via the Web Audio API. */
function playOrderChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    // First tone — low
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);
    // Second tone — high
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.15); // E5
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.5);
    // Clean up after playback
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* AudioContext blocked — fail silently */
  }
}

/**
 * One incoming record to announce — a delivery order, a takeaway pre-order or
 * a table reservation. All three land on this desk the moment a guest submits
 * the matching form on the public site.
 */
type FreshAlert = {
  kind: "delivery" | "preorder" | "reservation";
  id: string;
  name: string;
  detail: string;
  reference: string;
};

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
  const orders = useDeliveryOrders();
  const preorders = usePreorders();
  const reservations = useReservations();
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const knownPreorderIds = useRef<Set<string> | null>(null);
  const knownReservationIds = useRef<Set<string> | null>(null);
  const [freshAlert, setFreshAlert] = useState<FreshAlert | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Chime once and surface the alert overlay for a new record. */
  const announce = (alert: FreshAlert) => {
    playOrderChime();
    setFreshAlert(alert);
    if (freshTimer.current) clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setFreshAlert(null), 8000);
  };

  /** Headline numbers derived from the live feed — always in sync. */
  const stats = useMemo(() => {
    if (!orders) return null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const placedToday = orders.filter(
      (order) => order.createdAt >= todayStart.getTime(),
    );
    return {
      active: orders.filter((order) => order.status !== "delivered").length,
      placedToday: placedToday.length,
      earnedToday: placedToday
        .filter((order) => order.status === "delivered")
        .reduce((sum, order) => sum + order.total, 0),
      pending: orders.filter((order) => order.status === "placed").length,
    };
  }, [orders]);

  useEffect(() => {
    document.title = `Staff portal · ${RESTAURANT.name}`;
  }, []);

  // Announce incoming orders: the first load seeds the baseline, every new
  // id afterwards is a fresh checkout from the public site.
  useEffect(() => {
    if (!orders) return;
    const ids = orders.map((o) => o._id);
    if (knownIds.current === null) {
      knownIds.current = new Set(ids);
      return;
    }
    const fresh = orders.filter((o) => !knownIds.current!.has(o._id));
    if (fresh.length > 0) {
      const order = fresh[0];
      announce({
        kind: "delivery",
        id: order._id,
        name: order.customerName,
        detail: `${order.items.length} ${
          order.items.length === 1 ? "item" : "items"
        } · Rs ${order.total.toLocaleString("en-PK")}`,
        reference: order.reference,
      });
      // Standard toast as backup
      toast.success("New delivery order received", {
        description: `${order.customerName} · ${order.items.length} ${
          order.items.length === 1 ? "item" : "items"
        }`,
      });
      knownIds.current = new Set(ids);
    }
  }, [orders]);

  // Same treatment for pre-orders — they land on this desk the moment a guest
  // submits the pickup request on the public site.
  useEffect(() => {
    if (!preorders) return;
    const ids = preorders.map((p) => p._id);
    if (knownPreorderIds.current === null) {
      knownPreorderIds.current = new Set(ids);
      return;
    }
    const fresh = preorders.filter((p) => !knownPreorderIds.current!.has(p._id));
    if (fresh.length > 0) {
      const order = fresh[0];
      announce({
        kind: "preorder",
        id: order._id,
        name: order.customerName,
        detail: `${order.dish} · pickup ${formatDayLong(order.pickupDate)} ${formatTime(order.pickupTime)}`,
        reference: order.reference,
      });
      toast.success("New pre-order received", {
        description: `${order.customerName} · ${order.dish}`,
      });
      knownPreorderIds.current = new Set(ids);
    }
  }, [preorders]);

  // And for table reservations — the third way a guest reaches this desk.
  useEffect(() => {
    if (!reservations) return;
    const ids = reservations.map((r) => r._id);
    if (knownReservationIds.current === null) {
      knownReservationIds.current = new Set(ids);
      return;
    }
    const fresh = reservations.filter(
      (r) => !knownReservationIds.current!.has(r._id),
    );
    if (fresh.length > 0) {
      const booking = fresh[0];
      announce({
        kind: "reservation",
        id: booking._id,
        name: booking.name,
        detail: `${booking.partySize} ${
          booking.partySize === 1 ? "guest" : "guests"
        } · ${formatDayLong(booking.date)} ${formatTime(booking.time)} · ${
          booking.seating === "outdoor" ? "open air" : "indoor hall"
        }`,
        reference: booking.reference,
      });
      toast.success("New table reservation", {
        description: `${booking.name} · ${booking.partySize} ${
          booking.partySize === 1 ? "guest" : "guests"
        }`,
      });
      knownReservationIds.current = new Set(ids);
    }
  }, [reservations]);

  const setStatus = async (order: DeliveryOrder, status: DeliveryStatus) => {
    setBusyId(order._id);
    try {
      await advanceDeliveryStatus(order._id, status);
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
      description="Everything the evening team needs while the terrace is full — the live delivery feed, order totals, and every table booking, pre-order and delivery in one searchable desk."
    >
      {/* A project with no schema looks like a desk that never receives
          anything — say so up front rather than leaving the team guessing. */}
      <SetupNotice />

      {/* Prominent new-order alert overlay */}
      <AnimatePresence>
        {freshAlert ? (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mb-6 overflow-hidden rounded-2xl border-2 border-gold/50 bg-gradient-to-r from-gold/15 via-gold/10 to-ember/15 p-5 shadow-[0_0_40px_rgba(212,168,83,0.15)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-gold/40 bg-gold/20 text-gold animate-pulse">
                  {freshAlert.kind === "delivery" ? (
                    <Bike className="size-6" aria-hidden />
                  ) : freshAlert.kind === "preorder" ? (
                    <ChefHat className="size-6" aria-hidden />
                  ) : (
                    <CalendarCheck className="size-6" aria-hidden />
                  )}
                </span>
                <div>
                  <p className="font-display text-lg font-bold text-gold">
                    {freshAlert.kind === "delivery"
                      ? "New delivery order!"
                      : freshAlert.kind === "preorder"
                        ? "New pre-order!"
                        : "New table reservation!"}
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{freshAlert.name}</span> ·{" "}
                    {freshAlert.detail}
                  </p>
                  <p className="font-mono text-xs tracking-[0.14em] text-gold/70">
                    {freshAlert.reference}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFreshAlert(null)}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
              className="inline-flex items-center gap-1.5 text-xs text-gold"
              aria-hidden
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-gold" />
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

      {/* Records desk — Today vs History, searchable */}
      <section className="mt-10">
        <div className="flex flex-col gap-1.5">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <ClipboardList className="size-5 text-gold" aria-hidden />
            Records desk
          </h2>
          <p className="text-sm text-muted-foreground">
            Today&apos;s table reservations, pre-orders and deliveries — plus the
            full searchable history, filterable by year, month and date.
          </p>
        </div>
        <div className="mt-5">
          <RecordsDesk />
        </div>
      </section>

      {/* Credentials, for the person signed in. It cannot touch a role — the
          team list and every promotion live in the admin portal. */}
      <div className="mt-10 border-t border-border/70 pt-10">
        <AccountSettings />
      </div>
    </PortalFrame>
  );
}
