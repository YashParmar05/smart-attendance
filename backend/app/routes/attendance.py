from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query
)

from pydantic import BaseModel

from sqlalchemy.orm import Session

from app.timezone import now_ist
from app import models
from app.auth import require_permission
from app.database import get_db
from app.event_service import get_valid_event
from app.access_control import require_event_access


router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class AttendanceCreate(BaseModel):

    event_id: int
    user_id: int
    confidence: float
    status: str = "Present"


class AttendanceUpdate(BaseModel):

    status: str


# ============================================================
# HELPER: GET EVENT GROUP IDS
# ============================================================

def get_event_group_ids(
    db: Session,
    event
):
    """
    Return all groups assigned to an event.

    Uses EventGroup as the new source of truth.

    Legacy event.group_id is used as a fallback for
    old events created before the EventGroup system.
    """

    assignments = (
        db.query(models.EventGroup)
        .filter(
            models.EventGroup.event_id
            == event.id
        )
        .all()
    )

    group_ids = {
        assignment.group_id
        for assignment in assignments
    }

    # --------------------------------------------------------
    # Backward compatibility
    # --------------------------------------------------------

    if not group_ids and event.group_id:
        group_ids.add(event.group_id)

    return group_ids


# ============================================================
# HELPER: GET EVENT STUDENTS
# ============================================================

def get_event_students(
    db: Session,
    event,
    organization_id: int
):
    """
    Get all active students belonging to any group
    assigned to the event.

    If a student belongs to multiple event groups,
    the student is returned only once.
    """

    group_ids = get_event_group_ids(
        db,
        event
    )

    if not group_ids:
        return []

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
            == organization_id,

            models.User.role == "student",

            models.User.is_active == True
        )
        .all()
    )

    # --------------------------------------------------------
    # Deduplicate students
    # --------------------------------------------------------

    unique_students = {}

    for member in members:

        if member.user_id not in unique_students:
            unique_students[
                member.user_id
            ] = member.user

    return list(
        unique_students.values()
    )


# ============================================================
# HELPER: FINALIZE ABSENT STUDENTS
# ============================================================

def calculate_attendance_status(event, check_in):
    """Calculate status from event start time and check-in time.

    First 10 minutes (inclusive) -> Present
    After 10 minutes -> Late
    """
    if check_in is None:
        return None

    elapsed_seconds = (check_in - event.starts_at).total_seconds()

    if elapsed_seconds <= 10 * 60:
        return "Present"

    return "Late"


def finalize_absent_students(
    event,
    db: Session
):
    """
    After an event ends, every student who belongs to
    one of the event's groups and has no attendance
    record becomes Absent.
    """

    if event.ends_at is None:
        return

    if now_ist() < event.ends_at:
        return

    students = get_event_students(
        db,
        event,
        event.organization_id
    )

    for student in students:

        existing = (
            db.query(models.Attendance)
            .filter(
                models.Attendance.event_id
                == event.id,

                models.Attendance.user_id
                == student.id
            )
            .first()
        )

        if existing:
            continue

        absent = models.Attendance(
            event_id=event.id,
            user_id=student.id,
            marked_by=event.created_by,
            confidence=0.0,
            status="Absent"
        )

        db.add(absent)

    db.commit()


# ============================================================
# 1. GET ALL ATTENDANCE
# ============================================================

@router.get("/")
def get_attendance(

    event_id: int | None = Query(
        default=None
    ),

    user_id: int | None = Query(
        default=None
    ),

    status: str | None = Query(
        default=None
    ),

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_view")
    )
):

    query = (
        db.query(models.Attendance)
        .join(
            models.Event,
            models.Attendance.event_id
            == models.Event.id
        )
        .filter(
            models.Event.organization_id
            == current_user.organization_id
        )
    )

    if event_id is not None:

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

        require_event_access(
            db,
            event,
            current_user
        )

        query = query.filter(
            models.Attendance.event_id
            == event_id
        )

    if user_id is not None:

        query = query.filter(
            models.Attendance.user_id
            == user_id
        )

    if status is not None:

        query = query.filter(
            models.Attendance.status
            == status
        )

    return query.all()


# ============================================================
# 2. GET ATTENDANCE FOR ONE EVENT
# ============================================================

@router.get("/event/{event_id}")
def get_event_attendance(

    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_view")
    )
):

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

    require_event_access(
        db,
        event,
        current_user
    )

    finalize_absent_students(
        event,
        db
    )

    return (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id
            == event_id
        )
        .all()
    )


# ============================================================
# 3. GET ATTENDANCE FOR ONE USER
# ============================================================

@router.get("/user/{user_id}")
def get_user_attendance(

    user_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_view")
    )
):

    user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return (
        db.query(models.Attendance)
        .join(
            models.Event,
            models.Attendance.event_id
            == models.Event.id
        )
        .filter(
            models.Attendance.user_id
            == user_id,

            models.Event.organization_id
            == current_user.organization_id
        )
        .all()
    )


# ============================================================
# STUDENT: GET MY ATTENDANCE
# ============================================================

@router.get("/me")
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("attendance_view")
    )
):
    # --------------------------------------------------------
    # Only students can use this endpoint
    # --------------------------------------------------------

    if current_user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available to students"
        )

    # --------------------------------------------------------
    # Get groups assigned to the logged-in student
    # --------------------------------------------------------

    memberships = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.user_id
            == current_user.id
        )
        .all()
    )

    group_ids = {
        member.group_id
        for member in memberships
    }

    # Student is not assigned to any group
    if not group_ids:
        return {
            "total_events": 0,
            "completed_events": 0,
            "present": 0,
            "late": 0,
            "absent": 0,
            "attendance_rate": 0.0,
            "records": []
        }

    # --------------------------------------------------------
    # Find events belonging to student's groups
    # --------------------------------------------------------

    events = (
        db.query(models.Event)
        .outerjoin(
            models.EventGroup,
            models.EventGroup.event_id
            == models.Event.id
        )
        .filter(
            models.Event.organization_id
            == current_user.organization_id,

            (
                models.EventGroup.group_id.in_(group_ids)
                |
                models.Event.group_id.in_(group_ids)
            )
        )
        .distinct()
        .order_by(
            models.Event.starts_at.desc()
        )
        .all()
    )

    now = now_ist()

    # --------------------------------------------------------
    # Finalize absent students for completed events
    # --------------------------------------------------------

    for event in events:

        if (
            event.ends_at is not None
            and event.ends_at <= now
            and not event.is_cancelled
        ):
            finalize_absent_students(
                event,
                db
            )

    # --------------------------------------------------------
    # Get this student's attendance records
    # --------------------------------------------------------

    attendance_records = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.user_id
            == current_user.id
        )
        .all()
    )

    attendance_by_event = {
        record.event_id: record
        for record in attendance_records
    }

    # --------------------------------------------------------
    # Calculate summary
    # --------------------------------------------------------

    records = []

    present = 0
    late = 0
    absent = 0
    completed_events = 0

    # --------------------------------------------------------
    # Build student's attendance history
    # --------------------------------------------------------

    for event in events:

        is_completed = (
            event.ends_at is not None
            and event.ends_at <= now
            and not event.is_cancelled
        )

        if is_completed:
            completed_events += 1

        record = attendance_by_event.get(
            event.id
        )

        if record:

            status = record.status
            check_in = record.check_in

        elif is_completed:

            status = "Absent"
            check_in = None

        else:

            status = "Not Marked"
            check_in = None

        # ----------------------------------------------------
        # Only completed classes contribute to attendance rate
        # ----------------------------------------------------

        if is_completed:

            if status == "Present":
                present += 1

            elif status == "Late":
                late += 1

            elif status == "Absent":
                absent += 1

        records.append({
            "event_id": event.id,
            "event_title": event.title,
            "starts_at": event.starts_at,
            "ends_at": event.ends_at,
            "is_active": event.is_active,
            "is_cancelled": event.is_cancelled,
            "status": status,
            "check_in": check_in
        })

    # --------------------------------------------------------
    # Attendance percentage
    #
    # (Present + Late) / Completed Classes * 100
    # --------------------------------------------------------

    attendance_rate = (
        ((present + late) / completed_events) * 100
        if completed_events > 0
        else 0.0
    )

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "total_events": len(events),
        "completed_events": completed_events,
        "present": present,
        "late": late,
        "absent": absent,
        "attendance_rate": round(
            attendance_rate,
            2
        ),
        "records": records
    }

# ============================================================
# 4. EVENT ATTENDANCE DETAILS
# ============================================================

@router.get("/event/{event_id}/students")
def get_event_attendance_details(

    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_view")
    )
):

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

    require_event_access(
        db,
        event,
        current_user
    )

    finalize_absent_students(
        event,
        db
    )

    students = get_event_students(
        db,
        event,
        current_user.organization_id
    )

    attendance_records = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id
            == event_id
        )
        .all()
    )

    attendance_by_user = {
        record.user_id: record
        for record in attendance_records
    }

    student_result = []

    for student in students:

        record = attendance_by_user.get(
            student.id
        )

        student_result.append({

            "user_id": student.id,

            "name": student.name,

            "employee_id":
                student.employee_id,

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

    group_ids = get_event_group_ids(
        db,
        event
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

        "total_students":
            len(student_result),

        "marked_students":
            sum(
                1
                for student in student_result
                if student["status"] is not None
            ),

        "not_marked":
            sum(
                1
                for student in student_result
                if student["status"] is None
            ),

        "present":
            sum(
                1
                for student in student_result
                if student["status"] == "Present"
            ),

        "late":
            sum(
                1
                for student in student_result
                if student["status"] == "Late"
            ),

        "absent":
            sum(
                1
                for student in student_result
                if student["status"] == "Absent"
            ),

        "students":
            student_result
    }


# ============================================================
# 5. EVENT ATTENDANCE SUMMARY
# ============================================================

@router.get("/event/{event_id}/summary")
def get_event_attendance_summary(

    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_view")
    )
):

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

    require_event_access(
        db,
        event,
        current_user
    )

    finalize_absent_students(
        event,
        db
    )

    students = get_event_students(
        db,
        event,
        current_user.organization_id
    )

    attendance_records = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id
            == event_id
        )
        .all()
    )

    present = 0
    absent = 0
    late = 0
    

    for record in attendance_records:

        if record.status == "Present":
            present += 1

        elif record.status == "Absent":
            absent += 1

        elif record.status == "Late":
            late += 1

    marked_students = len(
        attendance_records
    )

    total_students = len(
        students
    )

    not_marked = max(
        total_students - marked_students,
        0
    )

    group_ids = get_event_group_ids(
        db,
        event
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

        "total_students":
            total_students,

        "marked_students":
            marked_students,

        "not_marked":
            not_marked,

        "present":
            present,

        "absent":
            absent,

        "late":
            late
    }


# ============================================================
# 6. MANUAL ATTENDANCE
# ============================================================

@router.post("/")
def mark_attendance(

    data: AttendanceCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_take")
    )
):

    # --------------------------------------------------------
    # Validate event + teacher event access + time
    # --------------------------------------------------------

    event = get_valid_event(
        db=db,

        event_id=data.event_id,

        organization_id=
            current_user.organization_id,

        current_user=current_user
    )

    # --------------------------------------------------------
    # Find student
    # --------------------------------------------------------

    user = (
        db.query(models.User)
        .filter(
            models.User.id == data.user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "student",

            models.User.is_active == True
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # --------------------------------------------------------
    # Check whether student belongs to ANY event group
    # --------------------------------------------------------

    group_ids = get_event_group_ids(
        db,
        event
    )

    group_member = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.group_id.in_(
                group_ids
            ),

            models.GroupMember.user_id
            == user.id
        )
        .first()
    )

    if group_member is None:

        raise HTTPException(
            status_code=403,
            detail=(
                "Student is not a member "
                "of any group assigned "
                "to this event"
            )
        )

    # --------------------------------------------------------
    # Prevent duplicate attendance
    # --------------------------------------------------------

    existing = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id
            == event.id,

            models.Attendance.user_id
            == user.id
        )
        .first()
    )

    if existing:

        raise HTTPException(
            status_code=409,
            detail=(
                f"{user.name} already marked "
                "for this event"
            )
        )

    # --------------------------------------------------------
    # Calculate status from actual check-in time
    # --------------------------------------------------------

    check_in = now_ist()

    status = calculate_attendance_status(
        event,
        check_in
    )

    # --------------------------------------------------------
    # Create attendance
    # --------------------------------------------------------

    attendance = models.Attendance(

        event_id=event.id,

        user_id=user.id,

        marked_by=current_user.id,

        confidence=data.confidence,

        status=status,

        check_in=check_in
    )

    db.add(attendance)

    db.commit()

    db.refresh(attendance)

    return attendance


# ============================================================
# 7. MODIFY ATTENDANCE
# ============================================================

@router.patch("/{attendance_id}")
def modify_attendance(

    attendance_id: int,

    data: AttendanceUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_modify")
    )
):

    attendance = (
        db.query(models.Attendance)
        .join(
            models.Event,
            models.Attendance.event_id
            == models.Event.id
        )
        .filter(
            models.Attendance.id
            == attendance_id,

            models.Event.organization_id
            == current_user.organization_id
        )
        .first()
    )

    if attendance is None:

        raise HTTPException(
            status_code=404,
            detail="Attendance record not found"
        )

    # --------------------------------------------------------
    # Verify Teacher can access this event
    # --------------------------------------------------------

    require_event_access(
        db,
        attendance.event,
        current_user
    )

    # --------------------------------------------------------
    # Validate status
    # --------------------------------------------------------

    allowed_statuses = {
        "Present",
        "Absent",
        "Late",
    }

    if data.status not in allowed_statuses:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid status. Allowed values: "
                "Present, Absent, Late"
            )
        )

    attendance.status = data.status

    attendance.marked_by = current_user.id

    db.commit()

    db.refresh(attendance)

    return attendance