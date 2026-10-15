import pexpect
import sys

script_content = """import sys
import os
from app.core.database import SessionLocal
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import CourseEnrollment

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "zhandossahiev@gmail.com").first()
    if not user:
        print("User zhandossahiev@gmail.com not found!")
        sys.exit(0)
    
    enrollments = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == user.id).all()
    for e in enrollments:
        course = db.query(Course).filter(Course.id == e.course_id).first()
        course_title = course.title if course else "Unknown"
        
        if "machine" in course_title.lower() or "машин" in course_title.lower() or e.course_id == 3:
            print(f"Deleting enrollment ID={e.id} for course '{course_title}'...")
            db.delete(e)
            print("Deleted successfully on VPS!")
            
    db.commit()
except Exception as ex:
    db.rollback()
    print("Error:", ex)
finally:
    db.close()
"""

child = pexpect.spawn('ssh -o StrictHostKeyChecking=no root@212.19.134.72', timeout=60)
child.expect('assword:')
child.sendline('nurnur123')
child.expect('# ')

child.sendline('cat << "EOF" > /tmp/delete_ml.py\n' + script_content + '\nEOF')
child.expect('# ')

child.sendline('docker cp /tmp/delete_ml.py lms-qit-backend-1:/app/delete_ml.py')
child.expect('# ')

child.sendline('docker exec lms-qit-backend-1 python /app/delete_ml.py')
child.expect('# ')
print(child.before.decode('utf-8'))
