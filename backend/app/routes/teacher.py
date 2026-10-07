from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app import models
from app.auth import (
    get_current_user,
    require_permission,
    TEACHER
)
from app.database import get_db
from app.timezone import now_ist


router = APIRouter(
    prefix="/teacher",
    tags=["Teacher"]
)


# ============================================================
# TEACHER ACCESS
# ============================================================

def require_teacher(
    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Allow access only to Teacher accounts.
    """

    if current_user.role != TEACHER:
        raise HTTPException(
            status_code=403,
            detail="Teacher access required"
        )

    return current_user


# ============================================================
# TEACHER PROFILE
# ============================================================

@router.get("/me")
def get_teacher_me(
    current_user: models.User = Depends(
        require_teacher
    )
):
    return {
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
        "name": current_user.name,
        "email": current_user.email,
        "employee_id": current_user.employee_id,
        "role": current_user.role,
        "permissions": current_user.permissions or [],
        "is_active": current_user.is_active
    }


# ============================================================
# TEACHER DASHBOARD
# ============================================================

@router.get("/dashboard")
def get_teacher_dashboard(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_teacher
    )
):
    now = now_ist()

    # --------------------------------------------------------
    # GROUPS CREATED OR ASSIGNED TO THIS TEACHER
    # --------------------------------------------------------

    groups = (
        db.query(models.Group)
        .outerjoin(
            models.GroupTeacher,
            models.GroupTeacher.group_id
            == models.Group.id
        )
        .filter(
            models.Group.organization_id
            == current_user.organization_id,

            models.Group.is_active == True,

            (
                (models.Group.created_by == current_user.id)
                |
                (
                    models.GroupTeacher.teacher_id
                    == current_user.id
                )
            )
        )
        .distinct()
        .all()
    )

    # --------------------------------------------------------
    # EVENTS CREATED OR EXPLICITLY ASSIGNED TO THIS TEACHER
    #
    # IMPORTANT:
    # GroupTeacher does NOT grant event access.
    # --------------------------------------------------------

    events = (
        db.query(models.Event)
        .outerjoin(
            models.EventTeacher,
            models.EventTeacher.event_id
            == models.Event.id
        )
        .filter(
            models.Event.organization_id
            == current_user.organization_id,

            (
                (models.Event.created_by == current_user.id)
                |
                (
                    models.EventTeacher.teacher_id
                    == current_user.id
                )
            )
        )
        .distinct()
        .all()
    )

    current_events = 0
    upcoming_events = 0
    past_events = 0

    for event in events:

        if event.is_cancelled:
            continue

        if (
            event.starts_at <= now
            and (
                event.ends_at is None
                or event.ends_at > now
            )
        ):
            current_events += 1

        elif event.starts_at > now:
            upcoming_events += 1

        elif (
            event.ends_at is not None
            and event.ends_at <= now
        ):
            past_events += 1

    return {
        "teacher": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email
        },

        "groups": {
            "total": len(groups)
        },

        "events": {
            "current": current_events,
            "upcoming": upcoming_events,
            "past": past_events
        }
    }


# ============================================================
# TEACHER GROUPS
# ============================================================

@router.get("/groups")
def get_teacher_groups(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("group_view")
    )
):
    """
    Return groups:
    - created by this Teacher
    - OR explicitly assigned through GroupTeacher
    """

    if current_user.role != TEACHER:
        raise HTTPException(
            status_code=403,
            detail="Teacher access required"
        )

    groups = (
        db.query(models.Group)
        .outerjoin(
            models.GroupTeacher,
            models.GroupTeacher.group_id
            == models.Group.id
        )
        .filter(
            models.Group.organization_id
            == current_user.organization_id,

            models.Group.is_active == True,

            (
                (models.Group.created_by == current_user.id)
                |
                (
                    models.GroupTeacher.teacher_id
                    == current_user.id
                )
            )
        )
        .distinct()
        .order_by(
            models.Group.id.desc()
        )
        .all()
    )

    result = []

    for group in groups:

        student_count = (
            db.query(models.GroupMember)
            .join(
                models.User,
                models.GroupMember.user_id
                == models.User.id
            )
            .filter(
                models.GroupMember.group_id
                == group.id,

                models.User.organization_id
                == current_user.organization_id,

                models.User.role == "student",
                models.User.is_active == True
            )
            .count()
        )

        result.append({
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "created_by": group.created_by,
            "is_active": group.is_active,
            "student_count": student_count
        })

    return result


# ============================================================
# TEACHER EVENTS
# ============================================================

@router.get("/events")
def get_teacher_events(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_view")
    )
):
    """
    Return events:
    - created by this Teacher
    - OR explicitly assigned through EventTeacher

    GroupTeacher does NOT grant event visibility.
    """

    if current_user.role != TEACHER:
        raise HTTPException(
            status_code=403,
            detail="Teacher access required"
        )

    now = now_ist()

    events = (
        db.query(models.Event)
        .outerjoin(
            models.EventTeacher,
            models.EventTeacher.event_id
            == models.Event.id
        )
        .filter(
            models.Event.organization_id
            == current_user.organization_id,

            (
                (models.Event.created_by == current_user.id)
                |
                (
                    models.EventTeacher.teacher_id
                    == current_user.id
                )
            )
        )
        .distinct()
        .order_by(
            models.Event.starts_at.desc()
        )
        .all()
    )

    result = []

    for event in events:

        if event.is_cancelled:
            event_status = "cancelled"

        elif (
            event.ends_at is not None
            and event.ends_at <= now
        ):
            event_status = "expired"

        elif event.starts_at > now:
            event_status = "upcoming"

        else:
            event_status = "active"

        # ----------------------------------------------------
        # EVENT GROUPS
        # ----------------------------------------------------

        event_groups = (
            db.query(models.EventGroup)
            .filter(
                models.EventGroup.event_id
                == event.id
            )
            .all()
        )

        group_ids = [
            assignment.group_id
            for assignment in event_groups
        ]

        # Legacy fallback
        if not group_ids and event.group_id:
            group_ids = [event.group_id]

        # ----------------------------------------------------
        # EVENT TEACHERS
        # ----------------------------------------------------

        event_teachers = (
            db.query(models.EventTeacher)
            .filter(
                models.EventTeacher.event_id
                == event.id
            )
            .all()
        )

        teacher_ids = [
            assignment.teacher_id
            for assignment in event_teachers
        ]

        # Creator is always considered an event teacher
        if event.created_by not in teacher_ids:
            teacher_ids.append(event.created_by)

        result.append({
            "id": event.id,

            "title": event.title,

            # Backward compatibility
            "group_id": (
                group_ids[0]
                if group_ids
                else None
            ),

            "group_ids": group_ids,

            "teacher_ids": teacher_ids,

            "created_by": event.created_by,

            "starts_at": event.starts_at,

            "ends_at": event.ends_at,

            "is_active": event.is_active,

            "is_cancelled": event.is_cancelled,

            "status": event_status
        })

    return result


# ============================================================
# TEACHER EVENT ATTENDANCE
# ============================================================

@router.get(
    "/events/{event_id}/attendance"
)
def get_teacher_event_attendance(
    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_view")
    )
):
    """
    Return attendance for an event that the Teacher
    is authorized to access.

    Access:
    - Event creator
    - OR EventTeacher assignment
    """

    if current_user.role != TEACHER:
        raise HTTPException(
            status_code=403,
            detail="Teacher access required"
        )

    # --------------------------------------------------------
    # FIND EVENT
    # --------------------------------------------------------

    event = (
        db.query(models.Event)
        .outerjoin(
            models.EventTeacher,
            models.EventTeacher.event_id
            == models.Event.id
        )
        .filter(
            models.Event.id == event_id,

            models.Event.organization_id
            == current_user.organization_id,

            (
                (models.Event.created_by == current_user.id)
                |
                (
                    models.EventTeacher.teacher_id
                    == current_user.id
                )
            )
        )
        .first()
    )

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found"
        )

    # --------------------------------------------------------
    # GET ALL EVENT GROUPS
    # --------------------------------------------------------

    event_groups = (
        db.query(models.EventGroup)
        .filter(
            models.EventGroup.event_id
            == event.id
        )
        .all()
    )

    group_ids = {
        assignment.group_id
        for assignment in event_groups
    }

    # Legacy fallback
    if not group_ids and event.group_id:
        group_ids.add(event.group_id)

    if not group_ids:
        raise HTTPException(
            status_code=400,
            detail="Event has no groups assigned"
        )

    # --------------------------------------------------------
    # GET STUDENTS FROM ALL EVENT GROUPS
    #
    # A student belonging to multiple event groups
    # appears only once.
    # --------------------------------------------------------

    members = (
        db.query(models.GroupMember)
        .join(
            models.User,
            models.GroupMember.user_id
            == models.User.id
        )
        .filter(
            models.GroupMember.group_id.in_(
                group_ids
            ),

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "student",

            models.User.is_active == True
        )
        .all()
    )

    unique_student_ids = set()

    unique_members = []

    for member in members:

        if member.user_id in unique_student_ids:
            continue

        unique_student_ids.add(
            member.user_id
        )

        unique_members.append(member)

    # --------------------------------------------------------
    # GET ATTENDANCE
    # --------------------------------------------------------

    attendance_records = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id
            == event.id
        )
        .all()
    )

    attendance_by_user = {
        record.user_id: record
        for record in attendance_records
    }

    students = []

    for member in unique_members:

        record = attendance_by_user.get(
            member.user_id
        )

        students.append({
            "user_id": member.user_id,

            "name": member.user.name,

            "employee_id":
                member.user.employee_id,

            "status": (
                record.status
                if record
                else None
            ),

            "check_in": (
                record.check_in
                if record
                else None
            ),

            "confidence": (
                record.confidence
                if record
                else None
            )
        })

    # --------------------------------------------------------
    # STATISTICS
    # --------------------------------------------------------

    present = sum(
        1
        for student in students
        if student["status"] == "Present"
    )

    late = sum(
        1
        for student in students
        if student["status"] == "Late"
    )

    absent = sum(
        1
        for student in students
        if student["status"] == "Absent"
    )

    excused = sum(
        1
        for student in students
        if student["status"] == "Excused"
    )

    not_marked = sum(
        1
        for student in students
        if student["status"] is None
    )

    return {
        "event_id": event.id,

        "event_title": event.title,

        "group_id": (
            next(iter(group_ids))
            if group_ids
            else None
        ),

        "group_ids": list(group_ids),

        "total_students": len(students),

        "present": present,

        "late": late,

        "absent": absent,

        "excused": excused,

        "not_marked": not_marked,

        "students": students
    }