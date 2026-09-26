import {
  useDeliveryOrders,
  usePreorders,
  useReservations,
} from "@/hooks/use-live-db";
import {
  advanceDeliveryStatus,
  setPreorderStatus,
  setReservationStatus,
  type DeliveryOrder,
  type Preorder,
  type PreorderStatus,
  type Reservation,
  type ReservationStatus,
} from "@/lib/db";
import {
  findRecordByCode,
  normalizeCode,
  type DeskRecord,
} from "@/lib/desk-lookup";
import { formatRupees } from "@/lib/menu";
import {
  dayKeyFromMs,
  formatDayLong,
  formatMonthLabel,
  formatPhone,
  formatTime,
  monthOf,
  todayKey,
  yearOf,
} from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import {
  Bike,
  CalendarCheck,
  CheckCircle2,
  ChefHat,
  Clock,
  KeyRound,
  Loader2,
  PackageCheck,
  Phone,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Utensils,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

export type RecordKind = "reservations" | "preorders" | "deliveries";
type Scope = "today" | "history";

const KIND_ORDER: RecordKind[] = ["reservations", "preorders", "deliveries"];

const KIND_LABELS: Record<RecordKind, string> = {
  reservations: "Reservations",
  preorders: "Pre-orders",
  deliveries: "Deliveries",
};

/* ------------------------------------------------------------------ */
/* Generic Today / History browser                                     */
/* ------------------------------------------------------------------ */

/**
 * Splits any dated record list into Today and History, with a search and
 * filter bar over the history (year, month, exact day).
 *
 * `sortKeyOf` returns a sortable `YYYY-MM-DD HH:MM` string — the calendar day
 * is read from its first ten characters, so one function drives both the
 * Today/History split and the ordering.
 */
function RecordsBrowser<T>({
  records,
  keyOf,
  sortKeyOf,
  searchOf,
  isOpenOf,
  renderRecord,
  emptyToday,
  emptyHistory,
  loadingLabel,
}: {
  records: T[] | undefined;
  /** Stable React key — index keys would smear busy state across re-sorts. */
  keyOf: (record: T) => string;
  sortKeyOf: (record: T) => string;
  searchOf: (record: T) => string;
  /** Still needs attention (not completed or cancelled). */
  isOpenOf: (record: T) => boolean;
  renderRecord: (record: T, scope: Scope) => ReactNode;
  emptyToday: string;
  emptyHistory: string;
  loadingLabel: string;
}) {
  const [scope, setScope] = useState<Scope>("today");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [day, setDay] = useState("");
  const [search, setSearch] = useState("");

  const today = todayKey();
  const rows = records ?? [];

  // Every year and month the history actually contains, newest first.
  const years = new Set<string>();
  const months = new Set<string>();
  for (const record of rows) {
    const key = sortKeyOf(record);
    if (!key) continue;
    years.add(yearOf(key));
    months.add(monthOf(key));
  }
  const yearOptions = [...years].sort().reverse();
  const monthOptions = [...months].sort().reverse();

  const needle = search.trim().toLowerCase();
  const needleDigits = needle.replace(/\D/g, "");

  // Today = anything still open, plus anything dated today. That keeps a table
  // booked at 11:40 PM actionable after midnight instead of dropping it into
  // read-only history the moment the clock rolls over.
  const isToday = (record: T) =>
    isOpenOf(record) || sortKeyOf(record).slice(0, 10) === today;

  const visible = rows
    .filter((record) => {
      const recordDay = sortKeyOf(record).slice(0, 10);
      if (scope === "today") {
        if (!isToday(record)) return false;
      } else {
        // History is everything closed that is not today's work.
        if (isToday(record)) return false;
        if (year !== "all" && yearOf(recordDay) !== year) return false;
        if (month !== "all" && monthOf(recordDay) !== month) return false;
        if (day && recordDay !== day) return false;
      }
      if (!needle) return true;
      const haystack = searchOf(record).toLowerCase();
      if (haystack.includes(needle)) return true;
      // Phone search: compare digits so spaces and dashes do not matter.
      return (
        needleDigits.length >= 3 &&
        haystack.replace(/\D/g, "").includes(needleDigits)
      );
    })
    .sort((a, b) => {
      const left = sortKeyOf(a);
      const right = sortKeyOf(b);
      return scope === "history"
        ? right.localeCompare(left)
        : left.localeCompare(right);
    });

  const todayCount = rows.filter(isToday).length;

  const resetFilters = () => {
    setYear("all");
    setMonth("all");
    setDay("");
    setSearch("");
  };

  if (records === undefined) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {loadingLabel}
      </p>
    );
  }

  const filtersActive =
    year !== "all" || month !== "all" || day !== "" || search !== "";

  return (
    <div className="flex flex-col gap-4">
      {/* Scope tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-border/70 bg-background/50 p-1">
          {(["today", "history"] as Scope[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setScope(option)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium capitalize transition-colors sm:text-sm",
                scope === option
                  ? "bg-gold/15 text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "today" ? (
                <CalendarCheck className="size-3.5" aria-hidden />
              ) : (
                <Clock className="size-3.5" aria-hidden />
              )}
              {option}
              <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[0.6rem]">
                {option === "today" ? todayCount : rows.length - todayCount}
              </span>
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {visible.length} shown
        </span>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone or reference"
              className="h-10 w-full rounded-xl border border-input bg-background/50 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </div>

          {scope === "history" ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
                aria-label="Filter by year"
                className="h-10 rounded-xl border border-input bg-background/50 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <option value="all">All years</option>
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                aria-label="Filter by month"
                className="h-10 rounded-xl border border-input bg-background/50 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <option value="all">All months</option>
                {monthOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatMonthLabel(option)}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
                aria-label="Filter by exact date"
                className="h-10 rounded-xl border border-input bg-background/50 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />

              {filtersActive ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/70 px-3 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Reset
                </button>
              ) : null}
            </div>
          ) : search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="inline-flex h-10 items-center gap-1.5 self-start rounded-xl border border-border/70 px-3 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Clear
            </button>
          ) : null}
        </div>

        {scope === "history" ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-3 text-gold" aria-hidden />
            Completed and cancelled records only. Narrow by year, month or an
            exact date.
          </p>
        ) : null}
      </div>

      {/* Records */}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          {scope === "today" ? emptyToday : emptyHistory}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((record) => (
            <div key={keyOf(record)}>{renderRecord(record, scope)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared row chrome                                                   */
/* ------------------------------------------------------------------ */

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "pending" | "active" | "done" | "cancelled";
}) {
  const tones = {
    pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    active: "border-gold/40 bg-gold/10 text-gold",
    done: "border-gold/40 bg-gold/10 text-gold",
    cancelled: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium tracking-[0.14em] uppercase",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}

function RecordShell({
  reference,
  title,
  status,
  children,
  actions,
}: {
  reference: string;
  title: string;
  status: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-gold/25 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.14em] text-gold">
            {reference}
          </p>
          <h3 className="mt-0.5 truncate font-display text-base font-semibold">
            {title}
          </h3>
        </div>
        {status}
      </div>
      {children}
      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {actions}
        </div>
      ) : null}
    </article>
  );
}

const BUTTON_TONES = {
  gold: "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20",
  green:
    "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20",
  red: "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
} as const;

function ActionButton({
  onClick,
  disabled,
  icon: Icon,
  label,
  tone,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: typeof CheckCircle2;
  label: string;
  tone: keyof typeof BUTTON_TONES;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40",
        BUTTON_TONES[tone],
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

/** Date, month and year spelled out inline, as the history view requires. */
function DayLine({ day, time }: { day: string; time?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CalendarCheck className="size-3 text-gold" aria-hidden />
      {formatDayLong(day)}
      {time ? ` · ${time}` : ""}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Per-kind sort + search keys                                         */
/* ------------------------------------------------------------------ */

const reservationSortKey = (r: Reservation) => `${r.date} ${r.time}`;
const reservationSearch = (r: Reservation) =>
  `${r.reference} ${r.name} ${r.phone} ${r.seating} ${r.status}`;

const preorderSortKey = (p: Preorder) => `${p.pickupDate} ${p.pickupTime}`;
const preorderSearch = (p: Preorder) =>
  `${p.reference} ${p.customerName} ${p.phone} ${p.dish} ${p.status}`;

const deliverySortKey = (o: DeliveryOrder) => {
  const date = new Date(o.createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dayKeyFromMs(o.createdAt)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const deliverySearch = (o: DeliveryOrder) =>
  `${o.reference} ${o.customerName} ${o.phone} ${o.area} ${o.status}`;

/* ------------------------------------------------------------------ */
/* Desk                                                                */
/* ------------------------------------------------------------------ */

const RESERVATION_ACTIONS: {
  status: ReservationStatus;
  label: string;
  icon: typeof CheckCircle2;
  tone: keyof typeof BUTTON_TONES;
}[] = [
  { status: "confirmed", label: "Confirm", icon: CheckCircle2, tone: "green" },
  { status: "seated", label: "Seat now", icon: Utensils, tone: "sky" },
  { status: "cancelled", label: "Cancel", icon: XCircle, tone: "red" },
];

const PREORDER_ACTIONS: {
  status: PreorderStatus;
  label: string;
  icon: typeof CheckCircle2;
  tone: keyof typeof BUTTON_TONES;
}[] = [
  { status: "confirmed", label: "Confirm", icon: CheckCircle2, tone: "gold" },
  { status: "ready", label: "Ready", icon: ChefHat, tone: "sky" },
  {
    status: "collected",
    label: "Collected",
    icon: PackageCheck,
    tone: "green",
  },
  { status: "cancelled", label: "Cancel", icon: XCircle, tone: "red" },
];

/**
 * The records desk shared by the staff and admin panels. Splits reservations,
 * pre-orders and deliveries into Today and History, with a search bar and a
 * year/month/date filter over the history.
 */
const DESK_KIND_LABELS: Record<DeskRecord["kind"], string> = {
  reservation: "Table reservation",
  preorder: "Pre-order",
  delivery: "Delivery",
};

/**
 * The same code matched against the records the desk already holds.
 *
 * The desk subscribes to all three tables over the realtime channel, so a code
 * that `tribe_find_by_reference()` could not answer — a database that has not
 * run the function yet — is still found here rather than reported missing.
 */
function matchLive(
  code: string,
  reservations: Reservation[],
  preorders: Preorder[],
  deliveries: DeliveryOrder[],
): DeskRecord | null {
  const same = (reference: string) => reference.trim().toUpperCase() === code;

  const booking = reservations.find((row) => same(row.reference));
  if (booking) {
    return {
      kind: "reservation",
      reference: booking.reference,
      name: booking.name,
      phone: booking.phone,
      status: booking.status,
      when: `${booking.date} · ${booking.time}`,
      detail: `${booking.partySize} ${booking.partySize === 1 ? "guest" : "guests"} · ${booking.seating}`,
    };
  }

  const preorder = preorders.find((row) => same(row.reference));
  if (preorder) {
    return {
      kind: "preorder",
      reference: preorder.reference,
      name: preorder.customerName,
      phone: preorder.phone,
      status: preorder.status,
      when: `${preorder.pickupDate} · ${preorder.pickupTime}`,
      detail: preorder.dish,
    };
  }

  const delivery = deliveries.find((row) => same(row.reference));
  if (delivery) {
    return {
      kind: "delivery",
      reference: delivery.reference,
      name: delivery.customerName,
      phone: delivery.phone,
      status: delivery.status,
      detail: delivery.area,
      total: delivery.total,
    };
  }

  return null;
}

function FoundRecord({ record }: { record: DeskRecord }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold/30 bg-gold/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[0.65rem] tracking-[0.18em] text-gold uppercase">
          {DESK_KIND_LABELS[record.kind]}
          <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[0.6rem]">
            {record.status}
          </span>
        </p>
        <p className="mt-1 font-mono text-sm tracking-[0.14em] text-foreground">
          {record.reference}
        </p>
        <p className="truncate text-sm font-medium">{record.name}</p>
        {record.when || record.detail ? (
          <p className="text-xs text-muted-foreground">
            {[record.when, record.detail].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {record.total !== undefined ? (
          <span className="font-display text-sm font-semibold text-gold tabular-nums">
            {formatRupees(record.total)}
          </span>
        ) : null}
        <a
          href={`tel:${record.phone}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
        >
          <Phone className="size-3.5" aria-hidden />
          {formatPhone(record.phone)}
        </a>
      </div>
    </div>
  );
}

/**
 * "Find by Code" — the desk's front door.
 *
 * The code is the only thing a guest has when they walk in or call, so it is
 * the first field on the screen. The answer comes from the database
 * (`tribe_find_by_reference()`), which refuses anyone who is not signed in as
 * staff; when that function is not on the database yet, the same code is
 * matched against the records already streaming into this desk, so the box
 * works from the first load rather than showing an error nobody can fix.
 */
function FindByCode({
  reservations,
  preorders,
  deliveries,
}: {
  reservations: Reservation[];
  preorders: Preorder[];
  deliveries: DeliveryOrder[];
}) {
  const [code, setCode] = useState("");
  const [match, setMatch] = useState<DeskRecord | null>(null);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const find = async () => {
    const wanted = normalizeCode(code);
    if (wanted.length < 4) {
      setMatch(null);
      setMissed(false);
      return;
    }
    setBusy(true);
    try {
      const found =
        (await findRecordByCode(wanted)) ??
        matchLive(wanted, reservations, preorders, deliveries);
      setMatch(found);
      setMissed(!found);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-gold/25 bg-card/50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label
            htmlFor="find-by-code"
            className="flex items-center gap-2 text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase"
          >
            <KeyRound className="size-3.5 text-gold" aria-hidden />
            Find by code
          </label>
          <input
            id="find-by-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") void find();
            }}
            placeholder="JNX-7K4P9Q"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="find-by-code-help"
            className="h-10 w-full rounded-xl border border-input bg-background/50 px-3 font-mono text-sm tracking-[0.14em] text-foreground outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>
        <button
          type="button"
          onClick={() => void find()}
          disabled={busy}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/15 px-4 text-xs font-medium text-gold transition-colors hover:border-gold/70 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
          Find
        </button>
      </div>

      {match ? <FoundRecord record={match} /> : null}
      {missed ? (
        <p className="text-xs text-muted-foreground">
          No record carries that code. Check the characters, or search the board
          below by name or number.
        </p>
      ) : null}
      <p id="find-by-code-help" className="text-xs text-muted-foreground">
        Reservations, pre-orders and delivery orders, straight from the database.
      </p>
    </section>
  );
}

export function RecordsDesk({
  kinds = KIND_ORDER,
}: {
  kinds?: RecordKind[];
}) {
  const reservations = useReservations();
  const preorders = usePreorders();
  const deliveries = useDeliveryOrders();

  const [kind, setKind] = useState<RecordKind>(kinds[0]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, success: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error("Update failed", {
        description:
          error instanceof Error
            ? error.message.split("\n")[0]
            : "Could not update that record.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const counts: Record<RecordKind, number> = {
    reservations: reservations?.length ?? 0,
    preorders: preorders?.length ?? 0,
    deliveries: deliveries?.length ?? 0,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* The code a guest quotes, first on the screen. */}
      <FindByCode
        reservations={reservations ?? []}
        preorders={preorders ?? []}
        deliveries={deliveries ?? []}
      />

      {kinds.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {kinds.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                kind === option
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border/70 text-muted-foreground hover:border-gold/30 hover:text-foreground",
              )}
            >
              {KIND_LABELS[option]}
              <span className="ml-2 opacity-70">{counts[option]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {kind === "reservations" ? (
        <RecordsBrowser<Reservation>
          records={reservations}
          keyOf={(r) => r._id}
          sortKeyOf={reservationSortKey}
          searchOf={reservationSearch}
          loadingLabel="Loading the bookings feed…"
          isOpenOf={(b) => b.status === "pending" || b.status === "confirmed"}
          emptyToday="No table reservations need attention right now."
          emptyHistory="No past reservations match these filters."
          renderRecord={(booking, scope) => (
            <RecordShell
              reference={booking.reference}
              title={booking.name}
              status={
                <StatusChip
                  label={booking.status}
                  tone={
                    booking.status === "cancelled"
                      ? "cancelled"
                      : booking.status === "pending"
                        ? "pending"
                        : booking.status === "seated"
                          ? "done"
                          : "active"
                  }
                />
              }
            >
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Date
                  </dt>
                  <dd className="mt-0.5">
                    <DayLine
                      day={booking.date}
                      time={formatTime(booking.time)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Party
                  </dt>
                  <dd className="mt-0.5">{booking.partySize} guests</dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Seating
                  </dt>
                  <dd className="mt-0.5 capitalize">{booking.seating}</dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Phone
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:+${booking.phone}`}
                      className="inline-flex items-center gap-1.5 text-gold hover:underline"
                    >
                      <Phone className="size-3" aria-hidden />
                      {formatPhone(booking.phone)}
                    </a>
                  </dd>
                </div>
              </dl>
              {booking.notes ? (
                <p className="mt-3 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                  “{booking.notes}”
                </p>
              ) : null}
              {scope === "today" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  {RESERVATION_ACTIONS.filter(
                    (action) => action.status !== booking.status,
                  ).map((action) => (
                    <ActionButton
                      key={action.status}
                      icon={action.icon}
                      label={action.label}
                      tone={action.tone}
                      disabled={busyId === booking._id}
                      onClick={() =>
                        void run(
                          booking._id,
                          `${booking.reference} marked ${action.status}`,
                          () => setReservationStatus(booking._id, action.status),
                        )
                      }
                    />
                  ))}
                  {busyId === booking._id ? (
                    <span className="inline-flex items-center gap-2 px-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Saving…
                    </span>
                  ) : null}
                </div>
              ) : null}
            </RecordShell>
          )}
        />
      ) : null}

      {kind === "preorders" ? (
        <RecordsBrowser<Preorder>
          records={preorders}
          keyOf={(p) => p._id}
          sortKeyOf={preorderSortKey}
          searchOf={preorderSearch}
          loadingLabel="Loading the pre-order feed…"
          isOpenOf={(p) => p.status !== "collected" && p.status !== "cancelled"}
          emptyToday="No pre-orders need attention right now."
          emptyHistory="No past pre-orders match these filters."
          renderRecord={(order, scope) => (
            <RecordShell
              reference={order.reference}
              title={order.customerName}
              status={
                <StatusChip
                  label={order.status}
                  tone={
                    order.status === "cancelled"
                      ? "cancelled"
                      : order.status === "pending"
                        ? "pending"
                        : order.status === "collected"
                          ? "done"
                          : "active"
                  }
                />
              }
            >
              <p className="mt-2 text-sm">
                <span className="font-medium">{order.dish}</span>
                {order.quantity > 1 ? ` × ${order.quantity}` : ""}
              </p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Pickup
                  </dt>
                  <dd className="mt-0.5">
                    <DayLine
                      day={order.pickupDate}
                      time={formatTime(order.pickupTime)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Phone
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:+${order.phone}`}
                      className="inline-flex items-center gap-1.5 text-gold hover:underline"
                    >
                      <Phone className="size-3" aria-hidden />
                      {formatPhone(order.phone)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Requested
                  </dt>
                  <dd className="mt-0.5 text-muted-foreground">
                    {formatDayLong(dayKeyFromMs(order.createdAt))}
                  </dd>
                </div>
              </dl>
              {order.notes ? (
                <p className="mt-3 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                  “{order.notes}”
                </p>
              ) : null}
              {scope === "today" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  {PREORDER_ACTIONS.filter(
                    (action) => action.status !== order.status,
                  ).map((action) => (
                    <ActionButton
                      key={action.status}
                      icon={action.icon}
                      label={action.label}
                      tone={action.tone}
                      disabled={busyId === order._id}
                      onClick={() =>
                        void run(
                          order._id,
                          `${order.reference} marked ${action.status}`,
                          () => setPreorderStatus(order._id, action.status),
                        )
                      }
                    />
                  ))}
                  {busyId === order._id ? (
                    <span className="inline-flex items-center gap-2 px-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Saving…
                    </span>
                  ) : null}
                </div>
              ) : null}
            </RecordShell>
          )}
        />
      ) : null}

      {kind === "deliveries" ? (
        <RecordsBrowser<DeliveryOrder>
          records={deliveries}
          keyOf={(o) => o._id}
          sortKeyOf={deliverySortKey}
          searchOf={deliverySearch}
          loadingLabel="Loading the delivery feed…"
          isOpenOf={(o) => o.status !== "delivered"}
          emptyToday="No delivery orders need attention right now."
          emptyHistory="No past deliveries match these filters."
          renderRecord={(order, scope) => (
            <RecordShell
              reference={order.reference}
              title={order.customerName}
              status={
                <StatusChip
                  label={order.status}
                  tone={
                    order.status === "placed"
                      ? "pending"
                      : order.status === "confirmed"
                        ? "active"
                        : "done"
                  }
                />
              }
            >
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Placed
                  </dt>
                  <dd className="mt-0.5">
                    <DayLine day={dayKeyFromMs(order.createdAt)} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Area
                  </dt>
                  <dd className="mt-0.5">{order.area}</dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Items
                  </dt>
                  <dd className="mt-0.5">
                    {order.items.length}{" "}
                    {order.items.length === 1 ? "line" : "lines"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                    Total
                  </dt>
                  <dd className="mt-0.5 font-semibold text-gold">
                    {formatRupees(order.total)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <Bike className="mt-0.5 size-3 shrink-0 text-gold" aria-hidden />
                {order.address} · {order.phone}
              </p>
              {scope === "today" && order.status !== "delivered" ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  {order.status === "placed" ? (
                    <ActionButton
                      icon={CheckCircle2}
                      label="Confirm order"
                      tone="gold"
                      disabled={busyId === order._id}
                      onClick={() =>
                        void run(
                          order._id,
                          `${order.reference} confirmed`,
                          () => advanceDeliveryStatus(order._id, "confirmed"),
                        )
                      }
                    />
                  ) : null}
                  {order.status === "confirmed" ? (
                    <ActionButton
                      icon={PackageCheck}
                      label="Delivered"
                      tone="green"
                      disabled={busyId === order._id}
                      onClick={() =>
                        void run(
                          order._id,
                          `${order.reference} delivered`,
                          () => advanceDeliveryStatus(order._id, "delivered"),
                        )
                      }
                    />
                  ) : null}
                  {busyId === order._id ? (
                    <span className="inline-flex items-center gap-2 px-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Saving…
                    </span>
                  ) : null}
                </div>
              ) : null}
            </RecordShell>
          )}
        />
      ) : null}
    </div>
  );
}
