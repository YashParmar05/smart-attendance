"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  createSchool,
  getSchools,
  updateSchool,
  updateSchoolStatus,
} from "@/lib/api";

import { useRouter } from "next/navigation";


interface School {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  license_status?: string;
}


export default function ProductOwnerSchoolsPage() {

  const router = useRouter();


  // ==========================================================
  // DATA
  // ==========================================================

  const [schools, setSchools] =
    useState<School[]>([]);

  const [loading, setLoading] =
    useState(true);


  // ==========================================================
  // FORM
  // ==========================================================

  const [showForm, setShowForm] =
    useState(false);

  const [editingSchoolId, setEditingSchoolId] =
    useState<number | null>(null);

  const [schoolName, setSchoolName] =
    useState("");

  const [schoolEmail, setSchoolEmail] =
    useState("");


  // ==========================================================
  // UI STATE
  // ==========================================================

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
  // PO ROUTE PROTECTION
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


      loadSchools();

    } catch {

      router.replace(
        "/dashboard"
      );

    }

  }, [router]);


  // ==========================================================
  // LOAD SCHOOLS
  // ==========================================================

  async function loadSchools() {

    try {

      setLoading(true);
      setError("");

      const data =
        await getSchools();


      setSchools(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error: any) {

      console.error(
        "Failed to load schools:",
        error
      );

      setError(
        error?.message ||
        "Failed to load schools"
      );

    } finally {

      setLoading(false);

    }
  }


  // ==========================================================
  // OPEN CREATE FORM
  // ==========================================================

  function openCreateForm() {

    setEditingSchoolId(null);

    setSchoolName("");
    setSchoolEmail("");

    setError("");
    setSuccess("");

    setShowForm(true);

  }


  // ==========================================================
  // OPEN EDIT FORM
  // ==========================================================

  function openEditForm(
    school: School
  ) {

    setEditingSchoolId(
      school.id
    );

    setSchoolName(
      school.name
    );

    setSchoolEmail(
      school.email
    );

    setError("");
    setSuccess("");

    setShowForm(true);

  }


  // ==========================================================
  // CLOSE FORM
  // ==========================================================

  function closeForm() {

    setShowForm(false);

    setEditingSchoolId(null);

    setSchoolName("");
    setSchoolEmail("");

  }


  // ==========================================================
  // SAVE SCHOOL
  // ==========================================================

  async function handleSubmit(
    event: FormEvent
  ) {

    event.preventDefault();


    if (!schoolName.trim()) {

      setError(
        "School name is required."
      );

      return;
    }


    if (!schoolEmail.trim()) {

      setError(
        "School email is required."
      );

      return;
    }


    try {

      setSaving(true);
      setError("");
      setSuccess("");


      if (
        editingSchoolId !== null
      ) {

        await updateSchool(
          editingSchoolId,
          {
            name:
              schoolName.trim(),

            email:
              schoolEmail.trim(),
          }
        );


        setSuccess(
          "School updated successfully."
        );

      } else {

        await createSchool(
          {
            name:
              schoolName.trim(),

            email:
              schoolEmail.trim(),
          }
        );


        setSuccess(
          "School created successfully."
        );

      }


      closeForm();

      await loadSchools();

    } catch (error: any) {

      console.error(
        "School save error:",
        error
      );

      setError(
        error?.message ||
        "Failed to save school"
      );

    } finally {

      setSaving(false);

    }
  }


  // ==========================================================
  // CHANGE SCHOOL STATUS
  // ==========================================================

  async function handleStatusChange(
    school: School
  ) {

    const action =
      school.is_active
        ? "deactivate"
        : "activate";


    const confirmed =
      window.confirm(
        `Are you sure you want to ${action} "${school.name}"?`
      );


    if (!confirmed) {
      return;
    }


    try {

      setError("");
      setSuccess("");


      await updateSchoolStatus(
        school.id,
        !school.is_active
      );


      setSuccess(
        `School ${action}d successfully.`
      );


      await loadSchools();

    } catch (error: any) {

      console.error(
        "School status error:",
        error
      );

      setError(
        error?.message ||
        "Failed to update school status"
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
          Schools
        </h1>

        <p className="mt-4 text-gray-500">
          Loading schools...
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
            Schools
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage schools registered on the platform.
          </p>

        </div>


        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 w-full sm:w-auto"
        >
          + Add School
        </button>

      </div>


      {/* ======================================================
          CREATE / EDIT FORM
      ======================================================= */}

      {showForm && (

        <div className="mb-6 rounded-xl border bg-white p-4 sm:p-6 shadow-sm">

          <div className="mb-5">

            <h2 className="text-lg font-semibold">

              {editingSchoolId !== null
                ? "Edit School"
                : "Create School"}

            </h2>

            <p className="mt-1 text-sm text-gray-500">

              {editingSchoolId !== null
                ? "Update school information."
                : "Register a new school on the platform."}

            </p>

          </div>


          <form
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >

            {/* SCHOOL NAME */}

            <div>

              <label className="mb-1 block text-sm font-medium text-gray-700">

                School Name

              </label>

              <input
                type="text"
                value={schoolName}
                onChange={(event) =>
                  setSchoolName(
                    event.target.value
                  )
                }
                placeholder="XYZ School"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 text-sm"
              />

            </div>


            {/* SCHOOL EMAIL */}

            <div>

              <label className="mb-1 block text-sm font-medium text-gray-700">

                School Email

              </label>

              <input
                type="email"
                value={schoolEmail}
                onChange={(event) =>
                  setSchoolEmail(
                    event.target.value
                  )
                }
                placeholder="admin@xyzschool.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 text-sm"
              />

            </div>


            {/* BUTTONS */}

            <div className="flex flex-col sm:flex-row gap-3 sm:col-span-2">

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >

                {saving
                  ? "Saving..."
                  : editingSchoolId !== null
                  ? "Update School"
                  : "Create School"}

              </button>


              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >

                Cancel

              </button>

            </div>

          </form>

        </div>

      )}


      {/* ======================================================
          SCHOOL TABLE
      ======================================================= */}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

        <div className="border-b px-4 sm:px-6 py-4">

          <h2 className="font-semibold text-gray-900">
            Registered Schools
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {schools.length} school
            {schools.length === 1
              ? ""
              : "s"} registered
          </p>

        </div>


        {schools.length === 0 ? (

          <div className="px-6 py-12 text-center">

            <p className="text-gray-500">
              No schools registered yet.
            </p>

            <button
              onClick={openCreateForm}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Add First School
            </button>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-left min-w-[650px]">

              <thead className="bg-gray-50">

                <tr>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    ID
                  </th>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    School
                  </th>

                  <th className="px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
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

                {schools.map(
                  (school) => (

                    <tr
                      key={school.id}
                      className="hover:bg-gray-50"
                    >

                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-500">

                        #{school.id}

                      </td>


                      <td className="px-4 sm:px-6 py-4">

                        <p className="font-medium text-gray-900">
                          {school.name}
                        </p>

                        {school.license_status && (

                          <p className="mt-1 text-xs text-gray-500">
                            License: {school.license_status}
                          </p>

                        )}

                      </td>


                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">

                        {school.email}

                      </td>


                      <td className="px-4 sm:px-6 py-4">

                        <span
                          className={
                            school.is_active
                              ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                              : "rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                          }
                        >

                          {school.is_active
                            ? "Active"
                            : "Inactive"}

                        </span>

                      </td>


                      <td className="px-4 sm:px-6 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(
                                school
                              )
                            }
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(
                                school
                              )
                            }
                            className={
                              school.is_active
                                ? "rounded-lg border border-red-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50"
                                : "rounded-lg border border-green-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-green-600 hover:bg-green-50"
                            }
                          >

                            {school.is_active
                              ? "Deactivate"
                              : "Activate"}

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

    </div>
  );
}