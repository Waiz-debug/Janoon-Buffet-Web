import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { RESERVATION_STATUSES, reservationStatusValidator } from "./schema";

/** Reservation reference alphabet — no ambiguous 0/O/1/I characters. */
const REFERENCE_ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function makeReference() {
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += REFERENCE_ALPHABET[
      Math.floor(Math.random() * REFERENCE_ALPHABET.length)
    ];
  }
  return `TT-${code}`;
}

/**
 * Look up a booking using the short reference plus the phone number the guest
 * booked with. Only the last ten digits are compared, so `0300 1234567` and
 * `+92 300 1234567` both resolve.
 */
async function findReservation(ctx: QueryCtx | MutationCtx, reference: string, phone: string) {
  const code = reference.trim().toUpperCase();
  const digits = phone.replace(/[^\d]/g, "");
  if (!code || digits.length < 6) return null;

  const reservation = await ctx.db
    .query("reservations")
    .withIndex("by_reference", (q) => q.eq("reference", code))
    .unique();

  if (!reservation) return null;
  if (reservation.phone.slice(-10) !== digits.slice(-10)) return null;
  return reservation;
}

/**
 * Staff members are signed-in members of the restaurant team. Anonymous
 * "guest" sessions are rejected so the bookings desk stays private.
 */
async function requireStaff(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Sign in to manage buffet reservations.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.isAnonymous) {
    throw new Error("Only restaurant staff can view the reservations desk.");
  }
  return userId;
}

/** Accepts `0300-1234567`, `+92 300 1234567`, etc. */
function normalisePhone(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Enter a valid phone number so we can confirm your table.");
  }
  return digits;
}

function validateDate(raw: string) {
  if (!DATE_PATTERN.test(raw)) {
    throw new Error("Choose a valid reservation date.");
  }
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  if (raw < todayKey) {
    throw new Error("That date has already passed — pick today or later.");
  }
  return raw;
}

/** Public booking form endpoint. Families can reserve ahead without an account. */
export const create = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    partySize: v.number(),
    date: v.string(),
    time: v.string(),
    seating: v.union(v.literal("outdoor"), v.literal("indoor")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("Please tell us the name for the booking.");
    }

    const partySize = Math.floor(args.partySize);
    if (!Number.isFinite(partySize) || partySize < 1 || partySize > 30) {
      throw new Error("Party size must be between 1 and 30 guests.");
    }
    if (partySize > 12) {
      throw new Error(
        "Groups larger than 12 are seated by our floor team — please call 0322 8543333.",
      );
    }

    if (!TIME_PATTERN.test(args.time)) {
      throw new Error("Choose a valid arrival time.");
    }

    const reservation = {
      name,
      phone: normalisePhone(args.phone),
      partySize,
      date: validateDate(args.date),
      time: args.time,
      seating: args.seating,
      notes: args.notes?.trim() ? args.notes.trim().slice(0, 300) : undefined,
      status: RESERVATION_STATUSES.PENDING,
    };

    // Retry on the rare chance the short reference collides.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = makeReference();
      const clash = await ctx.db
        .query("reservations")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .unique();
      if (clash) continue;

      const id = await ctx.db.insert("reservations", { ...reservation, reference });
      return { id, reference };
    }

    throw new Error("Could not create your booking. Please try again.");
  },
});

/**
 * Public booking lookup. A guest signs in with nothing but their reference
 * code and phone number, and sees only their own reservation.
 */
export const findByReference = query({
  args: { reference: v.string(), phone: v.string() },
  handler: async (ctx, args) => {
    return await findReservation(ctx, args.reference, args.phone);
  },
});

/** A guest cancels their own booking with the same reference and phone pair. */
export const cancelByGuest = mutation({
  args: { reference: v.string(), phone: v.string() },
  handler: async (ctx, args) => {
    const reservation = await findReservation(ctx, args.reference, args.phone);
    if (!reservation) {
      throw new Error(
        "We could not find a booking with that reference and phone number.",
      );
    }
    if (reservation.status === RESERVATION_STATUSES.CANCELLED) {
      return { alreadyCancelled: true };
    }
    if (reservation.status === RESERVATION_STATUSES.SEATED) {
      throw new Error(
        "This table has already been seated. Please call 0322 8543333 and our team will help.",
      );
    }

    await ctx.db.patch(reservation._id, {
      status: RESERVATION_STATUSES.CANCELLED,
    });
    return { alreadyCancelled: false };
  },
});

/** Reservations desk feed — newest service dates first. Staff only. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const reservations = await ctx.db.query("reservations").collect();
    return reservations.sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
    );
  },
});

/** Live counts for the reservations desk header. Staff only. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;

    const reservations = await ctx.db.query("reservations").collect();
    const todays = reservations.filter(
      (r) => r.date === todayKey && r.status !== RESERVATION_STATUSES.CANCELLED,
    );

    return {
      todayKey,
      todayBookings: todays.length,
      todayGuests: todays.reduce((sum, r) => sum + r.partySize, 0),
      pending: reservations.filter((r) => r.status === RESERVATION_STATUSES.PENDING)
        .length,
      upcoming: reservations.filter(
        (r) =>
          r.date >= todayKey &&
          r.status !== RESERVATION_STATUSES.CANCELLED &&
          r.status !== RESERVATION_STATUSES.SEATED,
      ).length,
      total: reservations.length,
    };
  },
});

/** Move a booking through the service flow. Staff only. */
export const updateStatus = mutation({
  args: {
    id: v.id("reservations"),
    status: reservationStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("That reservation no longer exists.");
    }
    await ctx.db.patch(args.id, { status: args.status });
    return { id: args.id, status: args.status };
  },
});
