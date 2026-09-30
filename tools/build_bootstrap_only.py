#!/usr/bin/env python3
"""Emit a minimal SQL file with only what is needed to create the first admin.

The full staff-auth migration is 29 KB and installs nine functions. Only two of
them are on the critical path for a locked-out owner, and they are enough to
replace the mail-dependent signup entirely:

    staff_ensure_auth_user   — creates the Auth identity, confirmed
    admin_bootstrap_owner    — creates the FIRST admin, guarded

This is the same SQL, lifted from supabase/staff-auth.sql, so the two cannot
disagree. Anything else the Team screen needs is still installed by the full
file afterwards.
"""
import re
import sys

sys.path.insert(0, "tools")
from split_fns import load, block  # noqa: E402

SOURCE = "supabase/staff-auth.sql"
OUT = "supabase/first-admin.sql"

HEADER = """\
-- ============================================================================
--  Junoon — first admin only
--
--  A cut-down copy of supabase/staff-auth.sql, containing only the two
--  functions needed to create the first administrator. Same SQL, same
--  definitions — this file is generated from that one, so they cannot drift.
--
--  WHY A SHORTER FILE
--
--  Setting the restaurant up was blocked by Supabase's email rate limit, because
--  the browser created the account with `auth.signUp()`, which sends a
--  confirmation mail. Once the hourly quota is spent, that call is refused with
--  "Too many attempts just now" — a complaint about the quota, on an address
--  that was never the problem.
--
--  These two functions create the account in Postgres instead, already
--  confirmed, and send nothing at all:
--
--    staff_ensure_auth_user  — find the Auth identity for an address, or create
--                              it here with a bcrypt-hashed password. Revoked
--                              from PUBLIC and granted to no role, so it is only
--                              reachable from inside the function below.
--    admin_bootstrap_owner   — create the FIRST admin. It cannot ask "is the
--                              caller an admin" because there is none yet, so it
--                              asks the only question that matters: does this
--                              restaurant already have an active admin? The
--                              moment one exists, this refuses — the window is
--                              shut in the database, not merely hidden in the UI.
--
--  It also refuses an account already on the team as staff, so it is never a
--  route from staff to admin. Nothing outside `auth.users`, `auth.identities`,
--  `staff_members` and `staff_member_roles` is touched.
--
--  AFTER THIS, STILL RUN supabase/staff-auth.sql
--
--  It installs the remaining seven functions the Team screen needs: adding a
--  member, setting a role, activating and removing, deleting an account,
--  confirming an address by hand and repairing roles. It does not change the
--  owner you create here, and re-running it is safe.
-- ============================================================================

--  pgcrypto supplies bcrypt (crypt / gen_salt) and gen_random_uuid(). Supabase
--  installs it into the `extensions` schema; the exception handler covers a
--  project where it is already there under a different name.
do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then
  null; -- already installed elsewhere; the qualified calls below still resolve
end $$;
"""

FOOTER = """
-- ============================================================================
--  Done. The setup card on the website now creates the first admin through this
--  function: no confirmation mail, no rate limit, no waiting.
--
--  After signing in, run supabase/staff-auth.sql for the rest of the Team
--  screen. To close the setup door for good, once your admin exists:
--
--    revoke execute on function public.admin_bootstrap_owner(text, text, text) from anon;
-- ============================================================================
"""

GRANTS = {
    "staff_ensure_auth_user": (
        "  --  Not callable by anyone. It is revoked from PUBLIC and granted to no\n"
        "  --  role, so the only way in is from inside the function below.\n"
        "revoke all on function public.staff_ensure_auth_user(text, text, text) from public;\n"
    ),
    "admin_bootstrap_owner": (
        "revoke all on function public.admin_bootstrap_owner(text, text, text) from public;\n"
        "grant execute on function public.admin_bootstrap_owner(text, text, text) to anon, authenticated;\n"
    ),
}

FUNCTIONS = ["staff_ensure_auth_user", "admin_bootstrap_owner"]


def without_grants(text: str) -> str:
    """Drop the revoke/grant lines a lifted block already ends with.

    The rule line is dropped too: the caller writes its own, and the lifted
    block already begins with one.
    """
    kept = [
        line
        for line in text.split("\n")
        if not re.match(r"^(revoke|grant)\s+.*\bon function\b", line.strip())
    ]
    while kept and re.match(r"^--\s*={10,}\s*$", kept[0].strip()):
        kept.pop(0)
    return "\n".join(kept).rstrip()


def main() -> None:
    lines = load(SOURCE)
    parts = [HEADER]

    for name in FUNCTIONS:
        parts.append("-- " + "=" * 76 + "\n" + without_grants(block(lines, name)) + "\n")
        parts.append(GRANTS[name])

    text = "\n".join(parts).rstrip() + "\n" + FOOTER
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"wrote {OUT}: {len(text)} chars")


if __name__ == "__main__":
    main()
