from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app import models
from app.auth import require_permission
from app.database import get_db

from app.schemas import (
    GroupCreate,
    GroupUpdate,
    GroupResponse,
    GroupMembersAdd,
    GroupMembersRange,
    GroupTeachersAdd
)

from app.crud import (
    create_group,
    add_students_to_group,
    add_employee_range_to_group,
    update_group,      
    delete_group       
)
from app.access_control import require_group_access

router = APIRouter(
    prefix="/groups",
    tags=["Groups"]
)


# ============================================================
# 1. CREATE GROUP
# ============================================================

@router.post(
    "/",
    response_model=GroupResponse
)
def create_new_group(

    data: GroupCreate,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("group_create")
    )
):

    existing_group = (
        db.query(models.Group)
        .filter(
            models.Group.organization_id
            == current_user.organization_id,

            models.Group.name
            == data.name,

            models.Group.is_active == True
        )
        .first()
    )

    if existing_group:
        raise HTTPException(
            status_code=409,
            detail="A group with this name already exists."
        )

    group = create_group(
        db=db,
        group=data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )

    return group

# ============================================================
# 2. GET ALL GROUPS
# ============================================================

@router.get("/")
def get_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("group_view")
    )
):

    query = (
        db.query(models.Group)
        .filter(
            models.Group.organization_id
            == current_user.organization_id,

            models.Group.is_active == True
        )
    )

    # ---------------------------------------------------------
    # ADMIN
    # ---------------------------------------------------------
    if current_user.role == "admin":
        return (
            query
            .order_by(models.Group.id.desc())
            .all()
        )

    # ---------------------------------------------------------
    # TEACHER
    # ---------------------------------------------------------

    if current_user.role == "teacher":

        groups = (
            query
            .outerjoin(
                models.GroupTeacher,
                models.GroupTeacher.group_id
                == models.Group.id
            )
            .outerjoin(
                models.EventGroup,
                models.EventGroup.group_id
                == models.Group.id
            )
            .outerjoin(
                models.EventTeacher,
                models.EventTeacher.event_id
                == models.EventGroup.event_id
            )
            .filter(
                (
                    models.Group.created_by
                    == current_user.id
                )
                |
                (
                    models.GroupTeacher.teacher_id
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
                models.Group.id.desc()
            )
            .all()
        )

        return groups
    
    # ---------------------------------------------------------
    # STUDENT
    # ---------------------------------------------------------
    if current_user.role == "student":
        groups = (
            query
            .join(
                models.GroupMember,
                models.GroupMember.group_id
                == models.Group.id
            )
            .filter(
                models.GroupMember.user_id
                == current_user.id
            )
            .distinct()
            .order_by(
                models.Group.id.desc()
            )
            .all()
        )

        return groups

    # ---------------------------------------------------------
    # OTHER ROLES
    # ---------------------------------------------------------
    return []




# ============================================================
# 3. GET ONE GROUP
# ============================================================

@router.get("/{group_id}")
def get_group(

    group_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("group_view")
    )
):

    group = db.query(
        models.Group
    ).filter(

        models.Group.id == group_id,

        models.Group.organization_id
        == current_user.organization_id

    ).first()


    if group is None:

        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    # Students may only view groups they are actually enrolled in.
    # Admin/teacher access continues to use the existing access-control rules.
    if current_user.role == "student":
        is_member = (
            db.query(models.GroupMember)
            .filter(
                models.GroupMember.group_id == group_id,
                models.GroupMember.user_id == current_user.id
            )
            .first()
        )

        if is_member is None:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this group."
            )
    else:
        require_group_access(
            db,
            group,
            current_user
        )

    return group


# ============================================================
# 4. GET GROUP MEMBERS
# ============================================================

@router.get("/{group_id}/members")
def get_group_members(

    group_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("group_view")
    )
):

    # --------------------------------------------------------
    # Verify group
    # --------------------------------------------------------

    group = db.query(
        models.Group
    ).filter(

        models.Group.id == group_id,

        models.Group.organization_id
        == current_user.organization_id

    ).first()


    if group is None:

        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    # Students may only view classmates from groups they belong to.
    # This is an explicit check in addition to the organization filter.
    if current_user.role == "student":
        is_member = (
            db.query(models.GroupMember)
            .filter(
                models.GroupMember.group_id == group_id,
                models.GroupMember.user_id == current_user.id
            )
            .first()
        )

        if is_member is None:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this group."
            )
    else:
        require_group_access(
            db,
            group,
            current_user
        )

    # --------------------------------------------------------
    # Get members
    # --------------------------------------------------------

    members = (
        db.query(models.User)
        .join(
            models.GroupMember,
            models.GroupMember.user_id
            == models.User.id
        )
        .filter(

            models.GroupMember.group_id
            == group_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.is_active == True

        )
        .all()
    )


    # Students only need classmate identity information.
    # Do not expose email/password/other user fields to students.
    if current_user.role == "student":
        return [
            {
                "id": member.id,
                "name": member.name,
                "student_id": getattr(member, "student_id", None),
                "employee_id": getattr(member, "employee_id", None),
                "is_active": member.is_active,
            }
            for member in members
            if member.id != current_user.id
        ]

    return members

#  =========================================
#  ADD GROUP TEACHERS
#  =========================================

@router.post("/{group_id}/teachers")
def add_group_teachers(
    group_id: int,
    data: GroupTeachersAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("group_modify")
    )
):
    group = (
        db.query(models.Group)
        .filter(
            models.Group.id == group_id,
            models.Group.organization_id
            == current_user.organization_id,
            models.Group.is_active == True
        )
        .first()
    )

    if group is None:
        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_access(
        db,
        group,
        current_user
    )

    teachers = (
        db.query(models.User)
        .filter(
            models.User.id.in_(data.teacher_ids),
            models.User.organization_id
            == current_user.organization_id,
            models.User.role == "teacher",
            models.User.is_active == True
        )
        .all()
    )

    found_ids = {
        teacher.id
        for teacher in teachers
    }

    missing_ids = set(data.teacher_ids) - found_ids

    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid teacher IDs: "
                f"{sorted(missing_ids)}"
            )
        )

    added = []

    for teacher in teachers:

        existing = (
            db.query(models.GroupTeacher)
            .filter(
                models.GroupTeacher.group_id == group.id,
                models.GroupTeacher.teacher_id
                == teacher.id
            )
            .first()
        )

        if existing:
            continue

        assignment = models.GroupTeacher(
            group_id=group.id,
            teacher_id=teacher.id
        )

        db.add(assignment)
        added.append(teacher.id)

    db.commit()

    return {
        "message": "Teachers added to group",
        "group_id": group.id,
        "teacher_ids": added
    }

@router.get("/{group_id}/teachers")
def get_group_teachers(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("group_view")
    )
):
    group = (
        db.query(models.Group)
        .filter(
            models.Group.id == group_id,
            models.Group.organization_id
            == current_user.organization_id
        )
        .first()
    )

    if group is None:
        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_access(
        db,
        group,
        current_user
    )

    teachers = (
        db.query(models.User)
        .join(
            models.GroupTeacher,
            models.GroupTeacher.teacher_id
            == models.User.id
        )
        .filter(
            models.GroupTeacher.group_id
            == group_id,
            models.User.organization_id
            == current_user.organization_id,
            models.User.role == "teacher",
            models.User.is_active == True
        )
        .all()
    )

    return teachers

# =========================================
# REMOVE GROUP TEACHER
# =========================================
@router.delete("/{group_id}/teachers/{teacher_id}")
def remove_group_teacher(
    group_id: int,
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("group_modify")
    )
):
    group = (
        db.query(models.Group)
        .filter(
            models.Group.id == group_id,
            models.Group.organization_id
            == current_user.organization_id
        )
        .first()
    )

    if group is None:
        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_access(
        db,
        group,
        current_user
    )

    assignment = (
        db.query(models.GroupTeacher)
        .filter(
            models.GroupTeacher.group_id == group_id,
            models.GroupTeacher.teacher_id == teacher_id
        )
        .first()
    )

    if assignment is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher is not assigned to this group"
        )

    # -----------------------------------------
    # Prevent removing group creator
    # -----------------------------------------

    if group.created_by == teacher_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "The group creator cannot be removed "
                "from the group."
            )
        )

    db.delete(assignment)
    db.commit()

    return {
        "message": "Teacher removed from group",
        "group_id": group_id,
        "teacher_id": teacher_id
    }

# ============================================================
# 5. ADD INDIVIDUAL MEMBERS
# ============================================================

@router.post("/{group_id}/members")
def add_group_members(
    group_id: int,
    data: GroupMembersAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("group_modify")
    )
):

    # --------------------------------------------------------
    # Verify group
    # --------------------------------------------------------

    group = db.query(
        models.Group
    ).filter(

        models.Group.id == group_id,

        models.Group.organization_id
        == current_user.organization_id,

        models.Group.is_active == True

    ).first()


    if group is None:

        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_modification_access(group, current_user)
    # --------------------------------------------------------
    # Verify every user
    # --------------------------------------------------------

    for user_id in data.user_ids:

        user = db.query(
            models.User
        ).filter(

            models.User.id == user_id,

            models.User.organization_id
            == current_user.organization_id,

            models.User.is_active == True

        ).first()


        if user is None:

            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} not found"
            )


    # --------------------------------------------------------
    # Add members
    # --------------------------------------------------------

    added = add_students_to_group(
        db,
        group_id,
        data.user_ids
    )


    return {
        "group_id": group_id,
        "added_user_ids": added,
        "count": len(added)
    }


# ============================================================
# 6. ADD MEMBERS BY EMPLOYEE-ID RANGE
# ============================================================

@router.post("/{group_id}/members/range")
def add_group_member_range(

    group_id: int,

    data: GroupMembersRange,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("group_modify")
    )
):

    # --------------------------------------------------------
    # Verify group
    # --------------------------------------------------------

    group = db.query(
        models.Group
    ).filter(

        models.Group.id == group_id,

        models.Group.organization_id
        == current_user.organization_id,

        models.Group.is_active == True

    ).first()


    if group is None:

        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_modification_access(group, current_user)


    # --------------------------------------------------------
    # Add range
    # --------------------------------------------------------

    added = add_employee_range_to_group(

        db=db,

        group_id=group_id,

        organization_id=current_user.organization_id,

        start_employee_id=data.start_employee_id,

        end_employee_id=data.end_employee_id

    )


    return {

        "group_id": group_id,

        "added_user_ids": added,

        "count": len(added)

    }


# ============================================================
# 7. REMOVE MEMBER
# ============================================================

@router.delete("/{group_id}/members/{user_id}")
def remove_group_member(

    group_id: int,

    user_id: int,

    db: Session = Depends(get_db),

    current_user: models.User = Depends(
        require_permission("group_modify")
    )
):

    # --------------------------------------------------------
    # Verify group
    # --------------------------------------------------------

    group = db.query(
        models.Group
    ).filter(

        models.Group.id == group_id,

        models.Group.organization_id
        == current_user.organization_id

    ).first()


    if group is None:

        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_modification_access(group, current_user)

    # --------------------------------------------------------
    # Find membership
    # --------------------------------------------------------

    membership = db.query(
        models.GroupMember
    ).filter(

        models.GroupMember.group_id
        == group_id,

        models.GroupMember.user_id
        == user_id

    ).first()


    if membership is None:

        raise HTTPException(
            status_code=404,
            detail="User is not a member of this group"
        )


    # --------------------------------------------------------
    # Remove membership
    # --------------------------------------------------------

    db.delete(membership)

    db.commit()


    return {

        "message": "Member removed successfully",

        "group_id": group_id,

        "user_id": user_id

    }



# ============================================================
# 8. UPDATE GROUP
# ============================================================

@router.patch(
    "/{group_id}",
    response_model=GroupResponse
)
def update_existing_group(
    group_id: int,
    data: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("group_modify")
    )
):

    group = (
        db.query(models.Group)
        .filter(
            models.Group.id == group_id,
            models.Group.organization_id
            == current_user.organization_id,
            models.Group.is_active == True
        )
        .first()
    )

    if group is None:
        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_modification_access(group, current_user)

    # -----------------------------------------
    # CHECK GROUP ACCESS
    # -----------------------------------------

    require_group_access(
        db,
        group,
        current_user
    )

    # -----------------------------------------
    # CHECK DUPLICATE GROUP NAME
    # -----------------------------------------

    duplicate = (
        db.query(models.Group)
        .filter(
            models.Group.organization_id
            == current_user.organization_id,

            models.Group.name
            == data.name,

            models.Group.id != group_id,

            models.Group.is_active == True
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="A group with this name already exists."
        )

    # -----------------------------------------
    # UPDATE GROUP
    # -----------------------------------------

    return update_group(
        db=db,
        group=group,
        name=data.name,
        description=data.description
    )

# ============================================================
# 9. DELETE GROUP
# ============================================================
@router.delete("/{group_id}")
def delete_existing_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_permission("group_modify")
    )
):

    group = (
        db.query(models.Group)
        .filter(
            models.Group.id == group_id,
            models.Group.organization_id
            == current_user.organization_id,
            models.Group.is_active == True
        )
        .first()
    )

    if group is None:
        raise HTTPException(
            status_code=404,
            detail="Group not found"
        )

    require_group_modification_access(group, current_user)

    require_group_access(
        db,
        group,
        current_user
    )

    delete_group(
        db=db,
        group=group
    )

    return {
        "message": "Group deleted successfully",
        "group_id": group_id
    }


def require_group_modification_access(group, current_user):
    """
    Only Admins or the exact creator of the group can modify or delete it.
    Event-assigned teachers CANNOT modify or delete someone else's group.
    """
    if current_user.role == "admin":
        return True

    if current_user.role == "teacher" and group.created_by == current_user.id:
        return True

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to modify or manage this group."
    )