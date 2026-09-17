import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { usePublicPreOrderItems } from "@/hooks/use-live-db";
import { createPreorder } from "@/lib/db";
import { formatRupees, preOrderCategoryLabel } from "@/lib/menu";
import { RESTAURANT, dayKeyFromMs } from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { CalendarClock, Clock, Flame, Loader2, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** The dishes shown when Supabase has no pre-order items yet. */
const FALLBACK_DISHES = [
  {
    id: "mutton-dumpukht",
    name: "Mutton Dumpukht",
    urdu: "دم پخت",
    description:
      "Slow-cooked for 6+ hours in a sealed handi with whole spices and bone marrow. Available on 24-hour pre-order only.",
    price: 3500,
    category: "slow-cooked",
    serves: "2–4 guests",
  },
  {
    id: "whole-roasted-sajji",
    name: "Whole Roasted Sajji",
    urdu: "سجی",
    description:
      "Marinated whole chicken roasted over open coals for hours. Pre-order by noon for evening collection.",
    price: 2800,
    category: "grills",
    serves: "3–5 guests",
  },
  {
    id: "seekh-kebab-platter",
    name: "Seekh Kebab Platter (Party)",
    urdu: "سیخ کباب پلیٹر",
    description:
      "A 50-piece mixed platter of our charcoal seekh kebabs — beef and chicken — for large family gatherings.",
    price: 8000,
    category: "platters",
    serves: "10–15 guests",
  },
] as const;

/** One row on the pre-order board — live items and the fallback share it. */
type PreOrderCard = {
  id: string;
  name: string;
  urdu: string;
  description: string;
  price: number;
  category: string;
  serves: string;
  image?: string;
};

/** Available pickup slots for the next 2 days. */
function getSlots() {
  const slots: { label: string; time: string; date: string }[] = [];
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    // Local calendar day — `toISOString()` would roll back a day in PKT.
    const dateStr = dayKeyFromMs(date.getTime());
    const dayLabel = dayOffset === 0 ? "Today" : "Tomorrow";
    // Evening slots from 5 PM to 10 PM
    for (let h = 17; h <= 22; h++) {
      const hour = String(h).padStart(2, "0");
      slots.push({
        label: `${dayLabel} ${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`,
        time: `${hour}:00`,
        date: dateStr,
      });
    }
  }
  return slots;
}

export function PreOrderSection() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null);

  // Live from Supabase — whatever the admin adds, hides or re-prices is
  // reflected here without a reload. The built-in list stands in until the
  // table has been seeded.
  const liveItems = usePublicPreOrderItems();
  const dishes: PreOrderCard[] =
    liveItems && liveItems.length > 0
      ? liveItems.map((item) => ({
          id: item.id,
          name: item.name,
          urdu: item.urdu ?? "",
          description: item.description ?? "",
          price: item.price,
          category: item.category,
          serves: item.serves ?? "",
          image: item.image,
        }))
      : FALLBACK_DISHES.map((dish) => ({ ...dish, image: undefined }));

  const slots = getSlots();
  const selectedDish = dishes.find((dish) => dish.id === selectedId);

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, "");
    const nextErrors: Record<string, string> = {};
    if (!selectedDish) nextErrors.dish = "Choose a dish to pre-order.";
    if (!selectedSlot) nextErrors.slot = "Pick a pickup slot.";
    if (name.trim().length < 2) {
      nextErrors.name = "Please enter the name for the pre-order.";
    }
    if (digits.length < 10 || digits.length > 15) {
      nextErrors.phone = "Enter a valid phone number we can reach you on.";
    }
    setErrors(nextErrors);
    const firstError = Object.values(nextErrors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }
    if (!selectedDish || !selectedSlot) return;

    // The slot key is `<YYYY-MM-DD>:<HH:MM>` — split on the first colon only.
    const separator = selectedSlot.indexOf(":");
    setIsSubmitting(true);
    try {
      const { reference } = await createPreorder({
        customerName: name,
        phone,
        dish: selectedDish.name,
        pickupDate: selectedSlot.slice(0, separator),
        pickupTime: selectedSlot.slice(separator + 1),
      });
      setConfirmedRef(reference);
      toast.success("Pre-order sent to the kitchen", {
        description: `${selectedDish.name} · reference ${reference}. Our team will call ${phone} to confirm.`,
      });
      setSelectedId(null);
      setSelectedSlot(null);
      setName("");
      setPhone("");
      setErrors({});
    } catch (error) {
      toast.error("Could not place the pre-order", {
        description:
          error instanceof Error
            ? error.message.split("\n")[0]
            : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="preorder" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pre-Order Specialties"
          title="Slow-cooked, worth the wait"
          description="Some dishes need hours of preparation. Book your Dumpukht, Sajji or party platter at least 24 hours ahead and collect at your chosen time."
          align="center"
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Dishes list */}
          <div className="flex flex-col gap-4">
            {dishes.map((dish) => (
              <motion.button
                key={dish.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4 }}
                onClick={() => {
                  setSelectedId(dish.id);
                  setErrors((previous) => {
                    if (!previous.dish) return previous;
                    const next = { ...previous };
                    delete next.dish;
                    return next;
                  });
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-5 text-left transition-all",
                  selectedId === dish.id
                    ? "border-gold/50 bg-gold/[0.08] shadow-[0_0_30px_rgba(212,168,83,0.08)]"
                    : "border-border/70 bg-card/40 hover:border-gold/25",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {dish.image ? (
                      <span className="size-12 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/60">
                        <img
                          src={dish.image}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <h4 className="font-display text-base font-semibold">
                        {dish.name}
                      </h4>
                      {dish.urdu ? (
                        <p className="text-xs text-gold/60" dir="rtl" lang="ur">
                          {dish.urdu}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                    {formatRupees(dish.price)}
                  </span>
                </div>
                {dish.description ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {dish.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-[0.65rem] tracking-wide uppercase">
                    {preOrderCategoryLabel(dish.category)}
                  </span>
                  {dish.serves ? (
                    <span className="flex items-center gap-1">
                      <Flame className="size-3 text-gold" aria-hidden />
                      Serves {dish.serves}
                    </span>
                  ) : null}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Booking form */}
          <div className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card/50 p-6 lg:sticky lg:top-28 lg:h-fit">
            <h3 className="font-display text-lg font-semibold">
              Choose your pickup slot
            </h3>

            {/* Time slots grid */}
            <div className="flex flex-col gap-3">
              <Label className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                <CalendarClock className="mr-1.5 inline size-3.5" aria-hidden />
                Pickup time
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const slotKey = `${slot.date}:${slot.time}`;
                  return (
                    <button
                      key={slotKey}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(slotKey);
                        setErrors((previous) => {
                          if (!previous.slot) return previous;
                          const next = { ...previous };
                          delete next.slot;
                          return next;
                        });
                      }}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
                        selectedSlot === slotKey
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-border/70 text-muted-foreground hover:border-gold/20 hover:text-foreground",
                      )}
                    >
                      <Clock className="size-3" aria-hidden />
                      <span className="text-[0.65rem] font-medium leading-tight">
                        {slot.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact details */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preorder-name">Your name</Label>
                <Input
                  id="preorder-name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  aria-invalid={Boolean(errors.name)}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((previous) => {
                      if (!previous.name) return previous;
                      const next = { ...previous };
                      delete next.name;
                      return next;
                    });
                  }}
                  placeholder="e.g. Ahmed Khan"
                />
                {errors.name ? (
                  <p className="text-xs text-destructive">{errors.name}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preorder-phone">Phone number</Label>
                <Input
                  id="preorder-phone"
                  name="phone"
                  // A real `tel` field: mobile keyboards open on the number pad
                  // and the value is stored exactly as typed, so `+92 3XX…`
                  // and `03XX-XXXXXXX` both go through.
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  aria-invalid={Boolean(errors.phone)}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors((previous) => {
                      if (!previous.phone) return previous;
                      const next = { ...previous };
                      delete next.phone;
                      return next;
                    });
                  }}
                  placeholder="03XX XXXXXXX"
                />
                {errors.phone ? (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    We call this number to confirm your pre-order.
                  </p>
                )}
              </div>
            </div>

            {confirmedRef ? (
              <p
                role="status"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 text-center text-xs leading-relaxed text-emerald-300"
              >
                Sent to the kitchen — reference{" "}
                <span className="font-mono tracking-[0.14em]">{confirmedRef}</span>
                . Keep it for when we call to confirm.
              </p>
            ) : null}

            <Button
              size="lg"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
              className="h-12 gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CalendarClock className="size-4" aria-hidden />
              )}
              {isSubmitting ? "Submitting…" : "Request pre-order"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Our team will call to confirm availability and take payment.
            </p>

            <div className="mt-2 flex items-center justify-center gap-2 border-t border-border/60 pt-4">
              <Phone className="size-3.5 text-gold" aria-hidden />
              <a
                href={RESTAURANT.phoneHref}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Questions? Call {RESTAURANT.phoneDisplay}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
