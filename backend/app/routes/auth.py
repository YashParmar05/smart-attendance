from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.schemas import PasswordChange
from app.database import get_db
from app import models

from app.auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_user
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    user = db.query(models.User).filter(
        models.User.email == form_data.username
    ).first()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        form_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = create_access_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "must_change_password": user.must_change_password
    }

@router.get("/me")
def get_me(
    current_user: models.User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "employee_id": current_user.employee_id,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
        "permissions": current_user.permissions,
        "is_active": current_user.is_active,
        "must_change_password": current_user.must_change_password
    }



@router.patch("/change-password")
def change_password(
    data: PasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify the temporary/current password
    if not verify_password(
        data.current_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    # 2. Prevent using the same password again
    if verify_password(
        data.new_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password"
        )

    # 3. Hash the new password
    current_user.password_hash = hash_password(
        data.new_password
    )

    # 4. User has completed the forced password change
    current_user.must_change_password = False

    # 5. Save to database
    db.commit()
    db.refresh(current_user)

    # 6. Generate a fresh JWT with must_change_password=False
    new_token = create_access_token(current_user)

    return {
        "message": "Password changed successfully",
        "must_change_password": False
    }


