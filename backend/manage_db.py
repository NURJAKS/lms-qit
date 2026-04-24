import sys
import argparse
from app.core.database import SessionLocal
from app.models.user import User
from app.models.course_application import CourseApplication
from app.models.enrollment import CourseEnrollment
from app.models.payment import Payment
from sqlalchemy import or_

def list_users(role=None):
    db = SessionLocal()
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    
    users = query.all()
    print(f"\n{'ID':<5} | {'Role':<10} | {'Email':<30} | {'Full Name'}")
    print("-" * 70)
    for u in users:
        print(f"{u.id:<5} | {u.role:<10} | {u.email:<30} | {u.full_name}")
    print(f"\nTotal: {len(users)} users.")
    db.close()

def delete_user(email):
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        print(f"User with email '{email}' not found.")
        db.close()
        return

    print(f"Found user: {user.full_name} (ID: {user.id})")
    confirm = input(f"Are you sure you want to delete user {email} and ALL their data? (y/n): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        db.close()
        return

    try:
        # Delete dependencies manually if CASCADE is not set in DB
        # Applications
        apps_deleted = db.query(CourseApplication).filter(CourseApplication.user_id == user.id).delete()
        # Enrollments
        enrollments_deleted = db.query(CourseEnrollment).filter(CourseEnrollment.user_id == user.id).delete()
        # Payments
        payments_deleted = db.query(Payment).filter(Payment.user_id == user.id).delete()
        
        # Finally delete user
        db.delete(user)
        db.commit()
        
        print("\nDeletion successful!")
        print(f"- Applications deleted: {apps_deleted}")
        print(f"- Enrollments deleted: {enrollments_deleted}")
        print(f"- Payments deleted: {payments_deleted}")
        print(f"- User record deleted.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during deletion: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LMS Database Manager")
    subparsers = parser.add_subparsers(dest="command")

    # List command
    list_p = subparsers.add_parser("list", help="List users")
    list_p.add_argument("--role", choices=["student", "admin", "teacher", "parent"], help="Filter by role")

    # Delete command
    delete_p = subparsers.add_parser("delete", help="Delete a user by email")
    delete_p.add_argument("email", help="Email of the user to delete")

    args = parser.parse_args()

    if args.command == "list":
        list_users(args.role)
    elif args.command == "delete":
        delete_user(args.email)
    else:
        parser.print_help()
