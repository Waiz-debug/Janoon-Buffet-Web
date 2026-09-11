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
import { api } from "@/convex/_generated/api";
import {
  ARRIVAL_SLOTS,
  RESTAURANT,
  formatDate,
  formatTime,
  todayKey,
} from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Phone,
  Trees,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useMemo, useState } from "react";
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

type BookingConfirmation = {
  reference: string;
  name: string;
  partySize: number;
  date: string;
  time: string;
  seating: Seating;
};

const PARTY_SIZES = Array.from({ length: 12 }, (_, index) => String(index + 1));

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

export function ReservationForm() {
  const createReservation = useMutation(api.reservations.create);
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const minDate = useMemo(() => todayKey(), []);

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

      setConfirmation({
        reference: result.reference,
        name: form.name.trim(),
        partySize: Number(form.partySize),
        date: form.date,
        time: form.time,
        seating: form.seating,
      });
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

  if (confirmation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex flex-col gap-6 rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/12 to-card/60 p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold">
              Your table is requested, {confirmation.name.split(" ")[0]}!
            </h3>
            <p className="text-sm text-muted-foreground">
              Our floor team will call you shortly to confirm.
            </p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <dt className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
              Booking reference
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tracking-wider text-gold">
              {confirmation.reference}
            </dd>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            <dt className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
              Your table
            </dt>
            <dd className="mt-1 flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-2">
                <Users className="size-3.5 text-gold" aria-hidden />
                {confirmation.partySize}{" "}
                {confirmation.partySize === 1 ? "guest" : "guests"}
              </span>
              <span className="flex items-center gap-2">
                <CalendarClock className="size-3.5 text-gold" aria-hidden />
                {formatDate(confirmation.date)} · {formatTime(confirmation.time)}
              </span>
              <span className="flex items-center gap-2 capitalize">
                <Trees className="size-3.5 text-gold" aria-hidden />
                {confirmation.seating} seating
              </span>
            </dd>
          </div>
        </dl>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Keep this reference handy. Running early or late? Call{" "}
          <a
            href={RESTAURANT.phoneHref}
            className="text-gold underline-offset-4 hover:underline"
          >
            {RESTAURANT.phoneDisplay}
          </a>{" "}
          and we will hold your table for 20 minutes past your arrival time.
        </p>

        <Button
          type="button"
          variant="outline"
          className="w-full border-gold/30"
          onClick={() => {
            setConfirmation(null);
            setForm(initialForm());
          }}
        >
          Book another table
        </Button>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-3xl border border-border/70 bg-card/60 p-6 sm:p-8"
    >
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
          <p className="text-xs text-muted-foreground">Open 24 hours — all slots live.</p>
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
        className="h-12 w-full gap-2 bg-gradient-to-r from-primary to-ember text-primary-foreground shadow-lg shadow-ember/20"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Saving your table…
          </>
        ) : (
          <>
            <CalendarClock className="size-4" aria-hidden />
            Reserve my table
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
