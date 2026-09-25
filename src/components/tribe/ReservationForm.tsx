import { ReservationStatusBadge } from "@/components/tribe/ReservationStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useReservationLookup } from "@/hooks/use-live-db";
import {
  cancelReservationByGuest,
  createReservation,
  type Reservation,
  type ReservationStatus,
} from "@/lib/db";
import {
  clearReservationPointer,
  readReservationPointer,
  saveReservationPointer,
  type ReservationPointer,
} from "@/lib/last-reservation";
import {
  ARRIVAL_SLOTS,
  RESTAURANT,
  formatDate,
  formatTime,
  todayKey,
} from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Phone,
  Trees,
  Users,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Seating = "outdoor" | "indoor";

type BookingForm = {
  name: string;
  phone: string;
  partySize: string;
  date: string;
  time: string;
  seating: Seating;
  notes: string;
};

const PARTY_SIZES = Array.from({ length: 12 }, (_, index) => String(index + 1));

const CONFIRMATION_HEADLINES: Record<ReservationStatus, string> = {
  pending: "Your table is requested",
  confirmed: "Your table is confirmed",
  seated: "Your table is ready",
  cancelled: "This reservation is cancelled",
};

const CONFIRMATION_NOTES: Record<ReservationStatus, string> = {
  pending:
    "Our floor team confirms every booking by phone, so expect a call shortly to lock in your table.",
  confirmed:
    "Your booking is confirmed. Give your reference at the counter on arrival and you will be seated straight away.",
  seated:
    "Your party has been seated. Please speak to our floor team if anything needs changing.",
  cancelled:
    "The table has been released and nothing further is required. We hope to welcome your family another evening.",
};

/** Convex prefixes thrown errors with request metadata — surface only the message. */
function bookingErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const match = raw.match(/(?:Uncaught Error|Error):\s*(.+)$/m);
  const message = (match ? match[1] : raw).split("\n")[0].trim();
  return message || "We could not save your booking. Please try again.";
}

function initialForm(): BookingForm {
  return {
    name: "",
    phone: "",
    partySize: "4",
    date: todayKey(),
    time: "20:00",
    seating: "outdoor",
    notes: "",
  };
}

/**
 * Confirmation view. It renders the reservation record fetched from the
 * database — never an in-memory snapshot — so a refresh (or a status change
 * made by the restaurant) is reflected immediately and stays correct.
 *
 * Cancelled bookings never reach this panel: the parent drops them from the
 * site the moment they are cancelled, here or on the reservations desk.
 */
function ConfirmationPanel({
  reservation,
  onBookAnother,
  onCancelled,
}: {
  reservation: Reservation;
  onBookAnother: () => void;
  onCancelled: () => void;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const firstName = reservation.name.split(" ")[0];
  const canCancel =
    reservation.status === "pending" || reservation.status === "confirmed";

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelReservationByGuest(reservation.reference, reservation.phone);
      setConfirmingCancel(false);
      toast.success("Reservation cancelled", {
        description: `Reference ${reservation.reference} has been released.`,
      });
      onCancelled();
    } catch (error) {
      toast.error("Could not cancel", { description: bookingErrorMessage(error) });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex flex-col gap-6 rounded-3xl border border-gold/30 bg-gold/[0.06] p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold">
              {CONFIRMATION_HEADLINES[reservation.status]}
            </h3>
            <p className="text-sm text-muted-foreground">
              Thank you, {firstName} — reference {reservation.reference} is held
              under {reservation.name}.
            </p>
          </div>
        </div>
        <ReservationStatusBadge status={reservation.status} />
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
          <dt className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
            Booking reference
          </dt>
          <dd className="mt-1 font-display text-2xl font-semibold tracking-wider text-gold">
            {reservation.reference}
          </dd>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
          <dt className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
            Your table
          </dt>
          <dd className="mt-1 flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-2">
              <Users className="size-3.5 text-gold" aria-hidden />
              {reservation.partySize}{" "}
              {reservation.partySize === 1 ? "guest" : "guests"}
            </span>
            <span className="flex items-center gap-2">
              <CalendarClock className="size-3.5 text-gold" aria-hidden />
              {formatDate(reservation.date)} · {formatTime(reservation.time)}
            </span>
            <span className="flex items-center gap-2 capitalize">
              <Trees className="size-3.5 text-gold" aria-hidden />
              {reservation.seating} seating
            </span>
          </dd>
        </div>
      </dl>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {CONFIRMATION_NOTES[reservation.status]} Keep this reference to manage or
        cancel the booking later. Running early or late? Call{" "}
        <a
          href={RESTAURANT.phoneHref}
          className="text-gold underline-offset-4 hover:underline"
        >
          {RESTAURANT.phoneDisplay}
        </a>{" "}
        and we will hold your table for 20 minutes past your arrival time.
      </p>

      {confirmingCancel && canCancel ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm">
            Cancel the table for {reservation.partySize} guests on{" "}
            {formatDate(reservation.date)} at {formatTime(reservation.time)}?
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="destructive"
              disabled={isCancelling}
              onClick={handleCancel}
              className="gap-2"
            >
              {isCancelling ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <XCircle className="size-4" aria-hidden />
              )}
              Yes, cancel it
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-border/70"
              onClick={() => setConfirmingCancel(false)}
            >
              Keep my table
            </Button>
          </div>
        </div>
      ) : canCancel ? (
        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          className="inline-flex items-center gap-2 self-start text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-destructive hover:underline"
        >
          <XCircle className="size-4" aria-hidden />
          Cancel this reservation
        </button>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-border/70"
          onClick={onBookAnother}
        >
          Book Another Table
        </Button>
        <Button asChild variant="outline" className="flex-1 border-border/70">
          <Link to="/manage">Manage this booking</Link>
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Saved to our reservations desk — this confirmation stays here, even after
        you reload the page.
      </p>
    </motion.div>
  );
}

export function ReservationForm() {
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The device pointer is read from storage on the first render: it is the one
  // thing that decides which panel shows, so deferring it to an effect painted
  // the booking form first and then swapped it for the confirmation.
  const [pointer, setPointer] = useState<ReservationPointer | null>(
    readReservationPointer,
  );

  // Re-read on an interval while the page is open, so a refresh — or a status
  // change made at the desk — never goes stale.
  const stored = useReservationLookup(
    pointer?.reference ?? null,
    pointer?.phone ?? "",
  );

  // A cancelled booking is taken off the website entirely — whether the guest
  // cancelled it here or the reservations desk cancelled on their behalf — and a
  // pointer that no longer resolves at all (booking purged) must not trap the
  // guest on a confirmation for a table that is gone.
  //
  // Both are derived rather than copied into state. They are answers *about the
  // record*, not events: mirroring them meant clearing the pointer, clearing the
  // panel and writing the message by hand from an effect. What is left is the
  // one real side effect — clearing the stale pointer out of localStorage.
  const cancelled = stored?.status === "cancelled" ? stored : null;
  const livePointer = cancelled || stored === null ? null : pointer;

  useEffect(() => {
    if (pointer && stored === null) clearReservationPointer();
  }, [pointer, stored]);

  useEffect(() => {
    if (cancelled) clearReservationPointer();
  }, [cancelled]);

  const isRestoring = livePointer !== null && stored === undefined;
  const minDate = useMemo(() => todayKey(), []);

  /** A cancellation caught from the record, kept alongside the local message. */
  const noticeText =
    notice ??
    (cancelled
      ? `Reservation ${cancelled.reference} was cancelled, so it has been removed.`
      : null);

  const update = <Key extends keyof BookingForm>(
    key: Key,
    value: BookingForm[Key],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) {
      nextErrors.name = "Please enter the name for the booking.";
    }
    const digits = form.phone.replace(/[^\d]/g, "");
    if (digits.length < 10 || digits.length > 15) {
      nextErrors.phone = "Enter a valid phone number we can reach you on.";
    }
    if (!form.date || form.date < minDate) {
      nextErrors.date = "Pick today or a later date.";
    }
    if (!form.time) {
      nextErrors.time = "Choose an arrival time.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    try {
      const result = await createReservation({
        name: form.name.trim(),
        phone: form.phone.trim(),
        partySize: Number(form.partySize),
        date: form.date,
        time: form.time,
        seating: form.seating,
        notes: form.notes.trim() ? form.notes.trim() : undefined,
      });

      // Persist the pointer, not the data: the booking itself is already stored
      // in the database and is what we read back on the next page load.
      const saved: ReservationPointer = {
        reference: result.reference,
        phone: form.phone.trim(),
      };
      saveReservationPointer(saved);
      setPointer(saved);
      setNotice(null);
      setForm(initialForm());

      toast.success("Table requested", {
        description: `Reference ${result.reference}. Our team will confirm by phone.`,
      });
    } catch (error) {
      const message = bookingErrorMessage(error);
      setErrors({ form: message });
      toast.error("Booking not saved", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    clearReservationPointer();
    setPointer(null);
    setForm(initialForm());
  };

  const handleCancelled = () => {
    clearReservationPointer();
    setPointer(null);
    setNotice(
      "Your reservation has been cancelled and removed from the website. No table is being held.",
    );
  };

  if (isRestoring) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-3xl border border-border/70 bg-card/60">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (livePointer && stored) {
    return (
      <ConfirmationPanel
        reservation={stored}
        onBookAnother={handleBookAnother}
        onCancelled={handleCancelled}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-3xl border border-border/70 bg-card/60 p-6 sm:p-8"
    >
      {noticeText ? (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
          <p className="text-sm leading-relaxed">{noticeText}</p>
          {/* Only the local message can be dismissed; a cancellation reported by
              the record stays until the guest books again. */}
          {notice ? (
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
              className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reservation-name">Full name</Label>
          <Input
            id="reservation-name"
            name="name"
            autoComplete="name"
            placeholder="e.g. Ahmed Raza"
            value={form.name}
            aria-invalid={Boolean(errors.name)}
            onChange={(event) => update("name", event.target.value)}
            className="h-11"
          />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reservation-phone">Phone number</Label>
          <Input
            id="reservation-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0300 0000000"
            value={form.phone}
            aria-invalid={Boolean(errors.phone)}
            onChange={(event) => update("phone", event.target.value)}
            className="h-11"
          />
          {errors.phone ? (
            <p className="text-xs text-destructive">{errors.phone}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reservation-guests">Guests</Label>
          <Select
            value={form.partySize}
            onValueChange={(value) => update("partySize", value)}
          >
            <SelectTrigger id="reservation-guests" className="h-11 w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {PARTY_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size} {size === "1" ? "guest" : "guests"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Bigger group? Call {RESTAURANT.phoneDisplay}.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reservation-date">Date</Label>
          <Input
            id="reservation-date"
            name="date"
            type="date"
            min={minDate}
            value={form.date}
            aria-invalid={Boolean(errors.date)}
            onChange={(event) => update("date", event.target.value)}
            className="h-11"
          />
          {errors.date ? (
            <p className="text-xs text-destructive">{errors.date}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reservation-time">Arrival time</Label>
          <Select value={form.time} onValueChange={(value) => update("time", value)}>
            <SelectTrigger id="reservation-time" className="h-11 w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {ARRIVAL_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {formatTime(slot)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Open 24 hours — all slots live.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Seating</Label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "outdoor", label: "Open air", icon: Trees },
              { value: "indoor", label: "Indoor hall", icon: UtensilsCrossed },
            ] as const
          ).map((option) => {
            const active = form.seating === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => update("seating", option.value)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm transition-colors",
                  active
                    ? "border-gold/50 bg-gold/15 text-foreground"
                    : "border-border/70 bg-background/40 text-muted-foreground hover:border-gold/30 hover:text-foreground",
                )}
              >
                <option.icon className="size-4" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="reservation-notes">Anything we should know? (optional)</Label>
        <Textarea
          id="reservation-notes"
          name="notes"
          rows={3}
          placeholder="Birthday cake, high chair for a toddler, wheelchair access…"
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          className="resize-none"
        />
      </div>

      {errors.form ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          {errors.form}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-12 w-full gap-2 shadow-lg shadow-black/30"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Saving your table…
          </>
        ) : (
          <>
            <CalendarClock className="size-4" aria-hidden />
            Book Reservation
          </>
        )}
      </Button>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Phone className="size-3.5 text-gold" aria-hidden />
        No deposit needed — pay per head at the counter. Call{" "}
        <a
          href={RESTAURANT.phoneHref}
          className="text-gold underline-offset-4 hover:underline"
        >
          {RESTAURANT.phoneDisplay}
        </a>
      </p>
    </form>
  );
}
