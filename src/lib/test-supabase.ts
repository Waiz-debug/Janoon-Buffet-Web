import { supabase, TABLES } from "./supabase";

/**
 * Lightweight connection test for Supabase.
 *
 * Runs once on application startup. Logs clear results to the browser console:
 *   ✅ Supabase Connected Successfully!
 *   ❌ Supabase Connection Failed – <reason>
 *
 * This never throws — the rest of the app continues unaffected.
 */
export async function testSupabaseConnection(): Promise<boolean> {
  const label = "[Supabase Connection Test]";

  try {
    // Try the menu_categories table first — it's always created by the schema.
    const { data, error } = await supabase
      .from(TABLES.categories)
      .select("id")
      .limit(1);

    if (error) {
      // Table might not exist yet (schema not run). Try a lightweight RPC or
      // storage probe as a fallback to confirm the endpoint is reachable.
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn(
          `${label} ⚠️ Connected, but table "${TABLES.categories}" not found.`,
          "Run supabase/schema.sql in your Supabase SQL editor to create tables.",
        );
        return true; // The connection itself is alive.
      }

      // Other errors (auth, network, etc.)
      console.error(`${label} ❌ Supabase Connection Failed –`, error.message);
      if (error.hint) console.warn(`${label} Hint:`, error.hint);
      return false;
    }

    const rowCount = data?.length ?? 0;
    console.log(
      `${label} ✅ Supabase Connected Successfully!`,
      `(queried ${TABLES.categories}: ${rowCount} row${rowCount === 1 ? "" : "s"} returned)`,
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${label} ❌ Supabase Connection Failed –`, msg);
    return false;
  }
}
