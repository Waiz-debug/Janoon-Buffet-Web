import type { StaffRole } from "@/hooks/use-staff-auth";
import { SUPABASE_KEY, SUPABASE_URL, supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

/**
 * Team management and account security.
 *
 * Two rules shape everything in this file:
 *
 *   • The browser never decides who may be staff. Creating a role, changing one
 *     or removing one all go through `security definer` functions in Postgres
 *     that refuse anyone whose own row is not `role = 'admin'`. This module only
 *     carries the request.
 *   • No password is ever read, stored or displayed. Supabase Auth holds a
 *     bcrypt hash of it; all this code can do is ask Auth to change the hash, and
 *     only for the signed-in account, after it has proved it knows the old one.
 */

export type StaffMember = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: StaffRole;
  active: boolean;
  createdAt: number;
};

/** Postgres raises our own sentences; surface the first line, not the stack. */
function firstLine(message: string): string {
  return message.split("\n")[0].trim();
}

async function rpc(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(firstLine(error.message));
  return (data ?? {}) as Record<string, unknown>;
}

/** PostgREST says this when the schema has not been applied yet. */
export function isMissingFunction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist|Could not find the function|schema cache/i.test(message);
}

/* ------------------------------------------------------------- team list --- */

/** The team, for the admin panel. Emails and roles only — never a password. */
export async function listStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase.rpc("admin_list_staff");
  if (error) {
    // Reads must not throw: the panel renders an empty list with the reason.
    console.warn(`[tribe] staff list failed: ${error.message}`);
    throw new Error(firstLine(error.message));
  }
  const rows = (data ?? []) as {
    userId: string;
    email: string | null;
    displayName: string | null;
    role: string;
    active: boolean;
    createdAt: number;
  }[];
  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role === "admin" ? "admin" : "staff",
    active: row.active === true,
    createdAt: row.createdAt ?? 0,
  }));
}

/* ------------------------------------------------------ team management --- */

/**
 * Give an existing account a role on the team.
 *
 * `signUp` runs on a throwaway client that never persists a session: creating
 * the staff account must not swap the admin's own session out from under them,
 * which is exactly what the shared client would do. Supabase Auth then emails
 * the new person a confirmation link if this project asks for one.
 *
 * `initialPassword` is the admin's choice, typed in the panel. Leave it empty
 * and a random one is generated that nobody — including the admin — ever sees;
 * the new member sets their own through the password-reset link.
 */
export async function addStaffAccount(
  email: string,
  role: StaffRole,
  initialPassword?: string,
): Promise<{ createdSignIn: boolean; usedResetLink: boolean }> {
  const address = email.trim().toLowerCase();
  if (!address || !address.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const password = initialPassword?.trim() || randomPassword();

  // A client of its own, and one that never touches storage: signing the new
  // member up must not swap the admin's own session out from under them, which
  // is exactly what using the shared client would do.
  const invite = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: "tribe-invite-token",
    },
  });
  const { error: signUpError } = await invite.auth.signUp({
    email: address,
    password,
  });

  const alreadyRegistered =
    !!signUpError && /already registered|already exists/i.test(signUpError.message);
  if (signUpError && !alreadyRegistered) {
    throw new Error(firstLine(signUpError.message));
  }

  // The role is decided in Postgres, by `admin_add_staff`, which refuses any
  // caller who is not an admin. This call cannot promote anybody by itself.
  await rpc("admin_add_staff", { p_email: address, p_role: role });

  let usedResetLink = false;
  if (!initialPassword?.trim() && !alreadyRegistered) {
    // No shared secret anywhere: they pick their own password from the link.
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo:
        typeof window === "undefined" ? undefined : window.location.origin,
    });
    usedResetLink = !error;
  }

  return { createdSignIn: !alreadyRegistered, usedResetLink };
}

export async function setStaffRole(userId: string, role: StaffRole) {
  await rpc("admin_set_staff_role", { p_user_id: userId, p_role: role });
}

export async function setStaffActive(userId: string, active: boolean) {
  await rpc("admin_set_staff_active", { p_user_id: userId, p_active: active });
}

export async function removeStaff(userId: string) {
  await rpc("admin_remove_staff", { p_user_id: userId });
}

/** Send a member a link to set a new password. Their role is untouched. */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      typeof window === "undefined" ? undefined : window.location.origin,
  });
  if (error) throw new Error(firstLine(error.message));
}

/** Sixty-four bits of entropy, from the platform's own CSPRNG. */
function randomPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const alphabet =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

/* ------------------------------------------------- account, both portals --- */

/**
 * Point `staff_members.email` at whatever the sign-in account now uses.
 *
 * Called after a confirmed address change and when the account screen opens, so
 * the team list never shows yesterday's address. It touches one column of the
 * caller's own row — the role is not in the statement at all.
 */
export async function syncOwnStaffEmail(): Promise<void> {
  const { error } = await supabase.rpc("staff_sync_email");
  if (error && !isMissingFunction(error)) {
    console.warn(`[tribe] staff email sync failed: ${error.message}`);
  }
}

/**
 * Re-prove the current password before anything is changed.
 *
 * Supabase issues a fresh session on success, so this doubles as the "are you
 * still you" step for both forms below — and it means a borrowed laptop cannot
 * be used to lock the real owner out.
 */
async function reauthenticate(currentPassword: string): Promise<string> {
  const { data: session } = await supabase.auth.getUser();
  const email = session.user?.email;
  if (!email) throw new Error("You are not signed in any more. Sign in again.");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (error) throw new Error("That password is not correct.");
  return email;
}

export type EmailChangeResult = {
  /** True when Supabase emailed a link and the new address is not live yet. */
  confirmationRequired: boolean;
  address: string;
};

/** Change the sign-in address. The role is not part of this call. */
export async function changeOwnEmail(
  currentPassword: string,
  newEmail: string,
): Promise<EmailChangeResult> {
  const address = newEmail.trim().toLowerCase();
  if (!address || !address.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  const current = await reauthenticate(currentPassword);
  if (address === current.toLowerCase()) {
    throw new Error("That is already your email address.");
  }

  const { data, error } = await supabase.auth.updateUser({ email: address });
  if (error) throw new Error(firstLine(error.message));

  // With "secure email change" on, the address only moves once the links have
  // been opened. The row is re-synced on the next visit either way.
  const confirmationRequired = data.user?.email?.toLowerCase() !== address;
  await syncOwnStaffEmail();
  return { confirmationRequired, address };
}

/** Change the password. The role is not part of this call. */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error("Use at least 8 characters for the new password.");
  }
  if (newPassword === currentPassword) {
    throw new Error("The new password has to be different from the old one.");
  }
  await reauthenticate(currentPassword);

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(firstLine(error.message));
}
