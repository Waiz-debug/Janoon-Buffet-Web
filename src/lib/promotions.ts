/**
 * Promotions — the offers the guest site broadcasts.
 *
 * This module owns the promotion readers, because promotions are the one table
 * whose guest behaviour differs from a plain read: while the restaurant has no
 * offer of its own, the seeded sample banner stands in, so the offers board is
 * never empty on a fresh install. The copies of `fetchPromotions()` and
 * `seedDemoPromotion()` still sitting in `src/lib/db.ts` are superseded by the
 * ones below — import the promotion functions from here.
 */
import { TABLES, mediaUrl, supabase } from "@/lib/supabase";
import {
  PROMO_DEFAULT_ORDER,
  fetchSiteContent,
  type Promotion,
} from "@/lib/db";

/** One row of `promotions` as Postgres stores it. */
type PromotionDb = {
  id: string;
  title: string;
  headline: string;
  body: string | null;
  visible: boolean;
  demo: boolean | null;
  image_url: string | null;
  image_path: string | null;
  link_url: string | null;
  sort_order: number | null;
  expires_at: number | string | null;
  created_at: number | string;
  updated_at: number | string;
};

const ms = (value: number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Reads never throw: if the table is missing (the SQL has not been run yet) or
 * the network is down, the caller gets an empty list and the site shows no
 * banner instead of breaking. Mirrors `selectRows()` in `src/lib/db.ts`.
 */
async function readPromotionRows(): Promise<PromotionDb[]> {
  const { data, error } = await supabase
    .from(TABLES.promotions)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn(`[Junoon] "promotions" read failed: ${error.message}`);
    return [];
  }
  return Array.isArray(data) ? (data as PromotionDb[]) : [];
}

/** The row shape the rest of the app reads. Mirrors `toPromotion()` in db.ts. */
function toPromotion(row: PromotionDb): Promotion {
  return {
    _id: row.id,
    title: row.title,
    headline: row.headline,
    body: row.body ?? undefined,
    visible: row.visible,
    imageUrl: row.image_url || mediaUrl(row.image_path) || undefined,
    imagePath: row.image_path ?? undefined,
    linkUrl: row.link_url ?? undefined,
    demo: row.demo === true,
    sortOrder: row.sort_order ?? PROMO_DEFAULT_ORDER,
    expiresAt: ms(row.expires_at),
    createdAt: ms(row.created_at) ?? 0,
    updatedAt: ms(row.updated_at) ?? 0,
  };
}

/**
 * Surface a write failure with the next step rather than a Postgres string.
 * Mirrors `fail()` in `src/lib/db.ts`.
 */
function fail(error: { message: string } | null, fallback: string): never {
  const message = error?.message ?? "";
  if (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("Could not find the table")
  ) {
    throw new Error(
      "A Supabase table or column is missing. Run supabase/schema.sql in the Supabase SQL editor, then try again.",
    );
  }
  if (/row-level security|permission denied|not authorized/i.test(message)) {
    throw new Error(
      "Supabase refused the write. Sign in to the admin panel as staff and try again — if you are already signed in, re-run supabase/schema.sql to restore the staff write policies.",
    );
  }
  throw new Error(message || fallback);
}

/**
 * Every offer the caller may see.
 *
 * `includeDemo` is the admin panel: it receives every row that has not lapsed,
 * so the team can edit or delete a seeded sample. Guest callers instead see
 * the restaurant's own offers — and while none exist yet, the newest seeded
 * sample, with its expiry waived so a lapsed sample cannot leave the board
 * empty. Publish one real offer and every sample steps aside with it.
 */
export async function fetchPromotions(
  options: { activeOnly?: boolean; includeDemo?: boolean } = {},
): Promise<Promotion[]> {
  const all = (await readPromotionRows()).map(toPromotion);
  const now = Date.now();
  // Expired banners disable and remove themselves the moment the clock runs
  // out — no cleanup job required. The seeded sample is the one exception,
  // handled below.
  const fresh = all.filter(
    (promo) => !promo.expiresAt || promo.expiresAt > now,
  );

  let pool: Promotion[];
  if (options.includeDemo) {
    // The admin list: every row that has not lapsed — that is where the team
    // sees a seeded sample and deletes it.
    pool = fresh;
  } else {
    // Guest surfaces show the restaurant's own offers. While it has none yet,
    // the newest seeded sample stands in so the board is never empty on a
    // fresh install, and its expiry is waived — a lapsed sample must not leave
    // the hero bare until someone re-seeds it. Publish one real offer and
    // every sample steps aside with it.
    const real = fresh.filter((promo) => !promo.demo);
    const sample = all
      .filter((promo) => promo.demo && promo.visible)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    pool =
      real.length > 0
        ? real
        : sample
          ? [{ ...sample, expiresAt: undefined }]
          : [];
  }

  const promos = pool.filter((promo) =>
    options.activeOnly ? promo.visible : true,
  );

  // Board position is applied here rather than in the query: ordering by
  // `sort_order` server-side would fail — and so hide every promotion — on a
  // database that has not run the migration adding the column yet.
  return promos.sort(
    (a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt,
  );
}

/**
 * Keep one sample promotional banner live so the public site always has
 * something to broadcast out of the box. The sample carries a seven-day
 * expiry; guest surfaces waive it while the sample stands in — see
 * fetchPromotions() above — so the board is never empty before the restaurant
 * publishes an offer of its own.
 *
 * It re-seeds when nothing is currently showing and the only rows on record
 * are demo banners of its own — so a lapsed sample is replaced, while a
 * promotion the team wrote (even one they have switched off or let expire) is
 * never overwritten or joined by a demo. After `remove-demo-content.sql` has
 * run, the `demo-seeding` flag it writes keeps the sample from coming back.
 */
export async function seedDemoPromotion(): Promise<boolean> {
  // Handover guard: once the flag below is set, the sample is never created
  // again, no matter how often the admin panel loads.
  const content = await fetchSiteContent();
  if (content.some((row) => row.key === "demo-seeding" && row.value === "off")) {
    return false;
  }

  const existing = await readPromotionRows();
  const now = Date.now();
  const liveRows = existing.filter(
    (row) => row.visible && (ms(row.expires_at) ?? now + 1) > now,
  );
  const live = liveRows.length > 0;
  const onlyOurDemos = existing.every((row) => row.demo ?? false);

  // An earlier version of this seeder could add its sample more than once, and
  // two identical banners show up twice on the offers board. When the only
  // live rows are our own samples, keep the newest and clear the rest. A
  // promotion the team wrote is never touched — `onlyOurDemos` has to be true
  // first.
  const liveDemos = liveRows.filter((row) => row.demo ?? false);
  if (onlyOurDemos && liveDemos.length > 1) {
    const sorted = [...liveDemos].sort(
      (a, b) => (ms(b.created_at) ?? 0) - (ms(a.created_at) ?? 0),
    );
    const duplicates = sorted.slice(1).map((row) => row.id).filter(Boolean);
    if (duplicates.length > 0) {
      const { error } = await supabase
        .from(TABLES.promotions)
        .delete()
        .in("id", duplicates);
      if (!error) return false;
    }
  }

  if (live || !onlyOurDemos) return false;

  // Clear lapsed samples before seeding: re-seeding on top of an expired row
  // would show the same banner twice, one of them dead. Best-effort — a fresh
  // sample below still beats none if this cleanup is refused.
  const stale = existing
    .filter((row) => row.demo ?? false)
    .map((row) => row.id);
  if (stale.length > 0) {
    await supabase.from(TABLES.promotions).delete().in("id", stale);
  }

  const { error } = await supabase.from(TABLES.promotions).insert({
    title: "Weekend Live BBQ Nights",
    headline: "Live BBQ Nights — family of four dines for Rs 7,500",
    body: "Valid Friday to Sunday, 7 PM onwards. Dine-in only.",
    visible: true,
    demo: true,
    expires_at: now + 7 * 24 * 60 * 60 * 1000,
    created_at: now,
    updated_at: now,
  });
  fail(error, "Could not seed the demo promotion.");
  return true;
}
