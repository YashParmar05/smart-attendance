import cv2
import numpy as np

from fastapi.responses import Response

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
)

from sqlalchemy.orm import Session

from app.database import get_db

from app.schemas import (
    UserCreate,
    UserResponse,
    UserStatusUpdate,
    UserBulkStatusUpdate,
    PasswordChange,
    PasswordReset,
    UserUpdate,
)

from app.auth import (
    get_current_user,
    verify_password,
    hash_password,
    require_admin,
    require_permission,
    require_user_management_permission,
    ADMIN,
    TEACHER,
    STUDENT,
    STUDENT_MANAGE,
    TEACHER_MANAGE,
)

from app.crud import (
    create_user,
    update_user_password,
)

from app.auth import (
    get_current_user,
    verify_password,
    hash_password,
    require_admin,
    require_permission,
    require_user_management_permission,
    ADMIN,
    TEACHER,
    STUDENT,
    STUDENT_MANAGE,
    TEACHER_MANAGE,
)

from app import models

from app.face_recognition import face_recognition_service

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

# ==================================================
# FACE PHOTO NORMALIZATION
# ==================================================

def normalize_face_photo(
    image_bytes: bytes
) -> bytes:

    # -----------------------------------------
    # Convert uploaded bytes → OpenCV image
    # -----------------------------------------

    image_array = np.frombuffer(
        image_bytes,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file"
        )

    print(
        "Enrollment image:",
        image.shape
    )

    # -----------------------------------------
    # Detect faces using InsightFace
    # -----------------------------------------

    faces = face_recognition_service.app.get(image)

    print(
        "InsightFace detected:",
        len(faces),
        "face(s)"
    )

    # Print detection confidence
    for index, face in enumerate(faces):
        print(
            f"Face {index + 1} "
            f"confidence:",
            float(face.det_score)
        )

    # -----------------------------------------
    # NO FACE
    # -----------------------------------------

    if len(faces) == 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "No face detected. "
                "Please upload a clear photo "
                "containing one face."
            )
        )

    # -----------------------------------------
    # MULTIPLE FACES
    # -----------------------------------------

    if len(faces) > 1:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Multiple faces detected "
                f"({len(faces)}). "
                "Please upload a photo containing "
                "only one face."
            )
        )

    # -----------------------------------------
    # EXACTLY ONE FACE
    # -----------------------------------------

    face = faces[0]

    print(
        "Single face detected successfully."
    )

    # -----------------------------------------
    # Get InsightFace bounding box
    #
    # [x1, y1, x2, y2]
    # -----------------------------------------

    x1, y1, x2, y2 = map(
        int,
        face.bbox
    )

    height, width = image.shape[:2]

    # -----------------------------------------
    # Add padding around face
    # -----------------------------------------

    face_width = x2 - x1
    face_height = y2 - y1

    padding = int(
        max(
            face_width,
            face_height
        ) * 0.35
    )

    x1 = max(
        0,
        x1 - padding
    )

    y1 = max(
        0,
        y1 - padding
    )

    x2 = min(
        width,
        x2 + padding
    )

    y2 = min(
        height,
        y2 + padding
    )

    # -----------------------------------------
    # Crop face
    # -----------------------------------------

    cropped = image[
        y1:y2,
        x1:x2
    ]

    if cropped.size == 0:

        raise HTTPException(
            status_code=400,
            detail="Unable to crop face"
        )

    # -----------------------------------------
    # Standardize image size
    # -----------------------------------------

    cropped = cv2.resize(
        cropped,
        (320, 320),
        interpolation=cv2.INTER_AREA
    )

    # -----------------------------------------
    # Encode as JPEG
    # -----------------------------------------

    success, encoded = cv2.imencode(
        ".jpg",
        cropped,
        [
            cv2.IMWRITE_JPEG_QUALITY,
            90
        ]
    )

    if not success:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to process face photo"
            )
        )

    return encoded.tobytes()

# ==================================================
# GET FACE PHOTO
# ==================================================

@router.get("/{user_id}/face-photo")
def get_student_face_photo(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    )
):
    face_embedding = (
        db.query(models.FaceEmbedding)
        .join(
            models.User,
            models.User.id
            == models.FaceEmbedding.user_id
        )
        .filter(
            models.User.id == user_id,
            models.User.organization_id
            == current_user.organization_id,
            models.FaceEmbedding.is_active == True
        )
        .first()
    )

    if face_embedding is None:
        raise HTTPException(
            status_code=404,
            detail="Face photo not found"
        )

    if face_embedding.face_photo is None:
        raise HTTPException(
            status_code=404,
            detail="Face photo not available"
        )

    return Response(
        content=face_embedding.face_photo,
        media_type="image/jpeg"
    )


# ==================================================
# CREATE USER
# ==================================================

@router.post(
    "/",
    response_model=UserResponse
)
def create_new_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        get_current_user
    )
):

    # ----------------------------------------------
    # PERMISSION PROTECTION
    # ----------------------------------------------

   

    """
    Create a new user.

    Rules:

    ADMIN
        → can create Teacher
        → can create Student

    TEACHER
        → can create Student

    STUDENT
        → cannot create users

    A user can only be created inside
    the creator's own organization.
    """

    # ----------------------------------------------
    # ORGANIZATION PROTECTION
    # ----------------------------------------------

    if (
        current_user.organization_id
        != user.organization_id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You cannot create users "
                "in another organization"
            )
        )

    # ----------------------------------------------
    # ROLE PROTECTION
    # ----------------------------------------------

    requested_role = user.role.lower()

    if requested_role not in {
        ADMIN,
        TEACHER,
        STUDENT
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid user role"
        )

    permissions = (
    current_user.permissions or []
    )

    if requested_role == STUDENT:

        if STUDENT_MANAGE not in permissions:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Missing permission: "
                    "student_manage"
                )
            )

    elif requested_role == TEACHER:

        if TEACHER_MANAGE not in permissions:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Missing permission: "
                    "teacher_manage"
                )
            )

    # ----------------------------------------------
    # ADMIN
    # ----------------------------------------------

    if current_user.role == ADMIN:

        if requested_role not in {
            TEACHER,
            STUDENT
        }:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Admin can only create "
                    "Teacher or Student accounts"
                )
            )

    # ----------------------------------------------
    # TEACHER
    # ----------------------------------------------

    elif current_user.role == TEACHER:

        if requested_role != STUDENT:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Teacher can only create "
                    "Student accounts"
                )
            )

    # ----------------------------------------------
    # STUDENT
    # ----------------------------------------------

    elif current_user.role == STUDENT:

        raise HTTPException(
            status_code=403,
            detail="Students cannot create users"
        )

    # ----------------------------------------------
    # UNKNOWN ROLE
    # ----------------------------------------------

    else:

        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission "
                "to create users"
            )
        )

    # ----------------------------------------------
    # CHECK DUPLICATE EMAIL
    # ----------------------------------------------

    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == user.email
        )
        .first()
    )

    if existing_email:

        raise HTTPException(
            status_code=409,
            detail=(
                "A user with this email "
                "already exists"
            )
        )

    # ----------------------------------------------
    # CHECK DUPLICATE EMPLOYEE ID
    # ----------------------------------------------

    existing_employee = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.employee_id
            == user.employee_id
        )
        .first()
    )

    if existing_employee:

        raise HTTPException(
            status_code=409,
            detail=(
                "A user with this employee ID "
                "already exists"
            )
        )

    # ----------------------------------------------
    # FORCE ORGANIZATION
    # ----------------------------------------------
    #
    # Never trust organization_id supplied
    # by the frontend.
    #
    # Always use the authenticated user's
    # organization.
    # ----------------------------------------------

    user.organization_id = (
        current_user.organization_id
    )

    # ----------------------------------------------
    # CREATE USER
    # ----------------------------------------------

    return create_user(
        db,
        user
    )


# ==================================================
# CREATE STUDENT + FACE ENROLLMENT
# ==================================================

@router.post("/enroll")
async def create_student_with_face(
    name: str = Form(...),
    email: str = Form(...),
    student_id: str = Form(...),
    password: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Atomically create a Student account
    and enroll the student's face.

    The operation succeeds only when both:

        1. Student account is created
        2. Face embedding is created

    If face processing or database commit
    fails, the transaction is rolled back.
    """

    permissions = (
        current_user.permissions or []
    )

    if STUDENT_MANAGE not in permissions:

        raise HTTPException(
            status_code=403,
            detail=(
                "Missing permission: "
                "student_manage"
            )
        )


    # ==================================================
    # 1. FACE MANAGEMENT PERMISSION
    # ==================================================

    if "face_manage" not in permissions:

        raise HTTPException(
            status_code=403,
            detail=(
                "Missing permission: "
                "face_manage"
            )
        )

    # ==================================================
    # 2. VERIFY CURRENT USER ORGANIZATION
    # ==================================================

    if current_user.organization_id is None:

        raise HTTPException(
            status_code=403,
            detail=(
                "User is not associated "
                "with an organization"
            )
        )

    # ==================================================
    # 3. CHECK DUPLICATE EMAIL
    # ==================================================

    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == email
        )
        .first()
    )

    if existing_email:

        raise HTTPException(
            status_code=409,
            detail=(
                "A user with this email "
                "already exists"
            )
        )

    # ==================================================
    # 4. CHECK DUPLICATE STUDENT ID
    # ==================================================

    existing_student = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.employee_id
            == student_id
        )
        .first()
    )

    if existing_student:

        raise HTTPException(
            status_code=409,
            detail=(
                "A student with this Student ID "
                "already exists"
            )
        )

    # ==================================================
    # 5. READ IMAGE
    # ==================================================

    image_bytes = await image.read()

    face_photo = normalize_face_photo(
        image_bytes
    )

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="Face image is empty"
        )

    # ==================================================
    # 6. DECODE IMAGE
    # ==================================================

    image_array = np.frombuffer(
        image_bytes,
        dtype=np.uint8
    )

    frame = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if frame is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )

    # ==================================================
    # 7. GENERATE FACE EMBEDDING
    # ==================================================

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

    # ==================================================
    # 8. VALIDATE EMBEDDING
    # ==================================================

    if len(embedding) != 512:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid face embedding. "
                "Expected 512 dimensions."
            )
        )

    # ==================================================
    # 9. CREATE STUDENT
    # ==================================================

    try:

        from app.auth import hash_password

        student = models.User(
            organization_id=(
                current_user.organization_id
            ),

            name=name,

            email=email,

            password_hash=hash_password(
                password
            ),

            employee_id=student_id,

            role=STUDENT,

            permissions=[
                "attendance_view",
                "event_view",
                "group_view"
            ],

            is_active=True
        )

        db.add(student)

        # ----------------------------------------------
        # FLUSH
        # ----------------------------------------------
        #
        # Flush sends INSERT to PostgreSQL
        # but does NOT commit the transaction.
        #
        # This gives us student.id.
        # ----------------------------------------------

        db.flush()

        # ==================================================
        # 10. CREATE FACE EMBEDDING
        # ==================================================

        face_embedding = models.FaceEmbedding(
            user_id=student.id,
            embedding=embedding,
            face_photo=face_photo,
            is_active=True
        )

        db.add(face_embedding)

        # ==================================================
        # 11. COMMIT BOTH OPERATIONS
        # ==================================================

        db.commit()

        # ==================================================
        # 12. REFRESH DATABASE OBJECTS
        # ==================================================

        db.refresh(student)

        db.refresh(face_embedding)

    except Exception as error:

        # ----------------------------------------------
        # ROLLBACK
        # ----------------------------------------------

        db.rollback()

        print(
            "Student enrollment failed:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to create student "
                "and enroll face"
            )
        )

    # ==================================================
    # 13. RETURN SUCCESS
    # ==================================================

    return {
        "message": (
            "Student created and "
            "face enrolled successfully"
        ),

        "user_id": student.id,

        "name": student.name,

        "student_id": student.employee_id,

        "face_enrolled": True
    }


# ==================================================
# GET ALL USERS
# ==================================================

@router.get(
    "/",
    response_model=list[UserResponse]
)
def get_users(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Return users belonging to the
    current user's organization.

    Product Owner is a global user and
    therefore does not access school users
    through this endpoint.
    """

    # ----------------------------------------------
    # PRODUCT OWNER
    # ----------------------------------------------
    #
    # Product Owner has no organization_id.
    # Therefore /users/ is not a school-user
    # endpoint for Product Owner.
    #
    # ----------------------------------------------

    if current_user.role == "product_owner":
        return []

    # ----------------------------------------------
    # SCHOOL USERS
    # ----------------------------------------------

    users = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id
        )
        .order_by(
            models.User.id.asc()
        )
        .all()
    )

    return users

@router.patch(
    "/{user_id}/with-face",
    response_model=UserResponse
)
async def update_user_with_face(
    user_id: int,
    name: str = Form(...),
    email: str = Form(...),
    employee_id: str = Form(...),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    # Find student inside the admin's organization
    user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,
            models.User.organization_id == current_user.organization_id,
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Do not allow editing admin accounts from student management
    if user.role == ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Admin accounts cannot be edited here",
        )

    # Check duplicate email
    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == email,
            models.User.id != user_id,
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists",
        )

    # Check duplicate student/employee ID
    existing_employee = (
        db.query(models.User)
        .filter(
            models.User.organization_id == current_user.organization_id,
            models.User.employee_id == employee_id,
            models.User.id != user_id,
        )
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail="A user with this employee ID already exists",
        )

    # Update normal student details
    user.name = name
    user.email = email
    user.employee_id = employee_id

    # If a new face photo was uploaded
    if image is not None:

        image_bytes = await image.read()

        # Validate + crop + normalize face photo
        face_photo = normalize_face_photo(image_bytes)

        # Decode normalized photo
        frame = cv2.imdecode(
            np.frombuffer(face_photo, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )

        if frame is None:
            raise HTTPException(
                status_code=400,
                detail="Invalid face image",
            )

        # Generate new 128-dimensional face embedding
        embedding = face_recognition_service.get_embedding(frame)

        if embedding is None:
            raise HTTPException(
                status_code=400,
                detail="Could not generate face embedding",
            )

        # Find existing active face embedding
        face_embedding = (
            db.query(models.FaceEmbedding)
            .filter(
                models.FaceEmbedding.user_id == user_id,
                models.FaceEmbedding.is_active == True,
            )
            .first()
        )

        if face_embedding:
            # Replace existing face
            face_embedding.embedding = embedding
            face_embedding.face_photo = face_photo
        else:
            # Create face record if one doesn't exist
            face_embedding = models.FaceEmbedding(
                user_id=user_id,
                embedding=embedding,
                face_photo=face_photo,
                is_active=True,
            )

            db.add(face_embedding)

    db.commit()
    db.refresh(user)

    return user



# ==================================================
# UPDATE USER DETAILS
# ==================================================

@router.patch(
    "/{user_id}",
    response_model=UserResponse
)
def update_user(
    user_id: int,
    data: UserUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Update Teacher/Student account details.

    Admin can update:
        - name
        - email
        - employee_id

    Admin accounts are protected.
    """

    # ----------------------------------------------
    # FIND USER
    # ----------------------------------------------

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

    # ----------------------------------------------
    # PROTECT ADMIN ACCOUNTS
    # ----------------------------------------------

    if user.role == ADMIN:
        raise HTTPException(
            status_code=403,
            detail=(
                "Admin accounts cannot "
                "be edited here"
            )
        )

    require_user_management_permission(
        current_user,
        user
    )

    # ----------------------------------------------
    # CHECK DUPLICATE EMAIL
    # ----------------------------------------------

    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == data.email,
            models.User.id != user_id
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail=(
                "A user with this email "
                "already exists"
            )
        )

    # ----------------------------------------------
    # CHECK DUPLICATE EMPLOYEE ID
    # ----------------------------------------------

    existing_employee = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.employee_id
            == data.employee_id,

            models.User.id != user_id
        )
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail=(
                "A user with this employee ID "
                "already exists"
            )
        )

    # ----------------------------------------------
    # UPDATE
    # ----------------------------------------------

    user.name = data.name
    user.email = data.email
    user.employee_id = data.employee_id

    db.commit()
    db.refresh(user)

    return user


# ==================================================
# UPDATE USER STATUS
# ==================================================

@router.patch(
    "/status/bulk"
)
def bulk_update_user_status(
    data: UserBulkStatusUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Activate or deactivate multiple
    Teacher/Student accounts at once.

    Admin accounts are protected.
    """

    if not data.user_ids:
        raise HTTPException(
            status_code=400,
            detail="No users selected"
        )

    users = (
        db.query(models.User)
        .filter(
            models.User.id.in_(
                data.user_ids
            ),
            models.User.organization_id
            == current_user.organization_id
        )
        .all()
    )

    if len(users) != len(
        set(data.user_ids)
    ):
        raise HTTPException(
            status_code=404,
            detail="One or more users were not found"
        )

    for user in users:

        if user.id == current_user.id:

            raise HTTPException(
                status_code=400,
                detail=(
                    "You cannot change "
                    "your own account status"
                )
            )

        # ------------------------------------------
        # Permission based on target role
        # ------------------------------------------

        require_user_management_permission(
            current_user,
            user
        )

        # ------------------------------------------
        # Admin accounts remain protected
        # ------------------------------------------

        if user.role == ADMIN:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Admin accounts cannot "
                    "be changed here"
                )
            )

    for user in users:
        user.is_active = data.is_active

    db.commit()

    for user in users:
        db.refresh(user)

    return {
        "message": (
            "User statuses updated successfully"
        ),
        "updated_count": len(users),
        "is_active": data.is_active,
        "user_ids": [
            user.id
            for user in users
        ]
    }


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse
)
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Activate or deactivate one
    Teacher/Student account.
    """

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

    require_user_management_permission(
        current_user,
        user
    )

    if user.role == ADMIN:
        raise HTTPException(
            status_code=403,
            detail=(
                "Admin accounts cannot "
                "be changed here"
            )
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail=(
                "You cannot change "
                "your own account status"
            )
        )

    user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    return user


# ==================================================
# DELETE / DEACTIVATE USER
# ==================================================

@router.delete(
    "/{user_id}",
    response_model=UserResponse
)
def deactivate_user(
    user_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    )
):
    """
    Admin can deactivate Teacher or Student.

    We do NOT physically delete the user.

    This preserves attendance history.
    """

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

    require_user_management_permission(
        current_user,
        user
    )

    # ----------------------------------------------
    # ADMIN CANNOT DEACTIVATE ANOTHER ADMIN
    # ----------------------------------------------

    if user.role == ADMIN:

        raise HTTPException(
            status_code=403,
            detail=(
                "Admin accounts cannot "
                "be deactivated here"
            )
        )

    # ----------------------------------------------
    # DEACTIVATE
    # ----------------------------------------------

    user.is_active = False

    db.commit()

    db.refresh(user)

    return user


# ==================================================
# CHANGE OWN PASSWORD
# ==================================================

@router.patch(
    "/me/password"
)
def change_own_password(
    data: PasswordChange,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
    )
):

    if not verify_password(
        data.current_password,
        current_user.password_hash
    ):

        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    current_user.password_hash = (
        hash_password(data.new_password)
    )

    db.commit()

    return {
        "message": "Password changed successfully"
    }


# ==================================================
# RESET USER PASSWORD
# ==================================================

@router.patch(
    "/{user_id}/password"
)
def reset_user_password(
    user_id: int,

    data: PasswordReset,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        get_current_user
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

    require_user_management_permission(
        current_user,
        user
    )

    if user.role == ADMIN:
        raise HTTPException(
            status_code=403,
            detail=(
                "Admin accounts cannot "
                "have their password reset here"
            )
        )
    

    user.password_hash = (
        hash_password(data.new_password)
    )

    db.commit()

    return {
        "message": "Password reset successfully"
    }