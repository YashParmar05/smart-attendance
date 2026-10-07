from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.auth import ADMIN, TEACHER


# ============================================================
# GROUP ACCESS
# ============================================================

def can_access_group(
    db: Session,
    group: models.Group,
    current_user: models.User
) -> bool:
    """
    Determine whether the current user can access a group.

    ADMIN:
        Can access every group in their organization.

    TEACHER:
        Can access a group if:
            1. They created the group
            OR
            2. They are explicitly assigned through GroupTeacher.

    IMPORTANT:
        Group access does NOT grant access to events.
    """

    # --------------------------------------------------------
    # ADMIN
    # --------------------------------------------------------

    if current_user.role == ADMIN:
        return (
            group.organization_id
            == current_user.organization_id
        )

    # --------------------------------------------------------
    # TEACHER
    # --------------------------------------------------------

    if current_user.role == TEACHER:

        # Group creator automatically has access.
        if group.created_by == current_user.id:
            return True

        # Check explicit GroupTeacher assignment.
        assignment = (
            db.query(models.GroupTeacher)
            .filter(
                models.GroupTeacher.group_id
                == group.id,

                models.GroupTeacher.teacher_id
                == current_user.id
            )
            .first()
        )

        return assignment is not None

    # --------------------------------------------------------
    # Other roles
    # --------------------------------------------------------

    return False


# def require_group_access(
#     db: Session,
#     group: models.Group,
#     current_user: models.User
# ):
#     """
#     Raise 403 when the current user cannot access the group.
#     """

#     if not can_access_group(
#         db,
#         group,
#         current_user
#     ):
#         raise HTTPException(
#             status_code=403,
#             detail="You do not have access to this group"
#         )

#     return group



def require_group_access(db, group, current_user):
    if current_user.role == "admin":
        return True

    if current_user.role == "teacher":
        # 1. Direct creation or GroupTeacher assignment
        is_direct = (
            db.query(models.GroupTeacher)
            .filter(
                models.GroupTeacher.group_id == group.id,
                models.GroupTeacher.teacher_id == current_user.id
            )
            .first() is not None
        )
        if is_direct or group.created_by == current_user.id:
            return True

        # 2. Event-based assignment (via EventGroup and EventTeacher)
        has_event_access = (
            db.query(models.EventTeacher)
            .join(
                models.EventGroup,
                models.EventGroup.event_id == models.EventTeacher.event_id
            )
            .filter(
                models.EventGroup.group_id == group.id,
                models.EventTeacher.teacher_id == current_user.id
            )
            .first() is not None
        )
        if has_event_access:
            return True

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to access this group."
    )


# ============================================================
# EVENT ACCESS
# ============================================================

def can_access_event(
    db: Session,
    event: models.Event,
    current_user: models.User
) -> bool:
    """
    Determine whether the current user can access an event.

    ADMIN:
        Can access every event in their organization.

    TEACHER:
        Can access an event if:
            1. They created the event
            OR
            2. They are explicitly assigned through EventTeacher.

    IMPORTANT:
        GroupTeacher is intentionally NOT checked here.

        A teacher being assigned to a group does not
        automatically give them access to events belonging
        to that group.
    """

    # --------------------------------------------------------
    # Organization boundary
    # --------------------------------------------------------

    if (
        event.organization_id
        != current_user.organization_id
    ):
        return False

    # --------------------------------------------------------
    # ADMIN
    # --------------------------------------------------------

    if current_user.role == ADMIN:
        return True

    # --------------------------------------------------------
    # TEACHER
    # --------------------------------------------------------

    if current_user.role == TEACHER:

        # Event creator automatically has access.
        if event.created_by == current_user.id:
            return True

        # Explicit EventTeacher assignment.
        assignment = (
            db.query(models.EventTeacher)
            .filter(
                models.EventTeacher.event_id
                == event.id,

                models.EventTeacher.teacher_id
                == current_user.id
            )
            .first()
        )

        return assignment is not None

    # --------------------------------------------------------
    # Other roles
    # --------------------------------------------------------

    return False


def require_event_access(
    db: Session,
    event: models.Event,
    current_user: models.User
):
    """
    Raise 403 when the current user cannot access the event.
    """

    if not can_access_event(
        db,
        event,
        current_user
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this event"
        )

    return event