import { supabase } from "@/lib/supabase";

/**
 * Find one transaction by its reference code, for the staff and admin desks.
 *
 * A guest quotes the code from their confirmation — it is on the screen, in the
 * clipboard beside it, and on the WhatsApp message the desk reads out — so
 * turning a code into a record has to be one keystroke at the counter. The call
 * goes to `tribe_find_by_reference()`: a `security definer` function that reads
 * all three transaction tables in one statement and refuses anyone who is not
 * signed in as staff, so a guessed code cannot pull another guest's booking out
 * of the database.
 *
 * The call is allowed to fail quietly. A database that has not run that
 * function yet, or a desk working from a bundle cached before it existed, falls
 * back to the records the desk already holds over the realtime channel — see
 * `matchLive()` in RecordsDesk. The box keeps working either way, and a
 * database error never becomes a message the staff cannot act on.
 */

/** The three kinds of transaction a code can belong to. */
export type DeskRecordKind = "reservation" | "preorder" | "delivery";

export type DeskRecord = {
  kind: DeskRecordKind;
  reference: string;
  name: string;
  phone: string;
  status: string;
  /** Reservations: the sitting. Pre-orders: the pickup slot. */
  when?: string;
  /** Party size and seating, the dish, or the delivery area. */
  detail?: string;
  /** Delivery orders only — the total the server priced. */
  total?: number;
};

/**
 * The code as the database mints it: upper case, no spaces. A guest reading
 * `JNX 7K4P9Q` off a phone, or typing it with the hyphen missing, still lands
 * on the same record.
 */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function findRecordByCode(
  raw: string,
): Promise<DeskRecord | null> {
  const code = normalizeCode(raw);
  if (code.length < 4) return null;

  const { data, error } = await supabase.rpc("tribe_find_by_reference", {
    p_reference: code,
  });
  // Missing function, refused call, no row — all "not found here", and the
  // caller's own records decide the answer.
  if (error || !data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  const kind = row.kind;
  if (kind !== "reservation" && kind !== "preorder" && kind !== "delivery") {
    return null;
  }

  return {
    kind,
    reference: typeof row.reference === "string" ? row.reference : code,
    name: typeof row.name === "string" ? row.name : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    status: typeof row.status === "string" ? row.status : "",
    when: typeof row.when === "string" ? row.when : undefined,
    detail: typeof row.detail === "string" ? row.detail : undefined,
    total: typeof row.total === "number" ? row.total : undefined,
  };
}
