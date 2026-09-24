/**
 * Targeted tests for counters — the stations a dish is filed under, and the
 * rules that keep the admin panel and the guest site showing the same thing.
 *
 * The mistake these pin down is the one an owner notices and cannot explain: a
 * heading that says "4 items" above a section that shows three, because the
 * count and the list were read from different arrays. `groupByCounter` is the
 * single place both now come from, so it is tested directly, and the writes the
 * panel makes are checked to be as narrow as they claim — moving a dish must
 * not disturb its photo, price or description on the way past.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  counterChoices,
  groupByCounter,
  groupedItemCount,
  type CounterLike,
} from "@/lib/counters";

/* -------------------------------------------------------------- fixtures --- */

const counters: CounterLike[] = [
  {
    id: "bbq",
    name: "Barbecue & Grill",
    urdu: "باری بی کیو",
    blurb: "Charcoal counters that stay lit all night.",
    icon: "flame",
    sortOrder: 1,
    active: true,
  },
  {
    id: "charcoal",
    name: "Charcoal Counter",
    icon: "flame",
    sortOrder: 2,
    active: true,
  },
  {
    id: "handi",
    name: "Traditional Handi",
    icon: "pot",
    sortOrder: 3,
    active: false,
  },
  {
    id: "uncategorized",
    name: "Other",
    icon: "flame",
    sortOrder: 99,
    active: false,
  },
];

const dish = (
  slug: string,
  categoryId: string,
  extra: { active?: boolean; featured?: boolean; sortOrder?: number } = {},
) => ({ slug, name: slug.replace(/-/g, " "), categoryId, ...extra });

const dishes = [
  dish("seekh-kebab", "bbq", { sortOrder: 2 }),
  dish("malai-boti", "bbq", { sortOrder: 1 }),
  dish("retired-dish", "bbq", { active: false }),
  dish("charcoal-tikka", "charcoal", { featured: true }),
  dish("nihari", "handi"),
  dish("orphan-platter", "party-platters"),
];

/* ----------------------------------------------------------- grouping ------ */

describe("groupByCounter", () => {
  test("files each item under its own counter, in menu order", () => {
    const groups = groupByCounter(counters, dishes);

    expect(groups.map((group) => group.id)).toEqual(["bbq", "charcoal"]);
    expect(groups[0].items.map((item) => item.slug)).toEqual([
      "malai-boti",
      "seekh-kebab",
    ]);
    expect(groups[1].items.map((item) => item.slug)).toEqual(["charcoal-tikka"]);
  });

  test("quotes the counter's own wording, and counts what it renders", () => {
    const [bbq] = groupByCounter(counters, dishes);

    expect(bbq.name).toBe("Barbecue & Grill");
    expect(bbq.blurb).toBe("Charcoal counters that stay lit all night.");
    // Two live items on the counter, and one switched off: the section shows
    // two rows and says two, while still reporting the hidden one.
    expect(bbq.items).toHaveLength(2);
    expect(bbq.hidden).toBe(1);
  });

  test("leaves hidden counters and hidden items out of the guest menu", () => {
    const ids = groupByCounter(counters, dishes).map((group) => group.id);
    expect(ids).not.toContain("handi");
    expect(ids).not.toContain("uncategorized");
  });

  test("keeps them for the admin panel, which has to switch them back on", () => {
    const groups = groupByCounter(counters, dishes, {
      includeHiddenCounters: true,
      includeHiddenItems: true,
    });

    expect(groups.map((group) => group.id)).toEqual([
      "bbq",
      "charcoal",
      "handi",
      "uncategorized",
    ]);
    const bbq = groups.find((group) => group.id === "bbq");
    expect(bbq?.items.map((item) => item.slug)).toContain("retired-dish");
    expect(bbq?.hidden).toBe(1);
  });

  test("drops an item whose counter was deleted rather than counting it", () => {
    const groups = groupByCounter(counters, dishes);

    // `party-platters` is not a counter any more, so there is no section that
    // could show its item — and no total claiming one either.
    expect(groupedItemCount(groups)).toBe(3);
    expect(groups.some((group) => group.id === "party-platters")).toBe(false);
  });

  test("gives stranded items a place to be seen when the panel asks for one", () => {
    const groups = groupByCounter(counters, dishes, { includeOrphans: true });
    const orphans = groups[groups.length - 1];

    expect(orphans.id).toBe("party-platters");
    expect(orphans.active).toBe(false);
    expect(orphans.items.map((item) => item.slug)).toEqual(["orphan-platter"]);
    expect(orphans.blurb).toContain("no longer exists");
  });

  test("names the leftover bucket in words, not as its id", () => {
    const groups = groupByCounter(counters, dishes, {
      includeHiddenCounters: true,
      includeOrphans: true,
    });
    expect(groups.find((group) => group.id === "uncategorized")?.name).toBe("Other");
  });

  test("can leave the Signature dishes to the section that already shows them", () => {
    const groups = groupByCounter(counters, dishes, { excludeFeatured: true });
    const charcoal = groups.find((group) => group.id === "charcoal");

    // The counter is still there with its own heading — its only dish is simply
    // not repeated here, because the Signature strip above already shows it.
    expect(charcoal?.name).toBe("Charcoal Counter");
    expect(charcoal?.items).toHaveLength(0);
    expect(groupedItemCount(groups)).toBe(2);
  });

  test("is empty, not broken, on a menu with no counters yet", () => {
    expect(groupByCounter([], dishes)).toEqual([]);
    expect(groupedItemCount([])).toBe(0);
  });
});

describe("counterChoices", () => {
  test("offers every counter in menu order, including the hidden ones", () => {
    expect(counterChoices(counters).map((choice) => choice.name)).toEqual([
      "Barbecue & Grill",
      "Charcoal Counter",
      "Traditional Handi",
      "Other",
    ]);
  });

  test("orders counters that share a sort order by name, not by accident", () => {
    const tied: CounterLike[] = [
      { id: "b", name: "Biryani", icon: "pot", sortOrder: 0 },
      { id: "a", name: "Angara", icon: "flame", sortOrder: 0 },
    ];
    expect(counterChoices(tied).map((choice) => choice.id)).toEqual(["a", "b"]);
  });
});

/* ----------------------------------------------------------- the writes ---- */

/** The body of one exported function, so a change to another cannot pass. */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect([name, start > -1]).toEqual([name, true]);
  const rest = source.slice(start + 1);
  const next = rest.indexOf("\nexport ");
  return next === -1 ? rest : rest.slice(0, next);
}

describe("the counter writes", () => {
  const db = readFileSync(new URL("../src/lib/db.ts", import.meta.url), "utf8");

  test("moving an item writes the counter and nothing else", () => {
    const body = bodyOf(db, "setDishCategory");

    expect(body).toContain("category_id: categoryId");
    // The whole reason this is a narrow update: re-saving the row could carry a
    // stale photo, price or description over the top of a newer one.
    for (const column of [
      "image",
      "image_path",
      "price_per_plate",
      "description",
      "summary",
      "name",
    ]) {
      expect([column, body.includes(column)]).toEqual([column, false]);
    }
  });

  test("availability and price each write their own column", () => {
    const availability = bodyOf(db, "setDishAvailability");
    expect(availability).toContain("active");
    expect(availability).not.toContain("price_per_plate");

    const price = bodyOf(db, "setDishPrice");
    expect(price).toContain("price_per_plate");
    expect(price).not.toContain("active:");
  });

  test("the leftover bucket cannot be deleted out from under its items", () => {
    const body = bodyOf(db, "deleteCategory");
    expect(body).toContain("UNCATEGORIZED_COUNTER");
    expect(body).toMatch(/throw new Error/);
  });
});

/* -------------------------------------------------------------- the sql ---- */

/**
 * `supabase/counters.sql` touches a live restaurant database. The promises it
 * makes — add what is missing, change no row, delete nothing — are read out of
 * the file here rather than trusted.
 */
describe("the counters migration", () => {
  const sql = readFileSync(
    new URL("../supabase/counters.sql", import.meta.url),
    "utf8",
  );

  test("adds nothing destructive", () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column|constraint)\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
  });

  test("guarantees the home counter a removed counter's items are parked in", () => {
    expect(sql).toContain("insert into public.menu_categories");
    expect(sql).toContain("'uncategorized'");
    expect(sql).toContain("on conflict (id) do nothing");
  });

  test("indexes the one query every counter section runs", () => {
    expect(sql).toMatch(
      /create index if not exists menu_dishes_category_sort_idx\s+on public\.menu_dishes \(category_id, sort_order\)/,
    );
  });

  test("keeps an item from pointing at a counter that is not there", () => {
    expect(sql).toContain("menu_dishes_category_fk");
    expect(sql).toContain("on delete restrict");
    // Only added when every existing row already points at a real counter, so
    // running it against a live project cannot fail half way through.
    expect(sql).toMatch(/raise notice/);
  });

  test("publishes the per-counter overview read-only", () => {
    expect(sql).toMatch(/create or replace view public\.menu_by_counter as/);
    expect(sql).toContain(
      "grant select on public.menu_by_counter to anon, authenticated",
    );
    expect(sql).not.toMatch(/insert into public\.menu_by_counter/i);
  });
});
