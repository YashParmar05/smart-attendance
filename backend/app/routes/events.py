from app.timezone import now_ist

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session
from sqlalchemy import or_, select

from app import models

from app.auth import (
    require_permission,
    ADMIN,
    TEACHER,
    STUDENT
)

from app.database import get_db

from app.schemas import (
    EventCreate,
    EventResponse,
    EventStatusUpdate,
    EventTeachersAdd
)

from app.access_control import (
    can_access_event,
    require_event_access,
    require_group_access
)


router = APIRouter(
    prefix="/events",
    tags=["Events"]
)


# ============================================================
# EVENT ACCESS HELPERS
# ============================================================

def get_event_for_user(
    db: Session,
    event_id: int,
    current_user: models.User
):
    """
    Get an event belonging to the current user's organization.

    IMPORTANT:
    This function checks only organization ownership.

    Actual teacher event authorization is handled separately
    using require_event_access().
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

    # Students may access only events assigned to groups
    # in which they are currently an active member.
    if current_user.role == STUDENT:
        membership = (
            db.query(models.GroupMember)
            .join(
                models.EventGroup,
                models.EventGroup.group_id
                == models.GroupMember.group_id
            )
            .join(
                models.Group,
                models.Group.id
                == models.GroupMember.group_id
            )
            .filter(
                models.EventGroup.event_id == event.id,
                models.GroupMember.user_id == current_user.id,
                models.Group.is_active == True
            )
            .first()
        )

        # Legacy events may still have only Event.group_id.
        legacy_membership = None
        if membership is None and event.group_id is not None:
            legacy_membership = (
                db.query(models.GroupMember)
                .join(
                    models.Group,
                    models.Group.id
                    == models.GroupMember.group_id
                )
                .filter(
                    models.GroupMember.group_id == event.group_id,
                    models.GroupMember.user_id == current_user.id,
                    models.Group.is_active == True
                )
                .first()
            )

        if membership is None and legacy_membership is None:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this event"
            )

    return event


def check_event_manage_access(
    db: Session,
    event: models.Event,
    current_user: models.User
):
    """
    Check whether the user is allowed to manage this event.

    ADMIN:
        Can manage any event in their organization.

    TEACHER:
        Can manage the event if:
            - they created it
            OR
            - they are explicitly assigned through EventTeacher.

    IMPORTANT:
        GroupTeacher is NOT used for event access.
    """

    if current_user.role == ADMIN:

        if (
            event.organization_id
            != current_user.organization_id
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this event"
            )

        return

    if current_user.role == TEACHER:

        if not can_access_event(
            db,
            event,
            current_user
        ):
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this event"
            )

        return

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to manage this event"
    )


# ============================================================
# EVENT RESPONSE BUILDER
# ============================================================

def build_event_response(
    db: Session,
    event: models.Event
):
    """
    Convert Event database object into the API response.

    Supports both:
        - new EventGroup relationships
        - old events using events.group_id

    This gives us a safe migration path.
    """

    # --------------------------------------------------------
    # Get event groups
    # --------------------------------------------------------

    event_group_rows = (
        db.query(models.EventGroup)
        .filter(
            models.EventGroup.event_id
            == event.id
        )
        .order_by(
            models.EventGroup.id.asc()
        )
        .all()
    )

    group_ids = [
        row.group_id
        for row in event_group_rows
    ]

    # --------------------------------------------------------
    # Backward compatibility for old events
    # --------------------------------------------------------

    if not group_ids and event.group_id is not None:
        group_ids = [
            event.group_id
        ]

    # --------------------------------------------------------
    # Get event teachers
    # --------------------------------------------------------

    event_teacher_rows = (
        db.query(models.EventTeacher)
        .filter(
            models.EventTeacher.event_id
            == event.id
        )
        .order_by(
            models.EventTeacher.id.asc()
        )
        .all()
    )

    teacher_ids = [
        row.teacher_id
        for row in event_teacher_rows
    ]

    # --------------------------------------------------------
    # Backward compatibility
    #
    # Older events may not have an EventTeacher row for their
    # creator.
    #
    # The creator still has event access.
    # --------------------------------------------------------

    # Only expose the creator as a teacher when the creator is
    # actually an active teacher in this organization.
    #
    # Admin creators already have organization-wide event access.
    # Returning an Admin in teacher_ids is incorrect because the
    # frontend sends teacher_ids back during edit, while teacher
    # validation only accepts active TEACHER users.
    if (
        event.created_by is not None
        and event.created_by not in teacher_ids
    ):
        creator = (
            db.query(models.User)
            .filter(
                models.User.id == event.created_by,
                models.User.organization_id == event.organization_id,
                models.User.role == TEACHER,
                models.User.is_active == True,
            )
            .first()
        )

        if creator is not None:
            teacher_ids.insert(0, creator.id)

    return {
        "id": event.id,
        "organization_id": event.organization_id,

        # Legacy field.
        # The first event group is used here.
        "group_id": (
            group_ids[0]
            if group_ids
            else event.group_id
        ),

        # New many-to-many fields.
        "group_ids": group_ids,
        "teacher_ids": teacher_ids,

        "title": event.title,
        "created_by": event.created_by,
        "starts_at": event.starts_at,
        "ends_at": event.ends_at,
        "is_active": event.is_active,
        "created_at": event.created_at,
        "is_cancelled": event.is_cancelled
    }


# ============================================================
# EVENT EXPIRY HELPER
# ============================================================

def expire_event_if_needed(
    db: Session,
    event: models.Event
):
    """
    Automatically marks an event inactive when its end time
    has passed.

    Cancelled events remain cancelled and are not modified.
    """

    now = now_ist()

    if (
        not event.is_cancelled
        and event.is_active
        and event.ends_at is not None
        and now >= event.ends_at
    ):

        event.is_active = False

        db.commit()
        db.refresh(event)

        return True

    return False


# ============================================================
# GROUP VALIDATION
# ============================================================

def get_valid_event_groups(
    db: Session,
    group_ids: list[int],
    current_user: models.User
):
    """
    Validate all groups selected for an event.

    Requirements:
        - at least one group
        - no duplicate IDs
        - groups belong to same organization
        - groups are active
        - teacher must have access to every selected group
    """

    if not group_ids:

        raise HTTPException(
            status_code=400,
            detail="At least one group is required"
        )

    # --------------------------------------------------------
    # Remove duplicates while preserving order.
    # --------------------------------------------------------

    unique_group_ids = list(
        dict.fromkeys(group_ids)
    )

    groups = (
        db.query(models.Group)
        .filter(
            models.Group.id.in_(unique_group_ids),
            models.Group.organization_id
            == current_user.organization_id,
            models.Group.is_active == True
        )
        .all()
    )

    group_map = {
        group.id: group
        for group in groups
    }

    # --------------------------------------------------------
    # Check every requested group exists.
    # --------------------------------------------------------

    missing_ids = [
        group_id
        for group_id in unique_group_ids
        if group_id not in group_map
    ]

    if missing_ids:

        raise HTTPException(
            status_code=404,
            detail=(
                "One or more groups were not found, "
                "inactive, or do not belong to your organization"
            )
        )

    # --------------------------------------------------------
    # Teacher group authorization.
    #
    # A teacher may create/update an event for a group only
    # if they can access that group.
    # --------------------------------------------------------

    if current_user.role == TEACHER:

        for group in groups:

            require_group_access(
                db,
                group,
                current_user
            )

    # Return groups in exactly the same order as requested.
    return [
        group_map[group_id]
        for group_id in unique_group_ids
    ]


# ============================================================
# TEACHER VALIDATION
# ============================================================

def get_valid_event_teachers(
    db: Session,
    teacher_ids: list[int],
    current_user: models.User
):
    """
    Validate teacher IDs selected for an event.

    Every teacher must:
        - belong to the same organization
        - be active
        - have role = teacher
    """

    unique_teacher_ids = list(
        dict.fromkeys(teacher_ids)
    )

    if not unique_teacher_ids:
        return []

    teachers = (
        db.query(models.User)
        .filter(
            models.User.id.in_(unique_teacher_ids),
            models.User.organization_id
            == current_user.organization_id,
            models.User.role == TEACHER,
            models.User.is_active == True
        )
        .all()
    )

    teacher_map = {
        teacher.id: teacher
        for teacher in teachers
    }

    missing_ids = [
        teacher_id
        for teacher_id in unique_teacher_ids
        if teacher_id not in teacher_map
    ]

    if missing_ids:

        raise HTTPException(
            status_code=404,
            detail=(
                "One or more teachers were not found, "
                "inactive, or do not belong to this organization"
            )
        )

    return [
        teacher_map[teacher_id]
        for teacher_id in unique_teacher_ids
    ]




# ============================================================
# CREATE NEW EVENT OCCURRENCE
# ============================================================

def create_new_event_occurrence(
    db: Session,
    source_event: models.Event,
    data: EventCreate,
    groups,
    requested_teachers,
):
    """
    Create a NEW event occurrence without modifying the existing event.

    This is used when an event already has attendance history or has
    already completed. The old event and all of its attendance records
    remain unchanged.

    IMPORTANT:
        One Event ID = One attendance cycle.
    """

    # The old Event ID remains the historical attendance cycle.
    # It must no longer be the active cycle after rescheduling.
    source_event.is_active = False

    new_event = models.Event(
        organization_id=source_event.organization_id,
        group_id=groups[0].id,
        title=data.title,
        created_by=source_event.created_by,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        is_active=True,
        is_cancelled=False
    )

    db.add(new_event)
    db.flush()

    # --------------------------------------------------------
    # Copy the selected event groups.
    # --------------------------------------------------------

    for group in groups:

        db.add(
            models.EventGroup(
                event_id=new_event.id,
                group_id=group.id
            )
        )

    # --------------------------------------------------------
    # Copy the selected event teachers.
    # --------------------------------------------------------

    assigned_teacher_ids = set()

    for teacher in requested_teachers:

        db.add(
            models.EventTeacher(
                event_id=new_event.id,
                teacher_id=teacher.id
            )
        )

        assigned_teacher_ids.add(
            teacher.id
        )

    # --------------------------------------------------------
    # Preserve the original teacher creator's event access.
    #
    # If the original creator is a teacher, they must retain
    # access to the new occurrence as well.
    # --------------------------------------------------------

    if (
        source_event.created_by
        and source_event.created_by
        not in assigned_teacher_ids
    ):

        creator = (
            db.query(models.User)
            .filter(
                models.User.id == source_event.created_by,
                models.User.organization_id
                == source_event.organization_id,
                models.User.role == TEACHER,
                models.User.is_active == True,
            )
            .first()
        )

        if creator is not None:

            db.add(
                models.EventTeacher(
                    event_id=new_event.id,
                    teacher_id=source_event.created_by
                )
            )

    db.commit()
    db.refresh(new_event)

    return new_event


# ============================================================
# GET TEACHERS AVAILABLE FOR EVENT ASSIGNMENT
# ============================================================

@router.get("/teachers")
def get_event_teachers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("event_view")
    )
):
    """
    Return active Teachers from the current organization.

    Used by the Events page when selecting teachers
    for an event.
    """

    teachers = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.role == TEACHER,

            models.User.is_active == True
        )
        .order_by(
            models.User.name.asc()
        )
        .all()
    )

    return [
        {
            "id": teacher.id,
            "name": teacher.name,
            "email": teacher.email,
            "employee_id": teacher.employee_id,
        }
        for teacher in teachers
    ]


# ============================================================
# 1. CREATE EVENT
# ============================================================

@router.post(
    "/",
    response_model=EventResponse
)
def create_event(
    data: EventCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_create")
    )
):

    # --------------------------------------------------------
    # Validate event time.
    # --------------------------------------------------------

    if data.ends_at is None:

        raise HTTPException(
            status_code=400,
            detail="End date and time are required"
        )

    if data.ends_at <= data.starts_at:

        raise HTTPException(
            status_code=400,
            detail="ends_at must be later than starts_at"
        )

    # --------------------------------------------------------
    # Validate groups.
    # --------------------------------------------------------

    groups = get_valid_event_groups(
        db,
        data.group_ids,
        current_user
    )

    # --------------------------------------------------------
    # Validate explicitly assigned teachers.
    # --------------------------------------------------------

    requested_teachers = get_valid_event_teachers(
        db,
        data.teacher_ids,
        current_user
    )

    # --------------------------------------------------------
    # Create Event.
    #
    # group_id stores the first group temporarily for backward
    # compatibility.
    # --------------------------------------------------------

    event = models.Event(
        organization_id=current_user.organization_id,

        group_id=groups[0].id,

        title=data.title,

        created_by=current_user.id,

        starts_at=data.starts_at,

        ends_at=data.ends_at,

        is_active=True,

        is_cancelled=False
    )

    db.add(event)
    db.flush()

    # --------------------------------------------------------
    # Add EventGroup relationships.
    # --------------------------------------------------------

    for group in groups:

        assignment = models.EventGroup(
            event_id=event.id,
            group_id=group.id
        )

        db.add(assignment)

    # --------------------------------------------------------
    # Add explicitly selected EventTeacher relationships.
    # --------------------------------------------------------

    assigned_teacher_ids = set()

    for teacher in requested_teachers:

        assignment = models.EventTeacher(
            event_id=event.id,
            teacher_id=teacher.id
        )

        db.add(assignment)

        assigned_teacher_ids.add(
            teacher.id
        )

    # --------------------------------------------------------
    # Event creator ALWAYS gets event access.
    #
    # If creator is a teacher, store them explicitly.
    #
    # If creator is Admin, admin already has organization-wide
    # event access, so an EventTeacher row is not required.
    # --------------------------------------------------------

    if (
        current_user.role == TEACHER
        and current_user.id not in assigned_teacher_ids
    ):

        creator_assignment = models.EventTeacher(
            event_id=event.id,
            teacher_id=current_user.id
        )

        db.add(creator_assignment)

    db.commit()
    db.refresh(event)

    return build_event_response(
        db,
        event
    )


# ============================================================
# 2. GET EVENTS
# ============================================================

@router.get("/")
def get_events(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_view")
    )
):

    # --------------------------------------------------------
    # ADMIN
    #
    # Admin sees every event in their organization.
    # --------------------------------------------------------

    if current_user.role == ADMIN:

        events = (
            db.query(models.Event)
            .filter(
                models.Event.organization_id
                == current_user.organization_id
            )
            .order_by(
                models.Event.starts_at.desc()
            )
            .all()
        )

    # --------------------------------------------------------
    # TEACHER
    #
    # Teacher sees:
    #   1. events they created
    #   OR
    #   2. events explicitly assigned through EventTeacher
    #
    # GroupTeacher is intentionally NOT included.
    # --------------------------------------------------------

    elif current_user.role == TEACHER:

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
                    models.Event.created_by
                    == current_user.id
                )
                |
                (
                    models.EventTeacher.teacher_id
                    == current_user.id
                )
            )
            .distinct()
            .order_by(
                models.Event.starts_at.desc()
            )
            .all()
        )

    # --------------------------------------------------------
    # STUDENT
    #
    # Student sees only events assigned to active groups in
    # which the student is currently a member.
    # --------------------------------------------------------

    elif current_user.role == STUDENT:

        student_group_ids = (
            select(models.GroupMember.group_id)
            .join(
                models.Group,
                models.Group.id
                == models.GroupMember.group_id
            )
            .filter(
                models.GroupMember.user_id == current_user.id,
                models.Group.organization_id
                == current_user.organization_id,
                models.Group.is_active == True
            )
            .subquery()
        )

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
                or_(
                    models.EventGroup.group_id.in_(
                        student_group_ids
                    ),
                    models.Event.group_id.in_(
                        student_group_ids
                    )
                )
            )
            .distinct()
            .order_by(
                models.Event.starts_at.desc()
            )
            .all()
        )

    else:

        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view events"
        )

    # --------------------------------------------------------
    # Expire events where necessary.
    # --------------------------------------------------------

    now = now_ist()
    changed = False

    for event in events:

        if (
            not event.is_cancelled
            and event.is_active
            and event.ends_at is not None
            and now >= event.ends_at
        ):

            event.is_active = False
            changed = True

    if changed:

        db.commit()

        for event in events:
            db.refresh(event)

    # --------------------------------------------------------
    # Build API responses.
    # --------------------------------------------------------

    return [
        build_event_response(
            db,
            event
        )
        for event in events
    ]


# ============================================================
# 3. GET ONE EVENT
# ============================================================

@router.get(
    "/{event_id}",
    response_model=EventResponse
)
def get_event(
    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_view")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    # --------------------------------------------------------
    # Authorization.
    #
    # Admin:
    #   organization-wide access.
    #
    # Teacher:
    #   creator OR EventTeacher.
    # --------------------------------------------------------

    require_event_access(
        db,
        event,
        current_user
    )

    # --------------------------------------------------------
    # Expire if necessary.
    # --------------------------------------------------------

    expire_event_if_needed(
        db,
        event
    )

    return build_event_response(
        db,
        event
    )


# ============================================================
# 4. EDIT EVENT
# ============================================================

@router.patch(
    "/{event_id}",
    response_model=EventResponse
)
def update_event(
    event_id: int,

    data: EventCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_modify")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    # --------------------------------------------------------
    # Cancelled events cannot be edited.
    # --------------------------------------------------------

    if event.is_cancelled:

        raise HTTPException(
            status_code=400,
            detail="Cancelled events cannot be edited"
        )

    # --------------------------------------------------------
    # Event access.
    #
    # Teacher may manage:
    #   creator OR explicitly assigned teacher.
    # --------------------------------------------------------

    check_event_manage_access(
        db,
        event,
        current_user
    )

    # --------------------------------------------------------
    # Validate groups.
    # --------------------------------------------------------

    groups = get_valid_event_groups(
        db,
        data.group_ids,
        current_user
    )

    # --------------------------------------------------------
    # Validate teachers.
    # --------------------------------------------------------

    requested_teachers = get_valid_event_teachers(
        db,
        data.teacher_ids,
        current_user
    )

    # --------------------------------------------------------
    # End time is required for editing.
    # --------------------------------------------------------

    if data.ends_at is None:

        raise HTTPException(
            status_code=400,
            detail="End date and time are required"
        )

    if data.ends_at <= data.starts_at:

        raise HTTPException(
            status_code=400,
            detail="ends_at must be later than starts_at"
        )

    # --------------------------------------------------------
    # Current time.
    # --------------------------------------------------------

    now = now_ist()

    # --------------------------------------------------------
    # Attendance history check.
    #
    # Attendance locks the START time of the current event
    # occurrence. The END time can still be moved while the
    # event is live, provided the new end is in the future.
    #
    # IMPORTANT:
    #   - Expired event -> create a NEW occurrence.
    #   - Live event + no attendance -> start may be changed.
    #   - Live event + attendance -> start is LOCKED.
    #   - Upcoming event -> normal edit.
    # --------------------------------------------------------

    attendance_exists = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id == event.id
        )
        .first()
        is not None
    )

    event_expired = (
        event.ends_at is not None
        and now >= event.ends_at
    )

    event_started = (
        event.starts_at is not None
        and now >= event.starts_at
    )

    # --------------------------------------------------------
    # EXPIRED EVENT
    # --------------------------------------------------------
    #
    # Once an event occurrence has expired, never modify its
    # schedule in place. Create a new occurrence so the old
    # attendance history remains attached to the old Event ID.
    # --------------------------------------------------------

    if event_expired:

        if data.starts_at <= now:

            raise HTTPException(
                status_code=400,
                detail=(
                    "This event has already expired. A new event "
                    "occurrence must start in the future."
                )
            )

        new_event = create_new_event_occurrence(
            db,
            event,
            data,
            groups,
            requested_teachers
        )

        return build_event_response(
            db,
            new_event
        )

    # --------------------------------------------------------
    # ATTENDANCE EXISTS
    # --------------------------------------------------------
    #
    # Once the first attendance record is created, the START
    # time of this Event ID becomes immutable. This applies
    # even if the event is currently live.
    # --------------------------------------------------------

    if attendance_exists and data.starts_at != event.starts_at:

        raise HTTPException(
            status_code=400,
            detail=(
                "Attendance has already been created for this "
                "event. The start time cannot be changed."
            )
        )

    # --------------------------------------------------------
    # LIVE EVENT
    # --------------------------------------------------------
    #
    # If the event has started but has NO attendance yet, the
    # start time may still be changed.
    #
    # The end time may be moved earlier or later, but it must
    # remain in the future.
    # --------------------------------------------------------

    if event_started:

        if data.ends_at <= now:

            raise HTTPException(
                status_code=400,
                detail=(
                    "A live event must have a future end time."
                )
            )

    # --------------------------------------------------------
    # Update basic event data.
    # --------------------------------------------------------

    event.title = data.title

    event.starts_at = data.starts_at

    event.ends_at = data.ends_at

    # Keep legacy group_id synchronized with first group.
    event.group_id = groups[0].id

    # --------------------------------------------------------
    # Replace EventGroup relationships.
    # --------------------------------------------------------

    existing_group_assignments = (
        db.query(models.EventGroup)
        .filter(
            models.EventGroup.event_id
            == event.id
        )
        .all()
    )

    for assignment in existing_group_assignments:
        db.delete(assignment)

    db.flush()

    for group in groups:

        db.add(
            models.EventGroup(
                event_id=event.id,
                group_id=group.id
            )
        )

    # --------------------------------------------------------
    # Replace EventTeacher relationships.
    # --------------------------------------------------------

    existing_teacher_assignments = (
        db.query(models.EventTeacher)
        .filter(
            models.EventTeacher.event_id
            == event.id
        )
        .all()
    )

    for assignment in existing_teacher_assignments:
        db.delete(assignment)

    db.flush()

    assigned_teacher_ids = set()

    for teacher in requested_teachers:

        db.add(
            models.EventTeacher(
                event_id=event.id,
                teacher_id=teacher.id
            )
        )

        assigned_teacher_ids.add(
            teacher.id
        )

    # --------------------------------------------------------
    # Teacher creator must retain access.
    # --------------------------------------------------------

    if (
        event.created_by
        and event.created_by
        not in assigned_teacher_ids
    ):

        creator = (
            db.query(models.User)
            .filter(
                models.User.id == event.created_by,
                models.User.organization_id == event.organization_id,
                models.User.role == TEACHER,
                models.User.is_active == True,
            )
            .first()
        )

        if creator is not None:

            db.add(
                models.EventTeacher(
                    event_id=event.id,
                    teacher_id=event.created_by
                )
            )

    db.commit()
    db.refresh(event)

    return build_event_response(
        db,
        event
    )


# ============================================================
# 5. REACTIVATE EVENT
# ============================================================

@router.patch(
    "/{event_id}/reactivate",
    response_model=EventResponse
)
def reactivate_event(
    event_id: int,

    data: EventCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_modify")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    # --------------------------------------------------------
    # Cancelled events cannot be reactivated.
    # --------------------------------------------------------

    if event.is_cancelled:

        raise HTTPException(
            status_code=400,
            detail="Cancelled events cannot be reactivated"
        )

    # --------------------------------------------------------
    # Authorization.
    # --------------------------------------------------------

    check_event_manage_access(
        db,
        event,
        current_user
    )

    now = now_ist()

    # --------------------------------------------------------
    # If the event is technically active but its end time has
    # passed, first treat it as expired.
    # --------------------------------------------------------

    if (
        event.is_active
        and event.ends_at is not None
        and now >= event.ends_at
    ):

        event.is_active = False

        db.commit()
        db.refresh(event)

    elif event.is_active:

        raise HTTPException(
            status_code=400,
            detail="Event is already active"
        )

    # --------------------------------------------------------
    # Validate groups.
    # --------------------------------------------------------

    groups = get_valid_event_groups(
        db,
        data.group_ids,
        current_user
    )

    # --------------------------------------------------------
    # Validate teachers.
    # --------------------------------------------------------

    requested_teachers = get_valid_event_teachers(
        db,
        data.teacher_ids,
        current_user
    )

    # --------------------------------------------------------
    # Reactivation requires an end time.
    # --------------------------------------------------------

    if data.ends_at is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "A future end time is required "
                "when reactivating an event"
            )
        )

    # --------------------------------------------------------
    # Validate time range.
    # --------------------------------------------------------

    if data.ends_at <= data.starts_at:

        raise HTTPException(
            status_code=400,
            detail="ends_at must be later than starts_at"
        )

    # --------------------------------------------------------
    # The complete reactivated/new event window must be in the
    # future.
    # --------------------------------------------------------

    if data.starts_at < now:

        raise HTTPException(
            status_code=400,
            detail=(
                "The event start time must be in the future "
                "when reactivating an event"
            )
        )

    if data.ends_at <= now:

        raise HTTPException(
            status_code=400,
            detail="Reactivation time must be in the future"
        )

    # --------------------------------------------------------
    # Attendance history check.
    #
    # If this Event ID already has attendance, it represents
    # a completed/used attendance cycle.
    #
    # Reactivating it with a new date must therefore create
    # a NEW event occurrence instead of changing the old one.
    # --------------------------------------------------------

    attendance_exists = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id == event.id
        )
        .first()
        is not None
    )

    event_completed = (
        event.ends_at is not None
        and now >= event.ends_at
    )

    if attendance_exists or event_completed:

        new_event = create_new_event_occurrence(
            db,
            event,
            data,
            groups,
            requested_teachers
        )

        return build_event_response(
            db,
            new_event
        )

    # --------------------------------------------------------
    # No attendance history and the event has not completed.
    #
    # This is a genuine reactivation of the SAME event cycle.
    # --------------------------------------------------------

    event.title = data.title

    event.starts_at = data.starts_at

    event.ends_at = data.ends_at

    event.group_id = groups[0].id

    event.is_active = True

    # --------------------------------------------------------
    # Replace groups.
    # --------------------------------------------------------

    existing_group_assignments = (
        db.query(models.EventGroup)
        .filter(
            models.EventGroup.event_id
            == event.id
        )
        .all()
    )

    for assignment in existing_group_assignments:
        db.delete(assignment)

    db.flush()

    for group in groups:

        db.add(
            models.EventGroup(
                event_id=event.id,
                group_id=group.id
            )
        )

    # --------------------------------------------------------
    # Replace teachers.
    # --------------------------------------------------------

    existing_teacher_assignments = (
        db.query(models.EventTeacher)
        .filter(
            models.EventTeacher.event_id
            == event.id
        )
        .all()
    )

    for assignment in existing_teacher_assignments:
        db.delete(assignment)

    db.flush()

    assigned_teacher_ids = set()

    for teacher in requested_teachers:

        db.add(
            models.EventTeacher(
                event_id=event.id,
                teacher_id=teacher.id
            )
        )

        assigned_teacher_ids.add(
            teacher.id
        )

    # --------------------------------------------------------
    # Preserve creator access.
    # --------------------------------------------------------

    if (
        event.created_by
        and event.created_by
        not in assigned_teacher_ids
    ):

        creator = (
            db.query(models.User)
            .filter(
                models.User.id == event.created_by,
                models.User.organization_id == event.organization_id,
                models.User.role == TEACHER,
                models.User.is_active == True,
            )
            .first()
        )

        if creator is not None:

            db.add(
                models.EventTeacher(
                    event_id=event.id,
                    teacher_id=event.created_by
                )
            )

    db.commit()
    db.refresh(event)

    return build_event_response(
        db,
        event
    )


# ============================================================
# 6. UPDATE EVENT STATUS
# ============================================================

@router.patch(
    "/{event_id}/status",
    response_model=EventResponse
)
def update_event_status(
    event_id: int,

    data: EventStatusUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_modify")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    check_event_manage_access(
        db,
        event,
        current_user
    )

    # --------------------------------------------------------
    # Status endpoint only handles deactivation.
    #
    # Reactivation must use /reactivate because it requires
    # a future event window.
    # --------------------------------------------------------

    if data.is_active:

        raise HTTPException(
            status_code=400,
            detail=(
                "Use the Reactivate action to "
                "reactivate an inactive event"
            )
        )

    event.is_active = False

    db.commit()
    db.refresh(event)

    return build_event_response(
        db,
        event
    )


# ============================================================
# 7. CANCEL EVENT
# ============================================================

@router.delete(
    "/{event_id}",
    response_model=EventResponse
)
def delete_event(
    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_delete")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    check_event_manage_access(
        db,
        event,
        current_user
    )

    # --------------------------------------------------------
    # Cancelled event cannot be cancelled again.
    # --------------------------------------------------------

    if event.is_cancelled:

        raise HTTPException(
            status_code=400,
            detail="Event is already cancelled"
        )

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Expired events cannot be cancelled.
    # --------------------------------------------------------

    now = now_ist()

    if (
        event.ends_at is not None
        and now >= event.ends_at
    ):

        raise HTTPException(
            status_code=400,
            detail="Expired events cannot be cancelled"
        )

    # --------------------------------------------------------
    # Soft cancellation.
    #
    # We preserve the event and attendance history.
    # --------------------------------------------------------

    event.is_active = False

    event.is_cancelled = True

    db.commit()
    db.refresh(event)

    return build_event_response(
        db,
        event
    )


# ============================================================
# GET AVAILABLE TEACHERS FOR EVENT ASSIGNMENT
# ============================================================

@router.get("/teachers")
def get_available_event_teachers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("event_view")
    )
):
    teachers = (
        db.query(models.User)
        .filter(
            models.User.organization_id == current_user.organization_id,
            models.User.role == TEACHER,
            models.User.is_active == True
        )
        .order_by(models.User.name.asc())
        .all()
    )

    return [
        {
            "id": teacher.id,
            "name": teacher.name,
            "email": teacher.email,
            "employee_id": teacher.employee_id,
        }
        for teacher in teachers
    ]


# ============================================================
# 8. GET EVENT TEACHERS
# ============================================================

@router.get(
    "/{event_id}/teachers"
)
def get_event_teachers(
    event_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_view")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    require_event_access(
        db,
        event,
        current_user
    )

    assignments = (
        db.query(models.EventTeacher)
        .join(
            models.User,
            models.User.id
            == models.EventTeacher.teacher_id
        )
        .filter(
            models.EventTeacher.event_id
            == event.id
        )
        .order_by(
            models.EventTeacher.id.asc()
        )
        .all()
    )

    return [
        {
            "id": assignment.id,
            "event_id": assignment.event_id,
            "teacher_id": assignment.teacher_id,
            "teacher_name": assignment.teacher.name,
            "teacher_email": assignment.teacher.email,
            "added_at": assignment.added_at
        }
        for assignment in assignments
    ]


# ============================================================
# 9. ADD EVENT TEACHERS
# ============================================================

@router.post(
    "/{event_id}/teachers"
)
def add_event_teachers(
    event_id: int,

    data: EventTeachersAdd,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_modify")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    check_event_manage_access(
        db,
        event,
        current_user
    )

    teachers = get_valid_event_teachers(
        db,
        data.teacher_ids,
        current_user
    )

    added_teacher_ids = []

    for teacher in teachers:

        existing = (
            db.query(models.EventTeacher)
            .filter(
                models.EventTeacher.event_id
                == event.id,

                models.EventTeacher.teacher_id
                == teacher.id
            )
            .first()
        )

        if existing is not None:
            continue

        db.add(
            models.EventTeacher(
                event_id=event.id,
                teacher_id=teacher.id
            )
        )

        added_teacher_ids.append(
            teacher.id
        )

    db.commit()

    return {
        "message": "Teachers added to event",
        "event_id": event.id,
        "teacher_ids": added_teacher_ids
    }


# ============================================================
# 10. REMOVE EVENT TEACHER
# ============================================================

@router.delete(
    "/{event_id}/teachers/{teacher_id}"
)
def remove_event_teacher(
    event_id: int,

    teacher_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("event_modify")
    )
):

    event = get_event_for_user(
        db,
        event_id,
        current_user
    )

    check_event_manage_access(
        db,
        event,
        current_user
    )

    assignment = (
        db.query(models.EventTeacher)
        .filter(
            models.EventTeacher.event_id
            == event.id,

            models.EventTeacher.teacher_id
            == teacher_id
        )
        .first()
    )

    if assignment is None:

        raise HTTPException(
            status_code=404,
            detail="Teacher is not assigned to this event"
        )

    # --------------------------------------------------------
    # The event creator always retains access through
    # event.created_by even if their EventTeacher row is
    # removed.
    # --------------------------------------------------------

    db.delete(assignment)

    db.commit()

    return {
        "message": "Teacher removed from event",
        "event_id": event.id,
        "teacher_id": teacher_id
    }