"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getGroups,
  getCurrentUser,
  createGroup,
  getUsers,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
} from "@/lib/api";

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] =
    useState<string | null>(null);
  const isStudent = currentUserRole === "student";
  const roleLoaded = currentUserRole !== null;
  const [students, setStudents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const [selectedGroup, setSelectedGroup] =
    useState<any | null>(null);

  const [selectedGroupIds, setSelectedGroupIds] =
    useState<number[]>([]);

  const [selectedStudents, setSelectedStudents] =
    useState<number[]>([]);

  const [selectedMembers, setSelectedMembers] =
    useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] =
    useState(false);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  const [isEditingGroup, setIsEditingGroup] =
    useState(false);

  const [editGroupName, setEditGroupName] =
    useState("");

  const [editGroupDescription, setEditGroupDescription] =
    useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingGroups, setDeletingGroups] =
    useState(false);

  // ==========================================================
  // AUTO-DISMISS FLASH MESSAGES (EFFECT)
  // ==========================================================
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [success, error]);

  /*
   * Students that are already members of the selected
   * group are removed from the "Add Students" list.
   */
  const availableStudents = useMemo(() => {
    return students.filter(
      (student) =>
        !members.some(
          (member) => member.id === student.id
        )
    );
  }, [students, members]);

  const activeAvailableStudents =
    availableStudents.filter(
      (student) => student.is_active
    );

  const allStudentsSelected =
    activeAvailableStudents.length > 0 &&
    selectedStudents.length === activeAvailableStudents.length;

  const allGroupsSelected =
    groups.length > 0 &&
    groups.every((group) =>
      selectedGroupIds.includes(group.id)
    );

  const allMembersSelected =
    members.length > 0 &&
    selectedMembers.length === members.length;

  async function loadData() {
    try {
      setLoading(true);

      const currentUser = await getCurrentUser();
      const role = currentUser?.role?.toLowerCase?.() || "";
      setCurrentUserRole(role);

      if (role === "student") {
        // The backend already restricts /groups/ to the student's
        // own memberships. Do not request the organization-wide
        // student list for a read-only student portal.
        const groupsData = await getGroups();
        setGroups(groupsData);
        setStudents([]);
        return;
      }

      const [groupsData, usersData] = await Promise.all([
        getGroups(),
        getUsers(),
      ]);

      setGroups(groupsData);

      setStudents(
        usersData.filter(
          (user: any) =>
            user.role?.toLowerCase() === "student"
        )
      );
    } catch (error) {
      console.error("Failed to load groups:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load groups."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function selectGroup(group: any) {
    setSelectedGroup(group);
    setMembers([]);
    setSelectedStudents([]);
    setSelectedMembers([]);
    setError("");
    setSuccess("");
    setIsEditingGroup(false);

    try {
      setLoadingMembers(true);

      const data =
        await getGroupMembers(group.id);

      setMembers(data);
      setSelectedMembers([]);
    } catch (error) {
      console.error(
        "Failed to load members:",
        error
      );

      setError(
        "Failed to load group members."
      );
    } finally {
      setLoadingMembers(false);
    }
  }

  function toggleGroupSelection(
    groupId: number
  ) {
    setSelectedGroupIds((previous) =>
      previous.includes(groupId)
        ? previous.filter(
            (id) => id !== groupId
          )
        : [...previous, groupId]
    );
  }

  function toggleSelectAllGroups() {
    if (allGroupsSelected) {
      setSelectedGroupIds([]);
      return;
    }

    setSelectedGroupIds(
      groups.map((group) => group.id)
    );
  }

  async function handleDeleteGroup(
    groupId: number
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this group?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteGroup(groupId);

      setGroups((previous) =>
        previous.filter(
          (group) => group.id !== groupId
        )
      );

      setSelectedGroupIds((previous) =>
        previous.filter(
          (id) => id !== groupId
        )
      );

      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        setMembers([]);
        setSelectedStudents([]);
        setIsEditingGroup(false);
      }

      setSuccess(
        "Group deleted successfully."
      );
    } catch (error) {
      console.error(
        "Failed to delete group:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete group"
      );
    }
  }

  async function handleBulkDeleteGroups() {
    if (selectedGroupIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedGroupIds.length} selected group(s)?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setDeletingGroups(true);

    try {
      const idsToDelete = [...selectedGroupIds];

      await Promise.all(
        idsToDelete.map((groupId) =>
          deleteGroup(groupId)
        )
      );

      setGroups((previous) =>
        previous.filter(
          (group) =>
            !idsToDelete.includes(group.id)
        )
      );

      setSelectedGroupIds([]);

      if (
        selectedGroup &&
        idsToDelete.includes(selectedGroup.id)
      ) {
        setSelectedGroup(null);
        setMembers([]);
        setSelectedStudents([]);
        setIsEditingGroup(false);
      }

      setSuccess(
        `${idsToDelete.length} group(s) deleted successfully.`
      );
    } catch (error) {
      console.error(
        "Failed to delete selected groups:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete selected groups."
      );
    } finally {
      setDeletingGroups(false);
    }
  }

  function startEditingGroup() {
    if (!selectedGroup) {
      return;
    }

    setEditGroupName(selectedGroup.name);
    setEditGroupDescription(
      selectedGroup.description || ""
    );
    setIsEditingGroup(true);
    setError("");
    setSuccess("");
  }

  function cancelEditingGroup() {
    setIsEditingGroup(false);

    if (selectedGroup) {
      setEditGroupName(selectedGroup.name);
      setEditGroupDescription(
        selectedGroup.description || ""
      );
    }
  }

  async function handleUpdateGroup() {
    if (!selectedGroup) {
      return;
    }

    if (!editGroupName.trim()) {
      setError("Group name is required.");
      return;
    }

    try {
      setError("");
      setSuccess("");

      const updatedGroup =
        await updateGroup(
          selectedGroup.id,
          {
            name: editGroupName.trim(),
            description:
              editGroupDescription.trim() ||
              undefined,
          }
        );

      setSelectedGroup(updatedGroup);

      setGroups((previous) =>
        previous.map((group) =>
          group.id === updatedGroup.id
            ? updatedGroup
            : group
        )
      );

      setIsEditingGroup(false);

      setSuccess(
        "Group updated successfully."
      );
    } catch (error) {
      console.error(
        "Failed to update group:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update group."
      );
    }
  }

  async function handleCreateGroup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setCreating(true);

    try {
      const group = await createGroup({
        name: name.trim(),
        description:
          description.trim() || undefined,
      });

      setGroups((previous) => [
        ...previous,
        group,
      ]);

      setName("");
      setDescription("");
      setShowCreateForm(false);

      setSuccess(
        "Group created successfully."
      );

      await selectGroup(group);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(
          "Failed to create group."
        );
      }
    } finally {
      setCreating(false);
    }
  }

  function toggleStudent(studentId: number) {
    setSelectedStudents((previous) =>
      previous.includes(studentId)
        ? previous.filter(
            (id) => id !== studentId
          )
        : [...previous, studentId]
    );
  }

  function toggleMemberSelection(
    memberId: number
  ) {
    setSelectedMembers((previous) =>
      previous.includes(memberId)
        ? previous.filter(
            (id) => id !== memberId
          )
        : [...previous, memberId]
    );
  }

  function toggleSelectAllMembers() {

    if (allMembersSelected) {

      setSelectedMembers([]);

      return;
    }

    setSelectedMembers(
      members.map(
        (member) => member.id
      )
    );
  }

  function toggleSelectAllStudents() {
    if (allStudentsSelected) {
      setSelectedStudents([]);
      return;
    }

    setSelectedStudents(
      availableStudents
        .filter((student) => student.is_active)
        .map((student) => student.id)
    );
  }

  async function handleAddStudents() {
    if (!selectedGroup) {
      return;
    }

    if (selectedStudents.length === 0) {
      setError(
        "Select at least one student."
      );
      return;
    }

    setError("");
    setSuccess("");
    setAdding(true);

    try {
      await addGroupMembers(
        selectedGroup.id,
        selectedStudents
      );

      const updatedMembers =
        await getGroupMembers(
          selectedGroup.id
        );

      setMembers(updatedMembers);
      setSelectedStudents([]);

      setSuccess(
        "Students added successfully."
      );
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(
          "Failed to add students."
        );
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(
    userId: number
  ) {
    if (!selectedGroup) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await removeGroupMember(
        selectedGroup.id,
        userId
      );

      setMembers((previous) =>
        previous.filter(
          (member) =>
            member.id !== userId
        )
      );

      setSelectedStudents((previous) =>
        previous.filter(
          (id) => id !== userId
        )
      );

      setSuccess(
        "Student removed from group."
      );
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(
          "Failed to remove student."
        );
      }
    }
  }

  // Reusable component for Members & Add Students management content
  const renderGroupManagementContent = () => (
    <div className="space-y-6">
      {/* Members Box */}
      <div className="min-w-0 overflow-hidden rounded-xl bg-white shadow-sm border">
        <div className="border-b px-4 py-4 sm:px-6 sm:py-5">
          {isEditingGroup ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(event) =>
                    setEditGroupName(event.target.value)
                  }
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={handleUpdateGroup}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    title="Save"
                  >
                    ✓ Save
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditingGroup}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <textarea
                value={editGroupDescription}
                onChange={(event) =>
                  setEditGroupDescription(event.target.value)
                }
                rows={2}
                placeholder="Group description"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="break-words text-lg font-semibold">
                    {selectedGroup.name}
                  </h2>

                  <button
                    type="button"
                    onClick={startEditingGroup}
                    className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                    title="Edit group"
                    aria-label="Edit group"
                  >
                    ✏️
                  </button>
                </div>

                <p className="mt-1 break-words text-sm text-gray-500">
                  {selectedGroup.description || "No description"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteGroup(selectedGroup.id)}
                className="w-full shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 sm:w-auto"
              >
                Delete Group
              </button>
            </div>
          )}
        </div>

        {loadingMembers ? (
          <div className="p-8 text-gray-500">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-gray-500">No students in this group.</div>
        ) : (
          <div>
            {/* Member selection header */}
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={allMembersSelected}
                  onChange={toggleSelectAllMembers}
                  className="h-4 w-4 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {selectedMembers.length} selected
              </span>
            </div>

            {/* Scrollable members */}
            <div className="max-h-[300px] overflow-y-auto divide-y">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMemberSelection(member.id)}
                      className="h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="break-words font-medium">{member.name}</p>
                      <p className="text-sm text-gray-500">
                        {member.student_id || member.employee_id}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id)}
                    className="self-start text-sm text-red-600 hover:text-red-800 sm:self-auto"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Remove selected */}
            {selectedMembers.length > 0 && (
              <div className="flex items-center justify-between border-t bg-red-50 px-4 py-3 sm:px-6">
                <p className="text-sm text-red-700">
                  {selectedMembers.length} student
                  {selectedMembers.length === 1 ? "" : "s"} selected
                </p>

                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedGroup) return;

                    const confirmed = window.confirm(
                      `Remove ${selectedMembers.length} selected student(s) from this group?`
                    );

                    if (!confirmed) return;

                    try {
                      setError("");
                      setSuccess("");

                      await Promise.all(
                        selectedMembers.map((userId) =>
                          removeGroupMember(selectedGroup.id, userId)
                        )
                      );

                      const updatedMembers = await getGroupMembers(
                        selectedGroup.id
                      );

                      setMembers(updatedMembers);
                      setSelectedMembers([]);
                      setSuccess("Selected students removed successfully.");
                    } catch (error) {
                      console.error(
                        "Failed to remove selected students:",
                        error
                      );
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Failed to remove selected students."
                      );
                    }
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Remove Selected
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Students Box */}
      <div className="min-w-0 rounded-xl bg-white p-4 shadow-sm border sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-lg">Add Students</h2>
            <p className="mt-1 text-sm text-gray-500">
              Select students to add to this group.
            </p>
          </div>

          {availableStudents.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllStudents}
              className="text-left text-sm font-medium text-blue-600 hover:text-blue-800 sm:text-right"
            >
              {allStudentsSelected ? "Unselect All" : "Select All"}
            </button>
          )}
        </div>

        {availableStudents.length === 0 ? (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
            All students are already members of this group.
          </div>
        ) : (
          <>
            <div className="mt-5 max-h-48 overflow-y-auto rounded-lg border divide-y">
              {availableStudents.map((student) => (
                <label
                  key={student.id}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    disabled={!student.is_active}
                    checked={selectedStudents.includes(student.id)}
                    onChange={() => {
                      if (!student.is_active) return;
                      toggleStudent(student.id);
                    }}
                    className={`mt-1 h-4 w-4 shrink-0 ${
                      !student.is_active ? "cursor-not-allowed opacity-40" : ""
                    }`}
                  />

                  <div className="min-w-0">
                    <p className="break-words font-medium">{student.name}</p>
                    <p className="text-sm text-gray-500">
                      {student.student_id || student.employee_id}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                {selectedStudents.length} selected
              </p>

              <button
                type="button"
                onClick={handleAddStudents}
                disabled={adding || selectedStudents.length === 0}
                className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              >
                {adding ? "Adding..." : "Add Students"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ============================================================
  // STUDENT: READ-ONLY GROUP VIEW
  // ============================================================
  const renderStudentGroupContent = () => (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedGroup?.name}
          </h2>
          <p className="text-sm text-gray-500">
            {selectedGroup?.description || "No description"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Batchmates
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Students currently enrolled in this group.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {members.length}
            </span>
          </div>
        </div>

        {loadingMembers ? (
          <div className="p-8 text-gray-500">
            Loading batchmates...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-gray-500">
            No other students are currently in this group.
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto divide-y">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 sm:px-6"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                  {(member.name || "?")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="break-words font-medium text-gray-900">
                    {member.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {member.student_id ||
                      member.employee_id ||
                      "Student"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0 relative">

      {/* ======================================================
          FLOATING AUTO-DISAPPEARING FLASH NOTIFICATIONS
      ======================================================= */}
      {(success || error) && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 pointer-events-none transition-all duration-300">
          {success && (
            <div className="pointer-events-auto rounded-xl border border-green-200 bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-xl flex items-center justify-between">
              <span>{success}</span>
              <button onClick={() => setSuccess("")} className="ml-3 text-green-100 hover:text-white font-bold">✕</button>
            </div>
          )}
          {error && (
            <div className="pointer-events-auto rounded-xl border border-red-200 bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-xl flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError("")} className="ml-3 text-red-100 hover:text-white font-bold">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Groups
          </h1>

          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {isStudent
              ? "View your groups and batchmates."
              : "Create groups and manage student members."}
          </p>
        </div>

        {!isStudent && (
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setError("");
              setSuccess("");
            }}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 sm:w-auto"
          >
            {showCreateForm ? "Cancel" : "+ Create Group"}
          </button>
        )}
      </div>

      {/* Create Group */}
      {roleLoaded && !isStudent && showCreateForm && (
        <div className="mt-6 rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">Create New Group</h2>

          <form onSubmit={handleCreateGroup} className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Group Name
              </label>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="Web Development Batch B"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Students enrolled in Web Development"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              >
                {creating ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid */}
      {roleLoaded && !isStudent && (
      <div className="mt-8 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Groups List Column */}
        <div className="min-w-0 overflow-hidden rounded-xl bg-white shadow-sm flex flex-col max-h-[700px] lg:col-span-1">
          <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div>
              <h2 className="text-lg font-semibold">Groups</h2>

              <p className="mt-1 text-xs text-gray-500">
                {groups.length} group{groups.length === 1 ? "" : "s"}
              </p>
            </div>

            {groups.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllGroups}
                className="text-left text-sm font-medium text-blue-600 hover:text-blue-800 sm:text-right"
              >
                {allGroupsSelected ? "Unselect All" : "Select All"}
              </button>
            )}
          </div>

          {selectedGroupIds.length > 0 && (
            <div className="flex flex-col gap-3 border-b bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-red-700">
                {selectedGroupIds.length} group
                {selectedGroupIds.length === 1 ? "" : "s"} selected
              </p>

              <button
                type="button"
                onClick={handleBulkDeleteGroups}
                disabled={deletingGroups}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto"
              >
                {deletingGroups ? "Deleting..." : "Delete Selected"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-6 text-gray-500">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="p-6 text-gray-500">No groups found.</div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`flex items-start gap-3 px-4 py-4 transition hover:bg-gray-50 sm:px-6 ${
                    selectedGroup?.id === group.id ? "bg-blue-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() => toggleGroupSelection(group.id)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                    aria-label={`Select ${group.name}`}
                  />

                  <button
                    type="button"
                    onClick={() => selectGroup(group)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="break-words font-medium text-gray-900">
                      {group.name}
                    </p>

                    <p className="mt-1 break-words text-sm text-gray-500">
                      {group.description || "No description"}
                    </p>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right side (Desktop view: Always visible 2-column span) */}
        <div className="hidden min-w-0 space-y-6 lg:block lg:col-span-2">
          {!selectedGroup ? (
            <div className="flex h-full min-h-[350px] items-center justify-center rounded-xl bg-white p-8 text-gray-500 shadow-sm border">
              Select a group to view its members.
            </div>
          ) : (
            renderGroupManagementContent()
          )}
        </div>
      </div>

      )}

      {/* Main Group View */}
      {roleLoaded && isStudent && (
      <div className="mt-8 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm flex flex-col max-h-[700px] lg:col-span-1">
          <div className="border-b px-4 py-4 sm:px-6 sm:py-5">
            <h2 className="text-lg font-semibold">My Groups</h2>
            <p className="mt-1 text-xs text-gray-500">
              {groups.length} group{groups.length === 1 ? "" : "s"}
            </p>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="p-6 text-gray-500">
              You are not enrolled in any group.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectGroup(group)}
                  className={`w-full px-4 py-4 text-left transition hover:bg-gray-50 sm:px-6 ${
                    selectedGroup?.id === group.id
                      ? "bg-blue-50"
                      : ""
                  }`}
                >
                  <p className="break-words font-medium text-gray-900">
                    {group.name}
                  </p>
                  <p className="mt-1 break-words text-sm text-gray-500">
                    {group.description || "No description"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden min-w-0 lg:block lg:col-span-2">
          {!selectedGroup ? (
            <div className="flex h-full min-h-[350px] items-center justify-center rounded-xl border bg-white p-8 text-gray-500 shadow-sm">
              Select a group to view your batchmates.
            </div>
          ) : (
            renderStudentGroupContent()
          )}
        </div>
      </div>

      )}

      {/* COMPACT FLOATING MOBILE POPUP MODAL */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm lg:hidden">
          <div className="relative flex flex-col max-h-[85vh] w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-5 py-4 bg-gray-50 shrink-0">
              <div className="min-w-0 pr-3">
                <h2 className="text-base font-bold text-gray-900 truncate">
                  {selectedGroup.name}
                </h2>
                <p className="text-xs text-gray-500">
                  {isStudent ? "View batchmates" : "Manage group members"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroup(null);
                  setMembers([]);
                  setSelectedStudents([]);
                  setIsEditingGroup(false);
                  setError("");
                  setSuccess("");
                }}
                className="rounded-full bg-gray-200/70 p-1.5 text-gray-600 hover:bg-gray-300 transition shrink-0"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Management Content Window */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {isStudent
                ? renderStudentGroupContent()
                : renderGroupManagementContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}