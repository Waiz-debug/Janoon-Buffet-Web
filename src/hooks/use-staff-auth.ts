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
  "The staff table is not set up on this project yet. Run supabase/schema.sql once, add your account to staff_members, then sign in again.";

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

  return { session, isLoaded, signIn, signOut };
}
