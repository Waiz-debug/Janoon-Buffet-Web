/**
 * JUNOON — single source of truth for public site content.
 *
 * Identity, in one place: the house name, its descriptor, the Urdu line and
 * the Gulberg address. Every heading, footer, page title and meta tag reads
 * from here, so correcting the business means editing this block and nothing
 * else.
 *
 * Photos: the Unsplash photos below are the fine-dining placeholders every
 * image slot falls back to, so a fresh install still looks like a finished
 * restaurant — swap them for real photos of the seating area and live counters
 * whenever they are ready. Every image degrades to a themed tile if it fails
 * to load, so the layout never breaks.
 */

const unsplash = (id: string, width = 1000) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;

/** The central reservations line. Every venue is reached through it. */
const PHONE_DISPLAY = "0333 4363996";
const PHONE_HREF = "tel:+923334363996";

/**
 * The house.
 *
 * `name` is the bare wordmark the crest prints, and the name the site uses
 * everywhere: JUNOON. `fullName` is the name that goes in page titles and the
 * footer, and `descriptor` is the line under the wordmark. Gulberg, Lahore is
 * the location and only the location — it is never part of the name.
 *
 * There are deliberately no prices, opening hours, offers, ratings or reviews
 * in this block. Anything of that kind is either owner-published content in the
 * database (the menu, the promotions board) or it does not appear on the site
 * at all: an invented time or price is worse than an absent one, because a
 * guest plans around it.
 */
export const RESTAURANT = {
  name: "JUNOON",
  fullName: "JUNOON",
  legalName: "JUNOON",
  /** Under the wordmark in the header and the footer. */
  descriptor: "Gulberg, Lahore",
  /** The house's own line, kept in the singular for sentence use. */
  tagline: "Pakistani restaurant in Gulberg, Lahore",
  cuisine: "Pakistani restaurant",
  phoneDisplay: PHONE_DISPLAY,
  phoneHref: PHONE_HREF,
  /** WhatsApp click-to-chat — international format, no leading zero. */
  whatsappNumber: "923334363996",
  whatsappUrl: "https://wa.me/923334363996",
  whatsappDisplay: PHONE_DISPLAY,
  /** This restaurant's address — keep exact; cover art prints it. */
  address: "487-B, Mangam Chowk, Gulberg III, Lahore",
  /** The one house, as a line for the eyebrow and page titles. */
  cityLine: "Gulberg III, Lahore",
  /** The same house as prose, for sentences. */
  cityNames: "Lahore",
  instagramHandle: "@junoon.pk",
  instagramUrl: "https://www.instagram.com/junoon.pk",
  facebookUrl: "https://www.facebook.com/junoon.pk/",
  tiktokUrl: "https://www.tiktok.com/@junoon.pk",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Junoon+Gulberg+III+Lahore",
  heroImage: unsplash("photo-1517248135467-4c7edcad34c4", 1600),
} as const;

/**
 * The one house.
 *
 * The house cooks in Lahore only, at Gulberg III. The street line is the part
 * to double-check — a courier, a taxi driver and a new guest all read this —
 * so it is spelled out here once instead of being repeated across the header,
 * the footer and the map.
 *
 * The list is kept as a list so a second house could be added without touching
 * a single component: every venue name, address and map link on the site is
 * drawn from these entries.
 */
export type Venue = {
  id: string;
  /** The venue's own name, as the brand sheet lists it. */
  name: string;
  city: string;
  address: string;
  /** The kitchen's role in a line. */
  note: string;
  phoneDisplay?: string;
  phoneHref?: string;
  mapsUrl: string;
};

export const LOCATIONS: readonly Venue[] = [
  {
    id: "lahore",
    name: "JUNOON",
    city: "Lahore",
    address: "487-B, Mangam Chowk, Gulberg III, Lahore",
    note: "Gulberg III, Lahore",
    phoneDisplay: PHONE_DISPLAY,
    phoneHref: PHONE_HREF,
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Junoon+Gulberg+III+Lahore",
  },
];

/** The house a booking is taken at. */
export const PRIMARY_VENUE = LOCATIONS[0];

/**
 * The gallery tiles. The captions are deliberately empty: a caption is a
 * claim about the photo, and these are placeholder house photographs until the
 * owner uploads real ones from the admin panel. A slot the owner gives a
 * caption is shown with it; an empty one shows the photo alone.
 */
export const GALLERY = [
  { caption: "", image: unsplash("photo-1555939594-58d7cb561ad1", 700) },
  { caption: "", image: unsplash("photo-1600891964092-4316c288032e", 700) },
  { caption: "", image: unsplash("photo-1585937421612-70a008356fbe", 700) },
  { caption: "", image: unsplash("photo-1414235077428-338989a2e8c0", 700) },
  { caption: "", image: unsplash("photo-1563379091339-03b21ab4a4f8", 700) },
  { caption: "", image: unsplash("photo-1544025162-d76694265947", 700) },
] as const;

/**
 * Fine-dining placeholders for an offer that has no artwork of its own, in
 * order, so a board of offers reads as several different offers rather than
 * the same photo repeated. An upload in the admin panel's Promotions tab
 * always wins over these.
 */
export const PROMO_PLACEHOLDER_PHOTOS = [
  unsplash("photo-1555939594-58d7cb561ad1", 900),
  unsplash("photo-1414235077428-338989a2e8c0", 900),
  unsplash("photo-1517248135467-4c7edcad34c4", 900),
  unsplash("photo-1600891964092-4316c288032e", 900),
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
    // Deliberately not the hero backdrop: the two sit on the same page, and a
    // section that opens with the photo the guest just scrolled past reads as
    // a placeholder. Separate fine-dining rooms, one hero, one courtyard.
    url: unsplash("photo-1550966871-3ed3cdb5ed0c", 1000),
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
  /** Placeholder totals for the admin panel's Experience tab and nothing
   *  else — the public site does not state seating numbers or sittings it
   *  cannot confirm. Keys the owner fills in are shown only where the site
   *  renders that key, so adding one here is the way to give a field a
   *  starting value rather than a public claim. */
  "experience-seats": "",
  "experience-seats-label": "",
} as const;

export type SiteContentKey = keyof typeof SITE_CONTENT_DEFAULTS;

/**
 * What the reservation itself promises: three facts about this booking, not
 * three claims about the restaurant. A table-holding window and a seating
 * policy an earlier revision wrote here were never confirmed by the house, so
 * they are gone. What is left is true of the product — the request reaches the
 * desk, nothing is charged through this site, and a large party is a call.
 */
export const BOOKING_PROMISES = [
  {
    title: "Sent to the desk",
    body: "The request lands on the restaurant's reservations desk under the name and number you leave.",
  },
  {
    title: "Free to reserve",
    body: "No deposit and no card required — nothing is charged through this site.",
  },
  {
    title: "Large parties",
    body: `Call ${PHONE_DISPLAY} and the team will take the details for your group directly.`,
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
