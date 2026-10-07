from app.database import SessionLocal
from app.models import User


db = SessionLocal()

permissions = [
    "organization_manage",
    "admin_manage",
    "role_manage",
    "permission_manage",

    "attendance_view",
    "attendance_take",
    "attendance_modify",

    "event_view",
    "event_create",
    "event_modify",
    "event_delete",

    "group_view",
    "group_create",
    "group_modify",

    "face_manage",

    "student_manage",
    "teacher_manage"
]

try:

    owner = (
        db.query(User)
        .filter(
            User.email == "owner@example.com"
        )
        .first()
    )

    if not owner:
        print("Product Owner not found.")

    else:
        owner.permissions = permissions

        db.commit()
        db.refresh(owner)

        print("Product Owner permissions updated.")
        print(owner.permissions)

finally:
    db.close()