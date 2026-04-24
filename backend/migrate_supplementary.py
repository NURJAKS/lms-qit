"""
Migration: Add is_supplementary column to teacher_assignments and teacher_materials tables.
Supplementary items are additional study materials that are NOT graded and NOT required for progress.
"""

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent / "education.db"


def migrate():
    if not DB_PATH.exists():
        print(f"[ERROR] Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    changes = []

    # --- teacher_assignments ---
    cur.execute("PRAGMA table_info(teacher_assignments)")
    cols = {row[1] for row in cur.fetchall()}

    if "is_supplementary" not in cols:
        cur.execute(
            "ALTER TABLE teacher_assignments ADD COLUMN is_supplementary BOOLEAN NOT NULL DEFAULT 0"
        )
        changes.append("teacher_assignments.is_supplementary")
        print("[OK] Added teacher_assignments.is_supplementary")
    else:
        print("[SKIP] teacher_assignments.is_supplementary already exists")

    # --- teacher_materials ---
    cur.execute("PRAGMA table_info(teacher_materials)")
    cols = {row[1] for row in cur.fetchall()}

    if "is_supplementary" not in cols:
        cur.execute(
            "ALTER TABLE teacher_materials ADD COLUMN is_supplementary BOOLEAN NOT NULL DEFAULT 0"
        )
        changes.append("teacher_materials.is_supplementary")
        print("[OK] Added teacher_materials.is_supplementary")
    else:
        print("[SKIP] teacher_materials.is_supplementary already exists")

    conn.commit()
    conn.close()

    if changes:
        print(f"\n[DONE] Migration complete. Added columns: {', '.join(changes)}")
    else:
        print("\n[DONE] Nothing to migrate — all columns already exist.")


if __name__ == "__main__":
    migrate()
