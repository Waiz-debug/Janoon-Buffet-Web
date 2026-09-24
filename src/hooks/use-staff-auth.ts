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

/** Where a confirmation link lands: back on the admin door, signed in. */
export function confirmationRedirect(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/?unlock=admin`;
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
 * Send the confirmation link again.
 *
 * Called when the sign-in service says the address is unconfirmed, so the way
 * forward is on screen: open the new link, which returns here with a real
 * session, and the account signs itself in. A failure is reported, never
 * swallowed — telling somebody a link is on its way when it is not is the same
 * class of mistake as blaming their password.
 */
export async function resendConfirmationEmail(email: string): Promise<boolean> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: confirmationRedirect() },
  });
  if (error) {
    console.warn(`[JUNOON] confirmation email not sent: ${error.message}`);
    return false;
  }
  return true;
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

/** Turn a Supabase Auth complaint into something the form can act on. */
function classifyAuthError(message: string): OwnerSetupFailure {
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
    console.warn(`[JUNOON] sign-in refused (${reason}): ${error.message}`);
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
 * Three things happen, in order:
 *   1. Supabase Auth creates the user with the ordinary publishable key.
 *   2. We hold the auth UUID it hands back.
 *   3. `claim_admin()` records that UUID in `staff_members` as an admin.
 *
 * Step 3 is decided in Postgres, and only while the table holds no active
 * admin, so the door is shut as soon as one exists — and reopens if the last one
 * is removed. An account already on the team as staff is refused, so this is
 * never a route from staff to admin. No service-role key is involved, and none
 * could be, since it would have to ship in the bundle.
 *
 * Calling this twice with the same details is safe — the second time round
 * `signUp` reports the account already exists, we sign in instead, and the claim
 * answers `claimed` if someone else got there first. That second pass is also
 * what finishes the job after a confirmation email is opened.
 *
 * Nothing is reported as created until the role is really recorded: every path
 * that cannot reach the grant ends in a failure the card can explain.
 */
export async function claimFirstAdmin(
  email: string,
  password: string,
): Promise<OwnerClaim> {
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
  // Confirming the address lands back on the admin card, so whoever set the
  // account up finishes in one press instead of arriving at the gateway holding
  // a session that records no role yet.
  const emailRedirectTo = confirmationRedirect();

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
    console.warn(`[Janoon] admin claim refused: ${claim.error.message}`);
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
