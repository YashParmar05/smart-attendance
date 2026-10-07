"use client";

import { useEffect, useState } from "react";

import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  updateTeacherStatus,
  updateTeacherPermissions,
  resetUserPassword,
} from "@/lib/api";


// ============================================================
// PERMISSIONS
// ============================================================

const TEACHER_PERMISSIONS = [
  {
    key: "attendance_view",
    label: "View Attendance",
  },
  {
    key: "attendance_take",
    label: "Take Attendance",
  },
  {
    key: "attendance_modify",
    label: "Modify Attendance",
  },
  {
    key: "event_view",
    label: "View Events",
  },
  {
    key: "event_create",
    label: "Create Events",
  },
  {
    key: "event_modify",
    label: "Modify Events",
  },
  {
    key: "event_delete",
    label: "Delete Events",
  },
  {
    key: "group_view",
    label: "View Groups",
  },
  {
    key: "group_create",
    label: "Create Groups",
  },
  {
    key: "group_modify",
    label: "Modify Groups",
  },
  {
    key: "face_manage",
    label: "Manage Face Recognition",
  },
];


// ============================================================
// PAGE
// ============================================================

export default function TeachersPage() {

  // ============================================================
  // TEACHERS
  // ============================================================

  const [teachers, setTeachers] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);


  // ============================================================
  // SEARCH
  // ============================================================

  const [search, setSearch] =
    useState("");


  // ============================================================
  // MESSAGES
  // ============================================================

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


  // ============================================================
  // CREATE TEACHER
  // ============================================================

  const [showForm, setShowForm] =
    useState(false);

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [creating, setCreating] =
    useState(false);


  // ============================================================
  // EDIT TEACHER
  // ============================================================

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [editingTeacher, setEditingTeacher] =
    useState<any | null>(null);

  const [editName, setEditName] =
    useState("");

  const [editEmail, setEditEmail] =
    useState("");

  const [editEmployeeId, setEditEmployeeId] =
    useState("");

  const [savingEdit, setSavingEdit] =
    useState(false);


  // ============================================================
  // RESET PASSWORD
  // ============================================================

  const [showPasswordModal, setShowPasswordModal] =
    useState(false);

  const [passwordTeacher, setPasswordTeacher] =
    useState<any | null>(null);

  const [newTeacherPassword, setNewTeacherPassword] =
    useState("");

  const [savingPassword, setSavingPassword] =
    useState(false);


  // ============================================================
  // PERMISSIONS
  // ============================================================

  const [showPermissionModal, setShowPermissionModal] =
    useState(false);

  const [permissionTeacher, setPermissionTeacher] =
    useState<any | null>(null);

  const [selectedPermissions, setSelectedPermissions] =
    useState<string[]>([]);

  const [savingPermissions, setSavingPermissions] =
    useState(false);


  // ============================================================
  // STATUS / DELETE
  // ============================================================

  const [processingTeacherId, setProcessingTeacherId] =
    useState<number | null>(null);


  // ============================================================
  // SELECTION
  // ============================================================

  const [selectedTeachers, setSelectedTeachers] =
    useState<number[]>([]);


  // ============================================================
  // SORTING
  // ============================================================

  const [sortField, setSortField] = useState<
    "name" | "employee_id" | "email" | "status"
  >("name");

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");


  // ============================================================
  // LOAD TEACHERS
  // ============================================================

  async function loadTeachers() {

    try {

      setLoading(true);
      setError("");

      const data =
        await getTeachers();

      setTeachers(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      console.error(
        "Failed to load teachers:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load teachers."
      );

    } finally {

      setLoading(false);

    }
  }


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {

    loadTeachers();

  }, []);


  // ============================================================
  // CREATE TEACHER
  // ============================================================

  async function handleCreateTeacher(
    event: React.FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    try {

      setCreating(true);
      setError("");
      setSuccess("");

      await createTeacher({
        name: name.trim(),
        email: email.trim(),
        password,
        employee_id: employeeId.trim(),
        permissions: [
          "attendance_view",
        ],
      });

      setSuccess(
        "Teacher created successfully."
      );

      setName("");
      setEmail("");
      setEmployeeId("");
      setPassword("");

      setShowForm(false);

      await loadTeachers();

    } catch (error) {

      console.error(
        "Teacher creation failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to create teacher."
      );

    } finally {

      setCreating(false);

    }
  }


  // ============================================================
  // OPEN EDIT
  // ============================================================

  function openEditTeacher(
    teacher: any
  ) {

    setEditingTeacher(
      teacher
    );

    setEditName(
      teacher.name || ""
    );

    setEditEmail(
      teacher.email || ""
    );

    setEditEmployeeId(
      teacher.employee_id || ""
    );

    setError("");

    setShowEditModal(true);
  }


  // ============================================================
  // CLOSE EDIT
  // ============================================================

  function closeEditModal() {

    if (savingEdit) {
      return;
    }

    setShowEditModal(false);

    setEditingTeacher(null);

    setEditName("");
    setEditEmail("");
    setEditEmployeeId("");
  }


  // ============================================================
  // UPDATE TEACHER
  // ============================================================

  async function handleUpdateTeacher() {

    if (!editingTeacher) {
      return;
    }

    try {

      setSavingEdit(true);
      setError("");
      setSuccess("");

      await updateTeacher(
        editingTeacher.id,
        {
          name: editName.trim(),
          email: editEmail.trim(),
          employee_id:
            editEmployeeId.trim(),
        }
      );

      setSuccess(
        "Teacher updated successfully."
      );

      closeEditModal();

      await loadTeachers();

    } catch (error) {

      console.error(
        "Teacher update failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update teacher."
      );

    } finally {

      setSavingEdit(false);

    }
  }


  function openTeacherPasswordModal(teacher: any) {
    setPasswordTeacher(teacher);
    setNewTeacherPassword("");
    setError("");
    setShowPasswordModal(true);
  }

  function closeTeacherPasswordModal() {
    if (savingPassword) return;
    setShowPasswordModal(false);
    setPasswordTeacher(null);
    setNewTeacherPassword("");
  }

  async function handleResetTeacherPassword() {
    if (!passwordTeacher || newTeacherPassword.length < 6) return;

    try {
      setSavingPassword(true);
      setError("");
      setSuccess("");

      await resetUserPassword(
        passwordTeacher.id,
        newTeacherPassword
      );

      setSuccess("Teacher password reset successfully.");
      closeTeacherPasswordModal();
    } catch (error) {
      console.error("Teacher password reset failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to reset teacher password."
      );
    } finally {
      setSavingPassword(false);
    }
  }


  // ============================================================
  // DELETE TEACHER
  // ============================================================

  async function handleDeleteTeacher(
    teacher: any
  ) {

    const confirmed =
      window.confirm(
        `Delete ${teacher.name}? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {

      setProcessingTeacherId(
        teacher.id
      );

      setError("");
      setSuccess("");

      await deleteTeacher(
        teacher.id
      );

      setSuccess(
        "Teacher deleted successfully."
      );

      setSelectedTeachers(
        (current) =>
          current.filter(
            (id) =>
              id !== teacher.id
          )
      );

      await loadTeachers();

    } catch (error) {

      console.error(
        "Teacher deletion failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete teacher."
      );

    } finally {

      setProcessingTeacherId(
        null
      );

    }
  }


  // ============================================================
  // STATUS
  // ============================================================

  async function handleTeacherStatus(
    teacher: any,
    isActive: boolean
  ) {

    const action =
      isActive
        ? "activate"
        : "deactivate";

    const confirmed =
      window.confirm(
        `${isActive ? "Activate" : "Deactivate"} ${teacher.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {

      setProcessingTeacherId(
        teacher.id
      );

      setError("");
      setSuccess("");

      await updateTeacherStatus(
        teacher.id,
        isActive
      );

      setSuccess(
        `Teacher ${action}d successfully.`
      );

      await loadTeachers();

    } catch (error) {

      console.error(
        `Teacher ${action} failed:`,
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : `Failed to ${action} teacher.`
      );

    } finally {

      setProcessingTeacherId(
        null
      );

    }
  }


  // ============================================================
  // OPEN PERMISSION MODAL
  // ============================================================

  function openPermissionModal(
    teacher: any
  ) {

    setPermissionTeacher(
      teacher
    );

    setSelectedPermissions(
      Array.isArray(
        teacher.permissions
      )
        ? teacher.permissions
        : []
    );

    setError("");

    setShowPermissionModal(
      true
    );
  }


  // ============================================================
  // CLOSE PERMISSION MODAL
  // ============================================================

  function closePermissionModal() {

    if (savingPermissions) {
      return;
    }

    setShowPermissionModal(
      false
    );

    setPermissionTeacher(
      null
    );

    setSelectedPermissions(
      []
    );
  }


  // ============================================================
  // TOGGLE PERMISSION
  // ============================================================

  function togglePermission(
    permission: string
  ) {

    setSelectedPermissions(
      (current) =>
        current.includes(permission)
          ? current.filter(
              (item) =>
                item !== permission
            )
          : [
              ...current,
              permission,
            ]
    );
  }


  // ============================================================
  // SAVE PERMISSIONS
  // ============================================================

  async function handleSavePermissions() {

    if (!permissionTeacher) {
      return;
    }

    try {

      setSavingPermissions(true);

      setError("");
      setSuccess("");

      await updateTeacherPermissions(
        permissionTeacher.id,
        selectedPermissions
      );

      setSuccess(
        "Teacher permissions updated successfully."
      );

      closePermissionModal();

      await loadTeachers();

    } catch (error) {

      console.error(
        "Permission update failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update permissions."
      );

    } finally {

      setSavingPermissions(false);

    }
  }


  // ============================================================
  // SEARCH
  // ============================================================

  const filteredTeachers =
    teachers.filter(
      (teacher) => {

        const query =
          search
            .toLowerCase()
            .trim();

        const employeeId =
          teacher.employee_id || "";

        return (
          teacher.name
            ?.toLowerCase()
            .includes(query) ||

          teacher.email
            ?.toLowerCase()
            .includes(query) ||

          employeeId
            .toLowerCase()
            .includes(query)
        );
      }
    );


  // ============================================================
  // SORT
  // ============================================================

  const sortedTeachers =
    [...filteredTeachers].sort(
      (a, b) => {

        let valueA = "";
        let valueB = "";

        if (
          sortField === "name"
        ) {

          valueA =
            (
              a.name || ""
            ).toLowerCase();

          valueB =
            (
              b.name || ""
            ).toLowerCase();

        } else if (
          sortField === "employee_id"
        ) {

          valueA =
            (
              a.employee_id || ""
            ).toLowerCase();

          valueB =
            (
              b.employee_id || ""
            ).toLowerCase();

        } else if (
          sortField === "email"
        ) {

          valueA =
            (
              a.email || ""
            ).toLowerCase();

          valueB =
            (
              b.email || ""
            ).toLowerCase();

        } else {

          valueA =
            a.is_active
              ? "active"
              : "inactive";

          valueB =
            b.is_active
              ? "active"
              : "inactive";
        }

        const result =
          valueA.localeCompare(
            valueB,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          );

        return sortDirection ===
          "asc"
          ? result
          : -result;
      }
    );


  // ============================================================
  // SORT
  // ============================================================

  function toggleSort(
    field:
      | "name"
      | "employee_id"
      | "email"
      | "status"
  ) {

    if (
      sortField === field
    ) {

      setSortDirection(
        sortDirection === "asc"
          ? "desc"
          : "asc"
      );

    } else {

      setSortField(field);

      setSortDirection("asc");
    }
  }


  function sortIcon(
    field:
      | "name"
      | "employee_id"
      | "email"
      | "status"
  ) {

    if (
      sortField !== field
    ) {

      return "↕";
    }

    return sortDirection ===
      "asc"
      ? "↑"
      : "↓";
  }


  // ============================================================
  // SELECTION
  // ============================================================

  function toggleTeacherSelection(
    teacherId: number
  ) {

    setSelectedTeachers(
      (current) =>
        current.includes(
          teacherId
        )
          ? current.filter(
              (id) =>
                id !== teacherId
            )
          : [
              ...current,
              teacherId,
            ]
    );
  }


  function selectAllTeachers() {

    setSelectedTeachers(
      sortedTeachers.map(
        (teacher) =>
          teacher.id
      )
    );
  }


  function unselectAllTeachers() {

    setSelectedTeachers([]);
  }


  // ============================================================
  // BULK STATUS
  // ============================================================

  async function handleBulkStatus(
    isActive: boolean
  ) {

    if (
      selectedTeachers.length === 0
    ) {
      return;
    }

    const selected =
      teachers.filter(
        (teacher) =>
          selectedTeachers.includes(
            teacher.id
          )
      );

    const confirmed =
      window.confirm(
        `${isActive ? "Activate" : "Deactivate"} ${selected.length} selected teacher${selected.length === 1 ? "" : "s"}?`
      );

    if (!confirmed) {
      return;
    }

    try {

      setProcessingTeacherId(-1);

      setError("");
      setSuccess("");

      await Promise.all(
        selectedTeachers.map(
          (teacherId) =>
            updateTeacherStatus(
              teacherId,
              isActive
            )
        )
      );

      setSuccess(
        `${selected.length} teacher${selected.length === 1 ? "" : "s"} ${isActive ? "activated" : "deactivated"} successfully.`
      );

      setSelectedTeachers([]);

      await loadTeachers();

    } catch (error) {

      console.error(
        "Bulk status update failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update selected teachers."
      );

    } finally {

      setProcessingTeacherId(
        null
      );

    }
  }


  // ============================================================
  // UI
  // ============================================================

  return (

    <div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        <div>

          <h1 className="text-3xl font-bold text-gray-900">
            Teachers
          </h1>

          <p className="mt-1 text-gray-500">
            Manage teachers and their permissions.
          </p>

        </div>


        <button
          onClick={() => {

            setShowForm(!showForm);

            setError("");
            setSuccess("");

          }}
          className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >

          {showForm
            ? "Cancel"
            : "+ Add Teacher"}

        </button>

      </div>


      {/* ======================================================
          MESSAGES
      ====================================================== */}

      {error && (

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">

          {error}

        </div>

      )}


      {success && (

        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">

          {success}

        </div>

      )}


      {/* ======================================================
          ADD TEACHER
      ====================================================== */}

      {showForm && (

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">

          <h2 className="text-lg font-semibold text-gray-900">
            Add New Teacher
          </h2>

          <form
            onSubmit={
              handleCreateTeacher
            }
            className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5"
          >

            <div>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Full Name
              </label>

              <input
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                required
                placeholder="Rahul Patel"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Employee ID
              </label>

              <input
                value={employeeId}
                onChange={(e) =>
                  setEmployeeId(
                    e.target.value
                  )
                }
                required
                placeholder="TCH001"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                required
                placeholder="teacher@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            <div>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                required
                minLength={6}
                placeholder="Temporary password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            <div className="md:col-span-2">

              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">

                New teachers receive
                <strong> View Attendance </strong>
                permission initially.
                You can change permissions after creation.

              </div>

            </div>


            <div className="md:col-span-2 flex justify-end">

              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >

                {creating
                  ? "Creating..."
                  : "Create Teacher"}

              </button>

            </div>

          </form>

        </div>

      )}


      {/* ======================================================
          SEARCH + COUNT
      ====================================================== */}

      <div className="mt-8">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>

            <p className="text-gray-500">
              Total Teachers
            </p>

            <p className="text-2xl font-bold text-gray-900">
              {teachers.length}
            </p>

          </div>


          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search teachers..."
            className="w-full lg:w-80 rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />

        </div>


        <div className="mt-4 flex flex-wrap items-center gap-3">

          <button
            type="button"
            onClick={
              selectAllTeachers
            }
            disabled={
              sortedTeachers.length === 0
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Select All
          </button>


          <button
            type="button"
            onClick={
              unselectAllTeachers
            }
            disabled={
              selectedTeachers.length === 0
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Unselect All
          </button>


          <span className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            {selectedTeachers.length} selected
          </span>


          {selectedTeachers.length > 0 && (

            <>

              <button
                type="button"
                onClick={() =>
                  handleBulkStatus(
                    true
                  )
                }
                disabled={
                  processingTeacherId === -1
                }
                className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                Activate
              </button>


              <button
                type="button"
                onClick={() =>
                  handleBulkStatus(
                    false
                  )
                }
                disabled={
                  processingTeacherId === -1
                }
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Deactivate
              </button>

            </>

          )}


          {search && (

            <span className="text-sm text-gray-500">
              {sortedTeachers.length} matching
            </span>

          )}

        </div>

      </div>


      {/* ======================================================
          TEACHER TABLE
      ====================================================== */}

      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">

        {loading ? (

          <div className="p-8 text-center text-gray-500">
            Loading teachers...
          </div>

        ) : sortedTeachers.length === 0 ? (

          <div className="p-8 text-center text-gray-500">
            No teachers found.
          </div>

        ) : (

          <div className="max-h-[600px] overflow-auto">

            <table className="w-full">

              <thead className="sticky top-0 z-10 bg-gray-50 border-b">

                <tr>

                  <th className="w-12 px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={
                        sortedTeachers.length > 0 &&
                        sortedTeachers.every(
                          (teacher) =>
                            selectedTeachers.includes(
                              teacher.id
                            )
                        )
                      }
                      onChange={() => {

                        const allSelected =
                          sortedTeachers.length > 0 &&
                          sortedTeachers.every(
                            (teacher) =>
                              selectedTeachers.includes(
                                teacher.id
                              )
                          );

                        if (allSelected) {

                          setSelectedTeachers(
                            (current) =>
                              current.filter(
                                (id) =>
                                  !sortedTeachers.some(
                                    (teacher) =>
                                      teacher.id === id
                                  )
                              )
                          );

                        } else {

                          setSelectedTeachers(
                            (current) =>
                              Array.from(
                                new Set([
                                  ...current,
                                  ...sortedTeachers.map(
                                    (teacher) =>
                                      teacher.id
                                  ),
                                ])
                              )
                          );

                        }

                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>


                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">

                    <button
                      type="button"
                      onClick={() =>
                        toggleSort("name")
                      }
                      className="inline-flex items-center gap-2 hover:text-blue-600"
                    >
                      Teacher

                      <span className="text-xs text-gray-400">
                        {sortIcon("name")}
                      </span>

                    </button>

                  </th>


                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">

                    <button
                      type="button"
                      onClick={() =>
                        toggleSort(
                          "employee_id"
                        )
                      }
                      className="inline-flex items-center gap-2 hover:text-blue-600"
                    >
                      Employee ID

                      <span className="text-xs text-gray-400">
                        {sortIcon(
                          "employee_id"
                        )}
                      </span>

                    </button>

                  </th>


                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">

                    <button
                      type="button"
                      onClick={() =>
                        toggleSort("email")
                      }
                      className="inline-flex items-center gap-2 hover:text-blue-600"
                    >
                      Email

                      <span className="text-xs text-gray-400">
                        {sortIcon("email")}
                      </span>

                    </button>

                  </th>


                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">

                    <button
                      type="button"
                      onClick={() =>
                        toggleSort("status")
                      }
                      className="inline-flex items-center gap-2 hover:text-blue-600"
                    >
                      Status

                      <span className="text-xs text-gray-400">
                        {sortIcon("status")}
                      </span>

                    </button>

                  </th>


                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Permissions
                  </th>


                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y">

                {sortedTeachers.map(
                  (teacher) => (

                    <tr
                      key={teacher.id}
                      className="hover:bg-gray-50"
                    >

                      <td className="px-4 py-4 text-center">

                        <input
                          type="checkbox"
                          checked={
                            selectedTeachers.includes(
                              teacher.id
                            )
                          }
                          onChange={() =>
                            toggleTeacherSelection(
                              teacher.id
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />

                      </td>


                      <td className="px-6 py-4">

                        <div className="font-medium text-gray-900">
                          {teacher.name}
                        </div>

                      </td>


                      <td className="px-6 py-4 text-gray-600">
                        {teacher.employee_id}
                      </td>


                      <td className="px-6 py-4 text-gray-600">
                        {teacher.email}
                      </td>


                      <td className="px-6 py-4">

                        <span
                          className={
                            teacher.is_active
                              ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                              : "rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
                          }
                        >
                          {teacher.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>

                      </td>


                      <td className="px-6 py-4">

                        <button
                          type="button"
                          onClick={() =>
                            openPermissionModal(
                              teacher
                            )
                          }
                          className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100"
                        >
                          {Array.isArray(
                            teacher.permissions
                          )
                            ? `${teacher.permissions.length} Permissions`
                            : "Manage"}
                        </button>

                      </td>


                      <td className="px-6 py-4">

                        <div className="flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              openEditTeacher(
                                teacher
                              )
                            }
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openTeacherPasswordModal(teacher)
                            }
                            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                          >
                            Reset Password
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              handleTeacherStatus(
                                teacher,
                                !teacher.is_active
                              )
                            }
                            disabled={
                              processingTeacherId ===
                              teacher.id
                            }
                            className={
                              teacher.is_active
                                ? "rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                : "rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                            }
                          >
                            {processingTeacherId ===
                            teacher.id
                              ? "..."
                              : teacher.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteTeacher(
                                teacher
                              )
                            }
                            disabled={
                              processingTeacherId ===
                              teacher.id
                            }
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>


      {/* ======================================================
          EDIT TEACHER MODAL
      ====================================================== */}

      {showEditModal &&
        editingTeacher && (

          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h2 className="text-xl font-semibold text-gray-900">
                    Edit Teacher
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Update teacher account details.
                  </p>

                </div>


                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={savingEdit}
                  className="text-xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>

              </div>


              <div className="mt-6 space-y-4">

                <div>

                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Full Name
                  </label>

                  <input
                    value={editName}
                    onChange={(e) =>
                      setEditName(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />

                </div>


                <div>

                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Employee ID
                  </label>

                  <input
                    value={editEmployeeId}
                    onChange={(e) =>
                      setEditEmployeeId(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />

                </div>


                <div>

                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) =>
                      setEditEmail(
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  />

                </div>

              </div>


              <p className="mt-4 text-xs font-medium text-gray-600">
              Enter at least 6 characters, then click <span className="font-semibold">Reset Password</span> to submit.
            </p>

            <div className="mt-4 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={savingEdit}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handleUpdateTeacher
                  }
                  disabled={
                    savingEdit ||
                    !editName.trim() ||
                    !editEmail.trim() ||
                    !editEmployeeId.trim()
                  }
                  className="rounded-lg bg-black px-5 py-2.5 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </div>

          </div>

        )}


      {/* ======================================================
          RESET TEACHER PASSWORD MODAL
      ====================================================== */}

      {showPasswordModal && passwordTeacher && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Reset Teacher Password
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Set a new temporary password for {passwordTeacher.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTeacherPasswordModal}
                disabled={savingPassword}
                className="text-xl text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                New Temporary Password
              </label>
              <input
                type="password"
                value={newTeacherPassword}
                onChange={(e) => setNewTeacherPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Minimum 6 characters"
              />
              <p className="mt-2 text-xs text-gray-500">
                The existing password will be replaced and cannot be recovered.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeTeacherPasswordModal}
                disabled={savingPassword}
                className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetTeacherPassword}
                title="Reset Password"
                disabled={savingPassword || newTeacherPassword.length < 6}
                className="rounded-lg bg-amber-600 px-5 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPassword ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ======================================================
          PERMISSION MODAL
      ====================================================== */}

      {showPermissionModal &&
        permissionTeacher && (

          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h2 className="text-xl font-semibold text-gray-900">
                    Teacher Permissions
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">

                    Manage permissions for{" "}

                    <span className="font-medium text-gray-700">
                      {permissionTeacher.name}
                    </span>

                  </p>

                </div>


                <button
                  type="button"
                  onClick={
                    closePermissionModal
                  }
                  disabled={
                    savingPermissions
                  }
                  className="text-xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>

              </div>


              <div className="mt-6 max-h-[420px] overflow-y-auto rounded-lg border">

                {TEACHER_PERMISSIONS.map(
                  (permission) => (

                    <label
                      key={
                        permission.key
                      }
                      className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-gray-50"
                    >

                      <input
                        type="checkbox"
                        checked={
                          selectedPermissions.includes(
                            permission.key
                          )
                        }
                        onChange={() =>
                          togglePermission(
                            permission.key
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />

                      <span className="text-sm text-gray-700">
                        {permission.label}
                      </span>

                      <span className="ml-auto text-xs text-gray-400">
                        {permission.key}
                      </span>

                    </label>

                  )
                )}

              </div>


              <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">

                <strong>
                  {selectedPermissions.length}
                </strong>{" "}
                permission
                {selectedPermissions.length === 1
                  ? ""
                  : "s"} selected.

              </div>


              <div className="mt-6 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={
                    closePermissionModal
                  }
                  disabled={
                    savingPermissions
                  }
                  className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handleSavePermissions
                  }
                  disabled={
                    savingPermissions
                  }
                  className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingPermissions
                    ? "Saving..."
                    : "Save Permissions"}
                </button>

              </div>

            </div>

          </div>

        )}

    </div>
  );
}