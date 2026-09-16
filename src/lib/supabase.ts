import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for Tribe of Taste.
 *
 * The URL and publishable (anon) key are inlined so the app runs on a fresh
 * checkout; both can be overridden per environment with `VITE_SUPABASE_URL`
 * and `VITE_SUPABASE_PUBLISHABLE_KEY` without touching this file.
 */
const PROJECT_URL = "https://tckzyoeqmgafuvnwvnfd.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_WVKKah2C-llgxPDQWSveXg_qqmMeUZ1";

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || PROJECT_URL;

export const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // The platform signs staff/admin in with a PIN, not Supabase Auth, so there
  // is no session to persist.
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

/** Public bucket that holds every admin-uploaded photo and banner graphic. */
export const MEDIA_BUCKET = "tribe-media";

/** Table names in one place so a rename only has to happen once. */
export const TABLES = {
  categories: "menu_categories",
  dishes: "menu_dishes",
  addons: "menu_addons",
  siteMedia: "site_media",
  siteContent: "site_content",
  deliveryOrders: "delivery_orders",
  reservations: "reservations",
  preorders: "preorders",
  promotions: "promotions",
} as const;

/**
 * Resolve a stored image reference to a browsable URL. Values are either an
 * already-absolute URL (legacy rows) or a path inside the media bucket.
 */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
