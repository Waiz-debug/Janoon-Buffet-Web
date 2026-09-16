import { useDeliveryOrders, usePreorders, useReservations } from "@/hooks/use-live-db";
import { useLiveSite } from "@/hooks/use-live-site";
import { SIGNATURE_LIMIT } from "@/lib/menu";
import { CalendarCheck, Camera, Coffee, Package, ShoppingCart, Star, UtensilsCrossed, Users } from "lucide-react";
import { motion } from "framer-motion";

const CARD =
  "flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur transition-colors hover:border-gold/30";

export function AdminOverview() {
  const deliveries = useDeliveryOrders() ?? [];
  const preorders = usePreorders() ?? [];
  const reservations = useReservations() ?? [];
  const { gallery, addons, signatures, content: siteContent } = useLiveSite();

  const activeDeliveries = deliveries.filter(
    (d) => d.status === "placed" || d.status === "confirmed",
  );
  const activePreorders = preorders.filter(
    (p) => p.status === "pending" || p.status === "confirmed",
  );
  const activeReservations = reservations.filter(
    (r) => r.status === "pending" || r.status === "confirmed",
  );

  const totalTodayOrders =
    activeDeliveries.length + activePreorders.length + activeReservations.length;

  const gallerySlots = gallery.filter((g) => g.url).length;
  const signatureCount = signatures.length;
  const seatingCounter = siteContent["experience-seats"] ?? "4\u201320";

  const metrics = [
    {
      icon: ShoppingCart,
      label: "Active deliveries",
      value: activeDeliveries.length,
      accent: "text-amber-400",
    },
    {
      icon: Coffee,
      label: "Active pre-orders",
      value: activePreorders.length,
      accent: "text-orange-400",
    },
    {
      icon: CalendarCheck,
      label: "Active reservations",
      value: activeReservations.length,
      accent: "text-emerald-400",
    },
    {
      icon: Package,
      label: "Total active today",
      value: totalTodayOrders,
      accent: "text-gold",
    },
    {
      icon: UtensilsCrossed,
      label: "Menu items live",
      value: addons.length,
      accent: "text-amber-300",
    },
    {
      icon: Camera,
      label: "Gallery tiles filled",
      value: gallerySlots,
      accent: "text-amber-300",
    },
    {
      icon: Star,
      label: "Signature dishes",
      value: `${signatureCount} / ${SIGNATURE_LIMIT}`,
      accent: "text-gold",
    },
    {
      icon: Users,
      label: "Seating counter",
      value: seatingCounter,
      accent: "text-gold",
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-base font-semibold">
          Live dashboard
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time snapshot of every active record and asset on the public
          site — updates automatically.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className={CARD}
          >
            <span className="flex items-center gap-2 text-xs tracking-wide text-muted-foreground uppercase">
              <m.icon className={`size-3.5 ${m.accent}`} aria-hidden />
              {m.label}
            </span>
            <span className={`font-display text-2xl font-semibold ${m.accent}`}>
              {m.value}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
