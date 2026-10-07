from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.auth import (
    require_admin,
    hash_password,
)
from app.database import get_db
from app.schemas import (
    TeacherCreate,
    UserCreate,
    UserResponse,
    UserUpdate,
    UserStatusUpdate,
    TeacherPermissionsUpdate,
    PasswordReset,
)


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


# =========================================================
# ADMIN PROFILE
# =========================================================

@router.get("/me")
def get_admin_profile(
    current_user: models.User = Depends(require_admin)
):
    """
    Return the currently logged-in Admin.
    """

    return {
        "message": "Admin access granted",
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "organization_id": current_user.organization_id
    }


# =========================================================
# ADMIN DASHBOARD
# =========================================================

@router.get("/dashboard")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Return dashboard statistics for the Admin's school.
    """

    organization_id = current_user.organization_id

    # -----------------------------------------------------
    # SCHOOL
    # -----------------------------------------------------

    school = (
        db.query(models.Organization)
        .filter(
            models.Organization.id == organization_id
        )
        .first()
    )

    if school is None:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    # -----------------------------------------------------
    # STUDENTS
    # -----------------------------------------------------

    total_students = (
        db.query(models.User)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == "student"
        )
        .count()
    )

    active_students = (
        db.query(models.User)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == "student",
            models.User.is_active == True
        )
        .count()
    )

    # -----------------------------------------------------
    # TEACHERS
    # -----------------------------------------------------

    total_teachers = (
        db.query(models.User)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == "teacher"
        )
        .count()
    )

    active_teachers = (
        db.query(models.User)
        .filter(
            models.User.organization_id == organization_id,
            models.User.role == "teacher",
            models.User.is_active == True
        )
        .count()
    )

    # -----------------------------------------------------
    # GROUPS
    # -----------------------------------------------------

    total_groups = (
        db.query(models.Group)
        .filter(
            models.Group.organization_id == organization_id,
            models.Group.is_active == True
        )
        .count()
    )

    # -----------------------------------------------------
    # EVENTS
    # -----------------------------------------------------

    total_events = (
        db.query(models.Event)
        .filter(
            models.Event.organization_id == organization_id,
            models.Event.is_active == True
        )
        .count()
    )

    # -----------------------------------------------------
    # ATTENDANCE
    # -----------------------------------------------------

    total_attendance = (
        db.query(models.Attendance)
        .join(
            models.Event,
            models.Attendance.event_id
            == models.Event.id
        )
        .filter(
            models.Event.organization_id
            == organization_id
        )
        .count()
    )

    return {
        "school": {
            "id": school.id,
            "name": school.name,
            "email": school.email,
            "is_active": school.is_active,
            "license_status": school.license_status
        },

        "students": {
            "total": total_students,
            "active": active_students,
            "inactive": (
                total_students - active_students
            )
        },

        "teachers": {
            "total": total_teachers,
            "active": active_teachers,
            "inactive": (
                total_teachers - active_teachers
            )
        },

        "groups": {
            "total": total_groups
        },

        "events": {
            "total": total_events
        },

        "attendance": {
            "total_records": total_attendance
        }
    }


# =========================================================
# SCHOOL DETAILS
# =========================================================

@router.get("/school")
def get_admin_school(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Return the school belonging to the Admin.
    """

    school = (
        db.query(models.Organization)
        .filter(
            models.Organization.id
            == current_user.organization_id
        )
        .first()
    )

    if school is None:
        raise HTTPException(
            status_code=404,
            detail="School not found"
        )

    return school


# =========================================================
# STUDENT MANAGEMENT
# =========================================================

# ---------------------------------------------------------
# GET STUDENTS
# ---------------------------------------------------------

@router.get(
    "/students",
    response_model=list[UserResponse]
)
def get_students(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Get all students belonging to the Admin's school.
    """

    students = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "student"
        )
        .order_by(
            models.User.id.asc()
        )
        .all()
    )

    return students


# ---------------------------------------------------------
# GET SINGLE STUDENT
# ---------------------------------------------------------

@router.get(
    "/students/{user_id}",
    response_model=UserResponse
)
def get_student(
    user_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Get one student from the Admin's school.
    """

    student = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "student"
        )
        .first()
    )

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return student


# ---------------------------------------------------------
# CREATE STUDENT
# ---------------------------------------------------------

@router.post(
    "/students",
    response_model=UserResponse
)
def create_student(
    data: UserCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Create a Student.

    The school is automatically taken from
    the logged-in Admin.
    """

    # -----------------------------------------------------
    # DUPLICATE EMAIL
    # -----------------------------------------------------

    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == data.email
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists"
        )

    # -----------------------------------------------------
    # DUPLICATE EMPLOYEE ID
    # -----------------------------------------------------

    existing_employee = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.employee_id
            == data.employee_id
        )
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail="Employee ID already exists in this school"
        )

    # -----------------------------------------------------
    # CREATE STUDENT
    # -----------------------------------------------------

    student = models.User(
        organization_id=current_user.organization_id,

        name=data.name,

        email=data.email,

        password_hash=hash_password(
            data.password
        ),

        employee_id=data.employee_id,

        role="student",

        permissions=[
            "attendance_view"
        ],

        is_active=True,
        must_change_password=True
    )

    db.add(student)

    db.commit()

    db.refresh(student)

    return student


# ---------------------------------------------------------
# UPDATE STUDENT
# ---------------------------------------------------------

@router.patch(
    "/students/{user_id}",
    response_model=UserResponse
)
def update_student(
    user_id: int,

    data: UserUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Update Student details.
    """

    student = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "student"
        )
        .first()
    )

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    # -----------------------------------------------------
    # DUPLICATE EMAIL
    # -----------------------------------------------------

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
            detail="A user with this email already exists"
        )

    # -----------------------------------------------------
    # DUPLICATE EMPLOYEE ID
    # -----------------------------------------------------

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
            detail="Employee ID already exists in this school"
        )

    # -----------------------------------------------------
    # UPDATE
    # -----------------------------------------------------

    student.name = data.name
    student.email = data.email
    student.employee_id = data.employee_id

    db.commit()

    db.refresh(student)

    return student


# ---------------------------------------------------------
# STUDENT STATUS
# ---------------------------------------------------------

@router.patch(
    "/students/{user_id}/status",
    response_model=UserResponse
)
def update_student_status(
    user_id: int,

    data: UserStatusUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Activate or deactivate a Student.
    """

    student = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "student"
        )
        .first()
    )

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    student.is_active = data.is_active

    db.commit()

    db.refresh(student)

    return student


# ---------------------------------------------------------
# DELETE STUDENT
# ---------------------------------------------------------

@router.delete(
    "/students/{user_id}"
)
def delete_student(
    user_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Soft-delete a Student by deactivating the account.
    """

    student = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "student"
        )
        .first()
    )

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    student.is_active = False

    db.commit()

    return {
        "message": "Student deactivated successfully",
        "user_id": student.id
    }


# =========================================================
# TEACHER MANAGEMENT
# =========================================================

# ---------------------------------------------------------
# GET TEACHERS
# ---------------------------------------------------------

@router.get(
    "/teachers",
    response_model=list[UserResponse]
)
def get_teachers(
    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Get all teachers belonging to the Admin's school.
    """

    teachers = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "teacher"
        )
        .order_by(
            models.User.id.asc()
        )
        .all()
    )

    return teachers


# ---------------------------------------------------------
# GET SINGLE TEACHER
# ---------------------------------------------------------

@router.get(
    "/teachers/{user_id}",
    response_model=UserResponse
)
def get_teacher(
    user_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Get one teacher from the Admin's school.
    """

    teacher = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "teacher"
        )
        .first()
    )

    if teacher is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    return teacher


# ---------------------------------------------------------
# CREATE TEACHER
# ---------------------------------------------------------

@router.post(
    "/teachers",
    response_model=UserResponse
)
def create_teacher(
    data: TeacherCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Create a Teacher.

    The school is automatically taken from
    the logged-in Admin.
    """

    # -----------------------------------------------------
    # DUPLICATE EMAIL
    # -----------------------------------------------------

    existing_email = (
        db.query(models.User)
        .filter(
            models.User.email == data.email
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists"
        )

    # -----------------------------------------------------
    # DUPLICATE EMPLOYEE ID
    # -----------------------------------------------------

    existing_employee = (
        db.query(models.User)
        .filter(
            models.User.organization_id
            == current_user.organization_id,

            models.User.employee_id
            == data.employee_id
        )
        .first()
    )

    if existing_employee:
        raise HTTPException(
            status_code=409,
            detail="Employee ID already exists in this school"
        )

    # -----------------------------------------------------
    # ALLOWED TEACHER PERMISSIONS
    # -----------------------------------------------------

    allowed_permissions = {
        "attendance_view",
        "attendance_take",
        "attendance_modify",

        "event_view",
        "event_create",
        "event_modify",
        "event_delete",

        "group_view",
        "group_create",
        "group_modify",

        "face_manage"
    }

    requested_permissions = set(
        data.permissions or []
    )

    invalid_permissions = (
        requested_permissions
        - allowed_permissions
    )

    if invalid_permissions:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid teacher permissions",
                "invalid_permissions": sorted(
                    invalid_permissions
                )
            }
        )

    # -----------------------------------------------------
    # CREATE TEACHER
    # -----------------------------------------------------

    teacher = models.User(
        organization_id=current_user.organization_id,

        name=data.name,

        email=data.email,

        password_hash=hash_password(
            data.password
        ),

        employee_id=data.employee_id,

        role="teacher",

        permissions=list(
            requested_permissions
        ),

        is_active=True,
        must_change_password=True
    )

    db.add(teacher)

    db.commit()

    db.refresh(teacher)

    return teacher


# ---------------------------------------------------------
# UPDATE TEACHER
# ---------------------------------------------------------

@router.patch(
    "/teachers/{user_id}",
    response_model=UserResponse
)
def update_teacher(
    user_id: int,

    data: UserUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Update Teacher details.
    """

    teacher = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "teacher"
        )
        .first()
    )

    if teacher is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    # -----------------------------------------------------
    # DUPLICATE EMAIL
    # -----------------------------------------------------

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
            detail="A user with this email already exists"
        )

    # -----------------------------------------------------
    # DUPLICATE EMPLOYEE ID
    # -----------------------------------------------------

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
            detail="Employee ID already exists in this school"
        )

    teacher.name = data.name
    teacher.email = data.email
    teacher.employee_id = data.employee_id

    db.commit()

    db.refresh(teacher)

    return teacher


# ---------------------------------------------------------
# TEACHER STATUS
# ---------------------------------------------------------

@router.patch(
    "/teachers/{user_id}/status",
    response_model=UserResponse
)
def update_teacher_status(
    user_id: int,

    data: UserStatusUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Activate or deactivate a Teacher.
    """

    teacher = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "teacher"
        )
        .first()
    )

    if teacher is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    teacher.is_active = data.is_active

    db.commit()

    db.refresh(teacher)

    return teacher


# ---------------------------------------------------------
# TEACHER PERMISSIONS
# ---------------------------------------------------------

@router.patch(
    "/teachers/{user_id}/permissions"
)
def update_teacher_permissions(
    user_id: int,

    data: TeacherPermissionsUpdate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    ),
):
    """
    Update Teacher permissions.
    """

    teacher = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "teacher"
        )
        .first()
    )

    if teacher is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    # -----------------------------------------------------
    # ALLOWED PERMISSIONS
    # -----------------------------------------------------

    allowed_permissions = {
        "attendance_view",
        "attendance_take",
        "attendance_modify",

        "event_view",
        "event_create",
        "event_modify",
        "event_delete",

        "group_view",
        "group_create",
        "group_modify",

        "face_manage"
    }

    invalid_permissions = (
        set(data.permissions)
        - allowed_permissions
    )

    if invalid_permissions:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Invalid teacher permissions",
                "invalid_permissions": sorted(
                    invalid_permissions
                )
            }
        )

    # -----------------------------------------------------
    # UPDATE PERMISSIONS
    # -----------------------------------------------------

    teacher.permissions = list(
        dict.fromkeys(data.permissions)
    )

    db.commit()

    db.refresh(teacher)

    return teacher


# ---------------------------------------------------------
# DELETE TEACHER
# ---------------------------------------------------------

@router.delete(
    "/teachers/{user_id}"
)
def delete_teacher(
    user_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_admin
    )
):
    """
    Soft-delete a Teacher by deactivating the account.
    """

    teacher = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.role == "teacher"
        )
        .first()
    )

    if teacher is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher not found"
        )

    teacher.is_active = False

    db.commit()

    return {
        "message": "Teacher deactivated successfully",
        "user_id": teacher.id
    }

# =========================================================
# UNIVERSAL PASSWORD RESET
# =========================================================

@router.patch(
    "/users/{user_id}/reset-password",
)
def reset_user_password(
    user_id: int,
    data: PasswordReset,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Reset the password of a Student or Teacher from the Admin portal.

    The new password is treated as a temporary password.
    The target user must change it after the next login.
    """

    user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,
            models.User.organization_id == current_user.organization_id,
            models.User.role.in_(["student", "teacher"])
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    user.password_hash = hash_password(
        data.new_password
    )

    user.must_change_password = True

    db.commit()

    return {
        "message": "Password reset successfully",
        "user_id": user.id,
        "must_change_password": True
    }
