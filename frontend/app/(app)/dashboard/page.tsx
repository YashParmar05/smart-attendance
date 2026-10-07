"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  getUsers,
  getGroups,
  getEvents,
  getAttendance,
  getMyAttendance
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==================================================
  // LOAD DASHBOARD DATA
  // ==================================================

  useEffect(() => {
    async function loadDashboard() {
      const token =
        localStorage.getItem("access_token");

      if (!token) {
        router.push("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        /*
         * First determine who is logged in.
         *
         * This is important because /dashboard is now
         * shared by Admin and Teacher.
         */
        const user = await getCurrentUser();

        setCurrentUser(user);

        const role =
          String(user?.role || "").toLowerCase();

        /*
         * Admin keeps the existing dashboard data.
         *
         * Teacher gets the same base data for now,
         * but the UI below filters it to teacher-specific
         * information.
         */
        const [
          usersData,
          groupsData,
          eventsData,
          attendanceData,
        ] = await Promise.all([
          getUsers(),
          getGroups(),
          getEvents(),
          getAttendance(),
        ]);

        setUsers(
          Array.isArray(usersData)
            ? usersData
            : []
        );

        setGroups(
          Array.isArray(groupsData)
            ? groupsData
            : []
        );

        setEvents(
          Array.isArray(eventsData)
            ? eventsData
            : []
        );

        setAttendance(
          Array.isArray(attendanceData)
            ? attendanceData
            : []
        );
      } catch (error: any) {
        console.error(
          "Dashboard error:",
          error
        );

        setError(
          error?.message ||
            "Failed to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-4 text-gray-500">
          Loading dashboard...
        </p>
      </div>
    );
  }

  // ==================================================
  // ERROR
  // ==================================================

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-semibold">
          Dashboard
        </h1>

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-700">
            Failed to load dashboard
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>

          <button
            onClick={() =>
              window.location.reload()
            }
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ==================================================
  // ROLE
  // ==================================================

  const role =
    String(
      currentUser?.role || ""
    ).toLowerCase();

  // ==================================================
  // TEACHER DASHBOARD
  // ==================================================

  if (role === "teacher") {
    return (
      <TeacherDashboard
        currentUser={currentUser}
        groups={groups}
        events={events}
        attendance={attendance}
      />
    );
  }

  // ==================================================
  // ADMIN DASHBOARD
  // ==================================================

  if (role === "admin") {
    return (
      <AdminDashboard
        users={users}
        groups={groups}
        events={events}
        attendance={attendance}
      />
    );
  }

  // ==================================================
  // PRODUCT OWNER
  // ==================================================

  if (role === "product_owner") {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-semibold">
          Product Owner
        </h1>

        <p className="mt-2 text-gray-500">
          Please use the Product Owner dashboard.
        </p>

        <button
          onClick={() =>
            router.push("/product-owner")
          }
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to Product Owner Dashboard
        </button>
      </div>
    );
  }

  // ==================================================
  // STUDENT
  // ==================================================

  if (role === "student") {
    return (
      <StudentDashboard
        currentUser={currentUser}
      />
    );
  }
  // ==================================================
  // UNKNOWN ROLE
  // ==================================================

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold">
        Dashboard
      </h1>

      <p className="mt-2 text-gray-500">
        Your account role could not be determined.
      </p>
    </div>
  );
}


// ======================================================
// TEACHER DASHBOARD
// ======================================================

function TeacherDashboard({
  currentUser,
  groups,
  events,
  attendance,
}: {
  currentUser: any;
  groups: any[];
  events: any[];
  attendance: any[];
}) {
  // ----------------------------------------------------
  // TEACHER ID
  // ----------------------------------------------------

  const teacherId =
    Number(currentUser?.id);

  // ----------------------------------------------------
  // PERMISSIONS
  // ----------------------------------------------------

  const permissions: string[] =
    Array.isArray(
      currentUser?.permissions
    )
      ? currentUser.permissions
      : [];

  const hasPermission = (
    permission: string
  ) =>
    permissions.includes(permission);

  // ----------------------------------------------------
  // TEACHER EVENTS
  // ----------------------------------------------------

  /*
   * Events can have teacher_ids.
   *
   * We only show events where the logged-in teacher
   * is assigned.
   *
   * We also support created_by as a fallback because
   * older event responses may use that field.
   */
  const myEvents =
    events.filter((event) => {
      const teacherIds =
        Array.isArray(event.teacher_ids)
          ? event.teacher_ids.map(Number)
          : [];

      const createdBy =
        Number(event.created_by);

      return (
        teacherIds.includes(teacherId) ||
        createdBy === teacherId
      );
    });

  // ----------------------------------------------------
  // ACTIVE EVENTS
  // ----------------------------------------------------

  const activeEvents =
    myEvents.filter(
      (event) =>
        event.is_active
    );

  // ----------------------------------------------------
  // UPCOMING EVENTS
  // ----------------------------------------------------

  const now =
    new Date();

  const upcomingEvents =
    myEvents
      .filter((event) => {
        if (!event.starts_at) {
          return false;
        }

        return (
          new Date(event.starts_at) > now &&
          event.is_active
        );
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime()
      );

  // ----------------------------------------------------
  // TODAY'S EVENTS
  // ----------------------------------------------------

  const today =
    new Date();

  const todayEvents =
    activeEvents.filter(
      (event) => {
        if (!event.starts_at) {
          return false;
        }

        const date =
          new Date(event.starts_at);

        return (
          date.getFullYear() ===
            today.getFullYear() &&
          date.getMonth() ===
            today.getMonth() &&
          date.getDate() ===
            today.getDate()
        );
      }
    );

  // ----------------------------------------------------
  // ATTENDANCE
  // ----------------------------------------------------

  /*
   * Only use attendance records related to the
   * teacher's events.
   *
   * Different backend versions may return event_id
   * or eventId, so support both.
   */
  const myEventIds =
    new Set(
      myEvents.map(
        (event) =>
          Number(event.id)
      )
    );

  const myAttendance =
    attendance.filter(
      (record) => {
        const eventId =
          Number(
            record.event_id ??
              record.eventId
          );

        return myEventIds.has(
          eventId
        );
      }
    );

  const presentCount =
    myAttendance.filter(
      (record) =>
        String(
          record.status
        ).toLowerCase() ===
        "present"
    ).length;

  const attendanceRate =
    myAttendance.length > 0
      ? (
          (presentCount /
            myAttendance.length) *
          100
        ).toFixed(1)
      : "0.0";

  // ----------------------------------------------------
  // FORMAT DATE
  // ----------------------------------------------------

  function formatDate(
    value: string
  ) {
    if (!value) {
      return "Date not available";
    }

    return new Date(
      value
    ).toLocaleDateString(
      undefined,
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  // ----------------------------------------------------
  // FORMAT TIME
  // ----------------------------------------------------

  function formatTime(
    value: string
  ) {
    if (!value) {
      return "--";
    }

    return new Date(
      value
    ).toLocaleTimeString(
      undefined,
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------

  return (
    <div className="p-6">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="mb-8">
        <h1 className="text-3xl font-semibold">
          Welcome back,{" "}
          {currentUser?.name ||
            "Teacher"}{" "}
          👋
        </h1>

        <p className="mt-1 text-gray-500">
          Here's what's happening with
          your classes.
        </p>
      </div>


      {/* ==================================================
          STATISTICS
      ================================================== */}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

        {/* MY GROUPS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            My Groups
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {hasPermission(
              "group_view"
            )
              ? groups.length
              : 0}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Groups available to you
          </p>
        </div>


        {/* MY EVENTS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            My Events
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {hasPermission(
              "event_view"
            )
              ? myEvents.length
              : 0}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {activeEvents.length} active
          </p>
        </div>


        {/* ATTENDANCE */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Attendance
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {hasPermission(
              "attendance_view"
            )
              ? `${attendanceRate}%`
              : "—"}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Based on your events
          </p>
        </div>


        {/* UPCOMING */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Upcoming
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {hasPermission(
              "event_view"
            )
              ? upcomingEvents.length
              : 0}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Upcoming events
          </p>
        </div>

      </div>


      {/* ==================================================
          TODAY'S EVENTS
      ================================================== */}

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold">
              Today's Events
            </h2>

            <p className="text-sm text-gray-500">
              Events scheduled for today
            </p>
          </div>

          <a
            href="/events"
            className="text-sm font-medium underline"
          >
            View Events
          </a>

        </div>


        <div className="mt-5 space-y-3">

          {!hasPermission(
            "event_view"
          ) ? (

            <p className="text-sm text-gray-500">
              You don't have permission
              to view events.
            </p>

          ) : todayEvents.length === 0 ? (

            <p className="text-sm text-gray-500">
              No events scheduled for
              today.
            </p>

          ) : (

            todayEvents.map(
              (event) => (

                <div
                  key={event.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >

                  <div>

                    <p className="font-medium">
                      {event.title}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {formatTime(
                        event.starts_at
                      )}
                      {" • "}
                      {event.group_ids
                        ? `${event.group_ids.length} group(s)`
                        : "Groups assigned"}
                    </p>

                  </div>


                  <div className="flex gap-2">

                    {hasPermission(
                      "attendance_take"
                    ) && (

                      <a
                        href={`/attendance?event=${event.id}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Take Attendance
                      </a>

                    )}

                    <a
                      href={`/events?event=${event.id}`}
                      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      View Event
                    </a>

                  </div>

                </div>

              )
            )

          )}

        </div>

      </div>


      {/* ==================================================
          RECENT ATTENDANCE + UPCOMING EVENTS
      ================================================== */}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">

        {/* RECENT ATTENDANCE */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold">
                Recent Attendance
              </h2>

              <p className="text-sm text-gray-500">
                Attendance from your events
              </p>
            </div>

            {hasPermission(
              "attendance_view"
            ) && (
              <a
                href="/attendance"
                className="text-sm font-medium underline"
              >
                View All
              </a>
            )}

          </div>


          <div className="mt-5 space-y-3">

            {!hasPermission(
              "attendance_view"
            ) ? (

              <p className="text-sm text-gray-500">
                You don't have permission
                to view attendance.
              </p>

            ) : myAttendance.length === 0 ? (

              <p className="text-sm text-gray-500">
                No attendance records
                found.
              </p>

            ) : (

              myAttendance
                .slice(-5)
                .reverse()
                .map(
                  (record, index) => (

                    <div
                      key={
                        record.id ??
                        index
                      }
                      className="flex items-center justify-between rounded-lg border p-3"
                    >

                      <div>

                        <p className="font-medium">
                          {record.student_name ||
                            record.user_name ||
                            `Student #${
                              record.user_id ??
                              ""
                            }`}
                        </p>

                        <p className="text-xs text-gray-500">
                          {formatDate(
                            record.created_at ||
                              record.date ||
                              ""
                          )}
                        </p>

                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          String(
                            record.status
                          ).toLowerCase() ===
                          "present"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {record.status ||
                          "Unknown"}
                      </span>

                    </div>

                  )
                )

            )}

          </div>

        </div>


        {/* UPCOMING EVENTS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold">
                Upcoming Events
              </h2>

              <p className="text-sm text-gray-500">
                Your upcoming classes
              </p>
            </div>

            <a
              href="/events"
              className="text-sm font-medium underline"
            >
              View All
            </a>

          </div>


          <div className="mt-5 space-y-3">

            {!hasPermission(
              "event_view"
            ) ? (

              <p className="text-sm text-gray-500">
                You don't have permission
                to view events.
              </p>

            ) : upcomingEvents.length ===
              0 ? (

              <p className="text-sm text-gray-500">
                No upcoming events.
              </p>

            ) : (

              upcomingEvents
                .slice(0, 5)
                .map(
                  (event) => (

                    <div
                      key={event.id}
                      className="rounded-lg border p-3"
                    >

                      <p className="font-medium">
                        {event.title}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(
                          event.starts_at
                        )}
                        {" • "}
                        {formatTime(
                          event.starts_at
                        )}
                      </p>

                    </div>

                  )
                )

            )}

          </div>

        </div>

      </div>


      {/* ==================================================
          QUICK ACTIONS
      ================================================== */}

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">

        <h2 className="text-lg font-semibold">
          Quick Actions
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Actions available to you
          based on your permissions.
        </p>


        <div className="mt-5 flex flex-wrap gap-3">

          {hasPermission(
            "group_view"
          ) && (
            <a
              href="/groups"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              My Groups
            </a>
          )}


          {hasPermission(
            "event_view"
          ) && (
            <a
              href="/events"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              My Events
            </a>
          )}


          {hasPermission(
            "event_create"
          ) && (
            <a
              href="/events"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Event
            </a>
          )}


          {hasPermission(
            "attendance_view"
          ) && (
            <a
              href="/attendance"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              View Attendance
            </a>
          )}

        </div>

      </div>

    </div>
  );
}


// ======================================================
// ADMIN DASHBOARD
// ======================================================

function AdminDashboard({
  users,
  groups,
  events,
  attendance,
}: {
  users: any[];
  groups: any[];
  events: any[];
  attendance: any[];
}) {
  // ==================================================
  // USER COUNTS
  // ==================================================

  const students =
    users.filter(
      (user) =>
        String(user.role).toLowerCase() ===
        "student"
    );

  const teachers =
    users.filter(
      (user) =>
        String(user.role).toLowerCase() ===
        "teacher"
    );

  const activeStudents =
    students.filter(
      (student) =>
        student.is_active
    ).length;

  const activeTeachers =
    teachers.filter(
      (teacher) =>
        teacher.is_active
    ).length;

  // ==================================================
  // EVENT COUNTS
  // ==================================================

  const activeEvents =
    events.filter(
      (event) =>
        event.is_active
    ).length;

  // ==================================================
  // ATTENDANCE COUNTS
  // ==================================================

  const presentCount =
    attendance.filter(
      (record) =>
        String(
          record.status
        ).toLowerCase() ===
        "present"
    ).length;

  // ==================================================
  // DASHBOARD
  // ==================================================

  return (
    <div className="p-6">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="mb-8">

        <h1 className="text-3xl font-semibold">
          Admin Dashboard
        </h1>

        <p className="mt-1 text-gray-500">
          Overview of your school's
          attendance system.
        </p>

      </div>


      {/* ==================================================
          STATISTICS
      ================================================== */}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">

        {/* STUDENTS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Students
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {students.length}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {activeStudents} active
          </p>

        </div>


        {/* TEACHERS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Teachers
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {teachers.length}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {activeTeachers} active
          </p>

        </div>


        {/* GROUPS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Groups
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {groups.length}
          </p>

        </div>


        {/* EVENTS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Events
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {events.length}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {activeEvents} active
          </p>

        </div>


        {/* ATTENDANCE */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Attendance
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {attendance.length}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {presentCount} present
          </p>

        </div>

      </div>


      {/* ==================================================
          QUICK MANAGEMENT
      ================================================== */}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">

        {/* STUDENTS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold">
                Students
              </h2>

              <p className="text-sm text-gray-500">
                Manage student accounts and
                face enrollment
              </p>

            </div>

            <a
              href="/students"
              className="text-sm font-medium underline"
            >
              Manage
            </a>

          </div>


          <div className="mt-5 max-h-80 overflow-y-auto space-y-3 pr-2">

            {students.length === 0 ? (

              <p className="text-sm text-gray-500">
                No students found.
              </p>

            ) : (

              students.map(
                (student) => (

                  <div
                    key={student.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >

                    <div>

                      <p className="font-medium">
                        {student.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {student.employee_id}
                      </p>

                    </div>


                    <span
                      className={
                        student.is_active
                          ? "text-sm font-medium"
                          : "text-sm font-medium text-gray-500"
                      }
                    >
                      {student.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>

                )
              )

            )}

          </div>

        </div>


        {/* TEACHERS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold">
                Teachers
              </h2>

              <p className="text-sm text-gray-500">
                Manage teachers and their
                permissions
              </p>

            </div>

            <a
              href="/teachers"
              className="text-sm font-medium underline"
            >
              Manage
            </a>

          </div>


          <div className="mt-5 max-h-80 overflow-y-auto space-y-3 pr-2">

            {teachers.length === 0 ? (

              <p className="text-sm text-gray-500">
                No teachers found.
              </p>

            ) : (

              teachers.map(
                (teacher) => (

                  <div
                    key={teacher.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >

                    <div>

                      <p className="font-medium">
                        {teacher.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {teacher.employee_id}
                      </p>

                    </div>


                    <span
                      className={
                        teacher.is_active
                          ? "text-sm font-medium"
                          : "text-sm font-medium text-gray-500"
                      }
                    >
                      {teacher.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>

                )
              )

            )}

          </div>

        </div>


        {/* GROUPS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold">
                Groups
              </h2>

              <p className="text-sm text-gray-500">
                Manage student groups
              </p>

            </div>

            <a
              href="/groups"
              className="text-sm font-medium underline"
            >
              Manage
            </a>

          </div>


          <div className="mt-5 max-h-80 overflow-y-auto space-y-3 pr-2">

            {groups.length === 0 ? (

              <p className="text-sm text-gray-500">
                No groups found.
              </p>

            ) : (

              groups.map(
                (group) => (

                  <div
                    key={group.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >

                    <div>

                      <p className="font-medium">
                        {group.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {group.description ||
                          "No description"}
                      </p>

                    </div>


                    <span
                      className={
                        group.is_active
                          ? "text-sm font-medium"
                          : "text-sm font-medium text-gray-500"
                      }
                    >
                      {group.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>

                )
              )

            )}

          </div>

        </div>


        {/* EVENTS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold">
                Events
              </h2>

              <p className="text-sm text-gray-500">
                Manage attendance events
              </p>

            </div>

            <a
              href="/events"
              className="text-sm font-medium underline"
            >
              Manage
            </a>

          </div>


          <div className="mt-5 max-h-80 overflow-y-auto space-y-3 pr-2">

            {events.length === 0 ? (

              <p className="text-sm text-gray-500">
                No events found.
              </p>

            ) : (

              events.map(
                (event) => (

                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >

                    <div>

                      <p className="font-medium">
                        {event.title}
                      </p>

                      <p className="text-xs text-gray-500">
                        Group ID:{" "}
                        {event.group_id}
                      </p>

                    </div>


                    <span
                      className={
                        event.is_active
                          ? "text-sm font-medium"
                          : "text-sm font-medium text-gray-500"
                      }
                    >
                      {event.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>

                )
              )

            )}

          </div>

        </div>

      </div>


      {/* ==================================================
          ATTENDANCE SUMMARY
      ================================================== */}

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-lg font-semibold">
              Attendance
            </h2>

            <p className="text-sm text-gray-500">
              Attendance records in your
              school
            </p>

          </div>

          <a
            href="/attendance"
            className="text-sm font-medium underline"
          >
            View Attendance
          </a>

        </div>


        <div className="mt-5 grid gap-4 sm:grid-cols-3">

          <div className="rounded-lg border p-4">

            <p className="text-sm text-gray-500">
              Total Records
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {attendance.length}
            </p>

          </div>


          <div className="rounded-lg border p-4">

            <p className="text-sm text-gray-500">
              Present
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {presentCount}
            </p>

          </div>


          <div className="rounded-lg border p-4">

            <p className="text-sm text-gray-500">
              Groups
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {groups.length}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

// ======================================================
// STUDENT DASHBOARD
// ======================================================

function StudentDashboard({
  currentUser,
}: {
  currentUser: any;
}) {
  const [groups, setGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] =
    useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==================================================
  // LOAD STUDENT DATA
  // ==================================================

  useEffect(() => {
    async function loadStudentDashboard() {
      try {
        setLoading(true);
        setError("");

        const [
          groupsData,
          eventsData,
          myAttendanceData,
        ] = await Promise.all([
          getGroups(),
          getEvents(),
          getMyAttendance(),
        ]);

        setGroups(
          Array.isArray(groupsData)
            ? groupsData
            : []
        );

        setEvents(
          Array.isArray(eventsData)
            ? eventsData
            : []
        );

        setAttendanceData(
          myAttendanceData || null
        );
      } catch (error: any) {
        console.error(
          "Student dashboard error:",
          error
        );

        setError(
          error?.message ||
            "Failed to load student dashboard"
        );
      } finally {
        setLoading(false);
      }
    }

    loadStudentDashboard();
  }, []);

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-semibold">
          Student Dashboard
        </h1>

        <p className="mt-4 text-gray-500">
          Loading your dashboard...
        </p>
      </div>
    );
  }

  // ==================================================
  // ERROR
  // ==================================================

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-semibold">
          Student Dashboard
        </h1>

        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-700">
            Failed to load dashboard
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>

          <button
            onClick={() =>
              window.location.reload()
            }
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ==================================================
  // ATTENDANCE DATA
  // ==================================================

  const attendanceRate =
    Number(
      attendanceData?.attendance_rate || 0
    );

  const presentCount =
    Number(
      attendanceData?.present || 0
    );

  const lateCount =
    Number(
      attendanceData?.late || 0
    );

  const absentCount =
    Number(
      attendanceData?.absent || 0
    );

  const completedEvents =
    Number(
      attendanceData?.completed_events || 0
    );

  // ==================================================
  // EVENT CLASSIFICATION
  // ==================================================

  const now = new Date();

  const activeEvents = events.filter(
    (event) => {
      if (
        !event.starts_at ||
        !event.ends_at ||
        event.is_cancelled
      ) {
        return false;
      }

      const start =
        new Date(event.starts_at);

      const end =
        new Date(event.ends_at);

      return (
        start <= now &&
        now <= end &&
        event.is_active
      );
    }
  );

  const upcomingEvents = events
    .filter((event) => {
      if (
        !event.starts_at ||
        event.is_cancelled
      ) {
        return false;
      }

      return (
        new Date(event.starts_at) > now &&
        event.is_active
      );
    })
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() -
        new Date(b.starts_at).getTime()
    );

  // ==================================================
  // RECENT ATTENDANCE
  // ==================================================

  const attendanceRecords =
    Array.isArray(
      attendanceData?.records
    )
      ? attendanceData.records
      : [];

  const recentAttendance =
    [...attendanceRecords]
      .sort(
        (a, b) =>
          new Date(
            b.starts_at || 0
          ).getTime() -
          new Date(
            a.starts_at || 0
          ).getTime()
      )
      .slice(0, 5);

  // ==================================================
  // FORMAT DATE
  // ==================================================

  function formatDate(
    value: string
  ) {
    if (!value) {
      return "--";
    }

    return new Date(
      value
    ).toLocaleDateString(
      undefined,
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  // ==================================================
  // FORMAT TIME
  // ==================================================

  function formatTime(
    value: string
  ) {
    if (!value) {
      return "--";
    }

    return new Date(
      value
    ).toLocaleTimeString(
      undefined,
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // ==================================================
  // STATUS STYLE
  // ==================================================

  function getStatusClass(
    status: string
  ) {
    switch (
      String(status).toLowerCase()
    ) {
      case "present":
        return "bg-green-100 text-green-700";

      case "late":
        return "bg-yellow-100 text-yellow-700";

      case "absent":
        return "bg-red-100 text-red-700";

      case "not marked":
        return "bg-gray-100 text-gray-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  // ==================================================
  // DASHBOARD
  // ==================================================

  return (
    <div className="p-6">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="mb-8">
        <h1 className="text-3xl font-semibold">
          Welcome back,{" "}
          {currentUser?.name || "Student"} 👋
        </h1>

        <p className="mt-1 text-gray-500">
          Here's your class and attendance overview.
        </p>
      </div>


      {/* ==================================================
          STATISTICS
      ================================================== */}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

        {/* ACTIVE EVENTS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Active Events
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {activeEvents.length}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Events happening now
          </p>
        </div>


        {/* MY GROUPS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            My Groups
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {groups.length}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Groups you're enrolled in
          </p>
        </div>


        {/* ATTENDANCE */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Attendance
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {attendanceRate.toFixed(1)}%
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Overall attendance
          </p>
        </div>


        {/* COMPLETED CLASSES */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Completed Classes
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {completedEvents}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Classes completed
          </p>
        </div>

      </div>


      {/* ==================================================
          CURRENT EVENTS
      ================================================== */}

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold">
              Current Events
            </h2>

            <p className="text-sm text-gray-500">
              Classes happening right now
            </p>
          </div>

          <a
            href="/events"
            className="text-sm font-medium underline"
          >
            View Events
          </a>

        </div>


        <div className="mt-5 space-y-3">

          {activeEvents.length === 0 ? (

            <p className="text-sm text-gray-500">
              No classes are happening right now.
            </p>

          ) : (

            activeEvents.map(
              (event) => (

                <div
                  key={event.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >

                  <div>

                    <p className="font-medium">
                      {event.title}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {formatTime(event.starts_at)}
                      {" - "}
                      {formatTime(event.ends_at)}
                    </p>

                  </div>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    Active
                  </span>

                </div>

              )
            )

          )}

        </div>

      </div>


      {/* ==================================================
          UPCOMING + ATTENDANCE OVERVIEW
      ================================================== */}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">

        {/* UPCOMING EVENTS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold">
                Upcoming Events
              </h2>

              <p className="text-sm text-gray-500">
                Your upcoming classes
              </p>
            </div>

            <a
              href="/events"
              className="text-sm font-medium underline"
            >
              View All
            </a>

          </div>


          <div className="mt-5 space-y-3">

            {upcomingEvents.length === 0 ? (

              <p className="text-sm text-gray-500">
                No upcoming events.
              </p>

            ) : (

              upcomingEvents
                .slice(0, 5)
                .map(
                  (event) => (

                    <div
                      key={event.id}
                      className="rounded-lg border p-4"
                    >

                      <p className="font-medium">
                        {event.title}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {formatDate(
                          event.starts_at
                        )}
                        {" • "}
                        {formatTime(
                          event.starts_at
                        )}
                      </p>

                    </div>

                  )
                )

            )}

          </div>

        </div>


        {/* ATTENDANCE OVERVIEW */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold">
                Attendance Overview
              </h2>

              <p className="text-sm text-gray-500">
                Your attendance summary
              </p>
            </div>

            <a
              href="/attendance"
              className="text-sm font-medium underline"
            >
              View All
            </a>

          </div>


          <div className="mt-5 grid grid-cols-3 gap-3">

            {/* PRESENT */}

            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-sm text-green-700">
                Present
              </p>

              <p className="mt-1 text-2xl font-semibold text-green-700">
                {presentCount}
              </p>
            </div>


            {/* LATE */}

            <div className="rounded-lg bg-yellow-50 p-4 text-center">
              <p className="text-sm text-yellow-700">
                Late
              </p>

              <p className="mt-1 text-2xl font-semibold text-yellow-700">
                {lateCount}
              </p>
            </div>


            {/* ABSENT */}

            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-sm text-red-700">
                Absent
              </p>

              <p className="mt-1 text-2xl font-semibold text-red-700">
                {absentCount}
              </p>
            </div>

          </div>


          {/* ATTENDANCE RATE */}

          <div className="mt-5 rounded-lg border p-4">

            <div className="flex items-center justify-between">

              <span className="text-sm text-gray-500">
                Overall Attendance
              </span>

              <span className="font-semibold">
                {attendanceRate.toFixed(1)}%
              </span>

            </div>


            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">

              <div
                className="h-full rounded-full bg-green-500"
                style={{
                  width: `${Math.min(
                    attendanceRate,
                    100
                  )}%`,
                }}
              />

            </div>

          </div>

        </div>

      </div>


      {/* ==================================================
          RECENT ATTENDANCE
      ================================================== */}

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold">
              Recent Attendance
            </h2>

            <p className="text-sm text-gray-500">
              Your latest attendance records
            </p>
          </div>

          <a
            href="/attendance"
            className="text-sm font-medium underline"
          >
            View All
          </a>

        </div>


        <div className="mt-5 space-y-3">

          {recentAttendance.length === 0 ? (

            <p className="text-sm text-gray-500">
              No attendance records found.
            </p>

          ) : (

            recentAttendance.map(
              (record, index) => (

                <div
                  key={
                    record.event_id ??
                    index
                  }
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >

                  <div>

                    <p className="font-medium">
                      {record.event_title ||
                        "Event"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(
                        record.starts_at
                      )}

                      {" • "}

                      {formatTime(
                        record.starts_at
                      )}
                    </p>

                  </div>


                  <div className="flex items-center gap-3">

                    {record.check_in && (
                      <span className="text-xs text-gray-500">
                        {formatTime(
                          record.check_in
                        )}
                      </span>
                    )}

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                        record.status
                      )}`}
                    >
                      {record.status}
                    </span>

                  </div>

                </div>

              )
            )

          )}

        </div>

      </div>


      {/* ==================================================
          QUICK LINKS
      ================================================== */}

      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">

        <h2 className="text-lg font-semibold">
          Quick Links
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Access your student information.
        </p>


        <div className="mt-5 flex flex-wrap gap-3">

          <a
            href="/groups"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            My Groups
          </a>

          <a
            href="/events"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            My Events
          </a>

          <a
            href="/attendance"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            My Attendance
          </a>

        </div>

      </div>

    </div>
  );
}