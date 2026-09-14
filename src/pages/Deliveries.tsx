import { DeliveryOrderCard } from "@/components/tribe/DeliveryOrderCard";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { DeliveryStatus } from "@/convex/schema";
import { RESTAURANT } from "@/lib/restaurant";
import { useMutation, useQuery } from "convex/react";
import {
  Bike,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Phone,
  Receipt,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type DeliveryOrder = Doc<"deliveryOrders">;

export default function Deliveries() {
  const orders = useQuery(api.delivery.list);
  const advanceStatus = useMutation(api.delivery.advanceStatus);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Delivery desk · ${RESTAURANT.name}`;
  }, []);

  const setStatus = async (order: DeliveryOrder, status: DeliveryStatus) => {
    setBusyId(order._id);
    try {
      await advanceStatus({ id: order._id, status });
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
  const active = all.filter((order) => order.status !== "delivered");
  const done = all.filter((order) => order.status === "delivered");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
              <Bike className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Delivery desk</p>
              <p className="text-[0.65rem] tracking-[0.2em] text-gold/80 uppercase">
                {RESTAURANT.name}
              </p>
            </div>
          </div>
          <Link
            to="/staff"
            className="rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Back to portals
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {orders === undefined ? (
          <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading the delivery feed…
          </p>
        ) : (
          <>
            <section>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <ClipboardList className="size-5 text-gold" aria-hidden />
                Active orders
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                  {active.length}
                </span>
              </h2>
              {active.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                  No orders in the kitchen right now.
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

            {done.length > 0 ? (
              <section className="mt-10">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-muted-foreground">
                  <Receipt className="size-5" aria-hidden />
                  Delivered
                  <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium">
                    {done.length}
                  </span>
                </h2>
                <div className="mt-4 grid gap-4 opacity-70 md:grid-cols-2 xl:grid-cols-3">
                  {done.slice(0, 6).map((order) => (
                    <DeliveryOrderCard
                      key={order._id}
                      order={order}
                      onConfirm={() => {}}
                      onDeliver={() => {}}
                      busy={false}
                    />
                  ))}
                </div>
                {done.length > 6 ? (
                  <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden />
                    Showing the 6 most recent of {done.length} completed orders.
                  </p>
                ) : null}
              </section>
            ) : null}

            <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <Phone className="size-3.5 text-gold" aria-hidden />
              Customer questions? Call the floor on {RESTAURANT.phoneDisplay}.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
