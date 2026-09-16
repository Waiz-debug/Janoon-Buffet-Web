import { RecordsDesk } from "@/components/tribe/RecordsDesk";
import { useReservations } from "@/hooks/use-live-db";
import { RESTAURANT, todayKey } from "@/lib/restaurant";
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  Users,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "react-router";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 text-gold" aria-hidden />
        <span className="text-[0.7rem] tracking-[0.16em] uppercase">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function Dashboard() {
  const reservations = useReservations();
  const today = todayKey();

  useEffect(() => {
    document.title = `Reservations desk · ${RESTAURANT.name}`;
  }, []);

  /** Live counters derived from the same feed the desk renders. */
  const stats = useMemo(() => {
    const all = reservations ?? [];
    const todays = all.filter((booking) => booking.date === today);
    return {
      todayBookings: todays.length,
      todayGuests: todays.reduce((sum, booking) => sum + booking.partySize, 0),
      pending: all.filter((booking) => booking.status === "pending").length,
      upcoming: all.filter(
        (booking) =>
          booking.date >= today &&
          (booking.status === "pending" || booking.status === "confirmed"),
      ).length,
    };
  }, [reservations, today]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
              <Flame className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-base font-semibold">
                Reservations desk
              </p>
              <p className="text-[0.7rem] tracking-[0.18em] text-gold/80 uppercase">
                {RESTAURANT.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/restaurant"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              View website
            </Link>
            <Link
              to="/staff"
              className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              Staff portal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Table reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Every booking from the website arrives here the moment a guest
            submits it. Today&apos;s tables sit up top; past bookings stay in
            the searchable history.
          </p>
        </section>

        {/* Live stats */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={CalendarDays}
            label="Today"
            value={stats.todayBookings}
            hint="Reservations today"
          />
          <StatCard
            icon={Users}
            label="Guests tonight"
            value={stats.todayGuests}
            hint="Heads expected today"
          />
          <StatCard
            icon={Utensils}
            label="Awaiting call"
            value={stats.pending}
            hint="Pending confirmation"
          />
          <StatCard
            icon={CheckCircle2}
            label="Upcoming"
            value={stats.upcoming}
            hint="Confirmed + pending ahead"
          />
        </section>

        <RecordsDesk kinds={["reservations"]} />
      </main>
    </div>
  );
}
