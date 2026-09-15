import { DeliveryOrderCard } from "@/components/tribe/DeliveryOrderCard";
import { PortalFrame } from "@/components/tribe/PortalFrame";
import { useDeliveryOrders, useReservations } from "@/hooks/use-live-db";
import {
  advanceDeliveryStatus,
  setReservationStatus,
  type DeliveryOrder,
  type DeliveryStatus,
  type ReservationStatus,
} from "@/lib/db";
import { RESTAURANT, formatDate, formatTime } from "@/lib/restaurant";
import {
  Bike,
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  Loader2,
  PackageCheck,
  PackageOpen,
  Timer,
  Trees,
  Users,
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

type FreshOrder = {
  id: string;
  name: string;
  itemCount: number;
  total: number;
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const [freshOrder, setFreshOrder] = useState<FreshOrder | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Play audible chime
      playOrderChime();
      // Show prominent alert overlay (auto-dismiss after 8s)
      setFreshOrder({
        id: order._id,
        name: order.customerName,
        itemCount: order.items.length,
        total: order.total,
        reference: order.reference,
      });
      if (freshTimer.current) clearTimeout(freshTimer.current);
      freshTimer.current = setTimeout(() => setFreshOrder(null), 8000);
      // Standard toast as backup
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
      description="Everything the evening team needs while the terrace is full — the live delivery feed, order totals and the bookings desk, in one place."
    >
      {/* Prominent new-order alert overlay */}
      <AnimatePresence>
        {freshOrder ? (
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
                  <Bike className="size-6" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-lg font-bold text-gold">
                    New order!
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{freshOrder.name}</span> · {" "}
                    {freshOrder.itemCount} {freshOrder.itemCount === 1 ? "item" : "items"} · {" "}
                    Rs {freshOrder.total.toLocaleString("en-PK")}
                  </p>
                  <p className="font-mono text-xs tracking-[0.14em] text-gold/70">
                    {freshOrder.reference}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFreshOrder(null)}
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

      {/* Reservations desk — live table bookings, no email sign-in needed */}
      <ReservationsDesk />
    </PortalFrame>
  );
}

const RESERVATION_ACTIONS: {
  status: ReservationStatus;
  label: string;
  className: string;
}[] = [
  {
    status: "confirmed",
    label: "Confirm",
    className:
      "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20",
  },
  {
    status: "seated",
    label: "Seated",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  },
  {
    status: "cancelled",
    label: "Cancel",
    className:
      "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
  },
];

/** Live table bookings with one-tap status changes. */
function ReservationsDesk() {
  const reservations = useReservations();
  const [busyId, setBusyId] = useState<string | null>(null);

  const upcoming = (reservations ?? []).filter(
    (booking) => booking.status !== "cancelled",
  );

  const change = async (id: string, status: ReservationStatus) => {
    setBusyId(id);
    try {
      await setReservationStatus(id, status);
      toast.success(`Booking marked ${status}`);
    } catch (error) {
      toast.error("Update failed", {
        description:
          error instanceof Error ? error.message : "Could not update that booking.",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold">
        <CalendarCheck className="size-5 text-gold" aria-hidden />
        Reservations desk
        <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
          {upcoming.length} open
        </span>
      </h2>

      {reservations === undefined ? (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading the bookings desk…
        </p>
      ) : upcoming.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          No open bookings. New table requests from the public site land here
          instantly.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {upcoming.map((booking) => (
            <article
              key={booking._id}
              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs tracking-[0.14em] text-gold">
                    {booking.reference}
                  </span>
                  <span className="font-display text-base font-semibold">
                    {booking.name}
                  </span>
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] capitalize text-muted-foreground">
                    {booking.status}
                  </span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3 text-gold" aria-hidden />
                    {booking.partySize}{" "}
                    {booking.partySize === 1 ? "guest" : "guests"}
                  </span>
                  <span>
                    {formatDate(booking.date)} · {formatTime(booking.time)}
                  </span>
                  <span className="flex items-center gap-1.5 capitalize">
                    <Trees className="size-3 text-gold" aria-hidden />
                    {booking.seating}
                  </span>
                  <a
                    href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {booking.phone}
                  </a>
                </p>
                {booking.notes ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    “{booking.notes}”
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {RESERVATION_ACTIONS.map((action) =>
                  booking.status === action.status ? null : (
                    <button
                      key={action.status}
                      type="button"
                      disabled={busyId === booking._id}
                      onClick={() => void change(booking._id, action.status)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${action.className}`}
                    >
                      {action.label}
                    </button>
                  ),
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
