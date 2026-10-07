from sqlalchemy.orm import Session

from app import models
from app.schemas import (
    OrganizationCreate,
    UserCreate,
    GroupCreate,
)

from app.auth import hash_password


# ==================================================
# ORGANIZATION
# ==================================================

def create_organization(
    db: Session,
    organization: OrganizationCreate
):
    db_organization = models.Organization(
        name=organization.name,
        email=organization.email
    )

    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)

    return db_organization


# ==================================================
# USER
# ==================================================

def create_user(
    db: Session,
    user: UserCreate
):
    """
    Create a user with a securely hashed password.
    """

    hashed_password = hash_password(
        user.password
    )

    db_user = models.User(
        organization_id=user.organization_id,
        name=user.name,
        email=user.email,
        password_hash=hashed_password,
        employee_id=user.employee_id,
        role=user.role,
        permissions=user.permissions
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


def update_user_password(
    db: Session,
    user: models.User,
    new_password: str
):
    """
    Update a user's password.

    The plain password is never stored.
    """

    user.password_hash = hash_password(
        new_password
    )

    db.commit()
    db.refresh(user)

    return user



def create_group(
    db: Session,
    group: GroupCreate,
    organization_id: int,
    created_by: int
):
    db_group = models.Group(
        organization_id=organization_id,
        name=group.name,
        description=group.description,
        created_by=created_by
    )

    db.add(db_group)
    db.commit()
    db.refresh(db_group)

    return db_group


def update_group(
    db: Session,
    group: models.Group,
    name: str,
    description: str | None
):
    group.name = name
    group.description = description

    db.commit()
    db.refresh(group)

    return group


def delete_group(
    db: Session,
    group: models.Group
):
    group.is_active = False

    db.commit()
    db.refresh(group)

    return group



def add_students_to_group(
    db: Session,
    group_id: int,
    user_ids: list[int]
):
    added = []

    for user_id in user_ids:

        existing = db.query(models.GroupMember).filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.user_id == user_id
        ).first()

        if existing:
            continue

        member = models.GroupMember(
            group_id=group_id,
            user_id=user_id
        )

        db.add(member)
        added.append(user_id)

    db.commit()

    return added


def add_employee_range_to_group(
    db: Session,
    group_id: int,
    organization_id: int,
    start_employee_id: str,
    end_employee_id: str
):
    users = db.query(models.User).filter(
        models.User.organization_id == organization_id,
        models.User.employee_id >= start_employee_id,
        models.User.employee_id <= end_employee_id,
        models.User.is_active == True
    ).all()

    added = []

    for user in users:

        existing = db.query(models.GroupMember).filter(
            models.GroupMember.group_id == group_id,
            models.GroupMember.user_id == user.id
        ).first()

        if existing:
            continue

        member = models.GroupMember(
            group_id=group_id,
            user_id=user.id
        )

        db.add(member)
        added.append(user.id)

    db.commit()

    return added

