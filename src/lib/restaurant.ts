/**
 * JUNOON — single source of truth for public site content.
 *
 * Photos: swap these Unsplash placeholders for real photos of the Gulberg
 * seating area and live counters. Every image degrades to a themed tile
 * if it fails to load, so the layout never breaks.
 */

const unsplash = (id: string, width = 1000) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;

export const RESTAURANT = {
  name: "JUNOON",
  tagline: "24/7 open buffet",
  phoneDisplay: "0333 4363996",
  phoneHref: "tel:+923334363996",
  /** WhatsApp click-to-chat — international format, no leading zero. */
  whatsappNumber: "923334363996",
  whatsappUrl: "https://wa.me/923334363996",
  whatsappDisplay: "0333 4363996",
  address: "Gulberg, Lahore",
  hours: "Open 24 hours, every day",
  rating: 4.6,
  reviewCount: 72,
  buffetRange: "Rs 2,000 – 3,000",
  instagramHandle: "@junoonrestaurant",
  instagramUrl:
    "https://www.instagram.com/junoonrestaurant?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==",
  facebookUrl: "https://www.facebook.com/junoonrestaurantpk/",
  tiktokUrl: "https://www.tiktok.com/@junoonrestaurant",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=JUNOON+Gulberg+Lahore",
  heroImage: unsplash("photo-1517248135467-4c7edcad34c4", 1600),
} as const;

export const BUFFET_TIERS = [
  {
    label: "Monday – Thursday",
    price: "Rs 2,000",
    note: "per person, all you can eat",
  },
  {
    label: "Friday – Sunday",
    price: "Rs 2,500",
    note: "per person, live BBQ counters",
  },
  {
    label: "Festive & Eid nights",
    price: "Rs 3,000",
    note: "per person, extended menu",
  },
] as const;

export const BUFFET_INCLUDES = [
  "Unlimited live-fire BBQ refills",
  "Tandoori naan, sheermal & roti to order",
  "Salad bar, raita, chutneys & pickles",
  "Soft drinks, lassi and Kashmiri chai",
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "We came in at 1 AM with six kids after a wedding and they still set up a full table for us outdoors. The seekh kebab and nihari were exactly like home.",
    name: "Faiza N.",
    detail: "Family dinner · outdoor seating",
    rating: 5,
  },
  {
    quote:
      "Best value buffet in Lahore right now. The grilled fish special was outstanding and the staff kept refilling the BBQ without us asking.",
    name: "Hamza R.",
    detail: "Late-night craving",
    rating: 5,
  },
  {
    quote:
      "Booked ahead for my mother's birthday — 14 of us, open air, string lights on. They remembered the booking and had the table ready.",
    name: "Ayesha & Bilal",
    detail: "Birthday party of 14",
    rating: 4,
  },
] as const;

export const GALLERY = [
  { caption: "Live seekh kebab counter", image: unsplash("photo-1555939594-58d7cb561ad1", 700) },
  { caption: "Malai boti off the coals", image: unsplash("photo-1600891964092-4316c288032e", 700) },
  { caption: "Nihari at 3 AM", image: unsplash("photo-1585937421612-70a008356fbe", 700) },
  { caption: "Open-air family seating", image: unsplash("photo-1414235077428-338989a2e8c0", 700) },
  { caption: "Gulab jamun & kheer", image: unsplash("photo-1563379091339-03b21ab4a4f8", 700) },
  { caption: "Kulfi falooda", image: unsplash("photo-1544025162-d76694265947", 700) },
] as const;

/**
 * The backdrop behind the hero at the top of the public site. The admin panel
 * uploads over this slot; the URL below is the out-of-the-box default so the
 * hero is never empty before the first upload.
 */
export const HERO_MEDIA = {
  slot: "hero",
  label: "Hero backdrop",
  hint: "The photo behind the headline at the very top of the site.",
  url: RESTAURANT.heroImage,
} as const;

/**
 * The two showcase photos in "The Experience" section. The admin panel
 * uploads over these slots; the URLs below are the out-of-the-box defaults so
 * the section is never empty before the first upload.
 */
export const EXPERIENCE_MEDIA = {
  ambiance: {
    slot: "experience-ambiance",
    label: "Main ambiance photo",
    hint: "The large wide shot of the open-air seating at the top of the section.",
    url: RESTAURANT.heroImage,
  },
  food: {
    slot: "experience-food",
    label: "Food & grill photo",
    hint: "The smaller shot beneath it — the charcoal grill or a signature plate.",
    url: unsplash("photo-1555939594-58d7cb561ad1", 700),
  },
} as const;

/**
 * Editable copy in "The Experience" section, stored in `site_content` so the
 * owner can change the numbers from the admin panel without a redeploy.
 */
export const SITE_CONTENT_DEFAULTS = {
  "experience-seats": "4–20",
  "experience-seats-label": "seats per family table",
} as const;

export type SiteContentKey = keyof typeof SITE_CONTENT_DEFAULTS;

/** House rules that make booking ahead worth it for families. */
export const BOOKING_PROMISES = [
  {
    title: "Table held for 20 minutes",
    body: "Running late with the family? Call us and we will keep your table reserved.",
  },
  {
    title: "Free to reserve",
    body: "No deposit and no card required — pay per head at the buffet counter.",
  },
  {
    title: "Groups over 12",
    body: "Call 0333 4363996 and our floor team will set up joined tables for you.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Formatting + booking form helpers                                   */
/* ------------------------------------------------------------------ */

/** 30-minute arrival slots across the full 24-hour day. */
export const ARRIVAL_SLOTS: string[] = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${String(hours).padStart(2, "0")}:${minutes}`;
});

/** `"20:30"` → `"8:30 PM"` */
export function formatTime(time: string) {
  const [rawHours, minutes] = time.split(":");
  const hours = Number(rawHours);
  if (!Number.isFinite(hours)) return time;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes} ${suffix}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** `"2026-09-12"` → `"Sat, 12 Sep"` */
export function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return DATE_FORMATTER.format(parsed);
}

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** `"2026-09-12"` → `"12 September 2026"` — date, month and year spelled out
 *  in full for the history records. */
export function formatDayLong(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return LONG_DATE_FORMATTER.format(parsed);
}

/** Epoch milliseconds → the local calendar day as `YYYY-MM-DD`. */
export function dayKeyFromMs(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

/** `"2026-09"` → `"September 2026"` for the history month filter. */
export function formatMonthLabel(month: string) {
  const parsed = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return month;
  return MONTH_FORMATTER.format(parsed);
}

/** `"2026-09-12"` → `"September 2026"`; `"2026"` → `"2026"`. */
export function monthOf(day: string) {
  return day.slice(0, 7);
}

/** `"2026-09-12"` → `"2026"`. */
export function yearOf(day: string) {
  return day.slice(0, 4);
}

/** Today in the guest's local timezone as `YYYY-MM-DD` (for date inputs). */
export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function formatPhone(phone: string) {
  if (phone.startsWith("92") && phone.length === 12) {
    return `0${phone.slice(2, 5)} ${phone.slice(5)}`;
  }
  if (phone.length === 11) return `${phone.slice(0, 4)} ${phone.slice(4)}`;
  return phone;
}
