import sys
import os

# Add the backend directory to sys.path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.course import Course
from app.models.course_topic import CourseTopic

def migrate_localization_schema():
    """
    Example function to add localization columns to the database.
    Run this once to prepare the schema if not using Alembic.
    """
    db = SessionLocal()
    try:
        print("🛠 Checking schema for localization columns...")
        # Use raw SQL for SQLite to add columns if they don't exist
        # This is a simple approach for SQLite. For Postgres, use ALTER TABLE.
        tables_to_update = {
            "courses": ["title_kz", "title_ru", "description_kz", "description_ru"],
            "course_topics": ["title_kz", "title_ru", "description_kz", "description_ru"]
        }
        
        for table, columns in tables_to_update.items():
            for col in columns:
                try:
                    db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} TEXT"))
                    print(f"✅ Added {col} to {table}")
                except Exception:
                    # Column likely already exists
                    pass
        db.commit()
    finally:
        db.close()

def translate_existing_content():
    """
    Example function to populate localized columns from existing data.
    """
    db = SessionLocal()
    try:
        print("📝 Localizing existing course content...")
        
        # 1. Migrate Courses
        courses = db.query(Course).all()
        for course in courses:
            # If the course is currently in 'kz', set the title_kz
            if course.language == 'kz' or not course.language:
                course.title_kz = course.title
                course.description_kz = course.description
                # Here you would typically call an LLM API or use a translation dict for others
                course.title_ru = f"{course.title} (RU)" 
            elif course.language == 'ru':
                course.title_ru = course.title
                course.description_ru = course.description
                course.title_kz = f"{course.title} (KZ)"
        
        # 2. Migrate Topics
        topics = db.query(CourseTopic).all()
        for topic in topics:
            # Logic similar to courses
            topic.title_kz = topic.title
            topic.description_kz = topic.description
            
        db.commit()
        print("✨ Content localization complete.")
    finally:
        db.close()

if __name__ == "__main__":
    # migrate_localization_schema()
    # translate_existing_content()
    print("🚀 Script ready. Uncomment the functions above to run the migration.")
    print("⚠️  Warning: Always backup your database (app.db or education.db) before running migrations.")
