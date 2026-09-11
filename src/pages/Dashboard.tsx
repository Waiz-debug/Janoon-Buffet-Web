import {
  ReservationStatusBadge,
  RESERVATION_STATUS_LABELS,
} from "@/components/tribe/ReservationStatusBadge";
import type { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { ReservationStatus } from "@/convex/schema";
import { useAuth } from "@/hooks/use-auth";
import {
  RESTAURANT,
  formatDate,
  formatPhone,
  formatTime,
  todayKey,
} from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  Loader2,
  LogOut,
  Phone,
  Search,
  Users,
  Utensils,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router";

type Reservation = Doc<"reservations">;
type Scope = "upcoming" | "today" | "all";

const SCOPE_LABELS: Record<Scope, string> = {
  upcoming: "Upcoming",
  today: "Today",
  all: "All dates",
};

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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const reservations = useQuery(api.reservations.list);
  const stats = useQuery(api.reservations.stats);
  const updateStatus = useMutation(api.reservations.updateStatus);

  const [scope, setScope] = useState<Scope>("upcoming");
  const [filter, setFilter] = useState<ReservationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = todayKey();

  const filtered = useMemo(() => {
    if (!reservations) return [];
    const needle = search.trim().toLowerCase();

    return reservations
      .filter((reservation) => {
        if (scope === "today" && reservation.date !== today) return false;
        if (scope === "upcoming" && reservation.date < today) return false;
        if (filter !== "all" && reservation.status !== filter) return false;
        if (!needle) return true;
        return (
          reservation.name.toLowerCase().includes(needle) ||
          reservation.phone.includes(needle.replace(/[^\d]/g, "")) ||
          reservation.reference.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const left = `${a.date} ${a.time}`;
        const right = `${b.date} ${b.time}`;
        return scope === "all" ? right.localeCompare(left) : left.localeCompare(right);
      });
  }, [reservations, scope, filter, search, today]);

  const handleStatus = async (reservation: Reservation, status: ReservationStatus) => {
    setBusyId(reservation._id);
    try {
      await updateStatus({ id: reservation._id, status });
      toast.success(
        `${reservation.name} marked ${RESERVATION_STATUS_LABELS[status].toLowerCase()}`,
        {
        description: `${formatDate(reservation.date)} · ${formatTime(reservation.time)}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update.";
      toast.error("Update failed", { description: message.split("\n")[0] });
    } finally {
      setBusyId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
              to="/"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              View website
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              <LogOut className="size-3.5" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Table bookings
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.name ? `${user.name}, ` : ""}every booking from the website
            arrives here the moment a guest submits it, with no refresh required.
          </p>
        </section>

        {/* Live stats */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={CalendarDays}
            label="Today"
            value={stats ? stats.todayBookings : "—"}
            hint="Bookings for today"
          />
          <StatCard
            icon={Users}
            label="Guests tonight"
            value={stats ? stats.todayGuests : "—"}
            hint="Heads expected today"
          />
          <StatCard
            icon={Utensils}
            label="Awaiting call"
            value={stats ? stats.pending : "—"}
            hint="Pending confirmation"
          />
          <StatCard
            icon={CheckCircle2}
            label="Upcoming"
            value={stats ? stats.upcoming : "—"}
            hint="Confirmed + pending ahead"
          />
        </section>

        {/* Toolbar */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 rounded-xl border border-border/70 bg-background/50 p-1">
              {(Object.keys(SCOPE_LABELS) as Scope[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setScope(option)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
                    scope === option
                      ? "bg-gold/15 text-gold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {SCOPE_LABELS[option]}
                </button>
              ))}
            </div>

            <div className="relative lg:w-72">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, phone or reference"
                className="h-11 w-full rounded-xl border border-input bg-background/50 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "confirmed", "seated", "cancelled"] as const).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition-colors",
                    filter === option
                      ? "border-gold/50 bg-gold/15 text-gold"
                      : "border-border/70 text-muted-foreground hover:border-gold/30 hover:text-foreground",
                  )}
                >
                  {option === "all"
                    ? "All statuses"
                    : RESERVATION_STATUS_LABELS[option]}
                </button>
              ),
            )}
          </div>
        </section>

        {/* Bookings */}
        {reservations === undefined ? (
          <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-card/40 py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card/30 px-6 py-16 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gold/10 text-gold">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <p className="font-display text-lg font-semibold">No bookings here yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {reservations.length === 0
                ? "As soon as a family books a table on the website it will appear here instantly."
                : "Nothing matches these filters. Try a different date range or status."}
            </p>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            {filtered.map((reservation) => {
              const isToday = reservation.date === today;
              const isBusy = busyId === reservation._id;
              return (
                <article
                  key={reservation._id}
                  className="rounded-2xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-gold/25 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-sm font-semibold text-gold">
                        {reservation.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate font-display text-lg font-semibold">
                            {reservation.name}
                          </h2>
                          {isToday ? (
                            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] tracking-wide text-gold uppercase">
                              Today
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Ref {reservation.reference} · booked{" "}
                          {reservation.partySize === 1
                            ? "1 guest"
                            : `${reservation.partySize} guests`}
                        </p>
                        {reservation.notes ? (
                          <p className="mt-2 rounded-lg bg-background/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            “{reservation.notes}”
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <ReservationStatusBadge status={reservation.status} />
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                        When
                      </dt>
                      <dd className="mt-0.5">
                        {formatDate(reservation.date)} · {formatTime(reservation.time)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                        Party
                      </dt>
                      <dd className="mt-0.5">{reservation.partySize} guests</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                        Seating
                      </dt>
                      <dd className="mt-0.5 capitalize">{reservation.seating}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                        Phone
                      </dt>
                      <dd className="mt-0.5">
                        <a
                          href={`tel:+${reservation.phone}`}
                          className="inline-flex items-center gap-1.5 text-gold underline-offset-4 hover:underline"
                        >
                          <Phone className="size-3" aria-hidden />
                          {formatPhone(reservation.phone)}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                    <button
                      type="button"
                      disabled={isBusy || reservation.status === "confirmed"}
                      onClick={() => handleStatus(reservation, "confirmed")}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || reservation.status === "seated"}
                      onClick={() => handleStatus(reservation, "seated")}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-40"
                    >
                      <Utensils className="size-3.5" aria-hidden />
                      Seat now
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || reservation.status === "pending"}
                      onClick={() => handleStatus(reservation, "pending")}
                      className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold/20 disabled:opacity-40"
                    >
                      Reopen
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || reservation.status === "cancelled"}
                      onClick={() => handleStatus(reservation, "cancelled")}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      <XCircle className="size-3.5" aria-hidden />
                      Cancel
                    </button>
                    {isBusy ? (
                      <span className="inline-flex items-center gap-2 px-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Saving…
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
