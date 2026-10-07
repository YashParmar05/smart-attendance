from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.auth import ADMIN, TEACHER
from app.timezone import now_ist


def get_valid_event(
    db: Session,
    event_id: int,
    organization_id: int,
    current_user: models.User | None = None
):
    """
    Find an active event and verify:

    1. Event belongs to the organization.
    2. Event is active.
    3. Teacher has access to the event.
    4. Attendance window is currently open.

    Teacher access:
        - Event creator
        OR
        - EventTeacher assignment

    GroupTeacher does NOT grant event access.
    """

    # ========================================================
    # 1. FIND EVENT
    # ========================================================

    event = (
        db.query(models.Event)
        .filter(
            models.Event.id == event_id,

            models.Event.organization_id
            == organization_id,

            models.Event.is_active == True,

            models.Event.is_cancelled == False
        )
        .first()
    )

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found or inactive"
        )

    # ========================================================
    # 2. VERIFY TEACHER EVENT ACCESS
    # ========================================================

    if current_user is not None:

        if current_user.role == TEACHER:

            # ------------------------------------------------
            # Event creator automatically has access
            # ------------------------------------------------

            if event.created_by != current_user.id:

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

                if assignment is None:
                    raise HTTPException(
                        status_code=403,
                        detail=(
                            "You do not have access "
                            "to this event"
                        )
                    )

        elif current_user.role == ADMIN:

            # Admin can access events in their organization.
            pass

    # ========================================================
    # 3. CHECK START TIME
    # ========================================================

    now = now_ist()

    if now < event.starts_at:

        raise HTTPException(
            status_code=403,
            detail="Attendance has not started yet"
        )

    # ========================================================
    # 4. CHECK END TIME
    # ========================================================

    if (
        event.ends_at is not None
        and now > event.ends_at
    ):

        raise HTTPException(
            status_code=403,
            detail="Attendance window has ended"
        )

    # ========================================================
    # 5. EVENT IS VALID
    # ========================================================

    return event