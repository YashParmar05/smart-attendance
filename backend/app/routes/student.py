from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app import models
from app.auth import (
    get_current_user,
    STUDENT
)
from app.database import get_db
from app.timezone import now_ist


router = APIRouter(
    prefix="/student",
    tags=["Student"]
)


# ============================================================
# STUDENT ACCESS
# ============================================================

def require_student(
    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Allow access only to Student accounts.
    """

    if current_user.role != STUDENT:
        raise HTTPException(
            status_code=403,
            detail="Student access required"
        )

    return current_user


# ============================================================
# HELPER: GET STUDENT GROUP IDS
# ============================================================

def get_student_group_ids(
    db: Session,
    current_user: models.User
):
    """
    Return active groups to which the logged-in
    student belongs.
    """

    rows = (
        db.query(
            models.GroupMember.group_id
        )
        .join(
            models.Group,
            models.GroupMember.group_id
            == models.Group.id
        )
        .filter(
            models.GroupMember.user_id
            == current_user.id,

            models.Group.organization_id
            == current_user.organization_id,

            models.Group.is_active == True
        )
        .all()
    )

    return [
        row.group_id
        for row in rows
    ]


# ============================================================
# HELPER: GET STUDENT EVENT IDS
# ============================================================

def get_student_event_ids(
    db: Session,
    current_user: models.User
):
    """
    Return event IDs for events containing at least
    one group to which the student belongs.

    IMPORTANT:
    EventGroup is the source of truth.
    """

    group_ids = get_student_group_ids(
        db,
        current_user
    )

    if not group_ids:
        return []

    rows = (
        db.query(
            models.EventGroup.event_id
        )
        .join(
            models.Event,
            models.EventGroup.event_id
            == models.Event.id
        )
        .filter(
            models.EventGroup.group_id.in_(
                group_ids
            ),

            models.Event.organization_id
            == current_user.organization_id
        )
        .distinct()
        .all()
    )

    return [
        row.event_id
        for row in rows
    ]


# ============================================================
# HELPER: EVENT GROUP IDS
# ============================================================

def get_event_group_ids(
    event
):
    """
    Return all groups assigned to an event.

    Legacy event.group_id is supported for old events.
    """

    group_ids = [
        assignment.group_id
        for assignment in event.group_assignments
    ]

    if (
        not group_ids
        and event.group_id is not None
    ):
        group_ids = [
            event.group_id
        ]

    return list(
        dict.fromkeys(group_ids)
    )


# ============================================================
# HELPER: CHECK STUDENT EVENT ACCESS
# ============================================================

def student_can_access_event(
    db: Session,
    event,
    current_user: models.User
):
    """
    A student can access an event when they belong
    to at least one group assigned to that event.
    """

    if (
        event.organization_id
        != current_user.organization_id
    ):
        return False

    group_ids = get_student_group_ids(
        db,
        current_user
    )

    if not group_ids:
        return False

    event_group_ids = get_event_group_ids(
        event
    )

    return bool(
        set(group_ids)
        & set(event_group_ids)
    )


# ============================================================
# STUDENT PROFILE
# ============================================================

@router.get("/me")
def get_student_me(
    current_user: models.User = Depends(
        require_student
    )
):
    """
    Return the logged-in student's profile.
    """

    return {
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
        "name": current_user.name,
        "email": current_user.email,
        "employee_id": current_user.employee_id,
        "role": current_user.role,
        "is_active": current_user.is_active
    }


# ============================================================
# STUDENT EVENTS
# ============================================================

@router.get("/events")
def get_student_events(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_student
    )
):
    """
    Return only events containing at least one group
    in which the logged-in student is a member.

    Supports multiple groups per event.
    """

    now = now_ist()

    event_ids = get_student_event_ids(
        db,
        current_user
    )

    if not event_ids:
        return {
            "current": [],
            "upcoming": [],
            "past": []
        }

    events = (
        db.query(models.Event)
        .filter(
            models.Event.id.in_(
                event_ids
            ),

            models.Event.organization_id
            == current_user.organization_id,

            models.Event.is_cancelled == False
        )
        .order_by(
            models.Event.starts_at.asc()
        )
        .all()
    )

    current = []
    upcoming = []
    past = []

    student_group_ids = set(
        get_student_group_ids(
            db,
            current_user
        )
    )

    for event in events:

        event_group_ids = get_event_group_ids(
            event
        )

        # Groups of this event that this student belongs to.
        student_event_group_ids = [
            group_id
            for group_id in event_group_ids
            if group_id in student_group_ids
        ]

        if not student_event_group_ids:
            continue

        event_data = {
            "id": event.id,
            "title": event.title,

            # Backward compatibility.
            "group_id": (
                event_group_ids[0]
                if event_group_ids
                else event.group_id
            ),

            "group_ids": event_group_ids,

            "student_group_ids":
                student_event_group_ids,

            "starts_at": event.starts_at,
            "ends_at": event.ends_at,
            "is_active": event.is_active,
            "is_cancelled": event.is_cancelled
        }

        # ----------------------------------------------------
        # UPCOMING
        # ----------------------------------------------------

        if event.starts_at > now:

            event_data["status"] = "upcoming"

            upcoming.append(
                event_data
            )

        # ----------------------------------------------------
        # CURRENT
        # ----------------------------------------------------

        elif (
            event.ends_at is None
            or event.ends_at > now
        ):

            event_data["status"] = "active"

            current.append(
                event_data
            )

        # ----------------------------------------------------
        # PAST
        # ----------------------------------------------------

        else:

            event_data["status"] = "past"

            past.append(
                event_data
            )

    return {
        "current": current,
        "upcoming": upcoming,
        "past": past
    }


# ============================================================
# STUDENT EVENT DETAILS
# ============================================================

@router.get(
    "/events/{event_id}"
)
def get_student_event(
    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_student
    )
):
    """
    Return one event only if the student belongs
    to at least one group assigned to that event.
    """

    event = (
        db.query(models.Event)
        .filter(
            models.Event.id == event_id,

            models.Event.organization_id
            == current_user.organization_id
        )
        .first()
    )

    if event is None:

        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # STUDENT EVENT ACCESS
    # --------------------------------------------------------

    if not student_can_access_event(
        db,
        event,
        current_user
    ):
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # EVENT STATUS
    # --------------------------------------------------------

    now = now_ist()

    if event.is_cancelled:

        event_status = "cancelled"

    elif (
        event.ends_at is not None
        and event.ends_at <= now
    ):

        event_status = "past"

    elif event.starts_at > now:

        event_status = "upcoming"

    else:

        event_status = "active"

    # --------------------------------------------------------
    # EVENT GROUPS
    # --------------------------------------------------------

    event_group_ids = get_event_group_ids(
        event
    )

    student_group_ids = get_student_group_ids(
        db,
        current_user
    )

    student_event_group_ids = [
        group_id
        for group_id in event_group_ids
        if group_id in student_group_ids
    ]

    # --------------------------------------------------------
    # OWN ATTENDANCE
    # --------------------------------------------------------

    attendance = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id
            == event.id,

            models.Attendance.user_id
            == current_user.id
        )
        .first()
    )

    attendance_status = (
        attendance.status
        if attendance
        else None
    )

    # After event ends, no record means Absent.
    if (
        event_status == "past"
        and attendance_status is None
    ):

        attendance_status = "Absent"

    return {
        "event": {
            "id": event.id,
            "title": event.title,

            "group_id": (
                event_group_ids[0]
                if event_group_ids
                else event.group_id
            ),

            "group_ids": event_group_ids,

            "student_group_ids":
                student_event_group_ids,

            "starts_at": event.starts_at,
            "ends_at": event.ends_at,
            "status": event_status
        },

        "attendance": {
            "status": attendance_status,

            "check_in": (
                attendance.check_in
                if attendance
                else None
            ),

            "confidence": (
                attendance.confidence
                if attendance
                else None
            )
        }
    }


# ============================================================
# STUDENT ATTENDANCE
# ============================================================

@router.get("/attendance")
def get_student_attendance(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_student
    )
):
    """
    Return only the logged-in student's
    attendance history.

    Students can never request another user_id.
    """

    records = (
        db.query(models.Attendance)
        .join(
            models.Event,
            models.Attendance.event_id
            == models.Event.id
        )
        .filter(
            models.Attendance.user_id
            == current_user.id,

            models.Event.organization_id
            == current_user.organization_id
        )
        .order_by(
            models.Event.starts_at.desc()
        )
        .all()
    )

    result = []

    for record in records:

        event = record.event

        # ----------------------------------------------------
        # Security check
        # ----------------------------------------------------

        if not student_can_access_event(
            db,
            event,
            current_user
        ):
            continue

        event_group_ids = get_event_group_ids(
            event
        )

        student_group_ids = get_student_group_ids(
            db,
            current_user
        )

        student_event_group_ids = [
            group_id
            for group_id in event_group_ids
            if group_id in student_group_ids
        ]

        result.append({
            "event_id": event.id,

            "event_title": event.title,

            "group_id": (
                event_group_ids[0]
                if event_group_ids
                else event.group_id
            ),

            "group_ids": event_group_ids,

            "student_group_ids":
                student_event_group_ids,

            "starts_at": event.starts_at,

            "ends_at": event.ends_at,

            "status": record.status,

            "check_in": record.check_in,

            "confidence": record.confidence
        })

    return result


# ============================================================
# STUDENT DASHBOARD
# ============================================================

@router.get("/dashboard")
def get_student_dashboard(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_student
    )
):
    """
    Return everything required by the
    Student dashboard.
    """

    now = now_ist()

    # --------------------------------------------------------
    # STUDENT GROUPS
    # --------------------------------------------------------

    group_ids = get_student_group_ids(
        db,
        current_user
    )

    # --------------------------------------------------------
    # EVENTS
    # --------------------------------------------------------

    events = []

    if group_ids:

        event_ids = get_student_event_ids(
            db,
            current_user
        )

        if event_ids:

            events = (
                db.query(models.Event)
                .filter(
                    models.Event.id.in_(
                        event_ids
                    ),

                    models.Event.organization_id
                    == current_user.organization_id,

                    models.Event.is_cancelled == False
                )
                .order_by(
                    models.Event.starts_at.asc()
                )
                .all()
            )

    current_events = []
    upcoming_events = []
    past_events = []

    student_group_ids = set(
        group_ids
    )

    for event in events:

        event_group_ids = get_event_group_ids(
            event
        )

        student_event_group_ids = [
            group_id
            for group_id in event_group_ids
            if group_id in student_group_ids
        ]

        if not student_event_group_ids:
            continue

        event_data = {
            "id": event.id,
            "title": event.title,

            "group_id": (
                event_group_ids[0]
                if event_group_ids
                else event.group_id
            ),

            "group_ids": event_group_ids,

            "student_group_ids":
                student_event_group_ids,

            "starts_at": event.starts_at,
            "ends_at": event.ends_at
        }

        if (
            event.starts_at <= now
            and (
                event.ends_at is None
                or event.ends_at > now
            )
        ):

            current_events.append(
                event_data
            )

        elif event.starts_at > now:

            upcoming_events.append(
                event_data
            )

        else:

            past_events.append(
                event_data
            )

    # --------------------------------------------------------
    # ATTENDANCE
    # --------------------------------------------------------

    attendance_records = (
        db.query(models.Attendance)
        .join(
            models.Event,
            models.Attendance.event_id
            == models.Event.id
        )
        .filter(
            models.Attendance.user_id
            == current_user.id,

            models.Event.organization_id
            == current_user.organization_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Only attendance belonging to accessible events.
    # --------------------------------------------------------

    valid_attendance_records = []

    for record in attendance_records:

        if student_can_access_event(
            db,
            record.event,
            current_user
        ):

            valid_attendance_records.append(
                record
            )

    # --------------------------------------------------------
    # ATTENDANCE COUNTS
    # --------------------------------------------------------

    present = sum(
        1
        for record in valid_attendance_records
        if record.status == "Present"
    )

    late = sum(
        1
        for record in valid_attendance_records
        if record.status == "Late"
    )

    absent = sum(
        1
        for record in valid_attendance_records
        if record.status == "Absent"
    )

    # --------------------------------------------------------
    # RESPONSE
    # --------------------------------------------------------

    return {
        "student": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "employee_id": current_user.employee_id
        },

        "groups": {
            "total": len(group_ids)
        },

        "events": {
            "current": current_events,
            "upcoming": upcoming_events,
            "past": past_events
        },

        "attendance": {
            "total_records": len(
                valid_attendance_records
            ),

            "present": present,

            "late": late,

            "absent": absent,

        }
    }