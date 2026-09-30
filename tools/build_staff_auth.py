#!/usr/bin/env python3
"""Assemble supabase/staff-auth.sql from schema.sql's own function bodies.

Every function body is lifted verbatim out of supabase/schema.sql, so the three
files that ship these definitions can never drift: this script has no SQL in it
except the header, the pgcrypto block and the grant lines, and the bodies it
copies are the ones the app already runs.

Run from the project root:  python3 tools/build_staff_auth.py
"""
import re
import sys

sys.path.insert(0, "tools")
from split_fns import load, block  # noqa: E402

SCHEMA = "supabase/schema.sql"
OUT = "supabase/staff-auth.sql"

HEADER = """\
-- ============================================================================
--  Junoon — staff authentication migration
--
--  Run this AFTER supabase/schema.sql (or supabase/fix-admin-recovery.sql).
--  It is idempotent: re-running it changes nothing and deletes nothing.
--
--  WHY THIS FILE EXISTS
--
--  Setting the restaurant up must not depend on an email being deliverable.
--  The browser used to create the first admin with `auth.signUp()`, which makes
--  Supabase send a confirmation mail — and that call is refused with
--  "Too many attempts just now" once the project's hourly mail quota is spent.
--  The address is fine; the mail quota is the problem, and it recovers on its
--  own schedule rather than on ours. So the whole email step is gone from the
--  setup path:
--
--    1. staff_ensure_auth_user(email, password, display_name)
--       Find the Supabase Auth identity for an address, or create it here, in
--       Postgres, already confirmed and with a bcrypt-hashed password. Also
--       writes the matching `auth.identities` row, without which GoTrue refuses
--       the account at sign-in. Revoked from PUBLIC and granted to no role, so
--       it is only ever reached from inside the two functions below — which
--       check their own guards first.
--
--    2. admin_bootstrap_owner(email, password, display_name)
--       Create the FIRST administrator. It cannot ask "is the caller an admin"
--       because there is none yet, so it asks the one question that matters:
--       does this restaurant already have an active admin? While the answer is
--       no, setup is offered and this function performs it. The moment an admin
--       exists, both the card and this function refuse — the window is shut in
--       the database, not merely hidden in the UI.
--
--    3. admin_upsert_staff_account(email, password, display_name, role)
--       The single call the Team screen makes for everybody after the owner:
--       reuse or create the identity, confirm the address, write exactly one
--       `staff_members` row under that identity's UUID, and maintain
--       `staff_member_roles`. The older admin_add_staff() only granted a role to
--       an account that already existed, which left the browser to create the
--       Auth user first — and with "Confirm email" on, that account could not
--       sign in.
--
--  Plus the recovery and team-management functions the Team screen needs:
--  admin_confirm_staff_email, admin_delete_staff_account,
--  admin_sync_staff_roles, admin_set_staff_active, admin_remove_staff and
--  admin_set_staff_role — the last four re-stated here with their last-admin
--  guards, so this file alone leaves the Team screen complete.
--
--  WHAT THIS FILE DOES NOT TOUCH
--
--  Nothing outside `auth.users`, `auth.identities`, `public.staff_members` and
--  `public.staff_member_roles`. No menu, categories, reservations, pre-orders,
--  deliveries, promotions, photos or demo content is read or written here, and
--  no row in any of those tables is deleted. Existing staff and admin accounts
--  are never removed — `create or replace` only changes function definitions.
--
--  SECURITY
--
--  • Every function is SECURITY DEFINER. All of them but admin_bootstrap_owner
--    refuse any caller whose own `staff_members` row is not an active admin.
--    That check runs in Postgres, so hiding the Team screen from a staff
--    account is a convenience and not the boundary.
--  • admin_bootstrap_owner is open to `anon` because the person setting the
--    restaurant up has no session yet. It grants nothing and creates no second
--    admin once one exists, and it refuses an account that is already on the
--    team as staff, so it is never a route from staff to admin. Once your own
--    admin exists you can close it for good:
--        revoke execute on function public.admin_bootstrap_owner(text, text, text) from anon;
--  • No service-role key appears anywhere, in this file or in the app. One in a
--    web page would hand every visitor the ability to rewrite any account.
--  • A password is hashed with bcrypt inside this function and written only as
--    `encrypted_password` — the same column Supabase Auth keeps. The plaintext
--    is never stored in any table, never logged, and never returned. There is
--    no password column in `staff_members` and none is added.
--  • A person who already has an account keeps their existing password and
--    UUID: the identity is looked up by address and reused, never created a
--    second time.
--
--  TESTING NOTE
--
--  The two functions that write to `auth.users` do so by hand, which is the
--  part of this file worth trying on a throwaway address first:
--      select public.admin_bootstrap_owner('you@example.com', 'a-strong-password', null);
--  If your Supabase version has changed those tables' columns, that call is
--  where it shows — and the dashboard's Authentication → Users screen is the
--  fallback that always works.
-- ============================================================================

--  pgcrypto supplies bcrypt (crypt / gen_salt) and gen_random_uuid(). Supabase
--  installs it into the `extensions` schema; `if not exists` keeps this safe to
--  re-run, and the exception handler covers a project where it is already there
--  under a different name.
do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then
  null; -- already installed elsewhere; the qualified calls below still resolve
end $$;
"""

FOOTER = """
-- ============================================================================
--  Done. Nothing above read or wrote a menu, category, reservation, pre-order,
--  delivery, promotion or media row, and nothing deleted an existing account.
--
--  After running this, open the app signed out and use the "Set up the admin
--  account" card: the account is created, confirmed and signed in to in one
--  step, with no confirmation mail involved. After that, Admin → Team → Add a
--  team member, where each new member signs in at /staff with the password you
--  set.
-- ============================================================================
"""

# (function name, grant signature, roles granted to) — in the order they ship.
FUNCTIONS = [
    ("staff_ensure_auth_user", "text, text, text", None),
    ("admin_bootstrap_owner", "text, text, text", "anon, authenticated"),
    ("admin_upsert_staff_account", "text, text, text, text", "authenticated"),
    ("admin_confirm_staff_email", "text", "authenticated"),
    ("admin_delete_staff_account", "uuid", "authenticated"),
    ("admin_sync_staff_roles", "", "authenticated"),
    ("admin_set_staff_active", "uuid, boolean", "authenticated"),
    ("admin_remove_staff", "uuid", "authenticated"),
    ("admin_set_staff_role", "uuid, text", "authenticated"),
]

RULE = "-- " + "=" * 76


def without_grants(text: str) -> str:
    """Drop the revoke/grant lines a lifted block already ends with.

    They are re-stated below from the table, so leaving the originals in place
    would write each pair twice.
    """
    kept = [
        line
        for line in text.split("\n")
        if not re.match(r"^(revoke|grant)\s+.*\bon function\b", line.strip())
    ]
    return "\n".join(kept).rstrip()


def main() -> None:
    lines = load(SCHEMA)
    parts = [HEADER]

    for name, signature, roles in FUNCTIONS:
        parts.append(RULE + "\n" + without_grants(block(lines, name)) + "\n")
        # staff_ensure_auth_user is granted to no role at all: it exists only to
        # be called from inside the two functions that guard themselves.
        if roles is None:
            parts.append(
                f"--  Not callable by anyone. It is revoked from PUBLIC and granted to\n"
                f"--  no role, so the only way in is from inside the functions above.\n"
                f"revoke all on function public.{name}({signature}) from public;\n"
            )
            continue
        parts.append(
            f"revoke all on function public.{name}({signature}) from public;\n"
            f"grant execute on function public.{name}({signature}) to {roles};\n"
        )

    text = "\n".join(parts).rstrip() + "\n" + FOOTER
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"wrote {OUT}: {len(text)} chars")


if __name__ == "__main__":
    main()
