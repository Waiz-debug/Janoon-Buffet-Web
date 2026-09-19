import { TABLES, supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export type StaffRole = "staff" | "admin";

export type StaffSession = {
  userId: string;
  email: string;
  role: StaffRole;
};

/** The table that records who may work the portals. */
const STAFF_TABLE = TABLES.staffMembers;

export const NOT_STAFF_MESSAGE =
  "That account is not a staff member. Ask the owner to add it under staff_members.";

export const UNCONFIGURED_MESSAGE =
  "The staff table is not set up on this project yet. Run supabase/schema.sql once, then create the owner account from the Admin Portal sign-in card.";

export const CLAIMED_MESSAGE =
  "An admin account already exists for this restaurant. Sign in with it, or ask an admin to add you to the team.";

/** Staff and admin land on their own dashboards after the same check. */
export function portalPathFor(role: StaffRole): string {
  return role === "staff" ? "/staff" : "/admin";
}

/**
 * Which portal this account may open, or null if it may open neither.
 *
 * The answer comes from `staff_members`, read through row level security: the
 * policy only lets a member see their own row, so the browser cannot invent a
 * role. An account that is signed in but absent from the table is an ordinary
 * customer, and is deliberately not staff.
 */
type StaffLookup =
  /** The query ran: `role` is null when the account is not on the team. */
  | { ok: true; role: StaffRole | null }
  /** The query itself failed — nearly always a missing schema. */
  | { ok: false; message: string };

async function staffLookup(userId: string): Promise<StaffLookup> {
  const { data, error } = await supabase
    .from(STAFF_TABLE)
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn(`[tribe] staff lookup failed: ${error.message}`);
    return { ok: false, message: error.message };
  }
  const role = (data as { role?: string } | null)?.role;
  return {
    ok: true,
    role: role === "admin" || role === "staff" ? role : null,
  };
}

export type SignInResult =
  | { ok: true; role: StaffRole }
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
      const role = lookup.ok ? lookup.role : null;
      setSession(
        role ? { userId: user.id, email: user.email ?? "", role } : null,
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
      if (!lookup.role) {
        // Signed in, but not a member of staff: never leave that session open.
        await supabase.auth.signOut();
        return { ok: false, reason: "not-staff" };
      }

      const next: StaffSession = {
        userId: data.user.id,
        email: data.user.email ?? "",
        role: lookup.role,
      };
      setSession(next);
      setIsLoaded(true);
      return { ok: true, role: next.role };
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
   * "Create Admin Account" tab appears when the panel is unowned and disappears
   * again the moment an admin exists. Removing the last admin reopens it on the
   * next check — no code change and nothing cached in the browser.
   */
  const canClaimOwner = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc("staff_bootstrap_state");
    if (error) return false;
    return (data as { claimable?: boolean } | null)?.claimable === true;
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
      const emailRedirectTo =
        typeof window === "undefined" ? undefined : window.location.origin;

      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo },
      });

      // An address that already has an account is not a failure: the owner may
      // have signed up on an earlier attempt and never finished. The password
      // check below is the one that matters.
      if (error && !/already registered|already exists/i.test(error.message)) {
        return classifyAuthError(error.message);
      }

      let user = data.user;
      if (!data.session) {
        // Either the project requires a confirmed address before it
        // will issue a session, or the account already existed and this is a
        // plain sign-in. Both are answered by trying.
        const attempt = await supabase.auth.signInWithPassword({
          email: address,
          password,
        });
        if (attempt.error) {
          const message = attempt.error.message.toLowerCase();
          if (message.includes("confirm")) {
            // Ask Supabase to send the link again, so the "we emailed you" the
            // form shows is one that was actually just sent. A refusal here
            // (rate limit, or delivery not configured) is not worth surfacing —
            // the same message still tells them what to look for.
            await supabase.auth.resend({ type: "signup", email: address });
            return { ok: false, reason: "confirm-email" };
          }
          if (message.includes("fetch") || message.includes("network")) {
            return { ok: false, reason: "unreachable" };
          }
          return { ok: false, reason: "credentials" };
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
        };
        setSession(next);
        setIsLoaded(true);
        return { ok: true, role: next.role };
      }

      // The claim was refused. Either the site is already set up, or this person
      // is on the team already — signing in as themselves is the right ending,
      // so ask the table before treating it as a failure.
      const lookup = await staffLookup(user.id);
      if (lookup.ok && lookup.role) {
        const next: StaffSession = {
          userId: user.id,
          email: user.email ?? address,
          role: lookup.role,
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
