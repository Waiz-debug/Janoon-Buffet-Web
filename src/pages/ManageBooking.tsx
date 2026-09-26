import { ContactFooter } from "@/components/tribe/ContactFooter";
import { SiteHeader } from "@/components/tribe/SiteHeader";
import {
  ReservationStatusBadge,
  RESERVATION_STATUS_LABELS,
} from "@/components/tribe/ReservationStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReservationLookup } from "@/hooks/use-live-db";
import { cancelReservationByGuest } from "@/lib/db";
import {
  clearReservationPointer,
  readReservationPointer,
  saveReservationPointer,
} from "@/lib/last-reservation";
import {
  RESTAURANT,
  formatDate,
  formatPhone,
  formatTime,
} from "@/lib/restaurant";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Phone,
  Search,
  Trees,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Lookup = { reference: string; phone: string };

/** Read the device pointer synchronously on the client, never during SSR. */
function storedLookup(): Lookup | null {
  if (typeof window === "undefined") return null;
  return readReservationPointer();
}

export default function ManageBooking() {
  const [pointer] = useState(storedLookup);
  const [reference, setReference] = useState(pointer?.reference ?? "");
  const [phone, setPhone] = useState(pointer?.phone ?? "");
  const [lookup, setLookup] = useState<Lookup | null>(pointer);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  /** A reference cancelled during this visit, announced on its own. */
  const [cancelledNow, setCancelledNow] = useState<string | null>(null);

  // The reservation is always fetched from the database for the lookup in
  // state, so a refresh (or a desk-side change) re-loads it on first render.
  // (The stored pointer is read by `storedLookup` during the first render, so
  // there is nothing to hydrate from an effect.)
  const reservation = useReservationLookup(
    lookup?.reference ?? null,
    lookup?.phone ?? "",
  );

  // Remember the booking once it resolves, so the next visit opens it directly.
  useEffect(() => {
    if (!reservation || reservation.status === "cancelled") return;
    saveReservationPointer({
      reference: reservation.reference,
      phone: reservation.phone,
    });
  }, [reservation]);

  // A cancelled booking is taken off the website, including here — whether it
  // was cancelled a moment ago or by the reservations desk on the guest's
  // behalf. The record itself decides it, so a desk-side cancellation shows the
  // released card too instead of the lookup form quietly reappearing.
  const cancelled = reservation?.status === "cancelled" ? reservation : null;
  const releasedReference = cancelledNow ?? cancelled?.reference ?? null;
  // A released booking must not leave the lookup form filled in as if it still
  // stood, so the panel stays closed for the rest of the visit.
  const activeLookup = releasedReference ? null : lookup;

  // The stale pointer only lives in session storage, so clearing it is the one
  // side effect left here.
  useEffect(() => {
    if (cancelled) clearReservationPointer();
  }, [cancelled]);

  useEffect(() => {
    document.title = `Manage a reservation · ${RESTAURANT.name}`;
  }, []);

  const handleLookup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = reference.trim().toUpperCase();
    const digits = phone.replace(/[^\d]/g, "");
    if (!code) {
      setError("Enter the booking reference shown on your confirmation.");
      return;
    }
    if (digits.length < 6) {
      setError("Enter the phone number the table was booked with.");
      return;
    }
    setError(null);
    setConfirmingCancel(false);
    setCancelledNow(null);
    setLookup({ reference: code, phone: phone.trim() });
  };

  const handleCancel = async () => {
    if (!reservation) return;
    const reference = reservation.reference;
    setIsCancelling(true);
    try {
      await cancelReservationByGuest(reference, reservation.phone);
      clearReservationPointer();
      setConfirmingCancel(false);
      setLookup(null);
      setCancelledNow(reference);
      toast.success("Reservation cancelled", {
        description: `Reference ${reference} has been released.`,
      });
    } catch (cancelError) {
      const message =
        cancelError instanceof Error
          ? cancelError.message.split("\n")[0]
          : "Could not cancel this reservation.";
      toast.error("Could not cancel", { description: message });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="pt-16 sm:pt-20">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:py-20">
          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[0.7rem] tracking-[0.2em] text-gold uppercase">
              Reservations
            </span>
            <h1 className="font-display text-4xl leading-tight font-semibold text-balance sm:text-5xl">
              Manage a reservation
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Enter the booking reference from your confirmation alongside the
              phone number the table was booked with. You can review the details
              and cancel at no charge, at any hour, until your table is seated.
            </p>
            <div className="flex flex-col gap-3 border-t border-border/70 pt-6 text-sm">
              <a
                href={RESTAURANT.phoneHref}
                className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-gold"
              >
                <Phone className="size-4 text-gold" aria-hidden />
                Prefer to speak to us? Call {RESTAURANT.phoneDisplay}
              </a>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {RESTAURANT.address}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <form
              onSubmit={handleLookup}
              className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card/50 p-6 sm:p-8"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="lookup-reference">Booking reference</Label>
                <Input
                  id="lookup-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="TT-4F2K"
                  autoComplete="off"
                  className="h-11 tracking-[0.18em] uppercase"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lookup-phone">Phone number</Label>
                <Input
                  id="lookup-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="0300 0000000"
                  className="h-11"
                />
              </div>

              {error ? <p className="text-xs text-destructive">{error}</p> : null}

              <Button type="submit" className="h-11 w-full gap-2">
                <Search className="size-4" aria-hidden />
                Find my booking
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your details stay on our reservations desk and are never shared.
              </p>
            </form>

            {releasedReference ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col gap-4 rounded-2xl border border-gold/30 bg-gold/[0.06] p-6 sm:p-8"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                    <CheckCircle2 className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-semibold">
                      Reservation cancelled
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Reference {releasedReference} has been released and removed
                      from the website. No table is being held.
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  You are welcome to reserve another table — reservations cost
                  nothing online, and a booking can be changed or cancelled
                  here at any time.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild className="gap-2">
                    <Link to="/#reserve">
                      <CalendarCheck className="size-4" aria-hidden />
                      Book Another Table
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border/70"
                    onClick={() => {
                      setCancelledNow(null);
                      setReference("");
                      setPhone("");
                      setError(null);
                    }}
                  >
                    Look up a different booking
                  </Button>
                </div>
              </motion.div>
            ) : activeLookup ? (
              reservation === undefined ? (
                <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-card/40 py-14">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : reservation === null ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-6 text-center">
                  <p className="font-display text-lg font-semibold">
                    We could not find that booking
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Check the reference on your confirmation and use the same
                    phone number you booked with. If it still will not open, call{" "}
                    <a
                      href={RESTAURANT.phoneHref}
                      className="text-gold underline-offset-4 hover:underline"
                    >
                      {RESTAURANT.phoneDisplay}
                    </a>{" "}
                    and we will find it for you.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card/50 p-6 sm:p-8"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                        Reference {reservation.reference}
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-semibold">
                        {reservation.name}
                      </h2>
                    </div>
                    <ReservationStatusBadge status={reservation.status} />
                  </div>

                  <dl className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                        Arrival
                      </dt>
                      <dd className="mt-1.5 flex items-center gap-2 text-sm">
                        <CalendarClock className="size-3.5 text-gold" aria-hidden />
                        {formatDate(reservation.date)} ·{" "}
                        {formatTime(reservation.time)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                        Guests
                      </dt>
                      <dd className="mt-1.5 flex items-center gap-2 text-sm">
                        <Users className="size-3.5 text-gold" aria-hidden />
                        {reservation.partySize}{" "}
                        {reservation.partySize === 1 ? "guest" : "guests"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                        Seating
                      </dt>
                      <dd className="mt-1.5 flex items-center gap-2 text-sm capitalize">
                        <Trees className="size-3.5 text-gold" aria-hidden />
                        {reservation.seating}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
                        Contact
                      </dt>
                      <dd className="mt-1.5 text-sm">
                        {formatPhone(reservation.phone)}
                      </dd>
                    </div>
                  </dl>

                  {reservation.notes ? (
                    <p className="rounded-xl bg-background/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                      “{reservation.notes}”
                    </p>
                  ) : null}

                  {reservation.status === "seated" ? (
                    <p className="rounded-xl border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                      Your party has already been seated. Please speak to our floor
                      team or call {RESTAURANT.phoneDisplay} if anything needs to
                      change.
                    </p>
                  ) : confirmingCancel ? (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                      <p className="text-sm">
                        Cancel the table for {reservation.partySize} guests on{" "}
                        {formatDate(reservation.date)} at{" "}
                        {formatTime(reservation.time)}?
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
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-fit gap-2 border-border/70 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmingCancel(true)}
                    >
                      <XCircle className="size-4" aria-hidden />
                      Cancel this reservation
                    </Button>
                  )}

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Current status:{" "}
                    {RESERVATION_STATUS_LABELS[reservation.status].toLowerCase()}.
                    Our floor team calls every booking to confirm, so a change here
                    is applied immediately.
                  </p>
                </motion.div>
              )
            ) : null}
          </div>
        </section>
      </main>

      <ContactFooter />
    </div>
  );
}
