/**
 * The booking itself lives in the Convex database, so it always survives a
 * refresh. What cannot be stored on the server is *which* booking belongs to
 * the person in front of us — that is a device concern, so we keep a small
 * pointer (reference + phone) in localStorage and re-fetch the record from the
 * database on first render. Nothing sensitive is duplicated: only the two
 * values the guest already typed are kept, and they are the same two values
 * required by the public lookup query.
 */

const STORAGE_KEY = "junoon:last-reservation";

export type ReservationPointer = {
  reference: string;
  /** Stored exactly as typed, so the lookup can normalise it either way. */
  phone: string;
};

export function saveReservationPointer(pointer: ReservationPointer) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pointer));
  } catch {
    // Private browsing or storage disabled — the booking still exists server-side.
  }
}

export function readReservationPointer(): ReservationPointer | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { reference, phone } = parsed as Partial<ReservationPointer>;
    if (typeof reference !== "string" || typeof phone !== "string") return null;
    if (!reference.trim() || !phone.trim()) return null;
    return { reference: reference.trim(), phone: phone.trim() };
  } catch {
    return null;
  }
}

export function clearReservationPointer() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
