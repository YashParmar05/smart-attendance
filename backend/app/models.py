from datetime import datetime

from app.timezone import now_ist

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    JSON,
    String,
    LargeBinary,
    UniqueConstraint,
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from pgvector.sqlalchemy import Vector

from app.database import Base


# ============================================================
# ORGANIZATION
# ============================================================

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        nullable=False,
        index=True
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    license_status: Mapped[str] = mapped_column(
        String(30),
        default="active",
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan"
    )

    groups: Mapped[list["Group"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan"
    )

    events: Mapped[list["Event"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan"
    )


# ============================================================
# USER
# ============================================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=True,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    must_change_password: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    employee_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(50),
        default="student",
        nullable=False
    )

    permissions: Mapped[list] = mapped_column(
        JSON,
        default=list,
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    organization: Mapped["Organization"] = relationship(
        back_populates="users"
    )

    face_embeddings: Mapped[list["FaceEmbedding"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )

    group_memberships: Mapped[list["GroupMember"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )

    attendances: Mapped[list["Attendance"]] = relationship(
        back_populates="user",
        foreign_keys="Attendance.user_id"
    )

    created_events: Mapped[list["Event"]] = relationship(
        back_populates="created_by_user"
    )

    # --------------------------------------------------------
    # Teacher -> Group assignments
    # --------------------------------------------------------

    group_teaching_assignments: Mapped[list["GroupTeacher"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan"
    )

    # --------------------------------------------------------
    # Teacher -> Event assignments
    # --------------------------------------------------------

    event_teaching_assignments: Mapped[list["EventTeacher"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "employee_id",
            name="uq_user_organization_employee"
        ),
    )


# ============================================================
# FACE EMBEDDING
# ============================================================

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # IMPORTANT:
    # Keeping Vector(128) here for now because the existing
    # database schema was created with 128 dimensions.
    #
    # InsightFace ArcFace currently produces 512D embeddings,
    # so this will be migrated separately.
    # DO NOT change this here yet.
    # --------------------------------------------------------

    embedding: Mapped[list] = mapped_column(
        Vector(512),
        nullable=False
    )

    face_photo: Mapped[bytes | None] = mapped_column(
        LargeBinary,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    user: Mapped["User"] = relationship(
        back_populates="face_embeddings"
    )


# ============================================================
# GROUP
# ============================================================

class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    organization: Mapped["Organization"] = relationship(
        back_populates="groups"
    )

    # --------------------------------------------------------
    # Students belonging to this group
    # --------------------------------------------------------

    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan"
    )

    # --------------------------------------------------------
    # Teachers assigned to this group
    #
    # IMPORTANT:
    # GroupTeacher controls group-level access only.
    # It does NOT automatically grant event access.
    # --------------------------------------------------------

    teacher_assignments: Mapped[list["GroupTeacher"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan"
    )

    # --------------------------------------------------------
    # Events associated with this group
    #
    # NEW MANY-TO-MANY RELATIONSHIP
    # --------------------------------------------------------

    event_assignments: Mapped[list["EventGroup"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan"
    )


# ============================================================
# GROUP MEMBERS
# ============================================================

class GroupMember(Base):
    __tablename__ = "group_members"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id"),
        nullable=False,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    added_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    group: Mapped["Group"] = relationship(
        back_populates="members"
    )

    user: Mapped["User"] = relationship(
        back_populates="group_memberships"
    )

    __table_args__ = (
        UniqueConstraint(
            "group_id",
            "user_id",
            name="uq_group_user"
        ),
    )


# ============================================================
# GROUP TEACHER
# ============================================================

class GroupTeacher(Base):
    __tablename__ = "group_teachers"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id"),
        nullable=False,
        index=True
    )

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    added_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    group: Mapped["Group"] = relationship(
        back_populates="teacher_assignments"
    )

    teacher: Mapped["User"] = relationship(
        back_populates="group_teaching_assignments"
    )

    __table_args__ = (
        UniqueConstraint(
            "group_id",
            "teacher_id",
            name="uq_group_teacher"
        ),
    )


# ============================================================
# EVENT
# ============================================================

class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # LEGACY GROUP COLUMN
    #
    # This is kept temporarily because the existing database
    # already contains events.group_id and existing routes/data
    # depend on it.
    #
    # New event logic will use EventGroup.
    #
    # We will remove/migrate this column in a later DB migration.
    # --------------------------------------------------------

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id"),
        nullable=False,
        index=True
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    starts_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    is_cancelled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    organization: Mapped["Organization"] = relationship(
        back_populates="events"
    )

    # --------------------------------------------------------
    # LEGACY SINGLE GROUP RELATIONSHIP
    #
    # Kept temporarily for backward compatibility.
    # New code should use group_assignments.
    # --------------------------------------------------------

    group: Mapped["Group"] = relationship(
        foreign_keys=[group_id]
    )

    # --------------------------------------------------------
    # Event creator
    # --------------------------------------------------------

    created_by_user: Mapped["User"] = relationship(
        back_populates="created_events"
    )

    # --------------------------------------------------------
    # Students' attendance for this event
    # --------------------------------------------------------

    attendances: Mapped[list["Attendance"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan"
    )

    # --------------------------------------------------------
    # Teachers assigned to this event
    #
    # NEW MANY-TO-MANY RELATIONSHIP
    # --------------------------------------------------------

    teacher_assignments: Mapped[list["EventTeacher"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan"
    )

    # --------------------------------------------------------
    # Groups assigned to this event
    #
    # NEW MANY-TO-MANY RELATIONSHIP
    # --------------------------------------------------------

    group_assignments: Mapped[list["EventGroup"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan"
    )
    


# ============================================================
# EVENT GROUP
# ============================================================

class EventGroup(Base):
    """
    Many-to-many association between Event and Group.

    One event can belong to multiple groups.
    One group can have multiple events.
    """

    __tablename__ = "event_groups"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id"),
        nullable=False,
        index=True
    )

    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id"),
        nullable=False,
        index=True
    )

    added_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    event: Mapped["Event"] = relationship(
        back_populates="group_assignments"
    )

    group: Mapped["Group"] = relationship(
        back_populates="event_assignments"
    )

    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "group_id",
            name="uq_event_group"
        ),
    )

# ============================================================
# EVENT GROUP
# ===========================================================

# class EventGroup(Base):
#     __tablename__ = "event_groups"

#     id: Mapped[int] = mapped_column(
#         primary_key=True,
#         index=True
#     )

#     event_id: Mapped[int] = mapped_column(
#         ForeignKey("events.id"),
#         nullable=False,
#         index=True
#     )

#     group_id: Mapped[int] = mapped_column(
#         ForeignKey("groups.id"),
#         nullable=False,
#         index=True
#     )

#     added_at: Mapped[datetime] = mapped_column(
#         DateTime,
#         default=now_ist,
#         nullable=False
#     )

#     event: Mapped["Event"] = relationship(
#         back_populates="group_assignments"
#     )

#     group: Mapped["Group"] = relationship(
#         back_populates="event_assignments"
#     )

#     __table_args__ = (
#         UniqueConstraint(
#             "event_id",
#             "group_id",
#             name="uq_event_group"
#         ),
#     )


# ============================================================
# EVENT TEACHER
# ============================================================

class EventTeacher(Base):
    """
    Many-to-many association between Event and Teacher.

    One event can have multiple teachers.
    One teacher can be assigned to multiple events.

    IMPORTANT:
    EventTeacher determines teacher event visibility.
    GroupTeacher does NOT automatically grant event visibility.
    """

    __tablename__ = "event_teachers"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id"),
        nullable=False,
        index=True
    )

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    added_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    event: Mapped["Event"] = relationship(
        back_populates="teacher_assignments"
    )

    teacher: Mapped["User"] = relationship(
        back_populates="event_teaching_assignments"
    )

    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "teacher_id",
            name="uq_event_teacher"
        ),
    )


# ============================================================
# ATTENDANCE
# ============================================================

class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id"),
        nullable=False,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    marked_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    check_in: Mapped[datetime] = mapped_column(
        DateTime,
        default=now_ist,
        nullable=False
    )

    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="Present",
        nullable=False
    )

    event: Mapped["Event"] = relationship(
        back_populates="attendances"
    )

    user: Mapped["User"] = relationship(
        foreign_keys=[user_id],
        back_populates="attendances"
    )

    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "user_id",
            name="uq_event_user_attendance"
        ),
    )