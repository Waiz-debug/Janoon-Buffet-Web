-- ============================================================================
--  tribe-of-taste — attach the promo image to the EXISTING demo promotion
--
--  Not for the SQL editor — the SQL editor has no user session, so the RLS
--  policies that make writes staff-only would refuse everything. Run the two
--  steps below in the BROWSER CONSOLE while signed in to /admin on the site.
--
--  What it does:
--    1. Uploads the prepared graphic from the live site into the public
--       tribe-media bucket at promotions/bbq-promo.jpg (idempotent — the
--       upsert overwrites in place, so re-running is safe).
--    2. Attaches it to the existing demo row by id. No new promotion is
--       created; no other row is touched; title/headline/body/expiry/badge
--       are all left exactly as they are.
--    3. Verifies both steps by reading the row back.
--
--  The realtime feed picks the change up and the banner + offers board show
--  the picture on every open tab within seconds, no reload needed.
-- ============================================================================

// ---- Step 1: storage upload -----------------------------------------------
const src = await fetch("/images/bbq-promo.jpg");
if (!src.ok) throw new Error("Could not fetch /images/bbq-promo.jpg: " + src.status);

const up = await supabase.storage
  .from("tribe-media")
  .upload("promotions/bbq-promo.jpg", await src.blob(), {
    contentType: "image/jpeg",
    upsert: true,
  });
if (up.error) throw new Error("Upload failed: " + up.error.message);
console.log("✅ uploaded to storage:", up.data.path);

// ---- Step 2: attach to the existing demo row ------------------------------
const PROMO_ID = "cc8e13f6-476b-4087-9b87-c18192489bc2";
const upd = await supabase
  .from("promotions")
  .update({
    image_path: "promotions/bbq-promo.jpg",
    image_url: null,
    updated_at: Date.now(),
  })
  .eq("id", PROMO_ID)
  .select("id, headline, image_path")
  .single();
if (upd.error) throw new Error("Update failed: " + upd.error.message);
console.log("✅ attached to promotion:", upd.data.headline, "→", upd.data.image_path);

// ---- Step 3: verify what the public site will read ------------------------
const chk = await supabase
  .from("promotions")
  .select("id, headline, image_path, image_url, visible, expires_at")
  .eq("id", PROMO_ID)
  .single();
console.log(chk.data.image_path
  ? "✅ persisted — refresh the page and the banner/board show the image"
  : "❌ image_path is still null — the update did not stick");
