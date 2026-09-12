import { PortalCard, PortalFrame } from "@/components/tribe/PortalFrame";
import { CalendarCheck, ImagePlus, UtensilsCrossed } from "lucide-react";

const ADMIN_ITEMS = [
  {
    icon: UtensilsCrossed,
    title: "Menu & pricing",
    body: "Edit dishes, categories and the Rs 2,000–3,000 buffet tiers — changes reach the public site the moment you save.",
    ready: false,
  },
  {
    icon: ImagePlus,
    title: "Restaurant photos",
    body: "Replace demo imagery with real photos of the terrace, the grill and the dishes as they leave the pass.",
    ready: false,
  },
  {
    icon: CalendarCheck,
    title: "Reservations",
    body: "Review, confirm and close out every table booking in one place.",
    ready: true,
    action: { label: "Open reservations desk", href: "/dashboard" },
  },
];

export default function AdminPortal() {
  return (
    <PortalFrame
      badge="Admin portal"
      title="The management side of the hearth"
      description="Menu and pricing control, real photography and every reservation — the tools that keep the buffet honest."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {ADMIN_ITEMS.map((item) => (
          <PortalCard key={item.title} {...item} />
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        The reservations desk signs in with your admin email — the PIN only
        guards this portal.
      </p>
    </PortalFrame>
  );
}
