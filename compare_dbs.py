import os
import sqlite3
from sqlalchemy import create_engine, text

# SQLite connection
sqlite_path = "/root/projects/lms-qit/backend/education.db"
sqlite_conn = sqlite3.connect(sqlite_path)
sqlite_c = sqlite_conn.cursor()

# PostgreSQL connection
db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres_password_123@db:5432/education_platform")
engine = create_engine(db_url)

print("=== START DATABASE COMPARISON (SQLite vs PostgreSQL) ===")

# Helper to execute query on PostgreSQL
def pg_query(q):
    with engine.connect() as conn:
        return conn.execute(text(q)).fetchall()

# Helper to execute query on SQLite
def lite_query(q):
    sqlite_c.execute(q)
    return sqlite_c.fetchall()

# 1. Compare Course counts
lite_courses = lite_query("SELECT id, title FROM courses ORDER BY id;")
pg_courses = pg_query("SELECT id, title FROM courses ORDER BY id;")
lite_courses_dict = {row[0]: row[1] for row in lite_courses}
pg_courses_dict = {row[0]: row[1] for row in pg_courses}

print(f"\n1. Courses Count: SQLite={len(lite_courses_dict)}, PostgreSQL={len(pg_courses_dict)}")
missing_courses = set(lite_courses_dict.keys()) - set(pg_courses_dict.keys())
if missing_courses:
    print(f"   Missing Courses in PostgreSQL: {[{cid: lite_courses_dict[cid]} for cid in missing_courses]}")
else:
    print("   All courses exist in PostgreSQL.")

# 2. Compare Course Modules
lite_modules = lite_query("SELECT id, title, course_id FROM course_modules;")
pg_modules = pg_query("SELECT id, title, course_id FROM course_modules;")
lite_mod_dict = {row[0]: (row[1], row[2]) for row in lite_modules}
pg_mod_dict = {row[0]: (row[1], row[2]) for row in pg_modules}

missing_mods = set(lite_mod_dict.keys()) - set(pg_mod_dict.keys())
print(f"\n2. Modules Count: SQLite={len(lite_mod_dict)}, PostgreSQL={len(pg_mod_dict)}")
if missing_mods:
    print("   Missing Modules in PostgreSQL:")
    for mid in sorted(missing_mods):
        mtitle, cid = lite_mod_dict[mid]
        print(f"   - Module ID {mid}: '{mtitle}' for Course ID {cid} ('{lite_courses_dict.get(cid, 'Unknown')}')")
else:
    print("   All modules exist in PostgreSQL.")

# 3. Compare Course Topics
lite_topics = lite_query("SELECT id, title, course_id, module_id FROM course_topics;")
pg_topics = pg_query("SELECT id, title, course_id, module_id FROM course_topics;")
lite_top_dict = {row[0]: (row[1], row[2], row[3]) for row in lite_topics}
pg_top_dict = {row[0]: (row[1], row[2], row[3]) for row in pg_topics}

missing_topics = set(lite_top_dict.keys()) - set(pg_top_dict.keys())
print(f"\n3. Topics Count: SQLite={len(lite_top_dict)}, PostgreSQL={len(pg_top_dict)}")
if missing_topics:
    print("   Missing Topics in PostgreSQL:")
    for tid in sorted(missing_topics):
        ttitle, cid, mid = lite_top_dict[tid]
        # Ignore dummy/orphan topics from course 1 if we decided they are not needed, but list them
        print(f"   - Topic ID {tid}: '{ttitle}' for Course ID {cid} ('{lite_courses_dict.get(cid, 'Unknown')}'), Module ID {mid}")
else:
    print("   All topics exist in PostgreSQL.")

# 4. Compare Tests
lite_tests = lite_query("SELECT id, title, course_id, topic_id FROM tests;")
pg_tests = pg_query("SELECT id, title, course_id, topic_id FROM tests;")
lite_test_dict = {row[0]: (row[1], row[2], row[3]) for row in lite_tests}
pg_test_dict = {row[0]: (row[1], row[2], row[3]) for row in pg_tests}

missing_tests = set(lite_test_dict.keys()) - set(pg_test_dict.keys())
print(f"\n4. Tests Count: SQLite={len(lite_test_dict)}, PostgreSQL={len(pg_test_dict)}")
if missing_tests:
    print("   Missing Tests in PostgreSQL:")
    for tid in sorted(missing_tests):
        title, cid, topic_id = lite_test_dict[tid]
        print(f"   - Test ID {tid}: '{title}' for Course ID {cid} ('{lite_courses_dict.get(cid, 'Unknown')}'), Topic ID {topic_id}")
else:
    print("   All tests exist in PostgreSQL.")

# 5. Compare Test Questions count
lite_questions_count = lite_query("SELECT COUNT(*) FROM test_questions;")[0][0]
pg_questions_count = pg_query("SELECT COUNT(*) FROM test_questions;")[0][0]
print(f"\n5. Test Questions Count: SQLite={lite_questions_count}, PostgreSQL={pg_questions_count}")

# 6. Compare Shop items
lite_shop = lite_query("SELECT id, name FROM shop_items;")
pg_shop = pg_query("SELECT id, name FROM shop_items;")
lite_shop_dict = {row[0]: row[1] for row in lite_shop}
pg_shop_dict = {row[0]: row[1] for row in pg_shop}

missing_shop = set(lite_shop_dict.keys()) - set(pg_shop_dict.keys())
print(f"\n6. Shop Items Count: SQLite={len(lite_shop_dict)}, PostgreSQL={len(pg_shop_dict)}")
if missing_shop:
    print("   Missing Shop Items in PostgreSQL:")
    for sid in sorted(missing_shop):
        print(f"   - Item ID {sid}: '{lite_shop_dict[sid]}'")
else:
    print("   All shop items exist in PostgreSQL.")

# 7. Compare Course Categories
lite_cats = lite_query("SELECT id, name FROM course_categories;")
pg_cats = pg_query("SELECT id, name FROM course_categories;")
lite_cats_dict = {row[0]: row[1] for row in lite_cats}
pg_cats_dict = {row[0]: row[1] for row in pg_cats}

missing_cats = set(lite_cats_dict.keys()) - set(pg_cats_dict.keys())
print(f"\n7. Course Categories Count: SQLite={len(lite_cats_dict)}, PostgreSQL={len(pg_cats_dict)}")
if missing_cats:
    print("   Missing Categories in PostgreSQL:")
    for cid in sorted(missing_cats):
        print(f"   - Category ID {cid}: '{lite_cats_dict[cid]}'")
else:
    print("   All course categories exist in PostgreSQL.")

sqlite_conn.close()
