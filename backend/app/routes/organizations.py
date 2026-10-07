from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database import get_db

from app.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationStatusUpdate,
    OrganizationLicenseUpdate,
    UserCreate,
    UserResponse
)

from app.auth import (
    get_current_user,
    hash_password,
    PRODUCT_OWNER
)

from app import models


router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"]
)


# ==================================================
# PRODUCT OWNER CHECK
# ==================================================

def require_product_owner(
    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Only the Product Owner can manage schools.
    """

    if current_user.role != PRODUCT_OWNER:
        raise HTTPException(
            status_code=403,
            detail="Product Owner access required"
        )

    return current_user


# ==================================================
# CREATE SCHOOL
# ==================================================

@router.post(
    "/",
    response_model=OrganizationResponse
)
def create_org(
    organization: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_product_owner
    )
):
    """
    Product Owner creates a new school.
    """

    existing = (
        db.query(models.Organization)
        .filter(
            models.Organization.email
            == organization.email
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="A school with this email already exists"
        )

    db_organization = models.Organization(
        name=organization.name,
        email=organization.email,
        is_active=True,
        license_status="active"
    )

    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)

    return db_organization


# ==================================================
# GET ALL SCHOOLS
# ==================================================

@router.get(
    "/",
    response_model=list[OrganizationResponse]
)
def get_organizations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_product_owner
    )
):
    """
    Product Owner can view all schools.
    """

    return (
        db.query(models.Organization)
        .order_by(
            models.Organization.id.asc()
        )
        .all()
    )


# ==================================================
# GET ONE SCHOOL
# ==================================================

@router.get(
    "/{organization_id}",
    response_model=OrganizationResponse
)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_product_owner
    )
):
    organization = (
        db.query(models.Organization)
        .filter(
            models.Organization.id
            == organization_id
        )
        .first()
    )

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    return organization


# ==================================================
# ACTIVATE / DEACTIVATE SCHOOL
# ==================================================

@router.patch(
    "/{organization_id}/status",
    response_model=OrganizationResponse
)
def update_organization_status(
    organization_id: int,
    data: OrganizationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_product_owner
    )
):
    organization = (
        db.query(models.Organization)
        .filter(
            models.Organization.id
            == organization_id
        )
        .first()
    )

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    organization.is_active = data.is_active

    db.commit()
    db.refresh(organization)

    return organization


# ==================================================
# LICENSE
# ==================================================

@router.patch(
    "/{organization_id}/license",
    response_model=OrganizationResponse
)
def update_license(
    organization_id: int,
    data: OrganizationLicenseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_product_owner
    )
):
    organization = (
        db.query(models.Organization)
        .filter(
            models.Organization.id
            == organization_id
        )
        .first()
    )

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    allowed_statuses = {
        "active",
        "expired",
        "suspended"
    }

    if data.license_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid license status. "
                "Allowed: active, expired, suspended"
            )
        )

    organization.license_status = (
        data.license_status
    )

    # If license is expired/suspended,
    # deactivate school access.
    if data.license_status in {
        "expired",
        "suspended"
    }:
        organization.is_active = False

    elif data.license_status == "active":
        organization.is_active = True

    db.commit()
    db.refresh(organization)

    return organization


# ==================================================
# CREATE ADMIN
# ==================================================

@router.post(
    "/{organization_id}/admins",
    response_model=UserResponse
)
def create_admin(
    organization_id: int,
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_product_owner
    )
):
    """
    Product Owner creates an Admin account
    for a specific school.
    """

    organization = (
        db.query(models.Organization)
        .filter(
            models.Organization.id
            == organization_id
        )
        .first()
    )

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    if not organization.is_active:
        raise HTTPException(
            status_code=403,
            detail="Cannot create Admin for inactive school"
        )

    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == user.email
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists"
        )

    existing_employee = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == organization_id,
            models.User.employee_id
            == user.employee_id
        )
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail="Employee ID already exists in this school"
        )


    admin_permissions = [
        "group_view",
        "group_create",
        "group_modify",
        "group_delete",

        "student_create",
        "student_delete",

        "teacher_create",
        "teacher_delete",
        "teacher_permission_manage",

        "event_view",
        "event_create",
        "event_modify",
        "event_delete",

        "attendance_view",
        "attendance_take",

        "face_manage"
    ]
    
    admin = models.User(
        organization_id=organization_id,
        name=user.name,
        email=user.email,
        password_hash=hash_password(
            user.password
        ),
        employee_id=user.employee_id,
        role="admin",
        permissions=admin_permissions,
        is_active=True
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    return admin
           