#!/usr/bin/env python3
"""
Report duplicate keys inside each locale object in src/i18n/translations.ts.

Usage (from repo root or frontend-next):
  python3 scripts/check_translation_duplicates.py

Exit code 1 if any duplicates found.
Optional: --fix-last (keep last occurrence per key, remove earlier lines — use with care)
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

KEY_RE = re.compile(r"^    ([A-Za-z0-9_]+): ")


def locale_bounds(lines: list[str]) -> dict[str, int]:
    starts: dict[str, int] = {}
    for i, line in enumerate(lines):
        if re.match(r"^  ru: \{$", line):
            starts["ru"] = i
        elif re.match(r"^  kk: \{$", line):
            starts["kk"] = i
        elif re.match(r"^  en: \{$", line):
            starts["en"] = i
        elif re.match(r"^} as const;$", line):
            starts["_end"] = i
    return starts


def find_duplicates(lines: list[str], start: int, end: int) -> list[tuple[str, int, int]]:
    key_lines: dict[str, list[int]] = {}
    for i in range(start + 1, end):
        m = KEY_RE.match(lines[i])
        if m:
            key_lines.setdefault(m.group(1), []).append(i)
    out: list[tuple[str, int, int]] = []
    for k, idxs in sorted(key_lines.items()):
        if len(idxs) > 1:
            for a, b in zip(idxs, idxs[1:]):
                out.append((k, a + 1, b + 1))
    return out


def remove_earlier_duplicates(lines: list[str], start: int, end: int) -> set[int]:
    key_lines: dict[str, list[int]] = {}
    for i in range(start + 1, end):
        m = KEY_RE.match(lines[i])
        if m:
            key_lines.setdefault(m.group(1), []).append(i)
    remove: set[int] = set()
    for idxs in key_lines.values():
        if len(idxs) > 1:
            remove.update(idxs[:-1])
    return remove


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--fix-last",
        action="store_true",
        help="Rewrite file keeping only the last line per duplicate key within each locale",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    path = root / "src" / "i18n" / "translations.ts"
    if not path.exists():
        print("translations.ts not found", file=sys.stderr)
        return 2

    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    bounds = locale_bounds(lines)
    if "ru" not in bounds or "kk" not in bounds or "en" not in bounds:
        print("Could not find ru/kk/en blocks", file=sys.stderr)
        return 2
    end = bounds.get("_end", len(lines))

    total = 0
    for name, s, e in (
        ("ru", bounds["ru"], bounds["kk"]),
        ("kk", bounds["kk"], bounds["en"]),
        ("en", bounds["en"], end),
    ):
        d = find_duplicates(lines, s, e)
        total += len(d)
        if d:
            print(f"\n{name}: {len(d)} duplicate pair(s)")
            for k, l1, l2 in d[:50]:
                print(f"  {k}: lines {l1} and {l2}")
            if len(d) > 50:
                print(f"  ... +{len(d) - 50} more")

    if args.fix_last and total:
        remove: set[int] = set()
        remove |= remove_earlier_duplicates(lines, bounds["ru"], bounds["kk"])
        remove |= remove_earlier_duplicates(lines, bounds["kk"], bounds["en"])
        remove |= remove_earlier_duplicates(lines, bounds["en"], end)
        out = [ln for i, ln in enumerate(lines) if i not in remove]
        path.write_text("\n".join(out) + "\n", encoding="utf-8")
        print(f"\nRemoved {len(remove)} lines (--fix-last). Re-run without --fix to verify.")
        return 0

    if total:
        print(f"\nTotal duplicate pairs: {total}")
        return 1
    print("No duplicate keys per locale.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
