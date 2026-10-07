from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ============================================================
# ORGANIZATION
# ============================================================

class OrganizationCreate(BaseModel):
    name: str
    email: EmailStr


class OrganizationResponse(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool
    license_status: str

    class Config:
        from_attributes = True


class OrganizationStatusUpdate(BaseModel):
    is_active: bool


class OrganizationLicenseUpdate(BaseModel):
    license_status: str


# ============================================================
# PRODUCT OWNER - ADMIN MANAGEMENT
# ============================================================

class ProductOwnerAdminCreate(BaseModel):
    organization_id: int
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    employee_id: str
    permissions: list[str] = Field(
        default_factory=list
    )


class ProductOwnerAdminResponse(BaseModel):
    id: int
    organization_id: int | None
    name: str
    email: str
    employee_id: str
    role: str
    permissions: list[str]
    is_active: bool

    class Config:
        from_attributes = True


class ProductOwnerAdminSchoolUpdate(BaseModel):
    organization_id: int


class ProductOwnerAdminPermissionsUpdate(BaseModel):
    permissions: list[str]


class ProductOwnerAdminStatusUpdate(BaseModel):
    is_active: bool


# ============================================================
# USER
# ============================================================

class UserCreate(BaseModel):
    """
    Used when creating a new user.

    organization_id determines which school
    the user belongs to.
    """

    organization_id: int

    name: str

    email: EmailStr

    password: str = Field(
        min_length=6
    )

    employee_id: str

    role: str = "student"

    permissions: list[str] = Field(
        default_factory=lambda: [
            "attendance_view"
        ]
    )


class UserResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    email: str
    employee_id: str
    role: str
    permissions: list[str]
    is_active: bool
    must_change_password: bool

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool

class TeacherPermissionsUpdate(BaseModel):
    permissions: list[str]


class UserBulkStatusUpdate(BaseModel):
    user_ids: list[int]
    is_active: bool


class UserUpdate(BaseModel):
    name: str
    email: EmailStr
    employee_id: str


# ============================================================
# CREATE TEACHER
# ============================================================

class TeacherCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    employee_id: str
    permissions: list[str] = Field(default_factory=list)

# ============================================================
# PASSWORD
# ============================================================

class PasswordChange(BaseModel):
    """
    Used when any authenticated user
    changes their own password.
    """

    current_password: str = Field(
        min_length=6
    )

    new_password: str = Field(
        min_length=6
    )


class PasswordReset(BaseModel):
    """
    Used by an Admin to reset another
    user's password.
    """

    new_password: str = Field(
        min_length=6
    )


# ============================================================
# FACE
# ============================================================

class FaceEnrollmentResponse(BaseModel):
    user_id: int
    message: str


# ============================================================
# GROUP
# ============================================================

class GroupCreate(BaseModel):
    name: str
    description: str | None = None


class GroupUpdate(BaseModel):
    name: str
    description: str | None = None


class GroupResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    description: str | None
    created_by: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# GROUP MEMBERS
# ============================================================

class GroupMembersAdd(BaseModel):
    user_ids: list[int]


class GroupMembersRange(BaseModel):
    start_employee_id: str
    end_employee_id: str


# ============================================================
# GROUP TEACHERS
# ============================================================

class GroupTeachersAdd(BaseModel):
    """
    Add one or more teachers to a group.
    """

    teacher_ids: list[int]


class GroupTeacherResponse(BaseModel):
    id: int
    group_id: int
    teacher_id: int
    added_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# EVENT
# ============================================================

class EventCreate(BaseModel):
    """
    Create an event for one or more groups.

    Example:

        {
            "title": "Machine Learning",
            "group_ids": [1, 2],
            "teacher_ids": [10, 11],
            "starts_at": "...",
            "ends_at": "..."
        }

    group_ids:
        Students belonging to these groups become eligible
        for attendance for this event.

    teacher_ids:
        Teachers explicitly assigned to this event.

    The event creator is automatically treated as an
    authorized teacher and will also be stored in the
    EventTeacher relationship by the backend.
    """

    title: str

    group_ids: list[int] = Field(
        min_length=1
    )

    teacher_ids: list[int] = Field(
        default_factory=list
    )

    starts_at: datetime

    ends_at: datetime | None = None


class EventResponse(BaseModel):
    id: int
    organization_id: int

    # --------------------------------------------------------
    # Legacy compatibility field.
    #
    # During migration this represents the first/primary
    # group stored in events.group_id.
    #
    # New frontend code should use group_ids.
    # --------------------------------------------------------

    group_id: int

    # --------------------------------------------------------
    # NEW MANY-TO-MANY GROUP DATA
    # --------------------------------------------------------

    group_ids: list[int]

    # --------------------------------------------------------
    # NEW MANY-TO-MANY TEACHER DATA
    # --------------------------------------------------------

    teacher_ids: list[int]

    title: str
    created_by: int
    starts_at: datetime
    ends_at: datetime | None
    is_active: bool
    created_at: datetime
    is_cancelled: bool

    class Config:
        from_attributes = True


# ============================================================
# EVENT TEACHERS
# ============================================================

class EventTeachersAdd(BaseModel):
    """
    Add one or more teachers to an existing event.
    """

    teacher_ids: list[int]


class EventTeacherResponse(BaseModel):
    id: int
    event_id: int
    teacher_id: int
    added_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# EVENT STATUS
# ============================================================

class EventStatusUpdate(BaseModel):
    is_active: bool