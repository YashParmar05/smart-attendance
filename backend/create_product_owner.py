from app.database import SessionLocal
from app.models import User
from app.auth import hash_password


db = SessionLocal()


# Product Owner's system-level permissions
main_permissions = [
    "organization_manage",
    "admin_manage",
    "role_manage",
    "permission_manage"
]


# Permissions that can be assigned to School Admins
additional_permissions = [
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

    existing_user = (
        db.query(User)
        .filter(
            User.email == "owner@example.com"
        )
        .first()
    )

    if existing_user:

        print("Product Owner already exists.")

    else:

        owner = User(
            organization_id=None,

            name="Product Owner",

            email="owner@example.com",

            password_hash=hash_password(
                "Owner@123"
            ),

            employee_id="PO-001",

            role="product_owner",

            permissions=(
                main_permissions
                + additional_permissions
            ),

            is_active=True
        )

        db.add(owner)

        db.commit()

        db.refresh(owner)

        print(
            f"Product Owner created. "
            f"ID: {owner.id}"
        )

finally:

    db.close()