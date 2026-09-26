import { SiteHeader } from "@/components/tribe/SiteHeader";
import { ContactFooter } from "@/components/tribe/ContactFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePricedCart } from "@/hooks/use-priced-cart";
import { placeDeliveryOrder } from "@/lib/db";
import { formatRupees, FREE_DELIVERY_THRESHOLD } from "@/lib/menu";
import { RESTAURANT } from "@/lib/restaurant";
import { cn } from "@/lib/utils";
import {
  Bike,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  MapPin,
  ShoppingBag,
} from "lucide-react";
import { OrderTracker } from "@/components/tribe/OrderTracker";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const AREAS = [
  "DHA Phase 1-6",
  "Gulberg",
  "Johar Town",
  "Model Town",
  "Bahria Town",
  "Cantt",
  "Faisal Town",
  "Askari",
  "Wapda Town",
  "Valencia",
] as const;

type Placed = { reference: string; total: number };

export default function Order() {
  const navigate = useNavigate();
  // The bag is a device-side convenience; the numbers on this page are priced
  // from the live menu, and `place_delivery_order()` prices them again on the
  // server. Nothing here is taken on trust from storage.
  const { items, itemsTotal, itemCount, setCount, clear } = usePricedCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [notes, setNotes] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);

  useEffect(() => {
    document.title = `Delivery checkout · ${RESTAURANT.name}`;
  }, []);

  const deliveryFee =
    itemsTotal >= FREE_DELIVERY_THRESHOLD || items.length === 0 ? 0 : 150;
  const total = itemsTotal + deliveryFee;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (items.length === 0 || isPlacing) return;
    setIsPlacing(true);
    try {
      const result = await placeDeliveryOrder({
        customerName: name,
        phone,
        address,
        area,
        notes: notes.trim() ? notes : undefined,
        items: items.map((line) => ({
          slug: line.slug,
          name: line.name,
          count: line.count,
        })),
      });
      setPlaced({ reference: result.reference, total: result.total });
      clear();
      toast.success("Order placed", {
        description: `Reference ${result.reference} — we will call to confirm.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.split("\n")[0]
          : "Could not place the order. Please try again.";
      toast.error("Order not placed", { description: message });
    } finally {
      setIsPlacing(false);
    }
  };

  if (placed) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
          <span className="flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
            <CheckCircle2 className="size-8" aria-hidden />
          </span>
          <h1 className="mt-6 font-display text-3xl font-semibold text-balance">
            Your order is on the fire
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Reference <span className="font-semibold text-gold">{placed.reference}</span>{" "}
            · {formatRupees(placed.total)} payable on delivery. Our team will
            call {phone} shortly to confirm the timing.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/restaurant">Back to the restaurant</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/manage">Manage a reservation</Link>
            </Button>
          </div>
          <OrderTracker reference={placed.reference} phone={phone} />
        </main>
        <ContactFooter />
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-card/60 text-muted-foreground">
            <ShoppingBag className="size-6" aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold">
            Your cart is empty
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick your dishes from the menu and we will deliver them.
          </p>
          <Button asChild className="mt-6">
            <Link to="/restaurant#menu">
              <ChevronLeft className="size-4" aria-hidden />
              Browse the menu
            </Link>
          </Button>
        </main>
        <ContactFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-28 sm:px-6 sm:py-32">
        <button
          type="button"
          onClick={() => navigate("/restaurant#menu")}
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Add more dishes
        </button>

        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Delivery checkout
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cash on delivery across Lahore. Orders over{" "}
          {formatRupees(FREE_DELIVERY_THRESHOLD)} deliver free; otherwise a{" "}
          {formatRupees(150)} rider fee applies.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Delivery details */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <MapPin className="size-4 text-gold" aria-hidden />
                Where should we bring it?
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="order-name">Your name</Label>
                  <Input
                    id="order-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Ahmed Raza"
                    required
                    minLength={2}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="order-phone">Phone number</Label>
                  <Input
                    id="order-phone"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value.replace(/[^\d+ ]/g, ""))
                    }
                    placeholder="03XX XXXXXXX"
                    inputMode="tel"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="order-address">Street address</Label>
                <Input
                  id="order-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House, street, sector"
                  required
                  minLength={8}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="order-area">Area</Label>
                <select
                  id="order-area"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {AREAS.map((option) => (
                    <option key={option} value={option} className="bg-card">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="order-notes">
                  Rider notes <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="order-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Gate code, landmark, spice level…"
                />
              </div>
            </section>

            <Button
              type="submit"
              size="lg"
              disabled={isPlacing}
              className="h-12 gap-2"
            >
              {isPlacing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Bike className="size-4" aria-hidden />
              )}
              {isPlacing ? "Placing your order…" : `Place order · ${formatRupees(total)}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              No online payment — pay the rider when your food arrives.
            </p>
          </form>

          {/* Order summary */}
          <aside className="h-fit rounded-2xl border border-border/70 bg-card/60 p-6 lg:sticky lg:top-28">
            <h2 className="font-display text-lg font-semibold">Your plates</h2>
            <ul className="mt-4 flex flex-col divide-y divide-border/60">
              {items.map((line) => (
                <li key={line.slug} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.unitPrice > 0
                        ? `${formatRupees(line.unitPrice)} each`
                        : "Ask at the counter"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`One less ${line.name}`}
                      onClick={() => setCount(line.slug, line.count - 1)}
                      className="size-7 rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {line.count}
                    </span>
                    <button
                      type="button"
                      aria-label={`One more ${line.name}`}
                      onClick={() => setCount(line.slug, line.count + 1)}
                      className="size-7 rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-5 flex flex-col gap-1.5 border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Items</dt>
                <dd>{formatRupees(itemsTotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Delivery</dt>
                <dd>{deliveryFee === 0 ? "Free" : formatRupees(deliveryFee)}</dd>
              </div>
              <div className="mt-1 flex justify-between font-display text-base font-semibold">
                <dt>Total</dt>
                <dd className="text-gold">{formatRupees(total)}</dd>
              </div>
            </dl>

            <p
              className={cn(
                "mt-4 rounded-xl border px-3 py-2 text-xs",
                deliveryFee === 0
                  ? "border-gold/25 bg-gold/10 text-gold"
                  : "border-gold/25 bg-gold/[0.06] text-muted-foreground",
              )}
            >
              {deliveryFee === 0
                ? "Free delivery unlocked."
                : `Add ${formatRupees(FREE_DELIVERY_THRESHOLD - itemsTotal)} more for free delivery.`}
            </p>
          </aside>
        </div>
      </main>

      <ContactFooter />
    </div>
  );
}
