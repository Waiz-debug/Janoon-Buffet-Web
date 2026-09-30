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
/** Sign-ins tried by the credential checker, on its own throwaway client. */
const inviteSignIns: { email: string; password: string }[] = [];
let inviteSignUpReply: Reply | null = null;
let inviteSignInReply: Reply | null = null;

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
          return (
            inviteSignUpReply ?? {
              data: { user: { id: "invited-id", email: payload.email }, session: null },
              error: null,
            }
          );
        },
        signInWithPassword: async (payload: { email: string; password: string }) => {
          inviteSignIns.push(payload);
          return inviteSignInReply ?? { data: { user: null, session: null }, error: null };
        },
        signOut: async () => ({ error: null }),
      },
    };
  },
}));

const staff = await import("../src/lib/staff");
const {
  adminSetupState,
  authenticate,
  claimFirstAdmin,
  classifySignInError,
  portalPathFor,
  resendConfirmationEmail,
  setupIsOffered,
  staffLookup,
  CONFIRMATION_RATE_LIMITED_MESSAGE,
  CONFIRMATION_UNDELIVERABLE_MESSAGE,
  EMAIL_UNCONFIRMED_MESSAGE,
  INCORRECT_CREDENTIALS_MESSAGE,
  NOT_ADMIN_MESSAGE,
  RATE_LIMITED_MESSAGE,
  SETUP_REQUIRED_MESSAGE,
} = await import("../src/hooks/use-staff-auth");

/** The auth module under test, for the rules exported from it. */
const auth = await import("../src/hooks/use-staff-auth");

beforeEach(() => {
  rpcCalls.length = 0;
  tableTouches.length = 0;
  authCalls.length = 0;
  clientOptions.length = 0;
  inviteSignUps.length = 0;
  inviteSignIns.length = 0;
  inviteSignUpReply = null;
  inviteSignInReply = null;
  rpcReply = { data: null, error: null };
  rpcReplies = {};
  // The one-time admin setup is gated on a database read before anything is
  // created, so every test that reaches the claim needs an answer. The default
  // is the only answer that lets it through: no admin exists yet.
  rpcReplies.staff_bootstrap_state = {
    data: { claimable: true, version: 2 },
    error: null,
  };
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

  /**
   * A missing helper must not look like an empty team.
   *
   * A project can hold `staff_members` and still not have `admin_list_staff`
   * — which is how the Credentials tab once rendered "no team accounts yet" for
   * a team that plainly existed. The read falls back to the tables, and the
   * policies on them (`is_staff()`) are what still decides who sees what, so the
   * fallback grants nothing the function would have refused.
   */
  test("a project without the helper reads the team from the tables", async () => {
    rpcReply = {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.admin_list_staff" },
    };
    tableReplies.staff_members = {
      data: [
        {
          user_id: "admin-id",
          email: "owner@janoon.pk",
          display_name: "Owner",
          role: "admin",
          active: true,
          created_at: 5,
        },
        {
          user_id: "legacy-id",
          email: null,
          display_name: null,
          // An unrecognised role grants nothing, and `active` is only false
          // when it is explicitly false.
          role: "owner",
          created_at: 0,
        },
      ],
      error: null,
    };
    tableReplies.staff_member_roles = {
      data: [
        { user_id: "admin-id", role: "admin" },
        { user_id: "admin-id", role: "staff" },
        { user_id: "legacy-id", role: "not-a-role" },
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
    // No junction row, so the primary role stands on its own rather than the
    // member reading as having no role at all.
    expect(team[1]).toEqual({
      userId: "legacy-id",
      email: null,
      displayName: null,
      role: "staff",
      roles: ["staff"],
      active: true,
      createdAt: 0,
    });
  });

  test("a refused read is reported as a refusal, not as an empty list", async () => {
    rpcReply = {
      data: null,
      error: { message: "Only an admin can manage the team.", code: "42501" },
    };

    const attempt = await staff.listStaff().catch((error: unknown) => error);

    expect(attempt).toBeInstanceOf(staff.StaffListError);
    expect(attempt.reason).toBe("not-admin");
    // Nothing was read, so an empty array could never be mistaken for a team.
    expect(Array.isArray(attempt)).toBe(false);
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
  /**
   * The team row the database holds, keyed by the Auth UUID it wrote.
   *
   * The fake server answers every table read with the same shape, so this keeps
   * the read-back honest: it is only a *verification* step if the record it
   * finds is the one under the id the database itself handed over.
   */
  const writtenRow = (
    userId: string,
    email: string,
    role = "staff",
    displayName?: string,
  ) => {
    tableReplies.staff_members = {
      data: {
        user_id: userId,
        email,
        display_name: displayName ?? email.split("@")[0],
        role,
        active: true,
        created_at: 1,
      },
      error: null,
    };
    return {
      userId,
      email,
      displayName: displayName ?? email.split("@")[0],
      role,
      roles: [role],
      active: true,
      createdAt: 1,
    };
  };

  /** What `admin_upsert_staff_account` answers after writing the row. */
  const upserted = (
    userId: string,
    overrides: Record<string, unknown> = {},
  ) => {
    rpcReplies.admin_upsert_staff_account = {
      data: {
        ok: true,
        userId,
        email: "new.chef@janoon.pk",
        displayName: "Imran Khan",
        role: "staff",
        active: true,
        authCreated: true,
        passwordApplied: true,
        confirmed: true,
        ...overrides,
      },
      error: null,
    };
  };

  /* ------------------------------------------------ the route the app uses -- */

  /**
   * One call, and the whole job is done in the database.
   *
   * `admin_upsert_staff_account` creates the Auth identity when there isn't one,
   * reuses the existing UUID when there is, hashes the password with bcrypt,
   * confirms the address and writes one `staff_members` row. This project has
   * "Confirm email" on, so creating the account from the browser alone left it
   * unable to sign in — which is what the panel kept reporting as bad
   * credentials.
   */
  test("one database call creates the account, records it, and returns the row", async () => {
    upserted("auth-uuid-1");
    writtenRow("auth-uuid-1", "new.chef@janoon.pk", "staff", "Imran Khan");

    const result = await staff.addStaffAccount(
      "  New.Chef@Janoon.pk  ",
      "staff",
      "SharedSecret1!",
      "Imran Khan",
    );

    expect(result).toEqual({
      createdSignIn: true,
      usedResetLink: false,
      passwordApplied: true,
      // The database stamps the confirmation itself, so the address never sits
      // in the unconfirmed state that blocks the first sign-in.
      needsConfirmation: false,
      confirmedByPortal: true,
      member: {
        userId: "auth-uuid-1",
        email: "new.chef@janoon.pk",
        displayName: "Imran Khan",
        role: "staff",
        roles: ["staff"],
        active: true,
        createdAt: 1,
      },
    });

    // The address is normalised and the name travels with it.
    expect(rpcCalls).toEqual([
      {
        name: "admin_upsert_staff_account",
        args: {
          p_email: "new.chef@janoon.pk",
          p_password: "SharedSecret1!",
          p_display_name: "Imran Khan",
          p_role: "staff",
        },
      },
    ]);
    // Nothing is signed up from the browser, so no client is created and no
    // second Auth user can ever appear for this address.
    expect(inviteSignUps).toEqual([]);
    expect(clientOptions).toEqual([]);
  });

  test("a role of admin is passed through, and the row is read back as admin", async () => {
    upserted("auth-uuid-admin", { role: "admin" });
    writtenRow("auth-uuid-admin", "head.chef@janoon.pk", "admin", "Ayesha");

    const result = await staff.addStaffAccount(
      "head.chef@janoon.pk",
      "admin",
      "SharedSecret1!",
      "Ayesha",
    );

    expect(rpcCalls[0].args).toMatchObject({ p_role: "admin" });
    expect(result.member).toMatchObject({ role: "admin", active: true });
  });

  /**
   * The join is verified, not assumed.
   *
   * The function answering without an error is not proof a row exists. It is
   * read back under the Auth UUID the database itself returned, and a genuine
   * absence is a failure with the real cause — never "added".
   */
  test("a write with no team record behind it is a failure, not an added member", async () => {
    upserted("auth-uuid-ghost");
    tableReplies.staff_members = { data: null, error: null };

    const attempt = staff.addStaffAccount(
      "ghost@janoon.pk",
      "staff",
      "SharedSecret1!",
    );

    await expect(attempt).rejects.toThrow("no team record");
    await expect(attempt).rejects.toThrow("auth-uuid-ghost");
  });

  test("an answer that names no Auth id is refused rather than reported as added", async () => {
    rpcReplies.admin_upsert_staff_account = { data: { ok: true }, error: null };

    await expect(
      staff.addStaffAccount("nameless@janoon.pk", "staff", "SharedSecret1!"),
    ).rejects.toThrow("cannot be checked");
  });

  /**
   * An address that already has a Supabase account.
   *
   * The database reuses that identity — same UUID, same password — so no second
   * Auth user is ever created for one address. The password typed here was
   * never applied to that account, and saying so is the difference between
   * handing over a credential that works and one that was never set.
   */
  test("an address that already has an account reuses it, and says the typed password was not applied", async () => {
    upserted("auth-uuid-existing", {
      authCreated: false,
      passwordApplied: false,
    });
    writtenRow("auth-uuid-existing", "old@janoon.pk");

    const result = await staff.addStaffAccount(
      "old@janoon.pk",
      "staff",
      "BrandNew1!",
    );

    expect(result.createdSignIn).toBe(false);
    expect(result.passwordApplied).toBe(false);
    // The same UUID the account already had, so nothing was duplicated.
    expect(result.member?.userId).toBe("auth-uuid-existing");
  });

  /* --------------------------------------------- the older-database fallback -- */

  /** A project that has not run supabase/staff-auth.sql yet. */
  const withoutUpsert = () => {
    rpcReplies.admin_upsert_staff_account = {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    };
  };

  test("a project without the function falls back to the older two-call route", async () => {
    withoutUpsert();
    rpcReplies.admin_add_staff = {
      data: { ok: true, userId: "auth-uuid-old-path", role: "staff" },
      error: null,
    };
    writtenRow("auth-uuid-old-path", "new.chef@janoon.pk");

    const result = await staff.addStaffAccount(
      "new.chef@janoon.pk",
      "staff",
      "SharedSecret1!",
      "Imran Khan",
    );

    // The account is still created, on a throwaway client that cannot take over
    // the admin's own session.
    expect(inviteSignUps).toEqual([
      { email: "new.chef@janoon.pk", password: "SharedSecret1!" },
    ]);
    expect(clientOptions).toHaveLength(1);
    expect(clientOptions[0]).toMatchObject({ auth: { persistSession: false } });
    expect(result.member).toMatchObject({ userId: "auth-uuid-old-path" });
    // Both calls, in order, and the password never appears in either.
    expect(rpcCalls.map((call) => call.name)).toEqual([
      "admin_upsert_staff_account",
      "admin_add_staff",
    ]);
    expect(JSON.stringify(rpcCalls.slice(1))).not.toContain("SharedSecret1!");
  });

  test("an address that already has an account is reported, not quietly kept", async () => {
    withoutUpsert();
    inviteSignUpReply = {
      data: { user: null, session: null },
      error: { message: "User already registered" },
    };
    rpcReplies.admin_add_staff = {
      data: { ok: true, userId: "auth-uuid-old", role: "staff" },
      error: null,
    };
    writtenRow("auth-uuid-old", "old@janoon.pk");

    const result = await staff.addStaffAccount("old@janoon.pk", "staff", "BrandNew1!");

    expect(result).toMatchObject({
      createdSignIn: false,
      usedResetLink: true,
      passwordApplied: false,
      member: { userId: "auth-uuid-old" },
    });
    expect(authCalls.map((call) => call.method)).toEqual(["resetPasswordForEmail"]);
  });

  test("an account that still has to confirm its address says so", async () => {
    withoutUpsert();
    inviteSignUpReply = {
      data: { user: { email: "new@janoon.pk", email_confirmed_at: null }, session: null },
      error: null,
    };
    rpcReplies.admin_add_staff = {
      data: { ok: true, userId: "auth-uuid-3", role: "staff" },
      error: null,
    };
    writtenRow("auth-uuid-3", "new@janoon.pk");

    const result = await staff.addStaffAccount("new@janoon.pk", "staff", "SharedSecret1!");

    expect(result).toMatchObject({
      createdSignIn: true,
      usedResetLink: true,
      passwordApplied: true,
      needsConfirmation: true,
      confirmedByPortal: false,
      member: { userId: "auth-uuid-3" },
    });
  });

  test("a database without the confirm function falls back to the setup link", async () => {
    withoutUpsert();
    inviteSignUpReply = {
      data: { user: { email: "new@janoon.pk", email_confirmed_at: null }, session: null },
      error: null,
    };
    rpcReplies.admin_add_staff = {
      data: { ok: true, userId: "auth-uuid-5", role: "staff" },
      error: null,
    };
    writtenRow("auth-uuid-5", "new@janoon.pk");
    rpcReplies.admin_confirm_staff_email = {
      data: null,
      error: { message: "Could not find the function admin_confirm_staff_email" },
    };

    const result = await staff.addStaffAccount("new@janoon.pk", "staff", "SharedSecret1!");

    // An older project is never left worse off: the mail is the way in.
    expect(result).toMatchObject({
      createdSignIn: true,
      usedResetLink: true,
      needsConfirmation: true,
      confirmedByPortal: false,
      member: { userId: "auth-uuid-5" },
    });
  });

  test("with no password given, the member sets their own through a reset link", async () => {
    withoutUpsert();
    rpcReplies.admin_add_staff = {
      data: { ok: true, userId: "auth-uuid-2", role: "admin" },
      error: null,
    };
    writtenRow("auth-uuid-2", "new@janoon.pk", "admin");

    const result = await staff.addStaffAccount("new@janoon.pk", "admin");

    expect(result).toMatchObject({
      createdSignIn: true,
      usedResetLink: true,
      passwordApplied: true,
      member: { userId: "auth-uuid-2", role: "admin", active: true },
    });
    expect(authCalls.map((call) => call.method)).toEqual(["resetPasswordForEmail"]);
    // A generated password exists only long enough to create the account.
    expect(inviteSignUps[0].password.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(rpcCalls.slice(1))).not.toContain(inviteSignUps[0].password);
  });

  /**
   * The race that leaves an account with no team record.
   *
   * A role is granted by looking the address up in `auth.users`, on a different
   * connection from the one that created the account moments earlier. When that
   * row has not landed yet the grant is refused — leaving an account that signs
   * in perfectly well and is then turned away at every portal door as somebody
   * who is not staff. The grant is therefore looked at again once, and the
   * account is never created twice while that happens.
   */
  test("a role grant that cannot see the account yet is retried once", async () => {
    withoutUpsert();
    rpcReplies.admin_add_staff = {
      data: null,
      error: { message: "No Sign-in account exists for new@janoon.pk." },
    };
    // The row "lands" while the retry is waiting.
    setTimeout(() => {
      rpcReplies.admin_add_staff = {
        data: { ok: true, userId: "auth-uuid-retry", role: "staff" },
        error: null,
      };
    }, 50);
    writtenRow("auth-uuid-retry", "new@janoon.pk");

    const result = await staff.addStaffAccount(
      "new@janoon.pk",
      "staff",
      "SharedSecret1!",
    );

    expect(result.passwordApplied).toBe(true);
    expect(result.member?.userId).toBe("auth-uuid-retry");
    // One account, not two: the retry re-reads the team, it does not re-sign-up.
    expect(inviteSignUps).toHaveLength(1);
  });

  test("a role grant that stays blind says what to do, not a database sentence", async () => {
    withoutUpsert();
    rpcReplies.admin_add_staff = {
      data: null,
      error: { message: "No Sign-in account exists for new@janoon.pk." },
    };

    const attempt = staff.addStaffAccount("new@janoon.pk", "staff", "SharedSecret1!");

    await expect(attempt).rejects.toThrow("Press “Add to team” once more");
    // The raw sentence is replaced, not passed through to the screen.
    await expect(attempt).rejects.not.toThrow("No Sign-in account exists");
  });

  test("an invalid address is refused before anything is sent anywhere", async () => {
    await expect(staff.addStaffAccount("not-an-email", "staff")).rejects.toThrow(
      "Enter a valid email address.",
    );

    expect(inviteSignUps).toEqual([]);
    expect(rpcCalls).toEqual([]);
    expect(clientOptions).toEqual([]);
  });

  /**
   * No credential ever reaches a table.
   *
   * The password goes to exactly one place — the `admin_upsert_staff_account`
   * argument, which hashes it with bcrypt inside the function. It is not
   * written to `staff_members`, which has no column for it, and it is never
   * sent to any other endpoint.
   */
  test("the password travels to one call and to no table", async () => {
    upserted("auth-uuid-safe");
    writtenRow("auth-uuid-safe", "new.chef@janoon.pk");

    await staff.addStaffAccount("new.chef@janoon.pk", "staff", "SharedSecret1!");

    const withSecret = JSON.stringify([
      rpcCalls,
      authCalls,
      inviteSignUps,
    ]);
    expect((withSecret.match(/SharedSecret1!/g) ?? []).length).toBe(1);
    // The one place it appears is the argument of the one database call.
    expect(rpcCalls[0]).toEqual({
      name: "admin_upsert_staff_account",
      args: {
        p_email: "new.chef@janoon.pk",
        p_password: "SharedSecret1!",
        p_display_name: null,
        p_role: "staff",
      },
    });
  });
});

/* ------------------------------------------------------ the password check --- */

/**
 * The credential checker behind the admin's Credentials tab.
 *
 * It answers the question the vault cannot: *does this password actually work?*
 * Two properties matter. It runs on its own client, so checking someone's
 * password can never disturb the admin's session; and it turns Auth's refusal
 * into the reason, instead of a generic failure the admin cannot act on.
 */
describe("verifyStaffSignIn", () => {
  test("a working password is confirmed, on a client that keeps no session", async () => {
    const result = await staff.verifyStaffSignIn(" Chef@Janoon.pk ", "SharedSecret1!");

    expect(result).toEqual({ ok: true });
    expect(inviteSignIns).toEqual([
      { email: "chef@janoon.pk", password: "SharedSecret1!" },
    ]);
    // Never the admin's own session, and never a table.
    expect(authCalls).toEqual([]);
    expect(tableTouches).toEqual([]);
    expect(clientOptions[0]).toMatchObject({
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  test("a wrong password is explained, and points at the only way back in", async () => {
    inviteSignInReply = {
      data: null,
      error: { message: "Invalid login credentials" },
    };

    const result = await staff.verifyStaffSignIn("chef@janoon.pk", "wrong-one");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("setup link");
  });

  test("an unconfirmed address is told apart from a wrong password", async () => {
    inviteSignInReply = {
      data: null,
      error: { message: "Email not confirmed" },
    };

    const result = await staff.verifyStaffSignIn("chef@janoon.pk", "SharedSecret1!");

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("confirmed");
  });

  test("nothing is attempted without both halves of the credential", async () => {
    const result = await staff.verifyStaffSignIn("", "");

    expect(result.ok).toBe(false);
    expect(inviteSignIns).toEqual([]);
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

  test("a mail provider that cannot deliver is told apart from a spent allowance", async () => {
    // The allowance for the hour is gone: waiting is the right advice.
    authReplies.resend = {
      data: null,
      error: {
        code: "over_email_send_rate_limit",
        message: "Email rate limit exceeded",
      },
    };
    expect((await resendConfirmationEmail("owner@janoon.pk")).reason).toBe(
      "rate-limited",
    );

    // No working mail provider: waiting would never help, so the card must not
    // say to try again in a moment.
    authReplies.resend = {
      data: null,
      error: {
        code: "unexpected_failure",
        message: "Error sending confirmation email",
      },
    };
    expect((await resendConfirmationEmail("owner@janoon.pk")).reason).toBe(
      "provider",
    );

    // The shared testing mail server only delivers to the project's own team
    // addresses and refuses every other address outright — the answer a
    // restaurant domain like owner@janoon.pk normally gets. Classified as a
    // provider problem, because retrying will never clear it.
    authReplies.resend = {
      data: null,
      error: {
        code: "email_address_not_authorized",
        message: "Email address not authorized",
      },
    };
    expect((await resendConfirmationEmail("owner@janoon.pk")).reason).toBe(
      "provider",
    );

    // A link really on its way is the success case, and says so.
    authReplies.resend = { data: null, error: null };
    expect(await resendConfirmationEmail("owner@janoon.pk")).toEqual({
      ok: true,
    });
  });

  test("the two undeliverable messages are different sentences, and neither blames the account", () => {
    expect(CONFIRMATION_RATE_LIMITED_MESSAGE).not.toBe(
      CONFIRMATION_UNDELIVERABLE_MESSAGE,
    );
    for (const message of [
      CONFIRMATION_RATE_LIMITED_MESSAGE,
      CONFIRMATION_UNDELIVERABLE_MESSAGE,
    ]) {
      expect(message).not.toMatch(/supabase|smtp|sql|token|PGRST/i);
      // The account and its password are untouched in both cases — that has to
      // be said plainly, because the earlier bug taught people otherwise.
      expect(message).toMatch(/unchanged|still not confirmed/);
    }
  });

  test("every email link is built from one configurable, real address", () => {
    const redirects = readFileSync(
      new URL("../src/lib/redirects.ts", import.meta.url),
      "utf8",
    );

    // Supabase rewrites a redirect it does not recognise to the project's Site
    // URL, so the address the link is built from has to be configurable rather
    // than "whatever origin the preview happens to be on". The fallback is the
    // origin the page is actually running on, which is what keeps a link sent
    // from a preview off a `localhost` port.
    expect(redirects).toContain("VITE_SITE_URL");
    expect(redirects).toContain("window.location.origin");
    // A confirmation link finishes at the admin door, signed in.
    expect(redirects).toContain("/?unlock=admin");
    // A recovery link finishes at the page that can set a password. Sending it
    // anywhere else is what made a reset look like it had done nothing.
    expect(redirects).toContain("/update-password");

    // And the one place a link is sent from the team screen uses it.
    const staff = readFileSync(
      new URL("../src/lib/staff.ts", import.meta.url),
      "utf8",
    );
    expect(staff).toContain("redirectTo: recoveryRedirect()");
    expect(staff).not.toContain("window.location.origin");
  });

  test("a recovery link has a page that can actually finish it", () => {
    const route = readFileSync(
      new URL("../src/main.tsx", import.meta.url),
      "utf8",
    );
    const page = readFileSync(
      new URL("../src/pages/UpdatePassword.tsx", import.meta.url),
      "utf8",
    );

    // Routed outside every auth guard, and able to finish the job from either
    // shape of link the service sends.
    expect(route).toContain('path="/update-password"');
    expect(page).toContain("exchangeCodeForSession");
    expect(page).toContain("updateUser({ password })");
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
  /**
   * The staff-auth migration is not installed, so the email-free bootstrap is
   * unavailable and the older signUp path is what runs.
   *
   * The default for this block on purpose: everything below it is about the
   * fallback — what happens when the database cannot create the owner itself.
   * The bootstrap route has its own describe further down, where the function is
   * installed and the mail is never involved.
   */
  const NO_BOOTSTRAP = {
    code: "PGRST202",
    message:
      "Could not find the function public.admin_bootstrap_owner in the schema cache",
  };

  beforeEach(() => {
    rpcReplies.admin_bootstrap_owner = { data: null, error: NO_BOOTSTRAP };
  });

  test("a new address is created, then claimed, and only Auth ever sees the password", async () => {
    // `emailRedirectTo` is only built where `window` exists.
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://janoon.pk" },
    };
    rpcReplies = {
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
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
      // The address is trimmed, and the password goes to Supabase Auth and to
      // the one database function that hashes it — the confirmation link comes
      // back to the admin card so the claim can be finished in one press.
      expect(authCalls[0].args[0]).toMatchObject({
        email: "owner@janoon.pk",
        password: "brand-new-secret",
      });
      expect(JSON.stringify(authCalls[0].args)).toContain("unlock=admin");
      // The password reaches exactly one function, and it is the one whose only
      // job is to turn it into a bcrypt digest. Everywhere else it must not
      // appear — a table read, a log line, or another rpc.
      const carried = JSON.stringify(rpcCalls).match(/brand-new-secret/g) ?? [];
      expect(carried.length).toBe(1);
      expect(
        rpcCalls.filter((call) => JSON.stringify(call).includes("brand-new-secret")),
      ).toEqual([
        {
          name: "admin_bootstrap_owner",
          args: {
            p_email: "owner@janoon.pk",
            p_password: "brand-new-secret",
            p_display_name: null,
          },
        },
      ]);
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
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
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
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: { ok: true, role: "admin" }, error: null },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
    };

    expect(await claimFirstAdmin("owner@janoon.pk", "whatever-they-typed")).toEqual({
      ok: false,
      reason: "existing-account",
      message: "owner@janoon.pk",
    });
    // The existing identity keeps its UUID and its password: nothing was signed
    // up, no password was asked for, and only the gate and the grant were called.
    expect(authCalls).toEqual([]);
    expect(rpcCalls).toEqual([
      { name: "staff_bootstrap_state", args: {} },
      {
        name: "admin_bootstrap_owner",
        args: {
          p_email: "owner@janoon.pk",
          p_password: "whatever-they-typed",
          p_display_name: null,
        },
      },
      { name: "claim_admin_for_email", args: { p_email: "owner@janoon.pk" } },
    ]);
  });

  test("an address that already has an account, with a password that is not accepted, is a failure", async () => {
    rpcReplies = {
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
    };
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
    rpcReplies = {
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: null, error: NO_RULE },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
    };
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
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
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
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
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

  /**
   * A valid address must never be reported as a rejected one.
   *
   * Several of Supabase's refusals mention "email" while having nothing to say
   * about the address — an account that already exists, a spent rate limit —
   * and a classifier that reached for the word first told the owner their
   * address was not accepted. That is how a perfectly good
   * `admin@junoon.com` came back as "not accepted".
   */
  test("an address that is only mentioned in the complaint is not called invalid", async () => {
    const cases: [string, string | undefined, string][] = [
      [
        "A user with this email address has already been registered",
        "user_already_exists",
        "email-taken",
      ],
      ["User already registered", undefined, "email-taken"],
      ["Email rate limit exceeded", "email_rate_limit", "rate-limited"],
      [
        "For security purposes, you can only request this after 60 seconds",
        "over_request_rate_limit",
        "rate-limited",
      ],
      ["Unable to validate email address: bad format", undefined, "invalid-email"],
      ["Password should be at least 6 characters", undefined, "weak-password"],
    ];

    // A duplicate address falls through to a sign-in attempt, and that is where
    // the password typed into the setup card is found not to be the account's.
    authReplies.signInWithPassword = {
      data: null,
      error: { message: "Invalid login credentials" },
    };

    for (const [message, code, expected] of cases) {
      // Auth answers a refused sign-up with an error and no payload at all, so
      // this is the shape the app really has to survive.
      authReplies.signUp = { data: null, error: { message, code } };
      const outcome = await claimFirstAdmin("admin@junoon.com", "secret123");

      expect([message, outcome.ok === false && outcome.reason]).toEqual([
        message,
        expected,
      ]);
    }
  });

  test("a duplicate address is offered the sign-in route, not a typo", async () => {
    // The rule is installed and grants nothing: the address is genuinely free
    // for sign-up, and Auth is the one refusing it.
    rpcReplies.claim_admin_for_email = {
      data: null,
      error: { message: "No account found for that email address." },
    };
    authReplies.signUp = {
      data: { user: null, session: null },
      error: {
        message: "A user with this email address has already been registered",
        code: "user_already_exists",
      },
    };

    authReplies.signInWithPassword = {
      data: null,
      error: { message: "Invalid login credentials" },
    };

    const outcome = await claimFirstAdmin("admin@junoon.com", "secret123");

    expect(outcome.ok).toBe(false);
    // The point: never blamed on the address, which is perfectly well formed.
    expect(outcome.ok === false && outcome.reason).toBe("email-taken");
  });

  test("an address that needs confirming is not a failure", async () => {
    rpcReplies = {
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      claim_admin_for_email: { data: null, error: NO_ACCOUNT },
      // The email-free route is not installed here, so this test exercises the fallback.
      admin_bootstrap_owner: { data: null, error: NO_BOOTSTRAP },
    };
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
    expect(rpcCalls.map((call) => call.name)).toEqual([
      "staff_bootstrap_state",
      "admin_bootstrap_owner",
      "claim_admin_for_email",
    ]);
  });
});

/* --------------------------------------------------- the email-free setup --- */

/**
 * Setting the restaurant up, with no confirmation mail anywhere.
 *
 * This is the path the whole change exists for. The old one began with
 * `supabase.auth.signUp`, which makes Supabase send a message, and that call is
 * refused with "Too many attempts just now" once the project's hourly quota is
 * spent — a complaint about the quota, on an address that was fine, which cannot
 * be fixed from here and does not clear when you wait a minute.
 *
 * So the checks below are about a route that never sends anything: the identity
 * is created in Postgres, the address is confirmed there, and the only network
 * call is an ordinary sign-in.
 */
describe("the first admin is created without sending any mail", () => {
  /** What the function returns on success, with the admin role recorded. */
  const CREATED = {
    data: {
      ok: true,
      userId: "owner-uuid",
      email: "owner@janoon.pk",
      role: "admin",
      active: true,
      authCreated: true,
      confirmed: true,
    },
    error: null,
  };

  beforeEach(() => {
    rpcReplies = {
      staff_bootstrap_state: { data: { claimable: true, version: 2 }, error: null },
      admin_bootstrap_owner: CREATED,
    };
    // The row the claim is supposed to have written, read back before the card
    // is allowed to call the account created.
    tableReplies.staff_members = { data: { role: "admin", active: true }, error: null };
    authReplies.signInWithPassword = {
      data: { user: { id: "owner-uuid", email: "owner@janoon.pk" }, session: { access_token: "t" } },
      error: null,
    };
  });

  test("the account is created, signed in to, and never signed up or mailed", async () => {
    const outcome = await claimFirstAdmin("  owner@janoon.pk  ", "brand-new-secret");

    expect(outcome).toEqual({
      ok: true,
      userId: "owner-uuid",
      email: "owner@janoon.pk",
      roles: ["admin"],
    });

    // The one function that does the work, with the password and the trimmed
    // address and nothing else.
    expect(rpcCalls).toEqual([
      { name: "staff_bootstrap_state", args: {} },
      {
        name: "admin_bootstrap_owner",
        args: {
          p_email: "owner@janoon.pk",
          p_password: "brand-new-secret",
          p_display_name: null,
        },
      },
    ]);

    // The whole point: no signUp, so no mail, and no confirmation to wait for.
    // The only Auth call is the sign-in that gets a session.
    expect(authCalls.map((call) => call.method)).toEqual(["signInWithPassword"]);
    expect(authCalls[0].args[0]).toEqual({
      email: "owner@janoon.pk",
      password: "brand-new-secret",
    });
    // And the fallback is never reached, so nothing asks for a confirmation or
    // re-sends one.
    expect(rpcCalls.map((call) => call.name)).not.toContain("claim_admin_for_email");
    expect(rpcCalls.map((call) => call.name)).not.toContain("claim_admin");
  });

  test("a database without the function still falls back to the older path", async () => {
    // The migration has not been pasted. Setup has to keep working, so the
    // signUp path takes over — and it does need a deliverable mail, which is
    // exactly why the migration is the fix rather than this fallback.
    rpcReplies.admin_bootstrap_owner = {
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.admin_bootstrap_owner in the schema cache",
      },
    };
    rpcReplies.claim_admin_for_email = {
      data: null,
      error: { code: "23503", message: "No account found for that email address." },
    };
    rpcReplies.claim_admin = { data: { ok: true, role: "admin" }, error: null };
    authReplies.signUp = {
      data: {
        user: { id: "fallback-admin", email: "owner@janoon.pk" },
        session: { access_token: "t" },
      },
      error: null,
    };

    expect(await claimFirstAdmin("owner@janoon.pk", "brand-new-secret")).toEqual({
      ok: true,
      userId: "fallback-admin",
      email: "owner@janoon.pk",
      roles: ["admin"],
    });
    expect(authCalls.map((call) => call.method)).toContain("signUp");
  });

  /**
   * The function's own refusals are the answer, and are not re-asked.
   *
   * Passing these down to the fallback would mean calling signUp — and sending
   * the mail — after the database had already said no.
   */
  test("a refusal from the database is reported, never retried through signUp", async () => {
    for (const [message, reason] of [
      ["An admin account already exists for this restaurant.", "claimed"],
      ["Staff accounts cannot claim admin access. Ask an admin to grant it.", "claimed"],
      [
        "A password of at least 8 characters is required to create a sign-in account.",
        "weak-password",
      ],
      ["A valid email address is required.", "invalid-email"],
    ] as const) {
      rpcCalls.length = 0;
      authCalls.length = 0;
      rpcReplies.admin_bootstrap_owner = {
        data: null,
        error: { code: "P0001", message },
      };

      expect(await claimFirstAdmin("owner@janoon.pk", "pw")).toEqual({
        ok: false,
        reason,
        message,
      });
      // Not one signUp, so not one mail.
      expect(authCalls).toEqual([]);
    }
  });

  test("a call that succeeds but grants nothing is a failure, not a created admin", async () => {
    // `ok: true` with no role behind it: a function returning without having
    // written anything. Believing it hands the card a success and then refuses
    // the person at the sign-in gate.
    rpcReplies.admin_bootstrap_owner = {
      data: { ok: true },
      error: null,
    };

    expect(await claimFirstAdmin("owner@janoon.pk", "pw")).toEqual({
      ok: false,
      reason: "setup-required",
    });
    expect(authCalls).toEqual([]);
  });

  test("an owner whose role was not really recorded is signed out again", async () => {
    // The account exists and the sign-in worked, but the row is not there.
    // The session is closed rather than handed to an account with no access.
    tableReplies.staff_members = { data: { role: "staff", active: true }, error: null };

    expect(await claimFirstAdmin("owner@janoon.pk", "pw")).toEqual({
      ok: false,
      reason: "setup-required",
    });
    expect(authCalls.map((call) => call.method)).toContain("signInWithPassword");
    expect(authCalls.map((call) => call.method)).toContain("signOut");
  });

  test("the one-time rule is asked of the database before anything is created", async () => {
    // Even with the function installed, an admin that already exists is refused
    // before the call — the card being hidden is not the boundary.
    rpcReplies.staff_bootstrap_state = {
      data: { claimable: false, version: 2 },
      error: null,
    };

    const outcome = await claimFirstAdmin("owner@janoon.pk", "pw");

    expect(outcome).toMatchObject({ ok: false, reason: "claimed" });
    expect(rpcCalls.map((call) => call.name)).toEqual(["staff_bootstrap_state"]);
    expect(authCalls).toEqual([]);
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

  /**
   * The one-time setup is a property of the database, not of a browser.
   *
   * Two separate promises, and both have to hold. The *button* may only appear
   * when the database positively said no admin exists. The *claim* must then ask
   * again before it creates anything, so a screen left open, a stale tab or a
   * hand-made request cannot slip past a rule that has since been closed.
   */
  test("the setup action and the claim are both decided by the database", () => {
    const auth = read("../src/hooks/use-staff-auth.ts");
    const card = read("../src/pages/AuthLanding.tsx");

    // One function, one question, used by both the card and the claim.
    expect(auth).toContain("export async function adminSetupState()");
    expect(auth).toContain('supabase.rpc("staff_bootstrap_state")');
    expect(card).toContain("setupIsOffered");
    // The card reads its state through that one helper rather than deciding.
    expect(card).not.toMatch(/claim\s*!==\s*"closed"/);

    // The claim asks before it creates anything: the gate comes before signUp.
    const gate = auth.indexOf("const state = await adminSetupState()");
    const signUp = auth.indexOf("await supabase.auth.signUp(");
    expect([gate > -1, signUp > -1, gate < signUp]).toEqual([true, true, true]);

    // And an answer it could not get is a refusal, never a pass.
    for (const state of ["unavailable", "outdated"]) {
      expect([state, auth.includes(`"${state}"`)]).toEqual([state, true]);
    }
  });

  test("the setup action appears only on the two answers that mean no admin exists", () => {
    const { setupIsOffered } = auth;

    // What the database said no admin exists.
    expect(setupIsOffered("open")).toBe(true);
    // …or a database that has no rule at all, and so cannot be holding one.
    expect(setupIsOffered("missing")).toBe(true);

    // Everything else says no, and the important one is the answer we could not
    // get: offering setup on a guess is what "the browser must have no influence
    // on this" forbids.
    for (const state of ["closed", "outdated", "unavailable", "checking"]) {
      expect([state, setupIsOffered(state as never)]).toEqual([state, false]);
    }
  });

  test("an admin that already exists stops the claim before anything is created", async () => {
    rpcReplies.staff_bootstrap_state = {
      data: { claimable: false, version: 2 },
      error: null,
    };

    const outcome = await claimFirstAdmin("latecomer@janoon.pk", "brand-new-secret");

    expect(outcome).toMatchObject({ ok: false, reason: "claimed" });
    // No account was created and no role granted: the gate refused first.
    expect(authCalls).toEqual([]);
    expect(rpcCalls.map((call) => call.name)).toEqual(["staff_bootstrap_state"]);
  });

  test("a bootstrap check that cannot run does not open the door either", async () => {
    rpcReplies.staff_bootstrap_state = {
      data: null,
      error: { message: "Failed to fetch" },
    };

    const outcome = await claimFirstAdmin("owner@janoon.pk", "brand-new-secret");

    expect(outcome).toMatchObject({ ok: false, reason: "claimed" });
    expect(authCalls).toEqual([]);
  });

  test("a database with no bootstrap rule at all still offers the claim", async () => {
    rpcReplies.staff_bootstrap_state = {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    };

    // It cannot be holding an admin, and the database refuses the claim itself
    // if one turns out to exist — so this is a database answer, not a guess.
    expect(await adminSetupState()).toBe("missing");
  });

  test("no browser storage takes any part in the setup rule", () => {
    for (const path of [
      "../src/hooks/use-staff-auth.ts",
      "../src/pages/AuthLanding.tsx",
    ]) {
      const src = readFileSync(new URL(path, import.meta.url), "utf8");
      expect([path, /(localStorage|sessionStorage)\s*\./.test(src)]).toEqual([
        path,
        false,
      ]);
    }
  });

  /**
   * The credentials screen is gone, from both portals.
   *
   * Not "hidden" — removed. The staff desk has no password, address or account
   * settings surface at all, and the admin portal has no Credentials tab: team
   * management and team credentials are one screen, held by one role, instead of
   * a second place to look after passwords.
   */
  test("neither portal carries a credentials screen", () => {
    const staffDesk = read("../src/pages/StaffPortal.tsx");
    const admin = read("../src/pages/AdminPortal.tsx");

    // The floor team: no credential surface of any kind.
    expect(staffDesk).not.toContain("AccountSettings");
    expect(staffDesk).not.toContain("changeOwnPassword");
    expect(staffDesk).not.toContain("changeOwnEmail");

    // The admin portal: no Credentials tab, and nothing importing the vault.
    expect(admin).not.toContain("StaffCredentialsVault");
    expect(admin).not.toContain('value="credentials"');
    expect(admin).not.toMatch(/TabsTrigger value="credentials"/);

    // …and the component itself is gone from disk, not merely unreferenced.
    expect(() =>
      readFileSync(
        new URL("../src/components/admin/StaffCredentialsVault.tsx", import.meta.url),
        "utf8",
      ),
    ).toThrow();
  });

  /** The team list has to answer "who is on it" at a glance. */
  test("the team list names, addresses, roles and states every member", () => {
    // Labels are split across lines by the formatter, so compare the rendered
    // shape rather than the raw bytes.
    const src = read("../src/components/admin/StaffManager.tsx").replace(
      /\s+/g,
      " ",
    );

    for (const column of ["Name", "Email", "Role", "Status"]) {
      expect([column, src.includes(`> ${column} </`)]).toEqual([column, true]);
    }
    // Active/inactive is the flag the Team screen actually toggles, so it is
    // what the list has to say out loud.
    expect(src).toContain('{member.active ? "Active" : "Inactive"}');
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

/* --------------------------------------- manual confirmation fallback --- */

/**
 * The SQL fallback exists for the case the app cannot fix: mail that never
 * arrives. It has to confirm one address without switching verification off for
 * everyone — those are very different changes, and only the first one is safe.
 */
describe("the manual confirmation fallback", () => {
  const sql = readFileSync(
    new URL("../supabase/confirm-admin-email.sql", import.meta.url),
    "utf8",
  );

  /**
   * The file's statements only. The header explains the setting by name, and a
   * mention in prose is not the same as a statement that changes it — which is
   * exactly the difference these guards are about.
   */
  const statements = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  test("confirms one address instead of turning verification off for the project", () => {
    expect(statements).toContain(
      "set email_confirmed_at = coalesce(email_confirmed_at, now())",
    );
    // The project-wide switch is never touched, so every other account still
    // has to confirm its address.
    expect(statements).not.toMatch(/autoconfirm/i);
    expect(statements).not.toMatch(/alter\s+role/i);
    expect(statements).not.toMatch(/create\s+user/i);
    expect(statements).not.toMatch(/update\s+auth\.config|alter\s+database/i);
  });

  test("never rewrites a password, a role or an existing confirmation", () => {
    expect(statements).not.toMatch(/encrypted_password/i);
    expect(statements).not.toMatch(/update\s+public\.staff_members/i);
    expect(statements).not.toMatch(/insert\s+into\s+public\.staff_members/i);
    expect(statements).not.toMatch(/delete\s+from/i);
    // Already-confirmed addresses keep their original timestamp.
    expect(statements).toContain("coalesce(email_confirmed_at, now())");
  });

  test("stays confined to the SQL editor — the website cannot call it", () => {
    expect(statements).toContain(
      "revoke all on function public.confirm_staff_email(text) from public",
    );
    expect(statements).toContain(
      "revoke all on function public.staff_login_state(text) from public",
    );
    // Nothing is handed to `anon` or `authenticated` in its place.
    expect(statements).not.toMatch(/grant execute/i);
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
  /**
   * Revoked on purpose: nothing in the app calls it, and nothing should be able
   * to. `staff_get_roles` is a leftover helper. `staff_ensure_auth_user` is the
   * one that matters — it is the function that creates an Auth identity, so it
   * is granted to no role at all and is reachable only from inside the two
   * functions that check their own guards first. Granting it to `authenticated`
   * would hand every signed-in staff member the ability to mint an account.
   */
  const INTERNAL_ONLY = new Set([
    "public.staff_get_roles(uuid)",
    "public.staff_ensure_auth_user(text, text, text)",
  ]);

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
    "admin_upsert_staff_account",
    "admin_set_staff_role",
    "admin_set_staff_active",
    "admin_remove_staff",
    "admin_delete_staff_account",
    "admin_confirm_staff_email",
    "admin_sync_staff_roles",
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

  /**
   * The dedicated staff-auth migration.
   *
   * It is the file that has to be pasted, so its promises are read out of the
   * SQL rather than trusted: one call that creates or reuses the Auth identity
   * and writes the team row, an admin-only confirmation, and a rule that touches
   * nothing outside the auth and staff tables.
   */
  test("the staff-auth migration defines every function the Team screen needs", () => {
    const sql = readSql("staff-auth.sql");

    for (const name of [
      // The identity helper and the two entry points that use it. Setup goes
      // through admin_bootstrap_owner precisely so no mail is involved.
      "staff_ensure_auth_user",
      "admin_bootstrap_owner",
      "admin_upsert_staff_account",
      "admin_confirm_staff_email",
      "admin_delete_staff_account",
      "admin_sync_staff_roles",
      "admin_set_staff_active",
      "admin_set_staff_role",
      "admin_remove_staff",
    ]) {
      expect([name, sql.includes(`create or replace function public.${name}(`)]).toEqual([
        name,
        true,
      ]);
    }

    // Each is defined once, not spliced in twice — a file that defines the
    // same function repeatedly is a file that has been spliced badly.
    for (const name of ["staff_ensure_auth_user", "admin_bootstrap_owner"]) {
      const count = sql.split(`create or replace function public.${name}(`).length - 1;
      expect([name, count]).toEqual([name, 1]);
    }

    // The same definitions are in the two files that ship them, so whichever
    // one gets pasted the behaviour is identical.
    for (const file of ["schema.sql", "fix-admin-recovery.sql"]) {
      for (const name of [
        "staff_ensure_auth_user",
        "admin_bootstrap_owner",
        "admin_upsert_staff_account",
      ]) {
        expect([
          file,
          name,
          readSql(file).includes(`create or replace function public.${name}(`),
        ]).toEqual([file, name, true]);
      }
    }
  });

  /** The body of one function, comments and layout left in. */
  const bodyOf = (name: string) => {
    const sql = readSql("staff-auth.sql");
    const start = sql.indexOf(`create or replace function public.${name}(`);
    return sql.slice(start, sql.indexOf("$$;", start));
  };

  /** The body of the one call the Team screen makes. */
  const upsertBody = () => bodyOf("admin_upsert_staff_account");

  /**
   * Setup must not depend on a mail being deliverable.
   *
   * The whole reason this route exists: the browser used to call
   * `auth.signUp`, which makes Supabase send a confirmation message, and that
   * is refused with "Too many attempts just now" once the hourly quota is spent.
   * The address was never the problem. So the identity is created here, already
   * confirmed, and nothing is sent.
   */
  test("the first admin is created in Postgres, with no confirmation mail", () => {
    const body = bodyOf("admin_bootstrap_owner");

    // It creates the identity itself rather than asking the browser to.
    expect(body).toContain("public.staff_ensure_auth_user(v_email, p_password, v_name)");
    // And confirms the address by hand, for this one account.
    expect(body).toContain(
      "email_confirmed_at = coalesce(email_confirmed_at, now())",
    );
    // The one-time rule is asked of the database, inside this transaction —
    // not left to the card having been hidden.
    expect(body).toContain("lock table public.staff_members in exclusive mode");
    expect(body).toContain("if public.tribe_active_admins() > 0 then");
    // And it is never a route from staff to admin.
    expect(body).toContain("Staff accounts cannot claim admin access.");
    // Records the role as a real row, not a flag.
    expect(body).toContain("insert into public.staff_members");
    expect(body).toContain("insert into public.staff_member_roles");
  });

  /**
   * The short file is a cut-down copy, not a second opinion.
   *
   * It exists so a locked-out owner can paste 12 KB instead of 29 KB and be
   * working again. That is only safe if the two functions in it are byte-for-byte
   * the same ones the full migration installs — otherwise the short file becomes
   * a second, divergent definition of how an account is created.
   */
  test("the short first-admin file is the same SQL, not a variant of it", () => {
    const short = readSql("first-admin.sql");
    const full = readSql("staff-auth.sql");

    // Only the two functions needed to get an admin in, and nothing else.
    expect([
      ...new Set(
        [...short.matchAll(/create or replace function public\.(\w+)\(/g)].map(
          (match) => match[1],
        ),
      ),
    ].sort()).toEqual(["admin_bootstrap_owner", "staff_ensure_auth_user"]);

    // The bodies match the full migration exactly, comments and layout included.
    const bodyOfIn = (sql: string, name: string) => {
      const start = sql.indexOf(`create or replace function public.${name}(`);
      expect([name, start > -1]).toEqual([name, true]);
      return sql.slice(start, sql.indexOf("$$;", start));
    };
    for (const name of ["staff_ensure_auth_user", "admin_bootstrap_owner"]) {
      expect([name, bodyOfIn(short, name)]).toEqual([
        name,
        bodyOfIn(full, name),
      ]);
    }

    // The same grants, so the short file leaves the door in the same state.
    expect(short).toContain(
      "revoke all on function public.staff_ensure_auth_user(text, text, text) from public;",
    );
    expect(short).toContain(
      "grant execute on function public.admin_bootstrap_owner(text, text, text) to anon, authenticated;",
    );
    // No duplicate grant, which a spliced file produces silently.
    expect(short.match(/grant execute on function/g)?.length).toBe(1);

    // And it still touches nothing outside the auth and staff tables.
    const statements = short
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(
      [
        ...new Set(
          [
            ...statements.matchAll(
              /(?:insert into|update|delete from)\s+((?:public|auth)\.[a-z_]+)/gi,
            ),
          ].map((match) => match[1].toLowerCase()),
        ),
      ].sort(),
    ).toEqual([
      "auth.identities",
      "auth.users",
      "public.staff_member_roles",
      "public.staff_members",
    ]);
  });

  /**
   * The identity helper is the only thing that writes to auth.users, and it is
   * reachable from nowhere but the two functions that guard themselves.
   */
  test("the identity helper is found before it is created, and needs a password", () => {
    const body = bodyOf("staff_ensure_auth_user");

    // The lookup by address comes before the insert, and it is inside the same
    // function, so the check and the write cannot drift apart.
    const looked = body.indexOf("from auth.users u");
    const inserted = body.indexOf("insert into auth.users");
    expect([looked > -1, inserted > -1, looked < inserted]).toEqual([true, true, true]);
    expect(body).toContain("where lower(u.email) = v_email");
    // Creating an identity with no password is refused rather than producing an
    // account nobody can sign in to.
    expect(body).toContain("if length(v_password) < 8 then");
    // GoTrue needs the identities row too. Without it the account exists and
    // still cannot sign in, which looks exactly like a missing account.
    expect(body).toContain("insert into auth.identities");

    // Granted to no role, so a browser cannot call it on its own.
    const sql = readSql("staff-auth.sql");
    expect(sql).toContain(
      "revoke all on function public.staff_ensure_auth_user(text, text, text) from public;",
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.staff_ensure_auth_user\(/,
    );
  });

  /** Reuses an identity by address, and never creates a second one. */
  test("the Team screen's one call reuses the identity and writes one team row", () => {
    const body = upsertBody();

    // It goes through the shared helper rather than repeating the auth insert.
    expect(body).toContain("public.staff_ensure_auth_user(v_email, p_password, v_name)");
    expect(body).not.toContain("insert into auth.users");
    // It confirms the address, so the member is not left unable to sign in.
    expect(body).toContain(
      "email_confirmed_at = coalesce(email_confirmed_at, now())",
    );
    // The team row is keyed by the UUID, so one identity cannot hold two.
    expect(body).toContain("on conflict (user_id) do update");
  });

  /** No service-role key, no plaintext password column, ever. */
  test("no secret is embedded and no password is stored in a readable column", () => {
    const sql = readSql("staff-auth.sql");

    // The password is hashed in the statement and only ever lands in the digest
    // column GoTrue itself keeps.
    expect(sql).toContain(
      "extensions.crypt(v_password, extensions.gen_salt('bf', 10))",
    );
    expect(sql).toContain("encrypted_password");
    // No column of our own ever holds a password. The only mentions are function
    // arguments, which exist for the length of the call — one per function that
    // sets a password, and nothing else in the file.
    const parameters = [...sql.matchAll(/^\s{2,4}p_\w+\s+[\w, ]+\)?$/gm)].map((m) =>
      m[0].trim(),
    );
    expect(parameters.filter((line) => /password/i.test(line))).toEqual([
      "p_password     text,",
      "p_password     text,",
      "p_password     text,",
    ]);
    // And no parameter is named anything that could be stored rather than passed.
    // The allow-list is the whole set the nine functions take, so a new argument
    // has to be added here deliberately rather than slipping in.
    expect(
      parameters.filter(
        (line) => !/^p_(email|password|display_name|role|user_id|active)\b/.test(line),
      ),
    ).toEqual([]);
    // No service-role key, and no grant of one.
    expect(sql).not.toMatch(/service_role/i);
  });

  /** Confirmation is done for one address on this team, never globally. */
  test("confirmation is admin-only and never a project-wide switch", () => {
    // Statements only: the header explains the setting by name, and a mention in
    // prose is not a statement that changes it — which is exactly the difference
    // this guard is about.
    const statements = readSql("staff-auth.sql")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    expect(upsertBody()).toContain("if not public.is_admin() then");
    expect(upsertBody()).toContain(
      "email_confirmed_at = coalesce(email_confirmed_at, now())",
    );
    // A blanket switch would confirm strangers too.
    expect(statements).not.toMatch(
      /mailer_autoconfirm|disable_confirmations|enable_signup|auth\.config/i,
    );
    // The hand-written one is admin-only and only for an address already on the
    // team, so it cannot be used to confirm a stranger's account.
    const schema = readSql("schema.sql");
    const confirm = schema.slice(
      schema.indexOf(
        "create or replace function public.admin_confirm_staff_email(",
      ),
    );
    expect(confirm).toContain("That address is not on this team.");
  });

  /** The last admin cannot be deactivated, removed or deleted. */
  test("the last active admin is protected in every direction", () => {
    const sql = readSql("staff-auth.sql");
    const guards = sql.match(/tribe_active_admins\(\) <= 1/g) ?? [];

    // Once in each of: deactivate, remove, delete, demote.
    expect(guards.length).toBe(4);
    expect(sql).toContain(
      "This is the only admin account — it cannot be deactivated.",
    );
    expect(sql).toContain("This is the only admin account — it cannot be removed.");
    expect(sql).toContain("This is the only admin account — it cannot be deleted.");
    expect(sql).toContain(
      "This is the only admin account — make someone else an admin first.",
    );
    // And nobody deletes the account they are signed in with.
    expect(sql).toContain("You cannot delete the account you are signed in with.");
  });

  /**
   * It touches the auth and staff tables, and nothing else.
   *
   * A migration that reads or writes a business table is a migration that can
   * lose a customer's booking. The check is over every statement, so a comment
   * mentioning one does not count and a statement writing one does not slip by.
   */
  test("no business table is read, written or deleted", () => {
    const sql = readSql("staff-auth.sql");
    const statements = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    for (const table of [
      "menu_categories",
      "menu_dishes",
      "menu_addons",
      "addon_categories",
      "site_media",
      "counter_media",
      "site_content",
      "reservations",
      "preorders",
      "pre_order_items",
      "delivery_orders",
      "promotions",
      "orders",
    ]) {
      const writes = new RegExp(
        `(delete from|insert into|update|truncate)\\s+\\w*\\.?${table}\\b`,
        "i",
      );
      expect([table, writes.test(statements)]).toEqual([table, false]);
    }

    // The tables it is allowed to touch, and the ones it really does.
    const touched = [
      ...new Set(
        [
          ...statements.matchAll(
            /(?:insert into|update|delete from)\s+((?:public|auth)\.[a-z_]+)/gi,
          ),
        ].map((match) => match[1].toLowerCase()),
      ),
    ].sort();
    expect(touched).toEqual([
      "auth.identities",
      "auth.users",
      "public.staff_member_roles",
      "public.staff_members",
    ]);
  });

  /**
   * Idempotent, and the `.txt` twin is the same file.
   *
   * The two copies drifted apart once, and the stale one is exactly what a
   * reader opens: it listed fourteen functions and none of the three that were
   * actually needed. Every staff SQL file now has to ship with an identical
   * `.txt`, so what is read is always what runs.
   */
  test("every staff SQL file ships an identical .txt twin", () => {
    for (const file of [
      "staff-auth.sql",
      "fix-admin-recovery.sql",
      "schema.sql",
      "first-admin.sql",
    ]) {
      const sql = readFileSync(new URL(`../supabase/${file}`, import.meta.url));
      const twin = readFileSync(
        new URL(`../supabase/${file}.txt`, import.meta.url),
      );
      expect([file, sql.equals(twin)]).toEqual([file, true]);
    }
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
