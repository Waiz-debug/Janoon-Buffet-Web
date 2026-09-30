#!/usr/bin/env python3
"""Extract `create or replace function` bodies from a SQL file, by name.

Deterministic, line based: find the line that starts the definition, then scan
forward to the first line whose stripped content is exactly `end $$;`. That is
the only terminator these files use, and it is never nested.
"""
import re
import sys


def load(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read().split("\n")


def bodies(lines):
    """Return {function_name: body_lines} for every function definition."""
    out = {}
    i = 0
    while i < len(lines):
        m = re.match(
            r"create or replace function (?:public\.)?([a-z_][a-z0-9_]*)\s*\(",
            lines[i].strip(),
            re.IGNORECASE,
        )
        if not m:
            i += 1
            continue
        name = m.group(1)
        j = i
        while j < len(lines) and lines[j].strip() != "end $$;":
            j += 1
        if j >= len(lines):
            raise SystemExit(f"unterminated function: {name}")
        out[name] = "\n".join(lines[i : j + 1]).strip()
        i = j + 1
    return out


def block(lines, name):
    """The full slice for a function: leading comment through trailing grants.

    Starts at the nearest preceding `-- ===` banner (or the line above the
    definition when there is no banner) and runs to the last consecutive
    revoke/grant line after the terminator.
    """
    start = None
    for i, line in enumerate(lines):
        if re.match(
            r"create or replace function (?:public\.)?" + name + r"\s*\(",
            line.strip(),
            re.IGNORECASE,
        ):
            start = i
            break
    if start is None:
        raise SystemExit(f"function not found: {name}")

    begin = start
    while begin > 0 and (
        lines[begin - 1].strip().startswith("--")
        or lines[begin - 1].strip().startswith("language")
        or lines[begin - 1].strip() == ""
    ):
        if lines[begin - 1].strip().startswith("--  " + name):
            break
        begin -= 1
        if start - begin > 80:
            break

    end = start
    while lines[end].strip() != "end $$;":
        end += 1
    end += 1
    while end < len(lines):
        nxt = lines[end].strip()
        if nxt.startswith(("revoke ", "grant ")) or nxt == "":
            end += 1
            continue
        break
    return "\n".join(lines[begin:end]).strip()


if __name__ == "__main__":
    mode, path = sys.argv[1], sys.argv[2]
    if mode == "names":
        for n in sorted(bodies(load(path))):
            print(n)
    elif mode == "show":
        print(block(load(path), sys.argv[3]))
