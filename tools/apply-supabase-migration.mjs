/**
 * Applies one SQL file to the connected Supabase project, then reads back what
 * the live database now answers.
 *
 * This exists because a database that was created before the current rules were
 * written keeps the old ones until somebody updates it — the website cannot, and
 * deliberately holds no key that could. The publishable key the app ships with
 * can only *ask* the database questions; changing its functions needs a
 * credential that never leaves the person running this command.
 *
 *     bun tools/apply-supabase-migration.mjs                     # the admin patch
 *     bun tools/apply-supabase-migration.mjs supabase/schema.sql  # the whole schema
 *
 * Two credentials are accepted, because either is enough:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_…    the SQL goes through the Management API, the
 *                                  same channel the Supabase CLI uses. Create
 *                                  one at Account → Access Tokens.
 *   SUPABASE_DB_URL=postgres://…   the SQL runs on a direct Postgres connection
 *                                  through Bun's own client. Find it at Project
 *                                  Settings → Database → Connection string.
 *
 * Both are read from the environment for the length of this one command and are
 * never written anywhere. Prefer the patch (`supabase/fix-admin-recovery.sql`)
 * over the full schema on a live project: it only creates the staff junction
 * table, backfills it from the roles already recorded, and replaces the fourteen
 * functions the portals call. It deletes no row and touches no business table.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "supabase/fix-admin-recovery.sql";
const sql = readFileSync(file, "utf8");

/** The project being updated, read from the client the app actually ships. */
const projectRef = readFileSync("src/lib/supabase.ts", "utf8").match(
  /https:\/\/([a-z0-9]+)\.supabase\.co/,
)?.[1];

if (!projectRef) {
  console.error("Could not read the project ref from src/lib/supabase.ts.");
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!token && !dbUrl) {
  console.error(
    [
      "No credential for the live database is available.",
      "",
      `  project : ${projectRef}`,
      `  file    : ${file}`,
      "",
      "Set one of these and run again (this sandbox has neither):",
      "  SUPABASE_ACCESS_TOKEN=sbp_…   (Supabase → Account → Access Tokens)",
      "  SUPABASE_DB_URL=postgres://…  (Supabase → Project Settings → Database)",
      "",
      "Or paste the same file into the project's SQL Editor once — it is idempotent.",
    ].join("\n"),
  );
  process.exit(1);
}

/** Run one or more statements, returning whatever the channel hands back. */
async function run(query) {
  if (token) {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
    const body = await response.json().catch(() => response.statusText);
    if (!response.ok) {
      throw new Error(
        `Management API said ${response.status}: ${JSON.stringify(body)}`,
      );
    }
    return body;
  }

  // `Bun.sql` speaks the Postgres wire protocol itself, so a connection string
  // is enough and no driver has to be installed for the one command.
  const client = new Bun.SQL(dbUrl);
  try {
    return await client.unsafe(query);
  } finally {
    await client.end();
  }
}

console.log(`Applying ${file} to project ${projectRef} …`);
const applied = await run(sql);
console.log(`Applied. (${JSON.stringify(applied).slice(0, 200)})\n`);

/** What the app asks the database, read back after the migration. */
const checks = [
  [
    "admin setup state (expect version 2; claimable true while no active admin)",
    "select public.staff_bootstrap_state() as state;",
  ],
  [
    "active admins / admin-gate functions present",
    `select public.tribe_active_admins() as active_admins,
            to_regprocedure('public.claim_admin_for_email(text)') is not null as has_claim_for_email,
            to_regprocedure('public.admin_grant_role(uuid,text)')    is not null as has_grant_role,
            to_regprocedure('public.admin_remove_role(uuid,text)')   is not null as has_remove_role;`,
  ],
  [
    "the team as recorded (nothing else in the database is touched)",
    "select user_id, email, role, active, created_at from public.staff_members order by created_at;",
  ],
];

for (const [label, query] of checks) {
  console.log(`— ${label}`);
  try {
    console.log(`${JSON.stringify(await run(query), null, 2)}\n`);
  } catch (error) {
    console.log(`${error instanceof Error ? error.message : String(error)}\n`);
  }
}
