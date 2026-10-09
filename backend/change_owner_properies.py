from app.database import SessionLocal
from app.models import User
from app.auth import hash_password


# ============================================================
# PRODUCT OWNER DETAILS TO CHANGE
# ============================================================

# How to find the Product Owner, put one value and another as None.
OWNER_ID = None
OWNER_EMAIL = "owner1@example.com"

# New values
NEW_NAME = "Product Owner"
NEW_EMAIL = "owner@example.com"
NEW_EMPLOYEE_ID = "PO001"
NEW_PASSWORD = "owner123"

# Product Owner role
# NEW_ROLE = "product_owner"

# Organization
NEW_ORGANIZATION_ID = None

# Account status
NEW_IS_ACTIVE = True

# Password behavior
NEW_MUST_CHANGE_PASSWORD = False

# Permissions
NEW_PERMISSIONS = [
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


# ============================================================
# UPDATE PRODUCT OWNER
# ============================================================

db = SessionLocal()

try:

    # --------------------------------------------------------
    # Find Product Owner
    # --------------------------------------------------------

    owner = None

    if OWNER_ID is not None:

        owner = (
            db.query(User)
            .filter(
                User.id == OWNER_ID,
                User.role == "product_owner"
            )
            .first()
        )

    elif OWNER_EMAIL is not None:

        owner = (
            db.query(User)
            .filter(
                User.email == OWNER_EMAIL,
                User.role == "product_owner"
            )
            .first()
        )

    # --------------------------------------------------------
    # Check if Product Owner exists
    # --------------------------------------------------------

    if not owner:
        print("❌ Product Owner not found.")

    else:

        print(f"Found Product Owner:")
        print(f"ID: {owner.id}")
        print(f"Name: {owner.name}")
        print(f"Email: {owner.email}")

        # ----------------------------------------------------
        # Update basic details
        # ----------------------------------------------------

        if NEW_NAME is not None:
            owner.name = NEW_NAME

        if NEW_EMAIL is not None:
            owner.email = NEW_EMAIL

        if NEW_EMPLOYEE_ID is not None:
            owner.employee_id = NEW_EMPLOYEE_ID

        # ----------------------------------------------------
        # Update password
        # ----------------------------------------------------

        if NEW_PASSWORD is not None:
            owner.password_hash = hash_password(
                NEW_PASSWORD
            )

        # ----------------------------------------------------
        # Update role
        # ----------------------------------------------------

        # if NEW_ROLE is not None:
        #     owner.role = NEW_ROLE

        # ----------------------------------------------------
        # Update organization
        # ----------------------------------------------------

        if NEW_ORGANIZATION_ID is not None:
            owner.organization_id = NEW_ORGANIZATION_ID

        # ----------------------------------------------------
        # Update account status
        # ----------------------------------------------------

        if NEW_IS_ACTIVE is not None:
            owner.is_active = NEW_IS_ACTIVE

        # ----------------------------------------------------
        # Update password-change requirement
        # ----------------------------------------------------

        if NEW_MUST_CHANGE_PASSWORD is not None:
            owner.must_change_password = NEW_MUST_CHANGE_PASSWORD

        # ----------------------------------------------------
        # Update permissions
        # ----------------------------------------------------

        if NEW_PERMISSIONS is not None:
            owner.permissions = NEW_PERMISSIONS

        # ----------------------------------------------------
        # Save changes
        # ----------------------------------------------------

        db.commit()
        db.refresh(owner)

        print()
        print("✅ Product Owner updated successfully.")
        print()
        print("Updated details:")
        print(f"ID: {owner.id}")
        print(f"Name: {owner.name}")
        print(f"Email: {owner.email}")
        print(f"Employee ID: {owner.employee_id}")
        print(f"Role: {owner.role}")
        print(f"Organization ID: {owner.organization_id}")
        print(f"Active: {owner.is_active}")
        print(f"Must Change Password: {owner.must_change_password}")
        print(f"Permissions: {owner.permissions}")

finally:
    db.close()