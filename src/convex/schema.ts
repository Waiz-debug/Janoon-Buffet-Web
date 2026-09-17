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

/**
 * Convex holds this project's account system and nothing else.
 *
 * There used to be a second, complete restaurant dataset here — menu
 * categories, dishes, site media, promotions, reservations, orders and
 * deliveries — with its own queries and mutations. None of it was ever called:
 * the app reaches Supabase directly (see src/lib/db.ts), which is also where
 * the staff roles, the row level policies that enforce them and the
 * server-priced guest writes live. Two implementations of the same tables meant
 * two answers to "what is the real total on this order" and two places to
 * secure, so the unused half was deleted and Supabase is the single source of
 * truth for every restaurant record.
 *
 * What remains is the template's sign-in (`api.users.currentUser` is the only
 * Convex function the app calls — see src/hooks/use-auth.ts), which the
 * Dashboard and the site header read.
 */
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

    // add other tables here
  },
  {
    schemaValidation: false,
  },
);

export default schema;
