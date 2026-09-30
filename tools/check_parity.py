#!/usr/bin/env python3
"""Verify the three staff SQL files carry identical definitions of the nine
staff-auth functions, and that staff-auth.sql defines nothing else."""
import sys

sys.path.insert(0, "tools")
from split_fns import load, bodies  # noqa: E402

FILES = ["schema.sql", "fix-admin-recovery.sql", "staff-auth.sql"]
TARGETS = [
    "staff_ensure_auth_user",
    "admin_bootstrap_owner",
    "admin_upsert_staff_account",
    "admin_confirm_staff_email",
    "admin_delete_staff_account",
    "admin_sync_staff_roles",
    "admin_set_staff_active",
    "admin_remove_staff",
    "admin_set_staff_role",
]

parsed = {f: bodies(load(f"supabase/{f}")) for f in FILES}

ok = True
for name in TARGETS:
    got = [parsed[f].get(name) for f in FILES]
    same = all(g is not None for g in got) and got[0] == got[1] == got[2]
    ok = ok and same
    print(f"{'OK  ' if same else 'DIFF'} {name:32} " + ",".join(
        "present" if g else "MISSING" for g in got))

strays = sorted(set(parsed["staff-auth.sql"]) - set(TARGETS))
if strays:
    ok = False
    print(f"\nUNEXPECTED in staff-auth.sql: {strays}")

print("\nALL IDENTICAL:", ok)
sys.exit(0 if ok else 1)
