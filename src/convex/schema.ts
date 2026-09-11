import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// reservation lifecycle used by the buffet bookings desk
export const RESERVATION_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SEATED: "seated",
  CANCELLED: "cancelled",
} as const;

export const reservationStatusValidator = v.union(
  v.literal(RESERVATION_STATUSES.PENDING),
  v.literal(RESERVATION_STATUSES.CONFIRMED),
  v.literal(RESERVATION_STATUSES.SEATED),
  v.literal(RESERVATION_STATUSES.CANCELLED),
);
export type ReservationStatus = Infer<typeof reservationStatusValidator>;

export const seatingValidator = v.union(
  v.literal("outdoor"),
  v.literal("indoor"),
);
export type Seating = Infer<typeof seatingValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Buffet table reservations submitted from the public booking form.
    reservations: defineTable({
      name: v.string(),
      phone: v.string(),
      partySize: v.number(),
      /** Local service date, ISO `YYYY-MM-DD`. */
      date: v.string(),
      /** Local service time, 24h `HH:mm`. */
      time: v.string(),
      seating: seatingValidator,
      notes: v.optional(v.string()),
      status: reservationStatusValidator,
      reference: v.string(),
    })
      .index("by_date", ["date"])
      .index("by_status", ["status"])
      .index("by_reference", ["reference"]),

    // add other tables here

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
