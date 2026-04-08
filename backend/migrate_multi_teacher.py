#!/usr/bin/env python3
import os
import sys

# Add the current directory to sys.path to allow importing app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import SessionLocal, engine, Base
from app.models.teacher_group import TeacherGroup
from app.models.group_teacher import GroupTeacher

def main():
    print("Starting migration for multi-teacher support...")
    
    # 1. Create the new table if it doesn't exist
    Base.metadata.create_all(bind=engine)
    print("Database tables synchronized (group_teachers created if missing).")

    db = SessionLocal()
    try:
        # 2. Check if we have already migrated data
        existing_count = db.query(GroupTeacher).count()
        if existing_count > 0:
            print(f"Found {existing_count} existing records in group_teachers. Skipping initial migration.")
        else:
            # 3. Migrate existing teacher_id from teacher_groups as 'primary' teachers
            groups = db.query(TeacherGroup).all()
            migrated_count = 0
            for g in groups:
                if g.teacher_id:
                    gt = GroupTeacher(
                        group_id=g.id,
                        teacher_id=g.teacher_id,
                        role="primary"
                    )
                    db.add(gt)
                    migrated_count += 1
            
            db.commit()
            print(f"Successfully migrated {migrated_count} primary teachers to group_teachers table.")
            
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
