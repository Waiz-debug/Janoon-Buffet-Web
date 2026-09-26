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
  roles: StaffRole[];
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
    console.warn(`[Junoon] staff list failed: ${error.message}`);
    throw new Error(firstLine(error.message));
  }
  const rows = (data ?? []) as {
    userId: string;
    email: string | null;
    displayName: string | null;
    role: string;
    roles?: string[];
    active: boolean;
    createdAt: number;
  }[];
  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    role: row.role === "admin" ? "admin" : "staff",
    roles: (row.roles ?? [row.role])
      .filter((r): r is StaffRole => r === "admin" || r === "staff"),
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
export type StaffAccountResult = {
  /** True when this call created the sign-in account. */
  createdSignIn: boolean;
  /** True when a setup link was emailed for the member to choose their own. */
  usedResetLink: boolean;
  /**
   * True only when the password the owner typed is now this account's password.
   *
   * False when the address already had an account: Supabase keeps the existing
   * password and silently ignores the one supplied. That is the commonest
   * reason a new hire's first sign-in is refused, so it is reported rather than
   * folded into a cheerful "added".
   */
  passwordApplied: boolean;
  /**
   * True when the project asks new accounts to confirm their email address
   * first — the second reason a first sign-in is refused, and one the panel
   * would otherwise report as a wrong password.
   */
  needsConfirmation: boolean;
};

export async function addStaffAccount(
  email: string,
  role: StaffRole,
  initialPassword?: string,
): Promise<StaffAccountResult> {
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
      storageKey: "janoon-invite-token",
    },
  });
  const { data: signUpData, error: signUpError } = await invite.auth.signUp({
    email: address,
    password,
  });

  const alreadyRegistered =
    !!signUpError && /already registered|already exists/i.test(signUpError.message);
  if (signUpError && !alreadyRegistered) {
    throw new Error(firstLine(signUpError.message));
  }

  const createdSignIn = !alreadyRegistered;
  // A project with "Confirm email" switched on hands back a user whose
  // `email_confirmed_at` is null — they cannot sign in yet. Saying so is the
  // difference between an admin who waits for a confirmation mail and one who
  // concludes the password was wrong. An absent field is treated as "no
  // problem reported" rather than as a refusal: only an explicit null is a yes.
  const needsConfirmation =
    createdSignIn && signUpData?.user?.email_confirmed_at === null;

  // The role is decided in Postgres, by `admin_add_staff`, which refuses any
  // caller who is not an admin. This call cannot promote anybody by itself.
  await rpc("admin_add_staff", { p_email: address, p_role: role });

  // A setup link goes out whenever the owner was not left holding a password
  // they can hand over: none was typed, the account already existed so the
  // typed one was ignored, or the address still has to be confirmed. This is
  // the only recovery path the panel has, and an extra mail costs nothing.
  const needsOwnPassword =
    !initialPassword?.trim() || alreadyRegistered || needsConfirmation;

  let usedResetLink = false;
  if (needsOwnPassword) {
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo:
        typeof window === "undefined" ? undefined : window.location.origin,
    });
    usedResetLink = !error;
  }

  return {
    createdSignIn,
    usedResetLink,
    passwordApplied: createdSignIn,
    needsConfirmation,
  };
}

export type SignInCheck = { ok: true } | { ok: false; reason: string };

/**
 * Try a sign-in against a real account, on a throwaway client.
 *
 * This is how the admin finds out whether a credential *actually* works before
 * a member stands at the till being told it does not: the password is tested
 * against Supabase Auth itself, and Auth's own refusal is translated into the
 * reason. Nothing is stored and nothing is written — the session that a
 * successful check produces is dropped before the call returns, and the client
 * never touches storage, so the admin stays signed in throughout.
 */
export async function verifyStaffSignIn(
  email: string,
  password: string,
): Promise<SignInCheck> {
  const address = email.trim().toLowerCase();
  if (!address || !address.includes("@") || !password) {
    return { ok: false, reason: "Enter the address and the password to test." };
  }

  const checker = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: "janoon-invite-token",
    },
  });
  const { error } = await checker.auth.signInWithPassword({
    email: address,
    password,
  });
  // The token never leaves this client, but release it rather than leave a live
  // one sitting in memory.
  await checker.auth.signOut().catch(() => undefined);

  if (!error) return { ok: true };
  if (/email not confirmed/i.test(error.message)) {
    return {
      ok: false,
      reason:
        "The account exists, but the address has never been confirmed — send a setup link and have them open it first.",
    };
  }
  if (/invalid login credentials/i.test(error.message)) {
    return {
      ok: false,
      reason:
        "That is not the password on the account. Supabase keeps only a hash, so nobody can read the real one back — send a setup link to set a new password.",
    };
  }
  if (/rate limit|too many|security purposes/i.test(error.message)) {
    return { ok: false, reason: "Too many attempts just now. Wait a minute and try again." };
  }
  return { ok: false, reason: firstLine(error.message) };
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

/**
 * Erase a team member for good — team rows *and* the Supabase Auth account.
 *
 * Reversible, unlike `removeStaff()`: the address is released, so the same
 * person can be added again from scratch afterwards. The row in `auth.users` is
 * removed by a `security definer` function in Postgres, because a publishable
 * key cannot reach the auth schema from the browser and a service-role key must
 * never live in a page. Three guards sit in the database, not here: admin only,
 * never the caller's own account, never the last admin.
 */
export async function deleteStaffAccount(userId: string): Promise<void> {
  await rpc("admin_delete_staff_account", { p_user_id: userId });
}

export async function grantRole(userId: string, role: StaffRole) {
  await rpc("admin_grant_role", { p_user_id: userId, p_role: role });
}

export async function removeRole(userId: string, role: StaffRole) {
  await rpc("admin_remove_role", { p_user_id: userId, p_role: role });
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
    console.warn(`[Junoon] staff email sync failed: ${error.message}`);
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
  const { data, error: lookupError } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (lookupError || !email) {
    throw new Error("You are not signed in any more. Sign in again.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (error) throw new Error(authError(error.message));
  return email;
}

/** The session was gone by the time we wrote to it — worth one more try. */
function isMissingSession(message: string): boolean {
  return /auth session missing|session not found|not authenticated|invalid refresh token|refresh token not found/i.test(
    message,
  );
}

/**
 * Supabase Auth answers in its own words — "Invalid login credentials",
 * "New password should be different from the old password.", "Auth session
 * missing!". Every one of those is something the reader can act on, so each is
 * translated into a sentence about what to do. Anything we do not recognise is
 * passed through untouched rather than swallowed.
 */
function authError(message: string): string {
  const text = firstLine(message);
  if (/invalid login credentials|invalid password/i.test(text)) {
    return "That password is not correct.";
  }
  if (/should be different from the old password/i.test(text)) {
    return "The new password has to be different from the old one.";
  }
  if (/(at least|minimum of)\s*\d+\s*character|is too short|password should be at least/i.test(text)) {
    return "Use at least 8 characters for the new password.";
  }
  if (/unable to validate email|invalid email|not a valid email|email address .*invalid/i.test(text)) {
    return "Enter a valid email address.";
  }
  if (/already been registered|already registered|already exists|already in use/i.test(text)) {
    return "That email address already belongs to an account.";
  }
  if (/has been changed|confirm the change|confirmation link/i.test(text)) {
    return "Supabase emailed you a confirmation link — open it and the address changes.";
  }
  if (isMissingSession(text)) {
    return "Your sign-in session expired. Sign in again, then try once more.";
  }
  if (/rate limit|too many requests|too many attempts|security purposes/i.test(text)) {
    return "Too many attempts just now. Wait a minute, then try again.";
  }
  return text;
}

/**
 * Hand the change to Supabase Auth on the caller's own session.
 *
 * `reauthenticate` has just issued a brand new session, so the write below is
 * the one call that can lose a race with it. If Auth says the session is
 * missing, the client is refreshed and the identical call is made once more —
 * that single retry is what turns a silent no-op into a changed password.
 */
async function updateOwnAccount(
  attributes: { email?: string; password?: string },
): Promise<string> {
  let { data, error } = await supabase.auth.updateUser(attributes);
  if (error && isMissingSession(error.message)) {
    await supabase.auth.refreshSession();
    ({ data, error } = await supabase.auth.updateUser(attributes));
  }
  if (error) throw new Error(authError(error.message));
  return data?.user?.email ?? "";
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

  const live = await updateOwnAccount({ email: address });

  // With "secure email change" on, the address only moves once the links have
  // been opened. The row is re-synced on the next visit either way.
  const confirmationRequired = live.toLowerCase() !== address;
  await syncOwnStaffEmail();
  return { confirmationRequired, address };
}

/** Change the password. The role is not part of this call. */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
  /** The typed-again copy, when the screen has one. Both are checked here so
   *  the rule cannot be forgotten by a caller that forgets to check it. */
  repeatPassword?: string,
): Promise<void> {
  if (repeatPassword !== undefined && newPassword !== repeatPassword) {
    throw new Error("The new password and the repeat have to match.");
  }
  if (newPassword.length < 8) {
    throw new Error("Use at least 8 characters for the new password.");
  }
  if (newPassword === currentPassword) {
    throw new Error("The new password has to be different from the old one.");
  }
  await reauthenticate(currentPassword);
  await updateOwnAccount({ password: newPassword });
}
