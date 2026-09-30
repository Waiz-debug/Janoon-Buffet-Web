import * as redirects from "@/lib/redirects";
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
 *   open       — the database holds no active admin, so the claim is on offer
 *   closed     — an active admin exists, so the claim is refused
 *   outdated   — the database answered, but with the first version of the rule,
 *                which hid the setup action whenever ANY staff row existed
 *   missing    — the database has no bootstrap rule at all, so it cannot hold an
 *                admin either; the claim is offered because the refusal that
 *                would otherwise apply cannot exist
 *   unavailable — the question could not be answered (network down, the call
 *                refused). Deliberately *not* `open`: offering setup on a guess
 *                is exactly what "the browser must have no influence on this"
 *                forbids
 */
export type AdminSetupState =
  | "open"
  | "closed"
  | "outdated"
  | "missing"
  | "unavailable";

/**
 * Is the setup action allowed to be shown at all?
 *
 * The single place that decides, so the card cannot show it in one state and
 * hide it in another. `open` and `missing` are the two answers where the
 * database has positively told us no admin exists — the second because a
 * database without the rule cannot be holding one. Everything else, including
 * "we could not ask", says no.
 */
export function setupIsOffered(state: AdminSetupState | "checking"): boolean {
  return state === "open" || state === "missing";
}

/** The table that records who may work the portals. */
const STAFF_TABLE = TABLES.staffMembers;

export const NOT_STAFF_MESSAGE =
  "That account does not have portal access. Ask an administrator to add it.";

/**
 * Shown when a signed-in account reaches the admin door without the role.
 *
 * Deliberately not a redirect: sending a staff account on to /staff would look
 * like the admin door had opened, when what actually happened is that it
 * refused. The session is closed as well, so no screen can quietly forward the
 * account somewhere it did not ask for.
 */
export const NOT_ADMIN_MESSAGE = "Admin access required.";

/** One wording for a rejected email/password pair, on both doors. */
export const INCORRECT_CREDENTIALS_MESSAGE = "Incorrect email or password.";

/**
 * The password was right, but the address was never confirmed.
 *
 * Saying "incorrect email or password" here is what made a perfectly good
 * administrator account look broken: the sign-in service refuses an
 * unconfirmed address with its own error, and every error used to be reported
 * as a bad password. This is the honest wording — plus the link is sent again.
 */
export const EMAIL_UNCONFIRMED_MESSAGE =
  "That email address has not been confirmed yet. We have sent a new confirmation link — open it, then sign in.";

/** Too many attempts in a row; the sign-in service is asking us to slow down. */
export const RATE_LIMITED_MESSAGE =
  "Too many sign-in attempts just now. Please wait a minute and try again.";

/** The sign-in service could not be reached at all — a connection problem. */
export const UNREACHABLE_MESSAGE =
  "Could not reach the sign-in service. Check your connection and try again.";

/**
 * The address is unconfirmed and a new link was just sent, so the mail allowance
 * for the hour is the thing standing in the way — not the account.
 */
export const CONFIRMATION_RATE_LIMITED_MESSAGE =
  "That email address is still not confirmed. A confirmation link was sent a moment ago — open it, or wait a few minutes and ask for another.";

/**
 * The address is unconfirmed and nothing can be delivered.
 *
 * Deliberately not "try again in a moment": that would send the owner round a
 * loop that cannot end. Nothing technical is named here — the console carries
 * the service's own words — but the sentence points at the one thing that has to
 * change, which is the project's mail settings rather than the account.
 */
export const CONFIRMATION_UNDELIVERABLE_MESSAGE =
  "That email address is still not confirmed, and the confirmation email could not be delivered. Your account and password are unchanged — ask whoever manages the restaurant's sign-in settings to check the email setup, or confirm the address directly.";

/**
 * Where a confirmation link should land: back on the admin door, signed in.
 *
 * The deployed address is read from `VITE_SITE_URL` before falling back to
 * whatever origin the page happens to be on. That matters because Supabase
 * rewrites a redirect it does not recognise to the project's Site URL, so a
 * link generated on a preview or local origin can be delivered pointing
 * somewhere the admin flow cannot finish. Setting `VITE_SITE_URL` to the real
 * restaurant address keeps the link correct no matter where the email is
 * opened, and the same address belongs in Supabase's own Site URL setting as
 * the fallback for links that carry no redirect at all.
 */
export function confirmationRedirect(): string | undefined {
  return redirects.confirmationRedirect();
}

export const UNCONFIGURED_MESSAGE =
  "Sign-in is not available right now. Please try again later.";

/**
 * The account was created but the admin role was never recorded.
 *
 * Shown only inside the owner-setup card, and written for the person setting
 * the restaurant up rather than for whoever maintains the site: no file names,
 * no SQL, nothing to run by hand. Whatever the database actually said is logged
 * to the console instead, where it is useful for debugging and invisible to the
 * owner. Telling somebody to go and paste a script into a database console is
 * not a way to finish setting up an account.
 */
export const SETUP_REQUIRED_MESSAGE =
  "We could not finish setting up the administrator account. Please try again in a moment.";

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
    console.warn(`[Junoon] staff lookup failed: ${error.message}`);
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
  | {
      ok: true;
      userId: string;
      email: string;
      role: StaffRole;
      /** Every role the account holds; the door check reads this list. */
      roles: StaffRole[];
    }
  | {
      ok: false;
      reason: SignInRefusal;
    };

/**
 * Every way the sign-in service can turn an account away.
 *
 * These are kept apart on purpose. Collapsing them into one "bad credentials"
 * answer is how an unconfirmed address, a rate limit and a genuinely wrong
 * password all ended up looking identical on screen — and it sent the owner
 * hunting for a password problem that did not exist.
 */
export type SignInRefusal =
  /** The password did not match, or no such account exists. */
  | "credentials"
  /** Password accepted, but the address still has to be confirmed. */
  | "email-unconfirmed"
  /** Too many attempts for now. */
  | "rate-limited"
  /** Signed in, but no row on the team (an ordinary customer). */
  | "not-staff"
  /** Signed in and on the team, but not an admin — the admin door. */
  | "not-admin"
  | "unreachable"
  | "unconfigured";

/**
 * Read the sign-in service's own answer instead of assuming it.
 *
 * `error.code` is the stable machine-readable field (`email_not_confirmed`,
 * `invalid_credentials`, `over_request_rate_limit`); the message is matched too
 * so a project on an older version of the library is classified the same way.
 * Only the network case is inferred from prose, because that is genuinely a
 * failure to reach the service rather than a decision it made.
 */
export function classifySignInError(error: {
  message?: string;
  code?: string;
}): SignInRefusal {
  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  const both = `${code} ${message}`;

  if (both.includes("email_not_confirmed") || both.includes("email not confirmed")) {
    return "email-unconfirmed";
  }
  if (
    both.includes("rate_limit") ||
    both.includes("too many requests") ||
    /rate limit/.test(both)
  ) {
    return "rate-limited";
  }
  if (
    /fetch|network|failed to fetch|load failed|timed? out/.test(both)
  ) {
    return "unreachable";
  }
  return "credentials";
}

/**
 * Why a confirmation email did not go out.
 *
 * `rate-limited` means "try again shortly" — the project's mail allowance for
 * the hour is spent. `provider` is the opposite: nothing will be delivered
 * until somebody configures an email provider for the project, and telling the
 * owner to "try again in a moment" would leave them retrying forever.
 */
export type ConfirmationSend =
  | { ok: true }
  | {
      ok: false;
      reason: "rate-limited" | "provider" | "unreachable" | "unknown";
      /** The service's own words. Logged, never rendered. */
      detail: string;
    };

/**
 * Send the confirmation link again.
 *
 * Called when the sign-in service says the address is unconfirmed, so the way
 * forward is on screen: open the new link, which returns here with a real
 * session, and the account signs itself in. A failure is reported, never
 * swallowed — telling somebody a link is on its way when it is not is the same
 * class of mistake as blaming their password.
 *
 * The two failures worth telling apart are separated here because the advice is
 * opposite: a spent mail allowance wants patience, a missing email provider
 * wants somebody to configure one. Everything the service said is logged either
 * way, so the console names the cause even when the card cannot.
 */
export async function resendConfirmationEmail(
  email: string,
): Promise<ConfirmationSend> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: confirmationRedirect() },
  });
  if (!error) return { ok: true };

  const detail = error.message ?? "";
  const both = `${error.code ?? ""} ${detail}`.toLowerCase();
  console.warn(`[Junoon] confirmation email not sent: ${detail}`);

  if (
    both.includes("rate") ||
    both.includes("too many") ||
    both.includes("security purposes")
  ) {
    return { ok: false, reason: "rate-limited", detail };
  }
  // Supabase's own wording when the project has no working mail provider, or
  // when the one configured is refusing the credentials.
  //
  // "Email address not authorized" is the one that actually bites here: a
  // project still on Supabase's shared testing server will only deliver to the
  // email addresses on its own organisation team, and refuses every other
  // address outright. The account is fine and the password is fine — the mail
  // simply cannot be sent to that address.
  if (
    both.includes("smtp") ||
    both.includes("error sending") ||
    both.includes("provider") ||
    both.includes("not configured") ||
    both.includes("not authorized")
  ) {
    return { ok: false, reason: "provider", detail };
  }
  if (/fetch|network|failed to fetch|load failed/.test(both)) {
    return { ok: false, reason: "unreachable", detail };
  }
  return { ok: false, reason: "unknown", detail };
}

/**
 * Why creating the owner account stopped short.
 *
 * `confirm-email` is not a failure — it is the state the site is in when the
 * Supabase project asks new accounts to confirm their address first. The form
 * shows "open the link, then continue" and the same call finishes the job.
 */
/** Every way the one-time owner setup can stop short, and why. */
export type OwnerSetupFailure = {
  ok: false;
  reason:
    | "confirm-email"
    | "claimed"
    | "credentials"
    /** The existing account was granted admin; sign in with its password. */
    | "existing-account"
    /** The email already has an account whose password was not accepted. */
    | "email-taken"
    /** Too many attempts in a short time — the address is not the problem. */
    | "rate-limited"
    /** No admin was recorded — the database rule is not installed. */
    | "setup-required"
    | "weak-password"
    | "invalid-email"
    | "unreachable"
    | "unconfigured"
    | "unknown";
  message?: string;
};

/** The claim itself, before the hook turns a success into a session. */
export type OwnerClaim =
  | { ok: true; userId: string; email: string; roles: StaffRole[] }
  | OwnerSetupFailure;

/** What the setup card is told once the hook has stored the session. */
export type OwnerSetupResult = { ok: true; role: StaffRole } | OwnerSetupFailure;

/**
 * Turn a Supabase Auth complaint into something the form can act on.
 *
 * The order matters more than anything else here, because several of the
 * service's refusals *mention* the word "email" without having anything to say
 * about the address. "A user with this email address has already been
 * registered" and "Email rate limit exceeded" are both about an address that is
 * perfectly well formed, and a classifier that reached for "email" first told
 * the owner their address was not accepted — which is how a valid
 * `admin@junoon.com` ended up refused for looking like a typo.
 *
 * So each case is matched by what it actually says, in this order:
 *
 *   1. too many attempts        — a pause, not a correction
 *   2. the address is taken     — a different account, not a bad one
 *   3. the password is refused  — a length or strength rule
 *   4. the address is malformed — the one case that really is the address
 *   5. the service is unreachable
 *
 * Anything unrecognised stays `unknown`, and its own words are kept for the
 * console. Nothing is guessed into "your email is wrong" any more.
 */
function classifyAuthError(
  message: string,
  code?: string,
): OwnerSetupFailure {
  const text = message.toLowerCase();
  const reason = (code ?? "").toLowerCase();

  if (
    /rate limit|too many|security purposes|over_request_rate_limit|email_rate_limit/.test(
      text,
    ) ||
    reason === "over_request_rate_limit" ||
    reason === "email_rate_limit"
  ) {
    return { ok: false, reason: "rate-limited", message };
  }

  // The service's wordings for "this address already has an account":
  // "User already registered", "A user with this email address has already
  // been registered", "Email address x has already been taken".
  if (
    /already\s+(been\s+)?registered|already\s+exists|already\s+been\s+taken|has\s+already\s+been/.test(
      text,
    ) ||
    reason === "user_already_exists" ||
    reason === "email_exists"
  ) {
    return { ok: false, reason: "email-taken", message };
  }

  if (/password/.test(text)) return { ok: false, reason: "weak-password", message };

  // Only these actually say the address itself is the problem.
  if (
    /unable to validate email|invalid email|is not a valid email|email.*format|malformed/.test(
      text,
    )
  ) {
    return { ok: false, reason: "invalid-email", message };
  }

  if (/fetch|network/.test(text)) return { ok: false, reason: "unreachable", message };

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
 * Ask the database whether an administrator may still be claimed.
 *
 * Module scope and free of React, so the claim can be gated by the same rule
 * the setup button is shown by, and so both can be tested against a fake server
 * without a browser. One read, one boolean, and every failure mode kept apart:
 * a refusal that could not be obtained is reported as such rather than being
 * rounded to "no admin exists".
 */
export async function adminSetupState(): Promise<AdminSetupState> {
  const { data, error } = await supabase.rpc("staff_bootstrap_state");
  if (error) {
    console.warn(`[Junoon] admin setup check failed: ${error.message}`);
    return isMissingFunction(error) ? "missing" : "unavailable";
  }
  const answer = data as { claimable?: boolean; version?: number } | null;
  if (answer?.version !== 2) return "outdated";
  if (answer.claimable === true) return "open";
  if (answer.claimable === false) return "closed";
  return "unavailable";
}

/**
 * Check a password and read the role behind it — the whole of sign-in, with no
 * React state attached, so the rule can be tested without a browser.
 *
 * `requiredRole` is the door the person used, not a preference: signing in at
 * `/admin` with a staff account is a refusal, not a quiet forwarding to
 * `/staff`. The role comes from `staff_members`, read through row level
 * security, so the browser cannot invent one — and from nothing else: not the
 * address, not the page, not storage.
 *
 * Three refusals are kept apart, because the card says something different
 * about each:
 *
 *   not-staff    signed in, but no row on the team (an ordinary customer)
 *   not-admin    on the team, but the admin door wants a row that holds admin
 *   credentials  the password did not match, or the account does not exist
 *
 * The first two close the session they just opened. Leaving one alive would
 * hand the account to whichever screen renders next, and on a live session the
 * gateway forwards staff straight to /staff — the very redirect the admin door
 * must never perform.
 */
export async function authenticate(
  email: string,
  password: string,
  requiredRole?: StaffRole,
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    // The service's own answer, reported as-is. Whatever it said is kept in the
    // console so the console shows the truth even where the card shows a single
    // sentence; it is never quietly rewritten into "wrong password".
    const reason = classifySignInError(error);
    console.warn(`[Junoon] sign-in refused (${reason}): ${error.message}`);
    return { ok: false, reason };
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
  if (requiredRole === "admin" && !lookup.roles.includes("admin")) {
    // On the team, but not an admin, at the admin door. Refused — and the
    // session closed with it, so that nothing quietly forwards this account to
    // /staff as though the admin console had opened.
    await supabase.auth.signOut();
    return { ok: false, reason: "not-admin" };
  }

  return {
    ok: true,
    userId: data.user.id,
    email: data.user.email ?? "",
    role: lookup.roles[0],
    roles: lookup.roles,
  };
}

/**
 * Create the admin account from the website — no dashboard step.
 *
 * What happens first, and by default:
 *   1. `admin_bootstrap_owner()` creates the Auth identity in Postgres, already
 *      confirmed, with the password hashed there. No mail is sent.
 *   2. We sign in with that password to get a real session.
 *   3. `staffLookup()` reads the caller's own roles back, and the setup is
 *      reported as done only once the row is really there.
 *
 * The mail is the point. The original path used `supabase.auth.signUp()`, which
 * makes Supabase send a confirmation message, and that call is refused with
 * "Too many attempts just now" once the project's hourly quota is spent — an
 * error about the quota, not about the address, on an address that was fine.
 * `admin_bootstrap_owner` sends nothing, so setup cannot be blocked by it.
 *
 * Everything else in this function is the fallback for a database that has not
 * been given that function yet, and is reached only when it reports itself
 * missing. Those paths still sign up, and still need a deliverable mail.
 *
 * The one-time rule is decided in Postgres, and only while the table holds no
 * active admin, so the door is shut as soon as one exists — and reopens if the
 * last one is removed. An account already on the team as staff is refused, so
 * this is never a route from staff to admin. No service-role key is involved,
 * and none could be, since it would have to ship in the bundle.
 *
 * Calling this twice with the same details is safe — the second time round
 * `signUp` reports the account already exists, we sign in instead, and the claim
 * answers `claimed` if someone else got there first. That second pass is also
 * what finishes the job after a confirmation email is opened.
 *
 * Nothing is reported as created until the role is really recorded: every path
 * that cannot reach the grant ends in a failure the card can explain.
 */
/**
 * Create the first admin in Postgres, where no mail is involved.
 *
 * Returns `null` — and only `null` — when this database cannot do it, so the
 * caller falls back to the signUp path. Every other outcome is a finished
 * answer, including the refusals: passing one of those down to the fallback
 * would re-ask a question the database has already answered, and the fallback's
 * signUp would send the mail this function exists to avoid.
 *
 * Three things can come back, and they are told apart deliberately:
 *   • the function is not installed   → null, fall back
 *   • the one-time rule refuses        → that refusal, reported as-is
 *   • anything else went wrong         → reported, never guessed at
 */
async function bootstrapOwner(
  address: string,
  password: string,
): Promise<OwnerClaim | null> {
  const { data, error } = await supabase.rpc("admin_bootstrap_owner", {
    p_email: address,
    p_password: password,
    p_display_name: null,
  });

  if (error) {
    // "Could not find the function" means this project has not run the
    // staff-auth migration yet. That is the one case the older flow can still
    // handle, so it is the one case worth handing back.
    if (isMissingFunction(error)) {
      console.warn(
        "[Junoon] admin_bootstrap_owner is not installed — falling back to the signUp path, which needs a deliverable email.",
      );
      return null;
    }

    // The database refused, and its reason is the answer. The one-time rule and
    // the staff self-promotion guard both land here, and both are correct.
    if (/already exists|staff accounts cannot/i.test(error.message)) {
      return { ok: false, reason: "claimed", message: error.message };
    }
    // A password the function would refuse to set is the caller's to correct.
    if (/at least 8 characters/i.test(error.message)) {
      return { ok: false, reason: "weak-password", message: error.message };
    }
    if (/valid email address/i.test(error.message)) {
      return { ok: false, reason: "invalid-email", message: error.message };
    }
    // Anything else — including a failure inside the auth.users insert — is
    // surfaced rather than retried down a path that would send a mail.
    console.warn(
      `[Junoon] admin_bootstrap_owner failed: ${error.message}`,
    );
    return { ok: false, reason: "setup-required", message: error.message };
  }

  const result = data as
    | { ok?: boolean; userId?: string; email?: string; authCreated?: boolean }
    | null;

  if (!result?.ok || !result.userId) {
    // The call succeeded but granted nothing. Believing it would hand the card
    // a success and then refuse the person at the sign-in gate.
    return { ok: false, reason: "setup-required" };
  }

  // The account exists and is confirmed, so this is an ordinary sign-in. If it
  // fails, the row is not being written the way a sign-in expects — which is
  // worth saying plainly rather than reporting as a bad password.
  const attempt = await supabase.auth.signInWithPassword({
    email: address,
    password,
  });

  if (attempt.error) {
    console.warn(
      `[Junoon] the owner was created but could not be signed in: ${attempt.error.message}`,
    );
    return classifyAuthError(attempt.error.message, attempt.error.code);
  }

  // Believed only once the database agrees the role is really recorded.
  const confirmed = await staffLookup(result.userId);
  if (confirmed.ok && confirmed.roles.includes("admin")) {
    return {
      ok: true,
      userId: result.userId,
      email: result.email ?? address,
      roles: confirmed.roles,
    };
  }

  // No role: the account is there but access is not, so the session is closed
  // again rather than handed to an account that cannot get in.
  await supabase.auth.signOut();
  return { ok: false, reason: "setup-required" };
}

export async function claimFirstAdmin(
  email: string,
  password: string,
): Promise<OwnerClaim> {
  const address = email.trim();

  // ------------------------------------------------------------------
  // GATE — asked of the database before anything is created.
  //
  // The setup action is hidden while an admin exists, but hiding it is a
  // convenience; this is the part that actually decides. Nothing is signed up,
  // no role is granted and no account is touched unless the database has just
  // answered that it holds no active admin — the same question the button's
  // visibility was decided by, asked again here so the two can never disagree
  // and so a stale screen (or a hand-made request) cannot slip past it.
  //
  // An answer that could not be obtained is a refusal, not a pass.
  // ------------------------------------------------------------------
  const state = await adminSetupState();
  if (state === "closed" || state === "outdated" || state === "unavailable") {
    return {
      ok: false,
      reason: "claimed",
      message:
        state === "outdated"
          ? "This database has not been updated with the current one-time setup rule."
          : "An admin account already exists for this restaurant.",
    };
  }

  // ------------------------------------------------------------------
  // PHASE 0 — Create the first admin in Postgres. No email.
  //
  // Everything below this line exists only as a fallback for a database that has
  // not been given admin_bootstrap_owner yet. It goes through
  // `supabase.auth.signUp()`, which makes Supabase send a confirmation mail, and
  // that call is refused with "Too many attempts just now" once the project's
  // hourly mail quota is spent. The address is perfectly valid; the quota is the
  // problem, and it clears on Supabase's schedule rather than ours — so setup
  // that needs a mail is setup that can be blocked by something no one here
  // controls.
  //
  // This call creates the Auth identity, confirms the address, records the admin
  // role and sends nothing at all. It performs its own one-time check inside the
  // same transaction, so the gate above is belt-and-braces rather than the only
  // guard.
  // ------------------------------------------------------------------
  const bootstrapped = await bootstrapOwner(address, password);
  if (bootstrapped) return bootstrapped;

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
      `[Junoon] admin granted to the existing sign-in account: ${address}`,
    );
    return {
      ok: false,
      reason: "existing-account",
      message: address,
    };
  }

  // A project whose database predates this rule answers the call with "Could
  // not find the function". Remember which one it was: it is the difference
  // between "this database can grant nothing" and "the account is fine, the
  // password was wrong".
  const byEmailRuleMissing = !!existingErr && isMissingFunction(existingErr);

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
        `[Junoon] claim_admin_for_email failed: ${existingErr.message}`,
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
  // Confirming the address lands back on the admin card, so whoever set the
  // account up finishes in one press instead of arriving at the gateway holding
  // a session that records no role yet.
  const emailRedirectTo = confirmationRedirect();

  const { data, error } = await supabase.auth.signUp({
    email: address,
    password,
    options: { emailRedirectTo },
  });

  // The service words "this address already has an account" several ways, and
  // the wording has changed between versions. A narrow test here is what sent
  // "A user with this email address has already been registered" on to the
  // classifier below, which reported it as a rejected address.
  const alreadyHasAccount =
    /already\s+(been\s+)?registered|already\s+exists|has\s+already\s+been/.test(
      error?.message ?? "",
    ) || error?.code === "user_already_exists";

  if (error && !alreadyHasAccount) {
    return classifyAuthError(error.message, error.code);
  }

  // `data` is not guaranteed to be an object when Auth answered with an error —
  // a duplicate sign-up comes back as an error and no payload at all. Reading
  // through it unconditionally threw a TypeError, which the card reported as
  // "something went wrong" for an address that was merely already taken.
  let user = data?.user ?? null;
  if (!data?.session) {
    const attempt = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });
    if (attempt.error) {
      const message = attempt.error.message.toLowerCase();
      if (message.includes("confirm")) {
        // The project asks new accounts to confirm their address before they
        // can sign in (Supabase's "Confirm email" setting). Not a failure: the
        // card says so, and Continue finishes the claim once the link has been
        // opened.
        await supabase.auth.resend({
          type: "signup",
          email: address,
          options: { emailRedirectTo },
        });
        return { ok: false, reason: "confirm-email" };
      }
      if (message.includes("fetch") || message.includes("network")) {
        return { ok: false, reason: "unreachable" };
      }
      // The address already has a Supabase Auth account, and the password typed
      // here is not that account's password. Nothing has been granted — Phase 1
      // either refused or is not installed — so this is reported as a failure.
      // Claiming success here is what told people their admin account was ready
      // and then refused them at the sign-in card.
      return {
        ok: false,
        reason: byEmailRuleMissing ? "setup-required" : "email-taken",
        message: address,
      };
    }
    user = attempt.data.user;
  }
  if (!user) return { ok: false, reason: "unknown" };

  const claim = await supabase.rpc("claim_admin");
  if (claim.error) {
    console.warn(`[Junoon] admin claim refused: ${claim.error.message}`);
  }

  /**
   * The grant is believed only once the database agrees with it.
   *
   * The function returning without an error is not proof that the role was
   * recorded: a database still carrying an older copy of the rule, or a policy
   * that will not let the account read its own row, both leave an account that
   * looks created and is then refused at the sign-in card. Reading the caller's
   * own row back is what separates the two, and it is why nothing is reported
   * as created until the row is present, `admin`, and switched on — the same
   * four things sign-in checks a moment later. Anything less and the session is
   * closed again rather than handed to an account with no access.
   */
  const confirmed = await staffLookup(user.id);
  if (confirmed.ok && confirmed.roles.includes("admin")) {
    return {
      ok: true,
      userId: user.id,
      email: user.email ?? address,
      roles: confirmed.roles,
    };
  }

  await supabase.auth.signOut();
  // Two kinds of refusal, told apart. "An admin account already exists" (or a
  // staff account trying to promote itself) is the rule working, and has its
  // own wording. Anything else means the role was never recorded — a function
  // this project does not have, or a rule from an older build refusing for its
  // own reasons — so the card says the setup step is outstanding rather than
  // inventing a cause.
  const refusal = claim.error?.message ?? "";
  if (/already exists|staff accounts cannot/i.test(refusal)) {
    return { ok: false, reason: "claimed", message: refusal };
  }
  return { ok: false, reason: "setup-required", message: refusal };
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

  /**
   * Sign in through one of the two doors, and keep what came back.
   *
   * The rule is `authenticate` above — module scope, no React — so it can be
   * tested against a fake server; this only stores the session.
   */
  const signIn = useCallback(
    async (
      email: string,
      password: string,
      requiredRole?: StaffRole,
    ): Promise<SignInResult> => {
      const result = await authenticate(email, password, requiredRole);
      if (result.ok) {
        setSession({
          userId: result.userId,
          email: result.email,
          role: result.role,
          roles: result.roles,
        });
        setIsLoaded(true);
      }
      return result;
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
    // The same read the claim is gated by, from one place: a database with no
    // bootstrap function cannot be holding an admin either, while a dropped
    // connection is not an answer and must not be rounded to "you may claim".
    return adminSetupState();
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
   * claim answers `claimed` if someone else got there first. That second pass
   * is also what finishes the job after a confirmation email is opened.
   *
   * Nothing is reported as created until the role is really recorded: every
   * path that cannot reach the grant ends in a failure the card can explain.
   */
  const setupOwner = useCallback(
    async (email: string, password: string): Promise<OwnerSetupResult> => {
      const outcome = await claimFirstAdmin(email, password);
      if (!outcome.ok) return outcome;
      setSession({
        userId: outcome.userId,
        email: outcome.email,
        role: outcome.roles[0],
        roles: outcome.roles,
      });
      setIsLoaded(true);
      return { ok: true, role: outcome.roles[0] };
    },
    [],
  );

  return { session, isLoaded, signIn, signOut, setupOwner, canClaimOwner };
}
