from app.timezone import now_ist

from datetime import timedelta
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app import models
from app.models import User


# ==================================================
# PASSWORD HASHING
# ==================================================

password_hash = PasswordHash.recommended()


# ==================================================
# JWT AUTHENTICATION
# ==================================================

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


# ==================================================
# ROLES
# ==================================================

PRODUCT_OWNER = "product_owner"
ADMIN = "admin"
TEACHER = "teacher"
STUDENT = "student"

# ==================================================
# PERMISSIONS
# ==================================================

ATTENDANCE_VIEW = "attendance_view"
ATTENDANCE_TAKE = "attendance_take"
ATTENDANCE_MODIFY = "attendance_modify"

EVENT_VIEW = "event_view"
EVENT_CREATE = "event_create"
EVENT_MODIFY = "event_modify"
EVENT_DELETE = "event_delete"

GROUP_VIEW = "group_view"
GROUP_CREATE = "group_create"
GROUP_MODIFY = "group_modify"

FACE_MANAGE = "face_manage"

STUDENT_MANAGE = "student_manage"
TEACHER_MANAGE = "teacher_manage"
ADMIN_MANAGE = "admin_manage"

ADMIN_PERMISSIONS = [
    ATTENDANCE_VIEW,
    ATTENDANCE_TAKE,
    ATTENDANCE_MODIFY,

    EVENT_VIEW,
    EVENT_CREATE,
    EVENT_MODIFY,
    EVENT_DELETE,

    GROUP_VIEW,
    GROUP_CREATE,
    GROUP_MODIFY,

    FACE_MANAGE,

    STUDENT_MANAGE,
    TEACHER_MANAGE,
]


def require_user_management_permission(
    current_user,
    target_user
):
    """
    Check whether current_user is allowed
    to manage target_user.

    Permission is determined by the
    target user's role.
    """

    # -----------------------------------------
    # Product Owner
    # -----------------------------------------

    if current_user.role == "product_owner":
        return current_user

    # -----------------------------------------
    # Target is Admin
    # -----------------------------------------

    if target_user.role == ADMIN:

        required_permission = ADMIN_MANAGE

    # -----------------------------------------
    # Target is Teacher
    # -----------------------------------------

    elif target_user.role == TEACHER:

        required_permission = TEACHER_MANAGE

    # -----------------------------------------
    # Target is Student
    # -----------------------------------------

    elif target_user.role == STUDENT:

        required_permission = STUDENT_MANAGE

    # -----------------------------------------
    # Unknown target role
    # -----------------------------------------

    else:

        raise HTTPException(
            status_code=403,
            detail="Unsupported target user role"
        )

    # -----------------------------------------
    # Check permission
    # -----------------------------------------

    permissions = (
        current_user.permissions or []
    )

    if required_permission not in permissions:

        raise HTTPException(
            status_code=403,
            detail=(
                f"Missing permission: "
                f"{required_permission}"
            )
        )

    return current_user


# ==================================================
# PASSWORD FUNCTIONS
# ==================================================

def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    """
    Verify a plain-text password against
    the stored password hash.
    """

    return password_hash.verify(
        plain_password,
        hashed_password
    )


def hash_password(password: str) -> str:
    """
    Convert a plain-text password into
    a secure password hash.
    """

    return password_hash.hash(password)


# ==================================================
# JWT TOKEN
# ==================================================

def create_access_token(user: models.User):
    """
    Create JWT token containing the user's
    identity, school, and role.
    """

    expire = now_ist() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user.id),
        "organization_id": user.organization_id,
        "role": user.role,
        "must_change_password": user.must_change_password,
        "exp": expire
    }

    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm="HS256"
    )


# ==================================================
# CURRENT USER
# ==================================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    Decode JWT and return the current database user.
    """

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        }
    )

    try:

        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise credentials_exception

    user = db.get(
        models.User,
        int(user_id)
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return user


# ==================================================
# ROLE CHECK
# ==================================================

def require_role(*allowed_roles: str):
    """
    Allow access only to users whose role
    matches one of the supplied roles.

    Example:

    Depends(require_role(ADMIN))
    """

    def role_checker(
        user: models.User = Depends(get_current_user)
    ):

        if user.role not in allowed_roles:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )

        return user

    return role_checker


# ==================================================
# PERMISSION CHECK
# ==================================================

def require_permission(permission: str):
    """
    Allow access only if the authenticated user
    contains the required permission.
    """

    def permission_checker(
        user: models.User = Depends(get_current_user)
    ):

        permissions = user.permissions or []

        if permission not in permissions:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}"
            )

        return user

    return permission_checker


# ==================================================
# ADMIN CHECK
# ==================================================

def require_admin(
    user: models.User = Depends(get_current_user)
):
    """
    Allow only school Admin users.
    """

    if user.role != ADMIN:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user


# ==================================================
# TEACHER OR ADMIN CHECK
# ==================================================

def require_admin_or_teacher(
    user: models.User = Depends(get_current_user)
):
    """
    Allow Admin or Teacher users.
    """

    if user.role not in {
        ADMIN,
        TEACHER
    }:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Teacher access required"
        )

    return user


# =================================================
# PRODUCT OWNER CHECK
# ==================================================
def require_product_owner(
    user: User = Depends(get_current_user)
) -> User:

    if user.role != PRODUCT_OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Product Owner access required"
        )

    return user