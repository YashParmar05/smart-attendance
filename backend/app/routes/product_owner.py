from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import (
    require_product_owner,
    password_hash,
    ADMIN_PERMISSIONS,
)

from app.database import get_db
from app.models import Organization, User
from app.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationStatusUpdate,
    ProductOwnerAdminCreate,
    ProductOwnerAdminResponse,
    ProductOwnerAdminSchoolUpdate,
    ProductOwnerAdminPermissionsUpdate,
    ProductOwnerAdminStatusUpdate,
    PasswordReset,
)


router = APIRouter(
    prefix="/product-owner",
    tags=["Product Owner"]
)


@router.get("/me")
def product_owner_me(
    current_user: User = Depends(
        require_product_owner
    )
):
    return {
        "message": "Product Owner access granted",
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }


@router.post(
    "/schools",
    response_model=OrganizationResponse
)
def create_school(
    school_data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    existing_school = (
        db.query(Organization)
        .filter(
            Organization.email ==
            school_data.email
        )
        .first()
    )

    if existing_school:
        raise HTTPException(
            status_code=400,
            detail="School with this email already exists"
        )

    school = Organization(
        name=school_data.name,
        email=school_data.email,
        is_active=True,
        license_status="active"
    )

    db.add(school)
    db.commit()
    db.refresh(school)

    return school


@router.get(
    "/schools",
    response_model=list[OrganizationResponse]
)
def list_schools(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    schools = (
        db.query(Organization)
        .order_by(Organization.id)
        .all()
    )

    return schools

@router.get(
    "/schools/{school_id}",
    response_model=OrganizationResponse
)
def get_school(
    school_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    school = (
        db.query(Organization)
        .filter(
            Organization.id == school_id
        )
        .first()
    )

    if not school:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    return school

@router.patch(
    "/schools/{school_id}",
    response_model=OrganizationResponse
)
def update_school(
    school_id: int,
    school_data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    school = (
        db.query(Organization)
        .filter(
            Organization.id == school_id
        )
        .first()
    )

    if not school:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    existing_school = (
        db.query(Organization)
        .filter(
            Organization.email == school_data.email,
            Organization.id != school_id
        )
        .first()
    )

    if existing_school:
        raise HTTPException(
            status_code=400,
            detail="Another school with this email already exists"
        )

    school.name = school_data.name
    school.email = school_data.email

    db.commit()
    db.refresh(school)

    return school

@router.patch(
    "/schools/{school_id}/status",
    response_model=OrganizationResponse
)
def update_school_status(
    school_id: int,
    status_data: OrganizationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    school = (
        db.query(Organization)
        .filter(
            Organization.id == school_id
        )
        .first()
    )

    if not school:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    school.is_active = status_data.is_active

    db.commit()
    db.refresh(school)

    return school


@router.post(
    "/admins",
    response_model=ProductOwnerAdminResponse
)
def create_admin(
    admin_data: ProductOwnerAdminCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    school = (
        db.query(Organization)
        .filter(
            Organization.id ==
            admin_data.organization_id
        )
        .first()
    )

    if not school:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    if not school.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot create admin for inactive school"
        )

    invalid_permissions = [
        permission
        for permission in admin_data.permissions
        if permission not in ADMIN_PERMISSIONS
    ]

    if invalid_permissions:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid admin permission(s)",
                "invalid_permissions": invalid_permissions
            }
        )

    existing_user = (
        db.query(User)
        .filter(
            User.email == admin_data.email
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email already exists"
        )

    existing_employee = (
        db.query(User)
        .filter(
            User.organization_id ==
            admin_data.organization_id,
            User.employee_id ==
            admin_data.employee_id
        )
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=400,
            detail="Employee ID already exists in this school"
        )

    admin = User(
        organization_id=admin_data.organization_id,
        name=admin_data.name,
        email=admin_data.email,
        password_hash=password_hash.hash(
            admin_data.password
        ),
        employee_id=admin_data.employee_id,
        role="admin",
        permissions=admin_data.permissions,
        is_active=True,
        must_change_password=True
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    return admin

@router.get(
    "/admins",
    response_model=list[ProductOwnerAdminResponse]
)
def list_admins(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    admins = (
        db.query(User)
        .filter(
            User.role == "admin"
        )
        .order_by(User.id)
        .all()
    )

    return admins


@router.get(
    "/admins/{admin_id}",
    response_model=ProductOwnerAdminResponse
)
def get_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    admin = (
        db.query(User)
        .filter(
            User.id == admin_id,
            User.role == "admin"
        )
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Admin not found"
        )

    return admin


@router.patch(
    "/admins/{admin_id}/school",
    response_model=ProductOwnerAdminResponse
)
def change_admin_school(
    admin_id: int,
    school_data: ProductOwnerAdminSchoolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    admin = (
        db.query(User)
        .filter(
            User.id == admin_id,
            User.role == "admin"
        )
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Admin not found"
        )

    school = (
        db.query(Organization)
        .filter(
            Organization.id ==
            school_data.organization_id
        )
        .first()
    )

    if not school:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    if not school.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign admin to inactive school"
        )

    admin.organization_id = (
        school_data.organization_id
    )

    db.commit()
    db.refresh(admin)

    return admin


@router.patch(
    "/admins/{admin_id}/permissions",
    response_model=ProductOwnerAdminResponse
)
def update_admin_permissions(
    admin_id: int,
    permission_data: ProductOwnerAdminPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    admin = (
        db.query(User)
        .filter(
            User.id == admin_id,
            User.role == "admin"
        )
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Admin not found"
        )

    invalid_permissions = [
        permission
        for permission in permission_data.permissions
        if permission not in ADMIN_PERMISSIONS
    ]

    if invalid_permissions:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid admin permission(s)",
                "invalid_permissions": invalid_permissions
            }
        )

    admin.permissions = permission_data.permissions

    db.commit()
    db.refresh(admin)

    return admin

@router.patch(
    "/admins/{admin_id}/status",
    response_model=ProductOwnerAdminResponse
)
def update_admin_status(
    admin_id: int,
    status_data: ProductOwnerAdminStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_product_owner
    )
):

    admin = (
        db.query(User)
        .filter(
            User.id == admin_id,
            User.role == "admin"
        )
        .first()
    )

    if not admin:
        raise HTTPException(
            status_code=404,
            detail="Admin not found"
        )

    admin.is_active = status_data.is_active

    db.commit()
    db.refresh(admin)

    return admin

# =========================================================
# UNIVERSAL PASSWORD RESET
# =========================================================

@router.patch(
    "/users/{user_id}/reset-password",
)
def reset_user_password(
    user_id: int,
    data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_product_owner)
):
    """
    Reset the password of an Admin from the Product Owner portal.

    The new password is treated as a temporary password.
    The Admin must change it after the next login.
    """

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.role == "admin"
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    user.password_hash = password_hash.hash(
        data.new_password
    )

    user.must_change_password = True

    db.commit()

    return {
        "message": "Password reset successfully",
        "user_id": user.id,
        "must_change_password": True
    }
