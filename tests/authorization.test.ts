/**
 * Targeted tests for the portal authorization rules.
 *
 * These pin the two promises the staff/admin layer makes, without needing a
 * database:
 *
 *   • Every privileged change is a request to a `security definer` function.
 *     The browser names a user and a role; it never writes a role into a table.
 *   • No password is ever put anywhere except Supabase Auth, and an account
 *     that is switched off holds no roles at all.
 *
 * `bun test` resolves `@/*` through the root tsconfig, so the modules under
 * test load exactly as they do in the app — only the Supabase client is faked.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

/* ------------------------------------------------------------ fake server --- */

type RpcCall = { name: string; args: Record<string, unknown> };
type TableTouch = { table: string; chain: string[] };
type Reply = { data: unknown; error: { message: string; code?: string } | null };
type AuthCall = { method: string; args: unknown[] };

const rpcCalls: RpcCall[] = [];
/** Any direct table access. The app should only ever reach tables via a policy. */
const tableTouches: TableTouch[] = [];
const authCalls: AuthCall[] = [];
/** Options handed to the throwaway client that creates staff sign-ins. */
const clientOptions: unknown[] = [];
const inviteSignUps: { email: string; password: string }[] = [];

let rpcReply: Reply = { data: null, error: null };
/** Answers by rpc name, for the flows that call more than one function. */
let rpcReplies: Record<string, Reply> = {};
let authReplies: Record<string, Reply> = {};
let tableReplies: Record<string, Reply> = {};

/**
 * A chainable stand-in for a PostgREST query. Every chain is recorded, and the
 * answer is whatever the test put in `tableReplies` for that table. The chain
 * itself is thenable, so both `await …maybeSingle()` and `await …select(…).eq(…)`
 * resolve to it — which is exactly how the client is used in the app.
 */
function tableProxy(table: string) {
  const touch: TableTouch = { table, chain: [] };
  const proxy: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "match",
    "order",
    "limit",
    "maybeSingle",
    "single",
  ]) {
    proxy[method] = (...args: unknown[]) => {
      touch.chain.push(method);
      void args;
      return proxy;
    };
  }
  proxy.then = (resolve: (value: unknown) => unknown) => {
    resolve(tableReplies[table] ?? { data: null, error: null });
    return proxy;
  };
  tableTouches.push(touch);
  return proxy;
}

const supabase = {
  rpc: async (name: string, args: Record<string, unknown> = {}) => {
    rpcCalls.push({ name, args });
    return rpcReplies[name] ?? rpcReply;
  },
  from: (table: string) => tableProxy(table),
  auth: {
    getUser: async (...args: unknown[]) => {
      authCalls.push({ method: "getUser", args });
      return authReplies.getUser ?? { data: { user: null }, error: null };
    },
    getSession: async (...args: unknown[]) => {
      authCalls.push({ method: "getSession", args });
      return authReplies.getSession ?? { data: { session: null }, error: null };
    },
    signInWithPassword: async (...args: unknown[]) => {
      authCalls.push({ method: "signInWithPassword", args });
      return authReplies.signInWithPassword ?? { data: {}, error: null };
    },
    updateUser: async (...args: unknown[]) => {
      authCalls.push({ method: "updateUser", args });
      return authReplies.updateUser ?? { data: { user: {} }, error: null };
    },
    resetPasswordForEmail: async (...args: unknown[]) => {
      authCalls.push({ method: "resetPasswordForEmail", args });
      return authReplies.resetPasswordForEmail ?? { data: {}, error: null };
    },
    signUp: async (...args: unknown[]) => {
      authCalls.push({ method: "signUp", args });
      return (
        authReplies.signUp ?? { data: { user: null, session: null }, error: null }
      );
    },
    resend: async (...args: unknown[]) => {
      authCalls.push({ method: "resend", args });
      return authReplies.resend ?? { data: {}, error: null };
    },
    signOut: async (...args: unknown[]) => {
      authCalls.push({ method: "signOut", args });
      return { error: null };
    },
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe() {} } },
    }),
  },
};

mock.module("@/lib/supabase", () => ({
  supabase,
  TABLES: { staffMembers: "staff_members" },
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "publishable-key",
  MEDIA_BUCKET: "tribe-media",
  mediaUrl: () => undefined,
}));

mock.module("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options?: unknown) => {
    clientOptions.push(options);
    return {
      auth: {
        signUp: async (payload: { email: string; password: string }) => {
          inviteSignUps.push(payload);
          return {
            data: { user: { id: "invited-id", email: payload.email }, session: null },
            error: null,
          };
        },
      },
    };
  },
}));

const staff = await import("../src/lib/staff");
const {
  authenticate,
  claimFirstAdmin,
  classifySignInError,
  portalPathFor,
  staffLookup,
  EMAIL_UNCONFIRMED_MESSAGE,
  INCORRECT_CREDENTIALS_MESSAGE,
  NOT_ADMIN_MESSAGE,
  RATE_LIMITED_MESSAGE,
  SETUP_REQUIRED_MESSAGE,
} = await import("../src/hooks/use-staff-auth");

beforeEach(() => {
  rpcCalls.length = 0;
  tableTouches.length = 0;
  authCalls.length = 0;
  clientOptions.length = 0;
  inviteSignUps.length = 0;
  rpcReply = { data: null, error: null };
  rpcReplies = {};
  authReplies = {};
  tableReplies = {};
});

/* --------------------------------------------------------------- portal --- */

describe("portal routing", () => {
  test("each role reaches its own portal, and admin wins when held alongside staff", () => {
    expect(portalPathFor("admin")).toBe("/admin");
    expect(portalPathFor("staff")).toBe("/staff");
    expect(portalPathFor("staff", ["staff", "admin"])).toBe("/admin");
    expect(portalPathFor("admin", ["admin", "staff"])).toBe("/admin");
  });
});

/* ---------------------------------------------------------- role lookup --- */

describe("staffLookup", () => {
  test("an account switched off holds no roles, and its extra roles are never even read", async () => {
    tableReplies.staff_members = { data: { role: "admin", active: false }, error: null };

    expect(await staffLookup("user-1")).toEqual({ ok: true, roles: [] });
    expect(tableTouches.map((touch) => touch.table)).toEqual(["staff_members"]);
  });

  test("roles are the junction rows plus the primary role, with unknown values dropped", async () => {
    tableReplies.staff_members = { data: { role: "admin", active: true }, error: null };
    tableReplies.staff_member_roles = {
      data: [{ role: "staff" }, { role: "owner" }],
      error: null,
    };

    expect(await staffLookup("user-1")).toEqual({ ok: true, roles: ["staff", "admin"] });
  });

  test("an account absent from the team is an ordinary customer", async () => {
    tableReplies.staff_members = { data: null, error: null };

    expect(await staffLookup("customer-1")).toEqual({ ok: true, roles: [] });
  });

  test("a database without the active column or the junction table keeps working", async () => {
    tableReplies.staff_members = { data: { role: "admin" }, error: null };
    tableReplies.staff_member_roles = {
      data: null,
      error: { message: 'relation "public.staff_member_roles" does not exist' },
    };

    expect(await staffLookup("user-1")).toEqual({ ok: true, roles: ["admin"] });
  });

  test("a lookup that fails is reported, so the portal is not trusted open", async () => {
    tableReplies.staff_members = {
      data: null,
      error: { message: "permission denied for table staff_members" },
    };

    expect(await staffLookup("user-1")).toEqual({
      ok: false,
      message: "permission denied for table staff_members",
    });
  });
});

/* ------------------------------------------------------- missing schema --- */

describe("isMissingFunction", () => {
  test("recognises the shapes PostgREST uses before the schema is applied", () => {
    expect(
      staff.isMissingFunction(
        new Error("Could not find the function public.claim_admin in the schema cache"),
      ),
    ).toBe(true);
    expect(
      staff.isMissingFunction(
        new Error("function public.staff_bootstrap_state() does not exist"),
      ),
    ).toBe(true);
  });

  test("does not mistake a real refusal for a missing function", () => {
    expect(
      staff.isMissingFunction(
        new Error("Only an active admin can change the team."),
      ),
    ).toBe(false);
    expect(staff.isMissingFunction(new Error("permission denied for function"))).toBe(false);
    expect(staff.isMissingFunction(null)).toBe(false);
  });
});

/* ------------------------------------------------------------- team list --- */

describe("listStaff", () => {
  test("normalises roles, rejects invalid ones, and treats only true as active", async () => {
    rpcReply = {
      data: [
        {
          userId: "admin-id",
          email: "owner@janoon.pk",
          displayName: "Owner",
          role: "admin",
          roles: ["admin", "staff"],
          active: true,
          createdAt: 5,
        },
        {
          userId: "legacy-id",
          email: null,
          displayName: null,
          // An unrecognised value in the column must not be passed through.
          role: "owner",
          roles: ["owner"],
          active: "yes",
          createdAt: undefined,
        },
      ],
      error: null,
    };

    const team = await staff.listStaff();

    expect(team[0]).toEqual({
      userId: "admin-id",
      email: "owner@janoon.pk",
      displayName: "Owner",
      role: "admin",
      roles: ["admin", "staff"],
      active: true,
      createdAt: 5,
    });
    // Invalid role strings grant nothing, and no column value is invented.
    expect(team[1]).toEqual({
      userId: "legacy-id",
      email: null,
      displayName: null,
      role: "staff",
      roles: [],
      active: false,
      createdAt: 0,
    });
  });

  test("surfaces the refusal, not the stack", async () => {
    rpcReply = {
      data: null,
      error: { message: "Only an admin can read the team.\nDETAIL: internal\nCONTEXT: x" },
    };

    await expect(staff.listStaff()).rejects.toThrow("Only an admin can read the team.");
  });
});

/* --------------------------------------------------------- role changes --- */

describe("role changes", () => {
  test("every privileged change is a database-checked function call", async () => {
    await staff.setStaffRole("user-1", "admin");
    await staff.setStaffActive("user-1", false);
    await staff.removeStaff("user-1");
    await staff.grantRole("user-1", "staff");
    await staff.removeRole("user-1", "staff");

    expect(rpcCalls.map((call) => call.name)).toEqual([
      "admin_set_staff_role",
      "admin_set_staff_active",
      "admin_remove_staff",
      "admin_grant_role",
      "admin_remove_role",
    ]);
    expect(rpcCalls[0].args).toEqual({ p_user_id: "user-1", p_role: "admin" });
    expect(rpcCalls[1].args).toEqual({ p_user_id: "user-1", p_active: false });
    expect(rpcCalls[2].args).toEqual({ p_user_id: "user-1" });
    expect(rpcCalls[3].args).toEqual({ p_user_id: "user-1", p_role: "staff" });
    // Nothing is written straight into a table from the browser.
    expect(tableTouches).toEqual([]);
  });

  test("a refusal to change a role reaches the caller intact", async () => {
    rpcReply = {
      data: null,
      error: { message: "Only an active admin can change the team.\nDETAIL: nope" },
    };

    await expect(staff.setStaffRole("user-1", "admin")).rejects.toThrow(
      "Only an active admin can change the team.",
    );
    expect(tableTouches).toEqual([]);
  });
});

/* ------------------------------------------------------- new staff login --- */

describe("addStaffAccount", () => {
  test("creates the sign-in without taking over the admin's session", async () => {
    const result = await staff.addStaffAccount("  New.Chef@Janoon.pk  ", "staff", "SharedSecret1!");

    expect(result).toEqual({ createdSignIn: true, usedResetLink: false });
    // The address is normalised, and the password goes to Auth — never to a table.
    expect(inviteSignUps).toEqual([
      { email: "new.chef@janoon.pk", password: "SharedSecret1!" },
    ]);
    expect(rpcCalls).toEqual([
      { name: "admin_add_staff", args: { p_email: "new.chef@janoon.pk", p_role: "staff" } },
    ]);
    expect(JSON.stringify(rpcCalls)).not.toContain("SharedSecret1!");

    // A client of its own, and one that never persists a session.
    expect(clientOptions).toHaveLength(1);
    expect(clientOptions[0]).toMatchObject({
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  test("with no password given, the member sets their own through a reset link", async () => {
    const result = await staff.addStaffAccount("new@janoon.pk", "admin");

    expect(result).toEqual({ createdSignIn: true, usedResetLink: true });
    expect(authCalls.map((call) => call.method)).toEqual(["resetPasswordForEmail"]);
    // A generated password exists only long enough to create the account.
    expect(inviteSignUps[0].password.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(rpcCalls)).not.toContain(inviteSignUps[0].password);
  });

  test("an invalid address is refused before anything is sent anywhere", async () => {
    await expect(staff.addStaffAccount("not-an-email", "staff")).rejects.toThrow(
      "Enter a valid email address.",
    );

    expect(inviteSignUps).toEqual([]);
    expect(rpcCalls).toEqual([]);
    expect(clientOptions).toEqual([]);
  });
});

/* -------------------------------------------------------- own password --- */

describe("changeOwnPassword", () => {
  test("the cheap rules are checked before the password is re-proved", async () => {
    await expect(staff.changeOwnPassword("old-password", "short")).rejects.toThrow(
      "Use at least 8 characters",
    );
    await expect(
      staff.changeOwnPassword("same-password-1", "same-password-1"),
    ).rejects.toThrow("different from the old one");

    // Nothing was sent: no sign-in attempt, no update.
    expect(authCalls).toEqual([]);
  });

  test("a new password is only ever handed to Supabase Auth", async () => {
    authReplies = {
      getUser: { data: { user: { email: "chef@janoon.pk" } }, error: null },
      signInWithPassword: { data: {}, error: null },
      updateUser: { data: { user: { email: "chef@janoon.pk" } }, error: null },
    };

    await staff.changeOwnPassword("old-password", "brand-new-secret");

    expect(authCalls.map((call) => call.method)).toEqual([
      "getUser",
      "signInWithPassword",
      "updateUser",
    ]);
    expect(authCalls[2].args[0]).toEqual({ password: "brand-new-secret" });
    // The role travels nowhere near a password change.
    expect(rpcCalls).toEqual([]);
    expect(tableTouches).toEqual([]);
  });

  test("a wrong current password stops the change", async () => {
    authReplies = {
      getUser: { data: { user: { email: "chef@janoon.pk" } }, error: null },
      signInWithPassword: { data: null, error: { message: "Invalid login credentials" } },
    };

    await expect(
      staff.changeOwnPassword("wrong-password", "brand-new-secret"),
    ).rejects.toThrow("That password is not correct.");
    expect(authCalls.map((call) => call.method)).toEqual(["getUser", "signInWithPassword"]);
  });
});

/* --------------------------------------------------------- the admin door --- */

/**
 * The sign-in rule, end to end against the fake server.
 *
 * Two of these are regressions the restaurant reported: a staff account entering
 * at `/admin` was opened on `/staff`, and an account that already existed was
 * told it had just become the admin when nothing had been recorded.
 */
describe("authenticate", () => {
  /** A signed-in account whose staff row says exactly this. */
  const teamMember = (role: string, active = true) => {
    tableReplies.staff_members = { data: { role, active }, error: null };
    authReplies.signInWithPassword = {
      data: { user: { id: "user-1", email: "user@janoon.pk" } },
      error: null,
    };
  };

  test("a staff account is refused at the admin door, and its session closed with it", async () => {
    teamMember("staff");

    expect(await authenticate("chef@janoon.pk", "pw", "admin")).toEqual({
      ok: false,
      reason: "not-admin",
    });
    // Signed in, then signed straight back out: no live session is left for the
    // next screen to forward to /staff.
    expect(authCalls.map((call) => call.method)).toEqual([
      "signInWithPassword",
      "signOut",
    ]);
    expect(NOT_ADMIN_MESSAGE).toBe("Admin access required.");
  });

  test("an admin reaches the admin door, and the staff desk as well", async () => {
    teamMember("admin");

    expect(await authenticate("owner@janoon.pk", "pw", "admin")).toEqual({
      ok: true,
      userId: "user-1",
      email: "user@janoon.pk",
      role: "admin",
      roles: ["admin"],
    });

    // The staff desk stays open to an admin, as before.
    const staffDesk = await authenticate("owner@janoon.pk", "pw", "staff");
    expect(staffDesk.ok).toBe(true);
  });

  test("a customer is refused at both doors and is never left signed in", async () => {
    tableReplies.staff_members = { data: null, error: null };
    authReplies.signInWithPassword = {
      data: { user: { id: "customer-1", email: "guest@example.com" } },
      error: null,
    };

    expect(await authenticate("guest@example.com", "pw", "admin")).toEqual({
      ok: false,
      reason: "not-staff",
    });
    expect(await authenticate("guest@example.com", "pw", "staff")).toEqual({
      ok: false,
      reason: "not-staff",
    });
    expect(authCalls.filter((call) => call.method === "signOut")).toHaveLength(2);
  });

  test("an account switched off in the Team screen opens neither door", async () => {
    teamMember("admin", false);

    expect(await authenticate("owner@janoon.pk", "pw", "admin")).toEqual({
      ok: false,
      reason: "not-staff",
    });
  });

  test("a wrong password is a credential refusal, and the role is never even read", async () => {
    authReplies.signInWithPassword = {
      data: null,
      error: { message: "Invalid login credentials" },
    };

    expect(await authenticate("owner@janoon.pk", "nope", "admin")).toEqual({
      ok: false,
      reason: "credentials",
    });
    expect(INCORRECT_CREDENTIALS_MESSAGE).toBe("Incorrect email or password.");
    // No table was touched: a bad password is not a role question.
    expect(tableTouches).toEqual([]);
  });
});

/* ----------------------------------- telling the refusals apart (login) --- */

/**
 * This is the bug the restaurant reported as "the correct admin password is
 * rejected".
 *
 * The password was never the problem. The Supabase project requires a confirmed
 * email address, so the sign-in service answered `email_not_confirmed` — and
 * every failure used to be flattened into one "bad credentials" answer. An
 * unconfirmed address, a rate limit and a genuinely wrong password were
 * indistinguishable on screen, and the only one that named the wrong cause was
 * the one people actually hit.
 *
 * These pin the separation, and that the card acts on it instead of guessing.
 */
describe("sign-in refusals", () => {
  test("the sign-in service's own answer decides the reason", () => {
    expect(
      classifySignInError({
        code: "email_not_confirmed",
        message: "Email not confirmed",
      }),
    ).toBe("email-unconfirmed");
    // The same answer from an older library build, which sends no `code`.
    expect(classifySignInError({ message: "Email not confirmed" })).toBe(
      "email-unconfirmed",
    );
    expect(
      classifySignInError({
        code: "invalid_credentials",
        message: "Invalid login credentials",
      }),
    ).toBe("credentials");
    expect(
      classifySignInError({
        code: "over_request_rate_limit",
        message: "Email rate limit exceeded",
      }),
    ).toBe("rate-limited");
    // Only the network case is read from prose: that is a failure to reach the
    // service, not a decision it made.
    expect(classifySignInError({ message: "Failed to fetch" })).toBe(
      "unreachable",
    );
  });

  test("an unconfirmed address is reported as unconfirmed, never as a wrong password", async () => {
    authReplies.signInWithPassword = {
      data: { user: null, session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    };

    expect(
      await authenticate("owner@janoon.pk", "the-right-password", "admin"),
    ).toEqual({ ok: false, reason: "email-unconfirmed" });
    // A rejected sign-in is not a role question, so no role was read.
    expect(tableTouches).toEqual([]);
    expect(EMAIL_UNCONFIRMED_MESSAGE).not.toBe(INCORRECT_CREDENTIALS_MESSAGE);
  });

  test("a rate limit is not dressed up as a wrong password either", async () => {
    authReplies.signInWithPassword = {
      data: null,
      error: {
        code: "over_request_rate_limit",
        message: "Email rate limit exceeded",
      },
    };

    expect(await authenticate("owner@janoon.pk", "pw", "admin")).toEqual({
      ok: false,
      reason: "rate-limited",
    });
  });

  test("both new messages are plain sentences, with nothing technical in them", () => {
    for (const message of [
      EMAIL_UNCONFIRMED_MESSAGE,
      RATE_LIMITED_MESSAGE,
    ]) {
      expect(message.length).toBeGreaterThan(20);
      expect(message).not.toMatch(/supabase|sql|schema|token|PGRST|stack/i);
    }
  });

  test("the card sends a fresh link for an unconfirmed address and says why", () => {
    const src = readFileSync(
      new URL("../src/pages/AuthLanding.tsx", import.meta.url),
      "utf8",
    );

    expect(src).toContain("resendConfirmationEmail");
    expect(src).toContain("EMAIL_UNCONFIRMED_MESSAGE");
    // One switch decides the wording; the password sentence is one branch of it
    // rather than the fallback for every refusal the service can make.
    expect(src).toContain("signInMessage(result.reason");
  });
});

/* ------------------------------------------------------- first admin setup --- */

describe("claimFirstAdmin", () => {
  /** Not found by email — the answer a project with the rule installed gives. */
  const NO_ACCOUNT = {
    code: "23503",
    message: "No account found for that email address.",
  };
  /** The answer a project WITHOUT the rule installed gives. */
  const NO_RULE = {
    code: "PGRST202",
    message:
      "Could not find the function public.claim_admin_for_email in the schema cache",
  };

  test("a new address is created, then claimed, and only Auth ever sees the password", async () => {
    // `emailRedirectTo` is only built where `window` exists.
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://janoon.pk" },
    };
    rpcReplies = {
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      claim_admin: { data: { ok: true, role: "admin" }, error: null },
    };
    authReplies.signUp = {
      data: {
        user: { id: "new-admin", email: "owner@janoon.pk" },
        session: { access_token: "t" },
      },
      error: null,
    };
    // The row the claim is supposed to have written, read back by the account
    // itself before the card is allowed to say the account exists.
    tableReplies.staff_members = { data: { role: "admin", active: true }, error: null };

    try {
      const outcome = await claimFirstAdmin("  owner@janoon.pk  ", "brand-new-secret");

      expect(outcome).toEqual({
        ok: true,
        userId: "new-admin",
        email: "owner@janoon.pk",
        roles: ["admin"],
      });
      // The address is trimmed, the password goes to Supabase Auth and nowhere
      // else, and the confirmation link comes back to the admin card so the
      // claim can be finished in one press.
      expect(authCalls[0].args[0]).toMatchObject({
        email: "owner@janoon.pk",
        password: "brand-new-secret",
      });
      expect(JSON.stringify(authCalls[0].args)).toContain("unlock=admin");
      expect(JSON.stringify(rpcCalls)).not.toContain("brand-new-secret");
      // The grant is confirmed by reading the caller's own staff rows back —
      // those two tables and nothing else, and never the password.
      expect([...new Set(tableTouches.map((touch) => touch.table))].sort()).toEqual([
        "staff_member_roles",
        "staff_members",
      ]);
      expect(JSON.stringify(tableTouches)).not.toContain("brand-new-secret");
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  /**
   * The failure the portal used to be able to report backwards: a claim that
   * wrote nothing, announced as a created admin. The account could sign up and
   * was then refused at the sign-in card, because no row recorded it. Success
   * is now read back from the database, so this ends as a failure.
   */
  test("a claim that records no row is a failure, not a created admin", async () => {
    authReplies.signUp = {
      data: {
        user: { id: "ghost-admin", email: "owner@janoon.pk" },
        session: { access_token: "t" },
      },
      error: null,
    };
    rpcReplies = {
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      // No error — and no row behind it.
      claim_admin: { data: { ok: true }, error: null },
    };
    tableReplies.staff_members = { data: null, error: null };

    const outcome = await claimFirstAdmin("owner@janoon.pk", "pw");

    expect(outcome).toMatchObject({ ok: false, reason: "setup-required" });
    // And the session it opened is closed again: an account with no row must
    // not be left signed in on the strength of a function that said nothing.
    expect(authCalls.map((call) => call.method)).toContain("signOut");
  });

  test("an existing address the database granted is left alone — no second Auth user", async () => {
    rpcReplies = {
      claim_admin_for_email: { data: { ok: true, role: "admin" }, error: null },
    };

    expect(await claimFirstAdmin("owner@janoon.pk", "whatever-they-typed")).toEqual({
      ok: false,
      reason: "existing-account",
      message: "owner@janoon.pk",
    });
    // The existing identity keeps its UUID and its password: nothing was signed
    // up, no password was asked for, and only the grant was called.
    expect(authCalls).toEqual([]);
    expect(rpcCalls).toEqual([
      { name: "claim_admin_for_email", args: { p_email: "owner@janoon.pk" } },
    ]);
  });

  test("an address that already has an account, with a password that is not accepted, is a failure", async () => {
    rpcReplies = { claim_admin_for_email: { data: null, error: NO_ACCOUNT } };
    authReplies.signUp = {
      data: { user: { id: "ghost", email: "taken@janoon.pk" }, session: null },
      error: null,
    };
    authReplies.signInWithPassword = {
      data: null,
      error: { message: "Invalid login credentials" },
    };

    expect(await claimFirstAdmin("taken@janoon.pk", "not-its-password")).toEqual({
      ok: false,
      reason: "email-taken",
      message: "taken@janoon.pk",
    });
  });

  test("the same case on a project without the rule says the setup step is outstanding", async () => {
    rpcReplies = { claim_admin_for_email: { data: null, error: NO_RULE } };
    authReplies.signUp = {
      data: { user: { id: "ghost", email: "owner@janoon.pk" }, session: null },
      error: null,
    };
    authReplies.signInWithPassword = {
      data: null,
      error: { message: "Invalid login credentials" },
    };

    expect(await claimFirstAdmin("owner@janoon.pk", "whatever")).toEqual({
      ok: false,
      reason: "setup-required",
      message: "owner@janoon.pk",
    });
    // Read by the restaurant owner, not by whoever maintains the site: no SQL
    // file to run, no schema language, nothing technical to interpret.
    expect(SETUP_REQUIRED_MESSAGE).not.toMatch(/sql|supabase|schema|script/i);
    expect(SETUP_REQUIRED_MESSAGE).toContain("administrator account");
  });

  test("a claim refused for an unrecognised reason reports the setup step, not a made-up cause", async () => {
    authReplies.signUp = {
      data: {
        user: { id: "new-admin", email: "owner@janoon.pk" },
        session: { access_token: "t" },
      },
      error: null,
    };
    rpcReplies = {
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      claim_admin: {
        data: null,
        error: { message: "Only the first account can claim owner access." },
      },
    };
    tableReplies.staff_members = { data: null, error: null };

    expect(await claimFirstAdmin("owner@janoon.pk", "pw")).toEqual({
      ok: false,
      reason: "setup-required",
      message: "Only the first account can claim owner access.",
    });
    // The session it opened is closed rather than left on an account with no
    // role recorded.
    expect(authCalls.map((call) => call.method)).toContain("signOut");
  });

  test("a claim refused because an admin exists says exactly that", async () => {
    authReplies.signUp = {
      data: {
        user: { id: "new-admin", email: "owner@janoon.pk" },
        session: { access_token: "t" },
      },
      error: null,
    };
    rpcReplies = {
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      claim_admin: {
        data: null,
        error: { code: "23505", message: "An admin account already exists for this restaurant." },
      },
    };
    tableReplies.staff_members = { data: null, error: null };

    expect(await claimFirstAdmin("owner@janoon.pk", "pw")).toEqual({
      ok: false,
      reason: "claimed",
      message: "An admin account already exists for this restaurant.",
    });
  });

  test("an address that needs confirming is not a failure", async () => {
    rpcReplies = { claim_admin_for_email: { data: null, error: NO_ACCOUNT } };
    authReplies.signUp = {
      data: { user: { id: "pending", email: "owner@janoon.pk" }, session: null },
      error: null,
    };
    authReplies.signInWithPassword = {
      data: null,
      error: { message: "Email not confirmed" },
    };

    expect(await claimFirstAdmin("owner@janoon.pk", "pw")).toEqual({
      ok: false,
      reason: "confirm-email",
    });
    // The link is re-sent, and nothing was claimed — the card says so.
    expect(authCalls.map((call) => call.method)).toContain("resend");
    expect(rpcCalls.map((call) => call.name)).toEqual(["claim_admin_for_email"]);
  });
});

/* --------------------------------------------------------- the admin route --- */

/**
 * The gate itself. The mistake being guarded against is behavioural — a staff
 * session reaching /admin was sent to /staff — so the check reads the component:
 * a `<Navigate to="/staff">` would be that redirect coming back.
 */
describe("the admin route", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  test("refuses a staff session instead of forwarding it to /staff", () => {
    const src = read("../src/components/RequireRole.tsx");

    expect(src).toContain('role === "admin" && !session.roles.includes("admin")');
    expect(src).toContain("NOT_ADMIN_MESSAGE");
    expect(src).toContain("<AccessDenied");
    expect(src).not.toMatch(/<Navigate\s+to=("|\{`)\/staff/);
  });

  /**
   * The same mistake seen from the gateway: a staff account that opens the
   * admin door while already signed in used to be carried straight to /staff by
   * the "live session goes to its portal" redirect, so the refusal was never
   * shown. The redirect is skipped while the refusal applies.
   */
  test("the gateway never forwards a staff session that asked for the admin door", () => {
    const src = read("../src/pages/AuthLanding.tsx");

    expect(src).toContain("const staffAtAdminDoor");
    expect(src).toContain('!session.roles.includes("admin")');
    // …and the portal redirect stands aside while it does.
    expect(src).toMatch(/if \(!isLoaded \|\| !session \|\| staffAtAdminDoor\) return;/);
    expect(src).toContain(
      'error={error ?? (staffAtAdminDoor ? NOT_ADMIN_MESSAGE : null)}',
    );
  });

  test("the door hands its own role to the sign-in rule", () => {
    const src = read("../src/pages/AuthLanding.tsx");

    expect(src).toContain("signIn(email, password, role)");
    expect(src).toContain("NOT_ADMIN_MESSAGE");
    expect(src).toContain("INCORRECT_CREDENTIALS_MESSAGE");
  });

  test("no session or role is ever read from browser storage", () => {
    for (const path of [
      "../src/hooks/use-staff-auth.ts",
      "../src/components/RequireRole.tsx",
      "../src/pages/AuthLanding.tsx",
    ]) {
      const src = read(path);
      // The words appear in comments only, describing what was removed.
      expect([path, /(localStorage|sessionStorage)\s*\./.test(src)]).toEqual([
        path,
        false,
      ]);
    }
  });
});

/* ------------------------------------------------------- sql migration --- */

/**
 * The grants in the schema are a pair: a function taken away from PUBLIC has to
 * be handed to `authenticated`, or nobody can call it at all. `admin_grant_role`
 * and `admin_remove_role` were revoked without their grant, which left the Team
 * screen's role buttons failing for every caller, the owner included. These
 * checks read the SQL directly, because the mistake is invisible from the app
 * until somebody clicks the button in production.
 */
describe("sql grants", () => {
  const readSql = (name: string) =>
    readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8");

  const signatures = (sql: string, pattern: RegExp) => {
    const found = new Set<string>();
    for (const match of sql.matchAll(pattern)) {
      found.add(match[1].replace(/\s+/g, " ").trim());
    }
    return found;
  };

  const REVOKED = /revoke all on function\s+([^\n;]+?)\s+from public\s*;/g;
  const GRANTED = /grant execute on function\s+([^\n;]+?)\s+to\s+[^\n;]+\s*;/g;
  /** Revoked on purpose: nothing in the app calls it. */
  const INTERNAL_ONLY = new Set(["public.staff_get_roles(uuid)"]);

  for (const file of ["schema.sql", "fix-admin-recovery.sql"]) {
    test(`${file} grants every function it revokes`, () => {
      const sql = readSql(file);
      const granted = signatures(sql, GRANTED);
      const orphaned = [...signatures(sql, REVOKED)]
        .filter((signature) => !granted.has(signature))
        .filter((signature) => !INTERNAL_ONLY.has(signature));

      expect([file, orphaned]).toEqual([file, []]);
    });
  }
});

describe("the security schema", () => {
  const readSql = (name: string) =>
    readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8");

  /** Every database function the portal layer asks for, by rpc name. */
  const calledFunctions = () => {
    const names = new Set<string>();
    for (const path of ["../src/lib/staff.ts", "../src/hooks/use-staff-auth.ts"]) {
      const code = readFileSync(new URL(path, import.meta.url), "utf8");
      for (const match of code.matchAll(/\brpc\(\s*"([a-z_]+)"/g)) {
        names.add(match[1]);
      }
    }
    return [...names].sort();
  };

  /**
   * A real definition — not merely a mention. `revoke all on function
   * public.x(…)` and `grant execute on function public.x(…)` both contain the
   * text `function public.x(`, so a looser check would call an undefined
   * function covered.
   */
  const definedIn = (sql: string, name: string) =>
    sql.includes(`create or replace function public.${name}(`) ||
    sql.includes(`create function public.${name}(`);

  test("defines every function the portal layer calls", () => {
    const sql = readSql("schema.sql");
    const names = calledFunctions();

    // Guard the extractor itself before trusting what it found.
    expect(names).toContain("claim_admin");
    expect(names.length).toBeGreaterThanOrEqual(10);

    const missing = names.filter((name) => !definedIn(sql, name));
    expect(missing).toEqual([]);
  });

  /**
   * The whole staff subsystem, as the live project needs it. A project that ran
   * the earlier migration has some of these and lacks the rest; the patch has to
   * leave none of them half-upgraded, or the screens that call them fail.
   */
  const PATCHED_IN = [
    "is_staff",
    "is_admin",
    "tribe_active_admins",
    "staff_bootstrap_state",
    "claim_admin",
    "claim_admin_for_email",
    "staff_sync_email",
    "admin_list_staff",
    "admin_add_staff",
    "admin_set_staff_role",
    "admin_set_staff_active",
    "admin_remove_staff",
    "admin_grant_role",
    "admin_remove_role",
  ];

  test("the copy-paste patch installs every function an older project is missing", () => {
    const patch = readSql("fix-admin-recovery.sql");

    for (const name of PATCHED_IN) {
      expect([name, patch.includes(`create or replace function public.${name}(`)]).toEqual([
        name,
        true,
      ]);
    }

    expect(patch).toContain("create table if not exists public.staff_member_roles");
    // The junction table has to exist before the functions that read it.
    expect(patch.indexOf("create table if not exists public.staff_member_roles")).toBeLessThan(
      patch.indexOf("create or replace function public.admin_list_staff("),
    );
    // `version: 2` is what clears the "outdated rule" state in the sign-in card.
    expect(patch).toContain("'version', 2");
    // The setup card calls this while signed out, before it can sign anybody in.
    expect(patch).toMatch(/grant execute on function public\.claim_admin_for_email\(text\) to anon/);
  });

  test("every function the patch installs is the schema's own definition", () => {
    const definitions = (sql: string, name: string) => {
      const start = sql.indexOf(`create or replace function public.${name}(`);
      expect([name, start > -1]).toEqual([name, true]);
      // Comments and layout removed: what is compared is the SQL that runs.
      return sql
        .slice(start, sql.indexOf("$$;", start))
        .replace(/--[^\n]*/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const schema = readSql("schema.sql");
    const patch = readSql("fix-admin-recovery.sql");

    for (const name of PATCHED_IN) {
      expect([name, definitions(patch, name)]).toEqual([
        name,
        definitions(schema, name),
      ]);
    }
  });
});

/* ---------------------------------------------------------- staff reset --- */

/**
 * The reset file makes one dangerous promise: it empties the team and touches
 * nothing else. The mistake it guards against — a delete that is a table wider
 * than intended — is invisible until somebody runs it against a live project
 * that is full of customers and bookings, so the promise is read out of the SQL
 * here rather than trusted.
 */
describe("the staff reset", () => {
  const sql = readFileSync(
    new URL("../supabase/reset-staff-accounts.sql", import.meta.url),
    "utf8",
  );

  test("deletes the team's own rows and their sign-in identities, and nothing else", () => {
    const deletes = [...sql.matchAll(/delete\s+from\s+([a-z_.]+)/gi)].map((match) =>
      match[1].toLowerCase(),
    );

    expect(deletes.sort()).toEqual([
      "auth.users",
      "public.staff_member_roles",
      "public.staff_members",
    ]);
  });

  test("never writes to a business table", () => {
    for (const table of [
      "menu_categories",
      "menu_dishes",
      "menu_addons",
      "addon_categories",
      "site_media",
      "site_content",
      "promotions",
      "reservations",
      "preorders",
      "pre_order_items",
      "delivery_orders",
      "orders",
    ]) {
      const writes = new RegExp(
        `(delete from|insert into|update)\\s+\\w*\\.?${table}\\b`,
        "i",
      );
      expect([table, writes.test(sql)]).toEqual([table, false]);
    }
  });

  test("is scoped by an explicit id list, never by auth.users as a whole", () => {
    expect(sql).toContain("create temporary table janoon_team_reset as");
    expect(sql).toContain("from janoon_team_reset t where t.user_id = u.id");
  });

  test("refuses to run until the current rules are installed", () => {
    // The whole point of emptying the team is that the setup action works
    // afterwards, which it only does under the current rules.
    expect(sql).toContain("'version') is distinct from '2'");
    expect(sql).toMatch(/raise exception/);
  });
});
