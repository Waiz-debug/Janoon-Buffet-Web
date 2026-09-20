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
    return rpcReply;
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
const { portalPathFor, staffLookup } = await import("../src/hooks/use-staff-auth");

beforeEach(() => {
  rpcCalls.length = 0;
  tableTouches.length = 0;
  authCalls.length = 0;
  clientOptions.length = 0;
  inviteSignUps.length = 0;
  rpcReply = { data: null, error: null };
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

  test("the copy-paste patch installs what an older project is missing", () => {
    const patch = readSql("fix-admin-recovery.sql");

    for (const name of [
      "staff_bootstrap_state",
      "claim_admin",
      "claim_admin_for_email",
      "admin_remove_staff",
      "admin_grant_role",
      "admin_remove_role",
    ]) {
      expect([name, patch.includes(`create or replace function public.${name}(`)]).toEqual([
        name,
        true,
      ]);
    }

    expect(patch).toContain("create table if not exists public.staff_member_roles");
    // `version: 2` is what clears the "outdated rule" state in the sign-in card.
    expect(patch).toContain("'version', 2");
    // The setup card calls this while signed out, before it can sign anybody in.
    expect(patch).toMatch(/grant execute on function public\.claim_admin_for_email\(text\) to anon/);
  });
});
