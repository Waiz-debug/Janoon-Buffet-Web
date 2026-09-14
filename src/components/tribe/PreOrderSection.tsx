import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/tribe/SectionHeading";
import { RESTAURANT } from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { CalendarClock, Clock, Flame, Loader2, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PREORDER_DISHES = [
  {
    name: "Mutton Dumpukht",
    urdu: "دم پخت",
    description:
      "Slow-cooked for 6+ hours in a sealed handi with whole spices and bone marrow. Available on 24-hour pre-order only.",
    estimatedPrice: "Rs 3,500",
    serves: "2–4 guests",
  },
  {
    name: "Whole Roasted Sajji",
    urdu: "سجی",
    description:
      "Marinated whole chicken roasted over open coals for hours. Pre-order by noon for evening collection.",
    estimatedPrice: "Rs 2,800",
    serves: "3–5 guests",
  },
  {
    name: "Seekh Kebab Platter (Party)",
    urdu: "سیخ کباب پلیٹر",
    description:
      "A 50-piece mixed platter of our charcoal seekh kebabs — beef and chicken — for large family gatherings.",
    estimatedPrice: "Rs 8,000",
    serves: "10–15 guests",
  },
] as const;

/** Available pickup slots for the next 2 days. */
function getSlots() {
  const slots: { label: string; time: string; date: string }[] = [];
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split("T")[0];
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
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slots = getSlots();

  const handleSubmit = () => {
    if (!selectedDish || !selectedSlot || !name.trim() || !phone.trim()) {
      toast.error("Please fill in all fields and select a dish and time slot.");
      return;
    }
    setIsSubmitting(true);
    // Simulate booking — in production this would hit a Convex mutation
    setTimeout(() => {
      const dish = PREORDER_DISHES.find((d) => d.name === selectedDish);
      toast.success("Pre-order request received", {
        description: `${dish?.name} — our team will call ${phone} to confirm.`,
      });
      setSelectedDish(null);
      setSelectedSlot(null);
      setName("");
      setPhone("");
      setIsSubmitting(false);
    }, 1000);
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
            {PREORDER_DISHES.map((dish) => (
              <motion.button
                key={dish.name}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4 }}
                onClick={() => setSelectedDish(dish.name)}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-5 text-left transition-all",
                  selectedDish === dish.name
                    ? "border-gold/50 bg-gold/[0.08] shadow-[0_0_30px_rgba(212,168,83,0.08)]"
                    : "border-border/70 bg-card/40 hover:border-gold/25",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-display text-base font-semibold">
                      {dish.name}
                    </h4>
                    <p className="text-xs text-gold/60">{dish.urdu}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                    {dish.estimatedPrice}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {dish.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Flame className="size-3 text-gold" aria-hidden />
                    Serves {dish.serves}
                  </span>
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
                      onClick={() => setSelectedSlot(slotKey)}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmed Khan"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preorder-phone">Phone number</Label>
                <Input
                  id="preorder-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\\d+ ]/g, ""))}
                  placeholder="03XX XXXXXXX"
                  inputMode="tel"
                />
              </div>
            </div>

            <Button
              size="lg"
              disabled={!selectedDish || !selectedSlot || !name.trim() || !phone.trim() || isSubmitting}
              onClick={handleSubmit}
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
