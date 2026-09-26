/**
 * Targeted tests for the transaction layer — the four things a guest can do
 * (book a table, pre-order, order delivery, look up their own record) and the
 * one thing a desk can do beyond that (look a code up by itself).
 *
 * The mistakes these pin down are all invisible in the UI and expensive in
 * production:
 *
 *   * a reference minted anywhere but the database, so a guest is shown a code
 *     that no row carries and the desk cannot find their booking;
 *   * a code that can collide across the three transaction tables, so "Find by
 *     Code" returns the wrong guest's record;
 *   * a price accepted from the client, so a hand-edited cart changes what an
 *     order costs;
 *   * a lookup that answers a guest, which would turn a guessed code into
 *     somebody else's booking.
 *
 * The SQL cannot be executed here, so these read the loader and assert the
 * properties that must hold in it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/transactions.sql", "utf8");

/** One `create or replace function public.<name>(` block, verbatim. */
function fn(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  // A plpgsql body closes with `end $$;`, a SQL body with a bare `$$;` on its
  // own line. Both are the end of this function and neither is anything else.
  const closers = [
    sql.indexOf("\n$$;", start),
    sql.indexOf("\nend $$;", start),
  ].filter((at) => at > start);
  const end = Math.min(...closers);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("the transaction loader", () => {
  test("is idempotent — every statement can be re-run", () => {
    // No drops of objects the app depends on, and every definition is
    // `create or replace`, so pasting the file twice is free.
    expect(sql).toContain("create or replace function public.create_reservation(");
    expect(sql).toContain("create or replace function public.create_preorder(");
    expect(sql).toContain("create or replace function public.place_delivery_order(");
    expect(sql).toContain("create or replace function public.tribe_find_by_reference(");
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/drop\s+function/i);
  });

  test("draws every reference in the database, never on the client", () => {
    for (const name of [
      "create_reservation",
      "create_preorder",
      "place_delivery_order",
    ]) {
      // The one place a code comes from. If a create function grew a literal
      // reference, or fell back to one from the client, this would miss it.
      expect(fn(name)).toContain("public.tribe_unique_reference()");
    }
    // And no function takes a caller-supplied code.
    for (const name of ["create_reservation", "create_preorder", "place_delivery_order"]) {
      expect(fn(name)).not.toMatch(/p_reference/);
    }
  });

  test("mints the house code: JNX- plus five unambiguous characters", () => {
    const reference = fn("tribe_unique_reference");
    expect(reference).toContain("public.tribe_reference('JNX', 5)");
    // I, O, 0 and 1 are left out of the alphabet, because a code read down a
    // phone line has to survive being written down.
    const alphabet =
      fn("tribe_reference").match(/alphabet\s+text\s*:=\s*'([^']+)'/)?.[1] ?? "";
    expect(alphabet).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
    for (const lookalike of ["I", "O", "0", "1"]) {
      expect(alphabet).not.toContain(lookalike);
    }
  });

  test("keeps a code unique across all three transaction tables", () => {
    const reference = fn("tribe_unique_reference");
    for (const table of ["reservations", "preorders", "delivery_orders"]) {
      expect(reference).toContain(`from public.${table} where reference = candidate`);
    }
    // Redrawn until free, not accepted and hoped for.
    expect(reference).toMatch(/loop/);
  });

  test("writes the row and the code in the same statement", () => {
    for (const name of ["create_reservation", "create_preorder", "place_delivery_order"]) {
      const body = fn(name);
      const draw = body.indexOf("tribe_unique_reference()");
      const insert = body.indexOf("insert into");
      expect(draw).toBeGreaterThan(-1);
      expect(insert).toBeGreaterThan(draw);
    }
  });

  test("prices a delivery order in the database, not from the cart", () => {
    const order = fn("place_delivery_order");
    // The client sends slug, name and count only.
    expect(order).toContain("v_item ->> 'slug'");
    expect(order).toContain("v_item ->> 'count'");
    // Every price is read from a table.
    expect(order).toContain("from public.menu_dishes d");
    expect(order).toContain("from public.menu_addons a");
    // The price stored on each line is the one this function looked up, never
    // one that arrived in the payload.
    expect(order).toContain("'unitPrice', v_price");
    expect(order).not.toMatch(/p_total|p_items_total/);
  });

  test("will not accept a client total", () => {
    const signature = fn("place_delivery_order");
    const parameters = signature.slice(
      signature.indexOf("place_delivery_order("),
      signature.indexOf(")"),
    );
    for (const forbidden of ["total", "price", "unit_price", "amount"]) {
      expect(parameters).not.toContain(`p_${forbidden}`);
    }
  });

  describe("the guest's own record", () => {
    test("needs the reference and the phone together", () => {
      for (const name of ["lookup_reservation", "lookup_delivery_order"]) {
        const body = fn(name);
        expect(body).toContain(
          "upper(trim(reference)) = upper(trim(p_reference))",
        );
        expect(body).toContain("regexp_replace(p_phone, '\\D', '', 'g')");
        // Six digits minimum, so a short guess cannot sweep the table.
        expect(body).toContain(">= 6");
      }
    });

    test("is security definer, because RLS hides these tables from guests", () => {
      for (const name of ["lookup_reservation", "lookup_delivery_order", "cancel_reservation"]) {
        expect(fn(name)).toContain("security definer");
      }
    });
  });

  test("the desk lookup refuses anyone who is not staff", () => {
    const lookup = fn("tribe_find_by_reference");
    expect(lookup).toContain("if not public.is_staff() then");
    expect(lookup).toContain("Staff sign-in required.");
    // Granted to signed-in staff only, and explicitly not to anon.
    expect(sql).toContain(
      "grant execute on function public.tribe_find_by_reference(text) to authenticated;",
    );
    expect(sql).toContain(
      "revoke execute on function public.tribe_find_by_reference(text) from anon;",
    );
  });

  test("the desk lookup answers from all three tables", () => {
    const lookup = fn("tribe_find_by_reference");
    for (const table of ["public.reservations", "public.preorders", "public.delivery_orders"]) {
      expect(lookup).toContain(`from ${table}`);
    }
    // A code is matched exactly, upper-cased, and only one row comes back.
    expect(lookup).toContain("upper(trim(r.reference)) = v_code");
    expect(lookup).toContain("upper(trim(o.reference)) = v_code");
    expect(lookup).toContain("coalesce(");
  });

  test("guest writes are rate limited per number and per caller", () => {
    for (const name of ["create_reservation", "create_preorder", "place_delivery_order"]) {
      expect(fn(name)).toContain("public.tribe_throttle_guest(");
    }
    const throttle = fn("tribe_throttle_guest");
    expect(throttle).toContain("p_bucket || ':phone'");
    expect(throttle).toContain("p_bucket || ':caller'");
  });

  test("keeps the RLS posture: guests can write only through these functions", () => {
    // No insert policy for anon anywhere in this file, and no table recreated.
    expect(sql).not.toMatch(/create\s+policy[\s\S]{0,80}to\s+anon[\s\S]{0,80}insert/i);
    expect(sql).not.toMatch(/alter\s+table[\s\S]{0,60}disable\s+row\s+level\s+security/i);
  });
});
