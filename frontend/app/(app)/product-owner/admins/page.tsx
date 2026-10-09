"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  createAdmin,
  getAdmins,
  getSchools,
  resetUserPassword,
  updateAdmin,
  updateAdminSchool,
  updateAdminPermissions,
  updateAdminStatus,
} from "@/lib/api";

import { useRouter } from "next/navigation";


interface School {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}


interface Admin {
  id: number;
  organization_id: number | null;
  name: string;
  email: string;
  employee_id: string;
  role: string;
  permissions: string[];
  is_active: boolean;
}


const PERMISSIONS = [
  {
    category: "Attendance",
    items: [
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
    ],
  },

  {
    category: "Events",
    items: [
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
    ],
  },

  {
    category: "Groups",
    items: [
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
    ],
  },

  {
    category: "Users",
    items: [
      {
        key: "student_manage",
        label: "Manage Students",
      },
      {
        key: "teacher_manage",
        label: "Manage Teachers",
      },
    ],
  },

  {
    category: "Face Recognition",
    items: [
      {
        key: "face_manage",
        label: "Manage Face Recognition",
      },
    ],
  },
];


export default function ProductOwnerAdminsPage() {

  const router = useRouter();


  // ==========================================================
  // DATA
  // ==========================================================

  const [admins, setAdmins] =
    useState<Admin[]>([]);

  const [schools, setSchools] =
    useState<School[]>([]);


  // ==========================================================
  // UI
  // ==========================================================

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");


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


  // ==========================================================
  // CREATE ADMIN FORM
  // ==========================================================

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [adminName, setAdminName] =
    useState("");

  const [adminEmail, setAdminEmail] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [schoolId, setSchoolId] =
    useState("");

  const [selectedPermissions, setSelectedPermissions] =
    useState<string[]>([]);


  // ==========================================================
  // EDIT PERMISSIONS
  // ==========================================================

  const [editingPermissionsAdminId, setEditingPermissionsAdminId] =
    useState<number | null>(null);

  const [editingPermissions, setEditingPermissions] =
    useState<string[]>([]);


  // ==========================================================
  // EDIT SCHOOL
  // ==========================================================

  const [editingSchoolAdminId, setEditingSchoolAdminId] =
    useState<number | null>(null);

  const [editingSchoolId, setEditingSchoolId] =
    useState("");


  // ==========================================================
  // EDIT ADMIN PROFILE
  // ==========================================================

  const [editingAdminId, setEditingAdminId] =
    useState<number | null>(null);

  const [editingAdminName, setEditingAdminName] =
    useState("");

  const [editingAdminEmail, setEditingAdminEmail] =
    useState("");

  const [editingAdminEmployeeId, setEditingAdminEmployeeId] =
    useState("");

  const [editingAdminPassword, setEditingAdminPassword] =
    useState("");


  // ==========================================================
  // ROUTE PROTECTION
  // ==========================================================

  useEffect(() => {

    try {

      const token =
        localStorage.getItem(
          "access_token"
        );

      if (!token) {
        router.replace("/login");
        return;
      }


      const parts =
        token.split(".");

      if (parts.length !== 3) {
        router.replace("/dashboard");
        return;
      }


      const payload =
        JSON.parse(
          atob(
            parts[1]
              .replace(/-/g, "+")
              .replace(/_/g, "/")
          )
        );


      const role =
        String(
          payload.role || ""
        ).toLowerCase();


      if (role !== "product_owner") {

        router.replace(
          "/dashboard"
        );

        return;
      }


      loadData();

    } catch {

      router.replace(
        "/dashboard"
      );

    }

  }, [router]);


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  async function loadData() {

    try {

      setLoading(true);
      setError("");

      const [
        adminsData,
        schoolsData,
      ] = await Promise.all([
        getAdmins(),
        getSchools(),
      ]);


      setAdmins(
        Array.isArray(adminsData)
          ? adminsData
          : []
      );


      setSchools(
        Array.isArray(schoolsData)
          ? schoolsData
          : []
      );

    } catch (error: any) {

      console.error(
        "Failed to load admin data:",
        error
      );

      setError(
        error?.message ||
        "Failed to load administrator data"
      );

    } finally {

      setLoading(false);

    }
  }


  // ==========================================================
  // CREATE ADMIN
  // ==========================================================

  async function handleCreateAdmin(
    event: FormEvent
  ) {

    event.preventDefault();


    if (!adminName.trim()) {
      setError("Admin name is required.");
      return;
    }


    if (!adminEmail.trim()) {
      setError("Admin email is required.");
      return;
    }


    if (!employeeId.trim()) {
      setError("Employee ID is required.");
      return;
    }


    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }


    if (!schoolId) {
      setError(
        "Please select a school."
      );
      return;
    }


    try {

      setSaving(true);
      setError("");
      setSuccess("");


      await createAdmin({
        organization_id:
          Number(schoolId),

        name:
          adminName.trim(),

        email:
          adminEmail.trim(),

        password,

        employee_id:
          employeeId.trim(),

        permissions:
          selectedPermissions,
      });


      setSuccess(
        "Administrator created successfully."
      );


      setAdminName("");
      setAdminEmail("");
      setEmployeeId("");
      setPassword("");
      setSchoolId("");
      setSelectedPermissions([]);

      setShowCreateForm(false);


      await loadData();

    } catch (error: any) {

      console.error(
        "Create admin error:",
        error
      );

      setError(
        error?.message ||
        "Failed to create administrator"
      );

    } finally {

      setSaving(false);

    }
  }


  // ==========================================================
  // TOGGLE CREATE PERMISSION
  // ==========================================================

  function toggleCreatePermission(
    permission: string
  ) {

    setSelectedPermissions(
      (current) => {

        if (
          current.includes(permission)
        ) {

          return current.filter(
            (item) =>
              item !== permission
          );

        }

        return [
          ...current,
          permission,
        ];

      }
    );
  }


  // ==========================================================
  // OPEN ADMIN PROFILE EDIT
  // ==========================================================

  function openAdminEditor(admin: Admin) {
    setEditingAdminId(admin.id);
    setEditingAdminName(admin.name);
    setEditingAdminEmail(admin.email);
    setEditingAdminEmployeeId(admin.employee_id);
    setEditingAdminPassword("");

    setError("");
    setSuccess("");
  }


  // ==========================================================
  // SAVE ADMIN PROFILE
  // ==========================================================

  async function saveAdminProfile() {
    if (editingAdminId === null) {
      return;
    }

    if (!editingAdminName.trim()) {
      setError("Administrator name is required.");
      return;
    }

    if (!editingAdminEmail.trim()) {
      setError("Administrator email is required.");
      return;
    }

    if (!editingAdminEmployeeId.trim()) {
      setError("Employee ID is required.");
      return;
    }

    if (
      editingAdminPassword &&
      editingAdminPassword.length < 6
    ) {
      setError(
        "Temporary password must contain at least 6 characters."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateAdmin(
        editingAdminId,
        {
          name: editingAdminName.trim(),
          email: editingAdminEmail.trim(),
          employee_id:
            editingAdminEmployeeId.trim(),
        }
      );

      if (editingAdminPassword) {
        await resetUserPassword(
          editingAdminId,
          editingAdminPassword
        );
      }

      setSuccess(
        editingAdminPassword
          ? "Administrator details and password updated successfully."
          : "Administrator details updated successfully."
      );

      setEditingAdminId(null);
      setEditingAdminName("");
      setEditingAdminEmail("");
      setEditingAdminEmployeeId("");
      setEditingAdminPassword("");

      await loadData();
    } catch (error: any) {
      console.error(
        "Admin profile update error:",
        error
      );

      setError(
        error?.message ||
        "Failed to update administrator"
      );
    } finally {
      setSaving(false);
    }
  }


  // ==========================================================
  // OPEN PERMISSION EDIT
  // ==========================================================

  function openPermissionEditor(
    admin: Admin
  ) {

    setEditingPermissionsAdminId(
      admin.id
    );

    setEditingPermissions(
      [...admin.permissions]
    );

    setError("");
    setSuccess("");

  }


  // ==========================================================
  // SAVE PERMISSIONS
  // ==========================================================

  async function savePermissions() {

    if (
      editingPermissionsAdminId === null
    ) {
      return;
    }


    try {

      setSaving(true);
      setError("");
      setSuccess("");


      await updateAdminPermissions(
        editingPermissionsAdminId,
        editingPermissions
      );


      setSuccess(
        "Administrator permissions updated successfully."
      );


      setEditingPermissionsAdminId(
        null
      );

      setEditingPermissions([]);


      await loadData();

    } catch (error: any) {

      console.error(
        "Permission update error:",
        error
      );

      setError(
        error?.message ||
        "Failed to update permissions"
      );

    } finally {

      setSaving(false);

    }
  }


  // ==========================================================
  // OPEN SCHOOL EDIT
  // ==========================================================

  function openSchoolEditor(
    admin: Admin
  ) {

    setEditingSchoolAdminId(
      admin.id
    );

    setEditingSchoolId(
      admin.organization_id
        ? String(
            admin.organization_id
          )
        : ""
    );

    setError("");
    setSuccess("");

  }


  // ==========================================================
  // SAVE SCHOOL
  // ==========================================================

  async function saveSchool() {

    if (
      editingSchoolAdminId === null
    ) {
      return;
    }


    if (!editingSchoolId) {

      setError(
        "Please select a school."
      );

      return;
    }


    try {

      setSaving(true);
      setError("");
      setSuccess("");


      await updateAdminSchool(
        editingSchoolAdminId,
        Number(editingSchoolId)
      );


      setSuccess(
        "Administrator school updated successfully."
      );


      setEditingSchoolAdminId(
        null
      );

      setEditingSchoolId("");


      await loadData();

    } catch (error: any) {

      console.error(
        "School assignment error:",
        error
      );

      setError(
        error?.message ||
        "Failed to update administrator school"
      );

    } finally {

      setSaving(false);

    }
  }


  // ==========================================================
  // STATUS
  // ==========================================================

  async function toggleAdminStatus(
    admin: Admin
  ) {

    const action =
      admin.is_active
        ? "deactivate"
        : "activate";


    if (
      !window.confirm(
        `Are you sure you want to ${action} "${admin.name}"?`
      )
    ) {
      return;
    }


    try {

      setError("");
      setSuccess("");


      await updateAdminStatus(
        admin.id,
        !admin.is_active
      );


      setSuccess(
        `Administrator ${action}d successfully.`
      );


      await loadData();

    } catch (error: any) {

      console.error(
        "Admin status error:",
        error
      );

      setError(
        error?.message ||
        "Failed to update administrator status"
      );

    }
  }


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <div className="p-6">

        <h1 className="text-2xl font-semibold">
          Administrators
        </h1>

        <p className="mt-4 text-gray-500">
          Loading administrators...
        </p>

      </div>
    );
  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (

    <div className="p-4 sm:p-6 relative">

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

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            Administrators
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage administrators responsible for each school.
          </p>

        </div>


        <button
          type="button"
          onClick={() => {

            setError("");
            setSuccess("");
            setShowCreateForm(
              !showCreateForm
            );

          }}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 w-full sm:w-auto"
        >
          {showCreateForm
            ? "Close"
            : "+ Add Administrator"}
        </button>

      </div>


      {/* ======================================================
          CREATE ADMIN FORM
      ======================================================= */}

      {showCreateForm && (

        <div className="mb-6 rounded-xl border bg-white p-4 sm:p-6 shadow-sm">

          <h2 className="text-lg font-semibold">
            Create Administrator
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create an administrator and assign them to a school.
          </p>


          <form
            onSubmit={handleCreateAdmin}
            className="mt-5 space-y-5"
          >

            <div className="grid gap-4 sm:grid-cols-2">

              {/* NAME */}

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name
                </label>

                <input
                  type="text"
                  value={adminName}
                  onChange={(event) =>
                    setAdminName(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 text-sm"
                  placeholder="Admin Name"
                />

              </div>


              {/* EMAIL */}

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>

                <input
                  type="email"
                  value={adminEmail}
                  onChange={(event) =>
                    setAdminEmail(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 text-sm"
                  placeholder="admin@example.com"
                />

              </div>


              {/* EMPLOYEE ID */}

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Employee ID
                </label>

                <input
                  type="text"
                  value={employeeId}
                  onChange={(event) =>
                    setEmployeeId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 text-sm"
                  placeholder="ADM-001"
                />

              </div>


              {/* PASSWORD */}

              <div>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 text-sm"
                  placeholder="Minimum 6 characters"
                />

              </div>


              {/* SCHOOL */}

              <div className="sm:col-span-2">

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  School
                </label>

                <select
                  value={schoolId}
                  onChange={(event) =>
                    setSchoolId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 text-sm"
                >

                  <option value="">
                    Select School
                  </option>

                  {schools
                    .filter(
                      (school) =>
                        school.is_active
                    )
                    .map(
                      (school) => (

                        <option
                          key={school.id}
                          value={school.id}
                        >
                          {school.name}
                        </option>

                      )
                    )}

                </select>

              </div>

            </div>


            {/* =================================================
                PERMISSIONS
            ================================================== */}

            <div>

              <h3 className="text-sm font-semibold text-gray-900">
                Permissions
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                Select the permissions this administrator should have.
              </p>


              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                {PERMISSIONS.map(
                  (group) => (

                    <div
                      key={group.category}
                      className="rounded-lg border p-4"
                    >

                      <h4 className="mb-3 text-sm font-semibold">
                        {group.category}
                      </h4>


                      <div className="space-y-2">

                        {group.items.map(
                          (permission) => (

                            <label
                              key={permission.key}
                              className="flex cursor-pointer items-center gap-2"
                            >

                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(
                                  permission.key
                                )}
                                onChange={() =>
                                  toggleCreatePermission(
                                    permission.key
                                  )
                                }
                              />

                              <span className="text-sm text-gray-700">
                                {permission.label}
                              </span>

                            </label>

                          )
                        )}

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>


            {/* CREATE */}

            <div className="flex flex-col sm:flex-row gap-3">

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Creating..."
                  : "Create Administrator"}
              </button>


              <button
                type="button"
                onClick={() =>
                  setShowCreateForm(false)
                }
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

            </div>

          </form>

        </div>

      )}


      {/* ======================================================
          ADMIN TABLE
      ======================================================= */}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

        <div className="border-b px-4 sm:px-6 py-4">

          <h2 className="font-semibold text-gray-900">
            Registered Administrators
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {admins.length} administrator
            {admins.length === 1
              ? ""
              : "s"}
          </p>

        </div>


        {admins.length === 0 ? (

          <div className="px-6 py-12 text-center">

            <p className="text-gray-500">
              No administrators found.
            </p>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-left min-w-[750px]">

              <thead className="bg-gray-50">

                <tr>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    ID
                  </th>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Administrator
                  </th>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    School
                  </th>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Permissions
                  </th>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>

                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y">

                {admins.map(
                  (admin) => {

                    const school =
                      schools.find(
                        (item) =>
                          item.id ===
                          admin.organization_id
                      );


                    return (

                      <tr
                        key={admin.id}
                        className="hover:bg-gray-50"
                      >

                        <td className="px-4 sm:px-6 py-4 text-sm text-gray-500">
                          #{admin.id}
                        </td>


                        <td className="px-4 sm:px-6 py-4">

                          <p className="font-medium text-gray-900">
                            {admin.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {admin.email}
                          </p>

                          <p className="text-xs text-gray-400">
                            {admin.employee_id}
                          </p>

                        </td>


                        <td className="px-4 sm:px-6 py-4">

                          <p className="text-sm text-gray-700">
                            {school?.name ||
                              "Not assigned"}
                          </p>

                        </td>


                        <td className="px-4 sm:px-6 py-4">

                          <button
                            type="button"
                            onClick={() =>
                              openPermissionEditor(
                                admin
                              )
                            }
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            {admin.permissions.length}
                            {" "}
                            permission
                            {admin.permissions.length === 1
                              ? ""
                              : "s"}
                          </button>

                        </td>


                        <td className="px-4 sm:px-6 py-4">

                          <span
                            className={
                              admin.is_active
                                ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                                : "rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                            }
                          >

                            {admin.is_active
                              ? "Active"
                              : "Inactive"}

                          </span>

                        </td>


                        <td className="px-4 sm:px-6 py-4">

                          <div className="flex flex-wrap justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                openAdminEditor(
                                  admin
                                )
                              }
                              className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                              Edit
                            </button>


                            <button
                              type="button"
                              onClick={() =>
                                openSchoolEditor(
                                  admin
                                )
                              }
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              School
                            </button>


                            <button
                              type="button"
                              onClick={() =>
                                openPermissionEditor(
                                  admin
                                )
                              }
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Permissions
                            </button>


                            <button
                              type="button"
                              onClick={() =>
                                toggleAdminStatus(
                                  admin
                                )
                              }
                              className={
                                admin.is_active
                                  ? "rounded-lg border border-red-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50"
                                  : "rounded-lg border border-green-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-green-600 hover:bg-green-50"
                              }
                            >
                              {admin.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                          </div>

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>


      {/* ======================================================
          ADMIN PROFILE EDITOR
      ======================================================= */}

      {editingAdminId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              Edit Administrator
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Update administrator details and optionally set a temporary password.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name
                </label>

                <input
                  type="text"
                  value={editingAdminName}
                  onChange={(event) =>
                    setEditingAdminName(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  placeholder="Administrator Name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>

                <input
                  type="email"
                  value={editingAdminEmail}
                  onChange={(event) =>
                    setEditingAdminEmail(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Employee ID
                </label>

                <input
                  type="text"
                  value={editingAdminEmployeeId}
                  onChange={(event) =>
                    setEditingAdminEmployeeId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  placeholder="ADM-001"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Temporary Password
                  <span className="ml-1 font-normal text-gray-400">
                    (optional)
                  </span>
                </label>

                <input
                  type="password"
                  value={editingAdminPassword}
                  onChange={(event) =>
                    setEditingAdminPassword(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  placeholder="Leave blank to keep current password"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Leave blank to keep the current password.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingAdminId(null);
                  setEditingAdminName("");
                  setEditingAdminEmail("");
                  setEditingAdminEmployeeId("");
                  setEditingAdminPassword("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveAdminProfile}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ======================================================
          SCHOOL EDITOR
      ======================================================= */}

      {editingSchoolAdminId !== null && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

            <h2 className="text-lg font-semibold">
              Assign School
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select the school for this administrator.
            </p>


            <select
              value={editingSchoolId}
              onChange={(event) =>
                setEditingSchoolId(
                  event.target.value
                )
              }
              className="mt-5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >

              <option value="">
                Select School
              </option>

              {schools
                .filter(
                  (school) =>
                    school.is_active
                )
                .map(
                  (school) => (

                    <option
                      key={school.id}
                      value={school.id}
                    >
                      {school.name}
                    </option>

                  )
                )}

            </select>


            <div className="mt-5 flex justify-end gap-3">

              <button
                type="button"
                onClick={() => {

                  setEditingSchoolAdminId(
                    null
                  );

                  setEditingSchoolId("");

                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={saveSchool}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save"}
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ======================================================
          PERMISSION EDITOR
      ======================================================= */}

      {editingPermissionsAdminId !== null && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 sm:p-6 shadow-xl">

            <h2 className="text-lg font-semibold">
              Manage Permissions
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select the permissions for this administrator.
            </p>


            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              {PERMISSIONS.map(
                (group) => (

                  <div
                    key={group.category}
                    className="rounded-lg border p-4"
                  >

                    <h3 className="mb-3 text-sm font-semibold">
                      {group.category}
                    </h3>


                    <div className="space-y-2">

                      {group.items.map(
                        (permission) => (

                          <label
                            key={permission.key}
                            className="flex cursor-pointer items-center gap-2"
                          >

                            <input
                              type="checkbox"
                              checked={editingPermissions.includes(
                                permission.key
                              )}
                              onChange={() => {

                                setEditingPermissions(
                                  (current) => {

                                    if (
                                      current.includes(
                                        permission.key
                                      )
                                    ) {

                                      return current.filter(
                                        (item) =>
                                          item !==
                                          permission.key
                                      );

                                    }

                                    return [
                                      ...current,
                                      permission.key,
                                    ];

                                  }
                                );

                              }}
                            />

                            <span className="text-sm">
                              {permission.label}
                            </span>

                          </label>

                        )
                      )}

                    </div>

                  </div>

                )
              )}

            </div>


            <div className="mt-6 flex justify-end gap-3">

              <button
                type="button"
                onClick={() => {

                  setEditingPermissionsAdminId(
                    null
                  );

                  setEditingPermissions([]);

                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={savePermissions}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving
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