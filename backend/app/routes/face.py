from app.event_service import get_valid_event

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File
)

from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.auth import require_permission
from app.face_match import recognize_face
from app.face_recognition import face_recognition_service

router = APIRouter(
    prefix="/face",
    tags=["Face Recognition"]
)

# ============================================================
# FACE ENROLLMENT
# ============================================================

@router.post("/enroll/{user_id}")
async def enroll_face(
    user_id: int,
    image: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("face_manage")
    )
):

    # --------------------------------------------------------
    # 1. Find user
    # --------------------------------------------------------

    user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id
        )
        .first()
    )

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )


    # --------------------------------------------------------
    # 2. Organization isolation
    # --------------------------------------------------------

    if (
        user.organization_id
        != current_user.organization_id
    ):

        raise HTTPException(
            status_code=403,
            detail="User belongs to another organization"
        )


    # --------------------------------------------------------
    # 3. Read uploaded image
    # --------------------------------------------------------

    image_bytes = await image.read()

    image_array = (
        __import__("numpy")
        .frombuffer(
            image_bytes,
            dtype="uint8"
        )
    )

    frame = __import__("cv2").imdecode(
        image_array,
        __import__("cv2").IMREAD_COLOR
    )


    if frame is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )


    # --------------------------------------------------------
    # 4. Generate ArcFace embedding
    # --------------------------------------------------------

    embedding = face_recognition_service.get_embedding(
        frame
    )


    if embedding is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Exactly one clear face "
                "must be present"
            )
        )


    # --------------------------------------------------------
    # 5. Deactivate previous embeddings
    # --------------------------------------------------------

    db.query(
        models.FaceEmbedding
    ).filter(
        models.FaceEmbedding.user_id == user_id
    ).update(
        {
            models.FaceEmbedding.is_active: False
        }
    )


    # --------------------------------------------------------
    # 6. Save new embedding
    # --------------------------------------------------------

    face_embedding = models.FaceEmbedding(
        user_id=user_id,
        embedding=embedding,
        is_active=True
    )

    db.add(face_embedding)

    db.commit()

    db.refresh(face_embedding)


    return {
        "user_id": user_id,
        "message": "Face enrolled successfully"
    }


# ============================================================
# FACE RECOGNITION + ATTENDANCE
# ============================================================
# ============================================================
# FACE RECOGNITION
# ============================================================

@router.post("/recognize/{event_id}")
async def recognize_face_for_event(

    event_id: int,

    image: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_take")
    )
):

    # --------------------------------------------------------
    # 1. Validate event
    #
    # This keeps the existing event authorization rules:
    # - organization isolation
    # - event active state
    # - event cancellation
    # - teacher event access
    # - attendance time window
    #
    # IMPORTANT:
    # Recognition does NOT create attendance.
    # --------------------------------------------------------

    event = get_valid_event(
        db=db,
        event_id=event_id,
        organization_id=current_user.organization_id,
        current_user=current_user
    )


    # --------------------------------------------------------
    # 2. Read uploaded image
    # --------------------------------------------------------

    image_bytes = await image.read()

    image_array = (
        __import__("numpy")
        .frombuffer(
            image_bytes,
            dtype="uint8"
        )
    )

    frame = __import__("cv2").imdecode(
        image_array,
        __import__("cv2").IMREAD_COLOR
    )


    if frame is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )


    # --------------------------------------------------------
    # 3. Get all groups belonging to this event
    # --------------------------------------------------------

    event_group_ids = [
        assignment.group_id
        for assignment in event.group_assignments
    ]


    # --------------------------------------------------------
    # Legacy compatibility
    # --------------------------------------------------------

    if not event_group_ids and event.group_id is not None:

        event_group_ids = [
            event.group_id
        ]


    if not event_group_ids:

        raise HTTPException(
            status_code=400,
            detail="Event has no groups assigned"
        )


    # --------------------------------------------------------
    # 4. Recognize face
    #
    # recognize_face() only identifies the best matching
    # student. It does NOT create attendance.
    # --------------------------------------------------------

    user, score = recognize_face(
        frame,
        event_id
    )


    # --------------------------------------------------------
    # 5. Face not recognized
    # --------------------------------------------------------

    if user is None:

        if score is not None:

            return {
                "recognized": False,
                "message": "Face not recognized",
                "confidence": score
            }


        return {
            "recognized": False,
            "message": "No matching face found"
        }


    # --------------------------------------------------------
    # 6. Verify recognized user belongs to at least ONE
    #    group assigned to this event
    # --------------------------------------------------------

    membership = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.user_id == user.id,
            models.GroupMember.group_id.in_(
                event_group_ids
            )
        )
        .first()
    )


    if membership is None:

        raise HTTPException(
            status_code=403,
            detail=(
                "Recognized student is not a member "
                "of any group assigned to this event"
            )
        )


    # --------------------------------------------------------
    # 7. Check whether attendance is already marked
    #
    # This does NOT create attendance.
    # It simply prevents showing the confirmation dialog again
    # for someone who is already marked.
    # --------------------------------------------------------

    existing = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id == event.id,
            models.Attendance.user_id == user.id
        )
        .first()
    )


    if existing:

        return {
            "recognized": True,
            "already_marked": True,

            "user_id": user.id,

            "name": user.name,

            "employee_id": user.employee_id,

            "confidence": score,

            "requires_confirmation": False,

            "message": (
                f"{user.name} already marked"
            )
        }


    # --------------------------------------------------------
    # 8. Return recognition result only
    #
    # Frontend behavior:
    #
    #   recognized = true
    #       ↓
    #   show "Is this Rahul?"
    #       ↓
    #   wait 3 seconds
    #       ↓
    #   NO pressed -> silently rescan
    #   no NO      -> call /face/confirm
    # --------------------------------------------------------

    return {

        "recognized": True,

        "already_marked": False,

        "user_id": user.id,

        "name": user.name,

        "employee_id": user.employee_id,

        "confidence": score,

        "requires_confirmation": True,

        "message": (
            f"Face recognized as {user.name}"
        )
    }


# ============================================================
# CONFIRM / COMMIT ATTENDANCE
# ============================================================

@router.post("/confirm/{event_id}/{user_id}")
async def confirm_recognized_student(

    event_id: int,

    user_id: int,

    confidence: float,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("attendance_take")
    )
):

    # --------------------------------------------------------
    # 1. Validate event
    # --------------------------------------------------------

    event = get_valid_event(
        db=db,
        event_id=event_id,
        organization_id=current_user.organization_id,
        current_user=current_user
    )


    # --------------------------------------------------------
    # 2. Get all event groups
    # --------------------------------------------------------

    event_group_ids = [
        assignment.group_id
        for assignment in event.group_assignments
    ]


    # --------------------------------------------------------
    # Legacy compatibility
    # --------------------------------------------------------

    if not event_group_ids and event.group_id is not None:

        event_group_ids = [
            event.group_id
        ]


    if not event_group_ids:

        raise HTTPException(
            status_code=400,
            detail="Event has no groups assigned"
        )


    # --------------------------------------------------------
    # 3. Find student inside current organization
    # --------------------------------------------------------

    user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,
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
    # 4. Verify student belongs to this event
    # --------------------------------------------------------

    membership = (
        db.query(models.GroupMember)
        .filter(
            models.GroupMember.user_id == user.id,
            models.GroupMember.group_id.in_(
                event_group_ids
            )
        )
        .first()
    )


    if membership is None:

        raise HTTPException(
            status_code=403,
            detail=(
                "Student is not a member of any "
                "group assigned to this event"
            )
        )


    # --------------------------------------------------------
    # 5. Prevent duplicate attendance
    # --------------------------------------------------------

    existing = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.event_id == event.id,
            models.Attendance.user_id == user.id
        )
        .first()
    )


    if existing:

        return {
            "recognized": True,
            "already_marked": True,

            "attendance_id": existing.id,

            "user_id": user.id,

            "name": user.name,

            "employee_id": user.employee_id,

            "confidence": existing.confidence,

            "message": (
                f"{user.name} already marked"
            )
        }


    # --------------------------------------------------------
    # 6. Create attendance
    #
    # THIS is the only place in the face flow where attendance
    # is actually inserted into the database.
    # --------------------------------------------------------

    attendance = models.Attendance(

        event_id=event.id,

        user_id=user.id,

        # Person operating the attendance camera
        marked_by=current_user.id,

        confidence=confidence,

        status="Present"
    )


    db.add(attendance)

    db.commit()

    db.refresh(attendance)


    # --------------------------------------------------------
    # 7. Return successful response
    # --------------------------------------------------------

    return {

        "recognized": True,

        "already_marked": False,

        "attendance_id": attendance.id,

        "user_id": user.id,

        "name": user.name,

        "employee_id": user.employee_id,

        "confidence": confidence,

        "message": (
            f"{user.name} marked present"
        )
    }
