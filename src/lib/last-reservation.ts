/**
 * The booking itself lives in the database, so it always survives a refresh.
 * What cannot be stored on the server is *which* booking belongs to the person
 * in front of us — that is a device concern, so a small pointer (reference +
 * phone) is kept in `sessionStorage` and the record is re-fetched from the
 * database on first render.
 *
 * The pointer is a convenience, never a source of truth: the record is only
 * ever displayed from `lookup_reservation()`, which re-checks the reference
 * *and* the phone in Postgres. And because the phone number is personal data,
 * it is kept per tab rather than on the device: closing the tab is enough to
 * leave nothing behind, and a guest returning later types both values again.
 */

const STORAGE_KEY = "junoon:last-reservation";

export type ReservationPointer = {
  reference: string;
  /** Stored exactly as typed, so the lookup can normalise it either way. */
  phone: string;
};

export function saveReservationPointer(pointer: ReservationPointer) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pointer));
  } catch {
    // Private browsing or storage disabled — the booking still exists server-side.
  }
}

export function readReservationPointer(): ReservationPointer | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
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
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
