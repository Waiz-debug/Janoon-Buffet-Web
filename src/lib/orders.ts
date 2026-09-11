export const ORDER_STATUSES = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
} as const;

export const STATUS_LABELS: Record<(typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES], string> =
  {
    pending: "Pending",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
  };

export const TIER_PRICES = {
  "monday-thursday": { label: "Mon – Thu", price: 2000, note: "per person, all you can eat" },
  "fri-sun": { label: "Fri – Sun", price: 2500, note: "per person, live BBQ counters" },
  "festive": { label: "Festive nights", price: 3000, note: "per person, extended menu" },
} as const;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Fulfilled date shown on the served card. Leave undefined if none set. */
export function fulfilledAt(seconds: number | undefined) {
  if (!seconds || seconds <= 0) return undefined;
  return DATE_FORMATTER.format(new Date(seconds * 1000));
}
