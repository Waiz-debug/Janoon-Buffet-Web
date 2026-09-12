import { PortalCard, PortalFrame } from "@/components/tribe/PortalFrame";
import { CalendarCheck, Clock3, ConciergeBell } from "lucide-react";

const DESK_ITEMS = [
  {
    icon: CalendarCheck,
    title: "Live reservations",
    body: "Tonight's bookings at a glance — confirm arrivals, seat parties and flag no-shows without leaving the floor.",
    ready: true,
    action: { label: "Open reservations desk", href: "/dashboard" },
  },
  {
    icon: ConciergeBell,
    title: "Order feed",
    body: "Buffet orders streaming in from the counters, tracked from prep to served.",
    ready: false,
  },
  {
    icon: Clock3,
    title: "Shift handover",
    body: "A quiet summary of covers served and outstanding tables between shifts.",
    ready: false,
  },
];

export default function StaffPortal() {
  return (
    <PortalFrame
      badge="Staff portal"
      title="The floor desk"
      description="Everything the evening team needs while the terrace is full — arrivals, seating and the order feed, in one place."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {DESK_ITEMS.map((item) => (
          <PortalCard key={item.title} {...item} />
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        The reservations desk signs in with your staff email — the PIN only
        guards this portal.
      </p>
    </PortalFrame>
  );
}
