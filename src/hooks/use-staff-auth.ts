import { TABLES, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type StaffRole = "staff" | "admin";

export type StaffSession = {
  userId: string;
  email: string;
  /** The user's primary role (from staff_members.role). */
  role: StaffRole;
  /** Every role this user holds (admin, staff, or both). */
  roles: StaffRole[];
};

/**
 * What the database says about the admin bootstrap door.
 *
 *   open     — no active admin exists, so the claim is on offer
 *   closed   — an active admin exists, so the claim is refused
 *   outdated — the live database still carries the first version of the rule,
 *              which hid the setup action whenever ANY staff row existed
 *   unknown  — the check could not run at all (schema missing, network down)
 */
export type AdminSetupState = "open" | "closed" | "outdated" | "unknown";

/** The table that records who may work the portals. */
const STAFF_TABLE = TABLES.staffMembers;

export const NOT_STAFF_MESSAGE =
  "That account does not have portal access. Ask an administrator to add it.";

export const UNCONFIGURED_MESSAGE =
  "Sign-in is not available right now. Please try again later.";

/** Staff and admin land on their own dashboards after the same check. */
/**
 * Which portal this session can reach.
 *
 * Admin-only → /admin.
 * Staff-only  → /staff.
 * Both roles  → /admin (the higher door; the user can navigate
 *                to /staff themselves if they prefer that view).
 */
export function portalPathFor(role: StaffRole, roles?: StaffRole[]): string {
  const effective = roles ?? [role];
  if (effective.includes("admin")) return "/admin";
  return "/staff";
}

/**
 * Which portal this account may open, or null if it may open neither.
 *
 * The answer comes from `staff_members`, read through row level security: the
 * policy only lets a member see their own row, so the browser cannot invent a
 * role. An account that is signed in but absent from the table is an ordinary
 * customer, and is deliberately not staff.
 */
export type StaffLookup =
  /** The query ran: `roles` is empty when the account is not on the team. */
  | { ok: true; roles: StaffRole[] }
  /** The query itself failed — nearly always a missing schema. */
  | { ok: false; message: string };

/**
 * Look up a user's roles from the database.
 *
 * `staff_members` is asked first because it is the row that carries `active`:
 * an account switched off in the Team screen keeps its roles but may not open a
 * portal, and letting it in would only produce a screen whose every query the
 * database then refuses. The junction table adds the extra roles a member
 * holds; it never grants access on its own, which is the same rule
 * `public.is_staff()` applies to every table policy.
 */
export async function staffLookup(userId: string): Promise<StaffLookup> {
  // `*` rather than a column list: this row is the caller's own, and a project
  // whose schema predates a column should not fail the whole sign-in over it.
  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn(`[Janoon] staff lookup failed: ${error.message}`);
    return { ok: false, message: error.message };
  }

  const row = data as { role?: string; active?: boolean } | null;
  if (!row) return { ok: true, roles: [] };
  // Only an explicit `false` counts as switched off, so a project that has not
  // added the column yet does not lock its whole team out.
  if (row.active === false) return { ok: true, roles: [] };

  const { data: roleRows, error: roleErr } = await supabase
    .from("staff_member_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (
    !roleErr && roleRows
      ? roleRows.map((r) => (r as { role?: string }).role)
      : []
  ).filter((r): r is StaffRole => r === "admin" || r === "staff");

  // The primary role still counts on a project that predates the junction table.
  if (row.role === "admin" || row.role === "staff") {
    if (!roles.includes(row.role)) roles.push(row.role);
  }

  return { ok: true, roles };
}

export type SignInResult =
  | { ok: true; role: StaffRole; roles: StaffRole[] }
  | {
      ok: false;
      reason: "credentials" | "not-staff" | "unreachable" | "unconfigured";
    };

/**
 * Why creating the owner account stopped short.
 *
 * `confirm-email` is not a failure — it is the state the site is in when the
 * Supabase project asks new accounts to confirm their address first. The form
 * shows "open the link, then continue" and the same call finishes the job.
 */
export type OwnerSetupResult =
  | { ok: true; role: StaffRole }
  | {
      ok: false;
      reason:
        | "confirm-email"
        | "claimed"
        | "credentials"
        | "existing-account"
        | "weak-password"
        | "invalid-email"
        | "unreachable"
        | "unconfigured"
        | "unknown";
      message?: string;
    };

/** Turn a Supabase Auth complaint into something the form can act on. */
function classifyAuthError(
  message: string,
): Extract<OwnerSetupResult, { ok: false }> {
  const text = message.toLowerCase();
  if (text.includes("password")) return { ok: false, reason: "weak-password" };
  if (text.includes("email")) return { ok: false, reason: "invalid-email" };
  if (text.includes("fetch") || text.includes("network")) {
    return { ok: false, reason: "unreachable" };
  }
  return { ok: false, reason: "unknown", message };
}

/** PostgREST answers a function it cannot find with this code. */
function isMissingFunction(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST202" ||
    /Could not find the function/i.test(error?.message ?? "")
  );
}

/**
 * The portals' identity layer, on Supabase Auth.
 *
 * This replaces a five-digit PIN that lived in the client bundle and a
 * localStorage flag that stood in for a session. Both were bypassable by anyone
 * who opened devtools, and — more to the point — they protected the UI while
 * the database stayed readable by anyone holding the publishable key. Now the
 * session is real, the role is read from the database, and every table policy
 * asks Postgres the same question before it answers.
 */
export function useStaffAuth() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!active) return;
      if (!user) {
        setSession(null);
        setIsLoaded(true);
        return;
      }
      const lookup = await staffLookup(user.id);
      if (!active) return;
      const roles = lookup.ok ? lookup.roles : [];
      setSession(
        roles.length > 0
          ? { userId: user.id, email: user.email ?? "", role: roles[0], roles }
          : null,
      );
      setIsLoaded(true);
    };

    void resolve();

    // Follows sign-in, sign-out, token refresh and expiry in other tabs.
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void resolve();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("fetch") || message.includes("network")) {
          return { ok: false, reason: "unreachable" };
        }
        return { ok: false, reason: "credentials" };
      }
      if (!data.user) return { ok: false, reason: "credentials" };

      const lookup = await staffLookup(data.user.id);
      if (!lookup.ok) {
        // The role cannot be checked, so the portal cannot be trusted open.
        await supabase.auth.signOut();
        return { ok: false, reason: "unconfigured" };
      }
      if (lookup.roles.length === 0) {
        // Signed in, but not a member of staff: never leave that session open.
        await supabase.auth.signOut();
        return { ok: false, reason: "not-staff" };
      }

      const next: StaffSession = {
        userId: data.user.id,
        email: data.user.email ?? "",
        role: lookup.roles[0],
        roles: lookup.roles,
      };
      setSession(next);
      setIsLoaded(true);
      return { ok: true, role: next.role, roles: next.roles };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  /**
   * Is the admin recovery door still open?
   *
   * Asked through a database function because a signed-out visitor cannot read
   * `staff_members` at all — the answer is a boolean and nothing else. The
   * database answers `claimable` only while it holds no **active admin**, so the
   * "Create Admin Account" action appears when the panel is unowned and
   * disappears again the moment an admin exists. Removing the last admin
   * reopens it on the next check — no code change and nothing cached in the
   * browser.
   *
   * `unknown` is returned when the check itself could not run (the schema has
   * not been applied yet, or the network dropped). It is deliberately distinct
   * from `closed`: reporting "an admin exists" when we simply failed to ask
   * would hide the only way back into a locked-out panel. The claim remains
   * database-gated either way, so offering it costs nothing.
   */
  const canClaimOwner = useCallback(async (): Promise<AdminSetupState> => {
    const { data, error } = await supabase.rpc("staff_bootstrap_state");
    if (error) {
      console.warn(`[Janoon] admin setup check failed: ${error.message}`);
      return "unknown";
    }
    const answer = data as {
      claimable?: boolean;
      version?: number;
    } | null;

    // The current rule answers with `version: 2`. A database that answers
    // without it is still running the first rule — which reported "not
    // claimable" as soon as a single staff row existed, and is the usual reason
    // the setup action looked missing. Say so instead of guessing, and offer the
    // action anyway: the claim itself is refused by the database when an admin
    // really does exist, so nothing is granted that should not be.
    if (answer?.version !== 2) return "outdated";

    if (answer.claimable === true) return "open";
    if (answer.claimable === false) return "closed";
    return "unknown";
  }, []);

  /**
   * Create the admin account from the website — no dashboard step.
   *
   * Three things happen, in order:
   *   1. Supabase Auth creates the user with the ordinary publishable key.
   *   2. We hold the auth UUID it hands back.
   *   3. `claim_admin()` records that UUID in `staff_members` as an admin.
   *
   * Step 3 is decided in Postgres, and only while the table holds no active
   * admin, so the door is shut as soon as one exists — and reopens if the last
   * one is removed. An account already on the team as staff is refused, so this
   * is never a route from staff to admin. No service-role key is involved, and
   * none could be, since it would have to ship in the bundle.
   *
   * Calling this twice with the same details is safe — the second time round
   * `signUp` reports the account already exists, we sign in instead, and the
   * claim answers `claimed` if someone else got there first.
   */
  const setupOwner = useCallback(
    async (email: string, password: string): Promise<OwnerSetupResult> => {
      const address = email.trim();

      // ------------------------------------------------------------------
      // PHASE 1 — Try to grant admin to an EXISTING auth user.
      //
      // This must happen BEFORE signUp: if the email already exists in
      // Supabase Auth, calling signUp would trigger "User already registered"
      // and signInWithPassword would require the existing password. Instead,
      // claim_admin_for_email handles everything server-side: it looks up the
      // auth user by email, creates/grants the admin record, and returns — no
      // password needed, no duplicate Auth user, no signUp call.
      // ------------------------------------------------------------------
      const { data: existingClaim, error: existingErr } = await supabase.rpc(
        "claim_admin_for_email",
        { p_email: address },
      );

      if (!existingErr && (existingClaim as { ok?: boolean } | null)?.ok) {
        // The email existed in Supabase Auth. Admin has been granted to that
        // existing identity server-side. The user must now sign in with their
        // existing password to get a session — we cannot create one without it.
        console.warn(
          `[Janoon] admin granted to the existing sign-in account: ${address}`,
        );
        return {
          ok: false,
          reason: "existing-account",
          message: address,
        };
      }

      // If the function failed, figure out why and decide what to do next.
      if (existingErr) {
        const msg = (existingErr.message ?? "").toLowerCase();

        // The function is not deployed yet — fall through to the normal
        // signUp flow below. This handles the common case where the SQL
        // migration has not been run.
        if (isMissingFunction(existingErr)) {
          // fall through
        }
        // The email does not exist in auth.users — this is a brand-new user.
        // Fall through to signUp to create the Auth account.
        else if (msg.includes("no account found")) {
          // fall through
        }
        // Admin already exists — refuse immediately.
        else if (msg.includes("admin account already exists")) {
          return { ok: false, reason: "claimed", message: existingErr.message };
        }
        // Staff cannot self-promote.
        else if (msg.includes("staff accounts cannot")) {
          return {
            ok: false,
            reason: "claimed",
            message: existingErr.message,
          };
        }
        // Any other error from the function — log it and fall through.
        else {
          console.warn(
            `[Janoon] claim_admin_for_email failed: ${existingErr.message}`,
          );
        }
      }

      // ------------------------------------------------------------------
      // PHASE 2 — Brand-new user: create the Auth account, then claim.
      //
      // This path is only reached when the email does NOT already exist in
      // Supabase Auth (or when claim_admin_for_email is not deployed yet).
      // signUp will create the Auth user; claim_admin will record the admin
      // role in staff_members.
      // ------------------------------------------------------------------
      const emailRedirectTo =
        typeof window === "undefined" ? undefined : window.location.origin;

      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo },
      });

      if (error && !/already registered|already exists/i.test(error.message)) {
        return classifyAuthError(error.message);
      }

      let user = data.user;
      if (!data.session) {
        const attempt = await supabase.auth.signInWithPassword({
          email: address,
          password,
        });
        if (attempt.error) {
          const message = attempt.error.message.toLowerCase();
          if (message.includes("confirm")) {
            await supabase.auth.resend({ type: "signup", email: address });
            return { ok: false, reason: "confirm-email" };
          }
          if (message.includes("fetch") || message.includes("network")) {
            return { ok: false, reason: "unreachable" };
          }
          // The email exists in Auth but the password doesn't match. This
          // happens when claim_admin_for_email is not deployed yet (we
          // couldn't handle it in Phase 1). Show the existing-account
          // message so the user knows to sign in with their existing password.
          return {
            ok: false,
            reason: "existing-account",
            message: address,
          };
        }
        user = attempt.data.user;
      }
      if (!user) return { ok: false, reason: "unknown" };

      const claim = await supabase.rpc("claim_admin");
      if (!claim.error) {
        const next: StaffSession = {
          userId: user.id,
          email: user.email ?? address,
          role: "admin",
          roles: ["admin"],
        };
        setSession(next);
        setIsLoaded(true);
        return { ok: true, role: next.role };
      }

      console.warn(`[Janoon] admin claim refused: ${claim.error.message}`);
      const lookup = await staffLookup(user.id);
      if (lookup.ok && lookup.roles.length > 0) {
        const next: StaffSession = {
          userId: user.id,
          email: user.email ?? address,
          role: lookup.roles[0],
          roles: lookup.roles,
        };
        setSession(next);
        setIsLoaded(true);
        return { ok: true, role: next.role };
      }

      await supabase.auth.signOut();
      if (isMissingFunction(claim.error)) {
        return { ok: false, reason: "unconfigured" };
      }
      return { ok: false, reason: "claimed", message: claim.error.message };
    },
    [],
  );

  return { session, isLoaded, signIn, signOut, setupOwner, canClaimOwner };
}
