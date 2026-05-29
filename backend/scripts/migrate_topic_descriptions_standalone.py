#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backfill topic descriptions (theory) for Python (course 1) and Web (course 2).
Content from topic_theory_content.py (Markdown). Run from backend: python3 migrate_topic_descriptions_standalone.py
"""
import os
import sqlite3
from pathlib import Path

from topic_theory_content import DESCRIPTIONS_COURSE_1, DESCRIPTIONS_COURSE_2

db_path = Path(__file__).parent / "education.db"
if not db_path.exists():
    db_url = os.getenv("DATABASE_URL", "sqlite:///./education.db")
    if "sqlite" in db_url:
        raw = db_url.replace("sqlite:///", "").strip("/")
        db_path = (Path(__file__).parent / raw).resolve()
if not db_path.exists():
    print("DB not found at", db_path)
    exit(1)

conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='course_topics'")
if not cur.fetchone():
    print("Table course_topics not found.")
    conn.close()
    exit(1)

updated = 0
for course_id, descriptions in [(1, DESCRIPTIONS_COURSE_1), (2, DESCRIPTIONS_COURSE_2)]:
    cur.execute(
        "SELECT id, order_number, title FROM course_topics WHERE course_id = ? ORDER BY order_number",
        (course_id,),
    )
    rows = cur.fetchall()
    for row in rows:
        idx = row["order_number"] - 1
        if idx < 0 or idx >= len(descriptions):
            continue
        # Always update so that new expanded Markdown content is applied
        cur.execute(
            "UPDATE course_topics SET description = ? WHERE id = ?",
            (descriptions[idx], row["id"]),
        )
        updated += 1
        print(f"Updated topic id={row['id']} (course {course_id}, order {row['order_number']}): {row['title'][:40]}...")

conn.commit()
conn.close()
print(f"Done. Updated {updated} topic descriptions. Refresh the topic pages to see theory.")
