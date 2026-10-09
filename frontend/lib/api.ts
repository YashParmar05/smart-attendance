// const API_URL =
//   process.env.NEXT_PUBLIC_API_URL ||
//   "http://127.0.0.1:8000";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "/api";



async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,

      headers: {
        "Content-Type": "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),

        ...options.headers,
      },
    }
  );

  const data = await response.json();

//   if (!response.ok) {

//     if (response.status === 401) {

//       localStorage.removeItem(
//         "access_token"
//       );

//       window.location.href = "/login";
//     }

//     throw new Error(
//       data.detail || "API request failed"
//     );
//   }


    if (!response.ok) {

    console.error(
        "API ERROR:",
        response.status,
        response.url,
        data
    );

    if (response.status === 401) {

        localStorage.removeItem(
        "access_token"
        );

        window.location.href = "/login";
    }

    throw new Error(
        data.detail || "API request failed"
    );
    }

  return data;
}


export async function login(
  email: string,
  password: string
) {

  const formData =
    new URLSearchParams();

  formData.append(
    "username",
    email
  );

  formData.append(
    "password",
    password
  );

  const response = await fetch(
    `${API_URL}/auth/login`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: formData.toString(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Login failed"
    );
  }

  return data;
}

export async function getCurrentUser() {
  return apiRequest("/auth/me");
}


/* ================================
   USERS
================================ */

export async function getUsers() {
  return apiRequest("/users/");
}

export async function createUser(user: {
  name: string;
  email: string;
  student_id: string;
  password: string;
}) {
  return apiRequest("/users/", {
    method: "POST",
    body: JSON.stringify({
      organization_id: 1,
      name: user.name,
      email: user.email,
      password: user.password,
      employee_id: user.student_id,
      role: "Student",
      permissions: ["attendance_view"],
    }),
  });
}


export async function resetUserPassword(
  userId: number,
  newPassword: string
) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Authentication required");
  }

  const payload = JSON.parse(
    atob(token.split(".")[1])
  );

  const role = payload.role;

  let endpoint: string;

  if (role === "product_owner") {
    endpoint = `/product-owner/users/${userId}/reset-password`;
  } else if (role === "admin") {
    endpoint = `/admin/users/${userId}/reset-password`;
  } else {
    throw new Error(
      "You are not authorized to reset passwords"
    );
  }

  return apiRequest(endpoint, {
    method: "PATCH",
    body: JSON.stringify({
      new_password: newPassword,
    }),
  });
}



export async function updateStudent(
  userId: number,
  student: {
    name: string;
    email: string;
    employee_id: string;
  },
  image?: File | null
) {
  const formData = new FormData();

  formData.append("name", student.name);
  formData.append("email", student.email);
  formData.append("employee_id", student.employee_id);

  if (image) {
    formData.append("image", image);
  }

  const token = localStorage.getItem("access_token");

  const response = await fetch(
    `${API_URL}/users/${userId}/with-face`,
    {
      method: "PATCH",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    throw new Error(
      error.detail || "Failed to update student"
    );
  }

  return response.json();
}

export async function updateUserStatus(
  userId: number,
  isActive: boolean
) {
  return apiRequest(
    `/users/${userId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        is_active: isActive,
      }),
    }
  );
}

export async function bulkUpdateUserStatus(
  userIds: number[],
  isActive: boolean
) {
  return apiRequest(
    "/users/status/bulk",
    {
      method: "PATCH",
      body: JSON.stringify({
        user_ids: userIds,
        is_active: isActive,
      }),
    }
  );
}

export async function getStudentFacePhoto(
  userId: number
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(
          "access_token"
        )
      : null;

  const response = await fetch(
    `${API_URL}/users/${userId}/face-photo`,
    {
      method: "GET",
      headers: {
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      "Failed to load student photo"
    );
  }

  return response.blob();
}


// ------------------------------------------
// FACE REPLACEMENT AND ENROLLMENT
// ------------------------------------------
export async function replaceStudentFace(
  userId: number,
  image: File,
  studentInfo: {
    name: string;
    email: string;
    employee_id: string;
  }
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const formData = new FormData();
  formData.append("name", studentInfo.name);
  formData.append("email", studentInfo.email);
  formData.append("employee_id", studentInfo.employee_id);
  formData.append("image", image);

  const response = await fetch(
    `${API_URL}/users/${userId}/with-face`,
    {
      method: "PATCH",
      headers: {
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }

    const detail = Array.isArray(data.detail)
      ? data.detail
          .map(
            (err: any) =>
              `${err.loc?.join(".")}: ${err.msg}`
          )
          .join(", ")
      : data.detail || "Failed to replace student face";

    throw new Error(detail);
  }

  return data;
}
// ===============================
// FACE ENROLLMENT WITH STUDENT CREATION
// ===============================

export async function createStudentWithFace(
  student: {
    name: string;
    email: string;
    student_id: string;
    password: string;
  },
  image: File
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(
          "access_token"
        )
      : null;

  const formData =
    new FormData();

  formData.append(
    "name",
    student.name
  );

  formData.append(
    "email",
    student.email
  );

  formData.append(
    "student_id",
    student.student_id
  );

  formData.append(
    "password",
    student.password
  );

  formData.append(
    "image",
    image
  );

  const response =
    await fetch(
      `${API_URL}/users/enroll`,
      {
        method: "POST",

        headers: {
          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {}),
        },

        body: formData,
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "STUDENT ENROLLMENT ERROR:",
      response.status,
      response.url,
      data
    );

    if (
      response.status === 401
    ) {
      localStorage.removeItem(
        "access_token"
      );

      window.location.href =
        "/login";
    }

    const detail =
      Array.isArray(data.detail)
        ? data.detail
            .map(
              (err: any) =>
                `${err.loc?.join(".")}: ${err.msg}`
            )
            .join("\n")
        : data.detail ||
          "Student enrollment failed";

    throw new Error(detail);
  }

  return data;
}


/* ================================
   GROUPS
================================ */

export async function getGroups() {
  return apiRequest("/groups/");
}

export async function createGroup(group: {
  name: string;
  description?: string;
}) {
  return apiRequest("/groups/", {
    method: "POST",
    body: JSON.stringify(group),
  });
}

export async function getGroupMembers(
  groupId: number
) {
  return apiRequest(
    `/groups/${groupId}/members`
  );
}

export async function addGroupMembers(
  groupId: number,
  userIds: number[]
) {
  return apiRequest(
    `/groups/${groupId}/members`,
    {
      method: "POST",
      body: JSON.stringify({
        user_ids: userIds,
      }),
    }
  );
}

export async function removeGroupMember(
  groupId: number,
  userId: number
) {
  return apiRequest(
    `/groups/${groupId}/members/${userId}`,
    {
      method: "DELETE",
    }
  );
}


/* ================================
   EVENTS
================================ */

export async function getEvents() {
  return apiRequest("/events/");
}


export async function createEvent(event: {
  title: string;
  group_ids: number[];
  teacher_ids: number[];
  starts_at: string;
  ends_at?: string;
}) {
  return apiRequest("/events/", {
    method: "POST",
    body: JSON.stringify({
      title: event.title,
      group_ids: event.group_ids,
      teacher_ids: event.teacher_ids,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
    }),
  });
}


export async function updateEvent(
  eventId: number,
  event: {
    title: string;
    group_ids: number[];
    teacher_ids: number[];
    starts_at: string;
    ends_at?: string;
  }
) {
  return apiRequest(`/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: event.title,
      group_ids: event.group_ids,
      teacher_ids: event.teacher_ids,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
    }),
  });
}


export async function reactivateEvent(
  eventId: number,
  event: {
    title: string;
    group_ids: number[];
    teacher_ids: number[];
    starts_at: string;
    ends_at: string;
  }
) {
  return apiRequest(
    `/events/${eventId}/reactivate`,
    {
      method: "PATCH",
      body: JSON.stringify({
        title: event.title,
        group_ids: event.group_ids,
        teacher_ids: event.teacher_ids,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
      }),
    }
  );
}


export async function deleteEvent(
  eventId: number
) {
  return apiRequest(
    `/events/${eventId}`,
    {
      method: "DELETE",
    }
  );
}


export async function updateEventStatus(
  eventId: number,
  isActive: boolean
) {
  return apiRequest(
    `/events/${eventId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        is_active: isActive,
      }),
    }
  );
}


/* ================================
   EVENT TEACHERS
================================ */

export async function getEventTeachers(
  eventId: number
) {
  return apiRequest(
    `/events/${eventId}/teachers`
  );
}

export async function getAvailableEventTeachers() {
  return apiRequest("/events/teachers");
}




export async function addEventTeachers(
  eventId: number,
  teacherIds: number[]
) {
  return apiRequest(
    `/events/${eventId}/teachers`,
    {
      method: "POST",
      body: JSON.stringify({
        teacher_ids: teacherIds,
      }),
    }
  );
}


export async function removeEventTeacher(
  eventId: number,
  teacherId: number
) {
  return apiRequest(
    `/events/${eventId}/teachers/${teacherId}`,
    {
      method: "DELETE",
    }
  );
}



/* ================================
   ATTENDANCE
================================ */

export async function getAttendance() {
  return apiRequest("/attendance/");
}

export async function getMyAttendance() {
  return apiRequest("/attendance/me");
}


export async function getEventSummary(
  eventId: number
) {
  return apiRequest(
    `/attendance/event/${eventId}/summary`
  );
}


export async function updateGroup(
  groupId: number,
  group: {
    name: string;
    description?: string;
  }
) {
  return apiRequest(
    `/groups/${groupId}`,
    {
      method: "PATCH",
      body: JSON.stringify(group),
    }
  );
}

export async function deleteGroup(
  groupId: number
) {
  return apiRequest(
    `/groups/${groupId}`,
    {
      method: "DELETE",
    }
  );
}


export async function recognizeFace(
  eventId: number,
  image: Blob
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(
          "access_token"
        )
      : null;

  const formData = new FormData();

  formData.append(
    "image",
    image,
    "attendance.jpg"
  );

  const response = await fetch(
    `${API_URL}/face/recognize/${eventId}`,
    {
      method: "POST",

      headers: {
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
      },

      body: formData,
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
        "Face recognition failed"
    );
  }

  return data;
}


export async function confirmAttendance(
  eventId: number,
  userId: number,
  confidence: number
) {
  return apiRequest(
    `/face/confirm/${eventId}/${userId}?confidence=${confidence}`,
    {
      method: "POST",
    }
  );
}

export async function getEventAttendanceDetails(
  eventId: number
) {
  return apiRequest(
    `/attendance/event/${eventId}/students`
  );
}


/* ================================
   TEACHERS
================================ */

/**
 * Get all teachers
 */
export async function getTeachers() {
  return apiRequest("/admin/teachers");
}


/**
 * Get one teacher
 */
export async function getTeacher(
  teacherId: number
) {
  return apiRequest(
    `/admin/teachers/${teacherId}`
  );
}


/**
 * Create teacher
 */
export async function createTeacher(
  teacher: {
    name: string;
    email: string;
    password: string;
    employee_id: string;
    permissions: string[];
  }
) {
  return apiRequest(
    "/admin/teachers",
    {
      method: "POST",
      body: JSON.stringify({
        name: teacher.name,
        email: teacher.email,
        password: teacher.password,
        employee_id: teacher.employee_id,
        permissions: teacher.permissions,
      }),
    }
  );
}


/**
 * Update teacher
 */


export async function updateTeacher(
  teacherId: number,
  teacher: {
    name: string;
    email: string;
    employee_id: string;
  }
) {
  return apiRequest(
    `/admin/teachers/${teacherId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        name: teacher.name,
        email: teacher.email,
        employee_id: teacher.employee_id,
      }),
    }
  );
}


/**
 * Delete teacher
 */
export async function deleteTeacher(
  teacherId: number
) {
  return apiRequest(
    `/admin/teachers/${teacherId}`,
    {
      method: "DELETE",
    }
  );
}


/**
 * Activate / deactivate teacher
 */
export async function updateTeacherStatus(
  teacherId: number,
  isActive: boolean
) {
  return apiRequest(
    `/admin/teachers/${teacherId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        is_active: isActive,
      }),
    }
  );
}


/**
 * Update teacher permissions
 */
export async function updateTeacherPermissions(
  teacherId: number,
  permissions: string[]
) {
  return apiRequest(
    `/admin/teachers/${teacherId}/permissions`,
    {
      method: "PATCH",
      body: JSON.stringify({
        permissions,
      }),
    }
  );
}



/* ================================
   PRODUCT OWNER
================================ */


/* ================================
   PRODUCT OWNER PROFILE
================================ */

export async function getProductOwnerMe() {
  return apiRequest("/product-owner/me");
}


/* ================================
   SCHOOL MANAGEMENT
================================ */


/**
 * Get all schools
 */
export async function getSchools() {
  return apiRequest("/product-owner/schools");
}


/**
 * Get one school
 */
export async function getSchool(
  schoolId: number
) {
  return apiRequest(
    `/product-owner/schools/${schoolId}`
  );
}


/**
 * Create a new school
 */
export async function createSchool(school: {
  name: string;
  email: string;
}) {
  return apiRequest(
    "/product-owner/schools",
    {
      method: "POST",

      body: JSON.stringify({
        name: school.name,
        email: school.email,
      }),
    }
  );
}


/**
 * Update school information
 */
export async function updateSchool(
  schoolId: number,
  school: {
    name: string;
    email: string;
  }
) {
  return apiRequest(
    `/product-owner/schools/${schoolId}`,
    {
      method: "PATCH",

      body: JSON.stringify({
        name: school.name,
        email: school.email,
      }),
    }
  );
}


/**
 * Activate / deactivate school
 */
export async function updateSchoolStatus(
  schoolId: number,
  isActive: boolean
) {
  return apiRequest(
    `/product-owner/schools/${schoolId}/status`,
    {
      method: "PATCH",

      body: JSON.stringify({
        is_active: isActive,
      }),
    }
  );
}


/* ================================
   ADMIN MANAGEMENT
================================ */


/**
 * Get all administrators
 */
export async function getAdmins() {
  return apiRequest(
    "/product-owner/admins"
  );
}


/**
 * Get one administrator
 */
export async function getAdmin(
  adminId: number
) {
  return apiRequest(
    `/product-owner/admins/${adminId}`
  );
}


/**
 * Update administrator profile
 */
export async function updateAdmin(
  adminId: number,
  admin: {
    name: string;
    email: string;
    employee_id: string;
  }
) {
  return apiRequest(
    `/product-owner/admins/${adminId}`,
    {
      method: "PATCH",

      body: JSON.stringify({
        name: admin.name,
        email: admin.email,
        employee_id: admin.employee_id,
      }),
    }
  );
}


/**
 * Create administrator
 */
export async function createAdmin(admin: {
  organization_id: number;
  name: string;
  email: string;
  password: string;
  employee_id: string;
  permissions: string[];
}) {
  return apiRequest(
    "/product-owner/admins",
    {
      method: "POST",

      body: JSON.stringify({
        organization_id:
          admin.organization_id,

        name: admin.name,

        email: admin.email,

        password: admin.password,

        employee_id:
          admin.employee_id,

        permissions:
          admin.permissions,
      }),
    }
  );
}


/**
 * Assign administrator to a school
 */
export async function updateAdminSchool(
  adminId: number,
  organizationId: number
) {
  return apiRequest(
    `/product-owner/admins/${adminId}/school`,
    {
      method: "PATCH",

      body: JSON.stringify({
        organization_id:
          organizationId,
      }),
    }
  );
}


/**
 * Update administrator permissions
 */
export async function updateAdminPermissions(
  adminId: number,
  permissions: string[]
) {
  return apiRequest(
    `/product-owner/admins/${adminId}/permissions`,
    {
      method: "PATCH",

      body: JSON.stringify({
        permissions,
      }),
    }
  );
}


/**
 * Activate / deactivate administrator
 */
export async function updateAdminStatus(
  adminId: number,
  isActive: boolean
) {
  return apiRequest(
    `/product-owner/admins/${adminId}/status`,
    {
      method: "PATCH",

      body: JSON.stringify({
        is_active: isActive,
      }),
    }
  );
}


export async function changePassword(
  currentPassword: string,
  newPassword: string
) {
  return apiRequest(
    "/auth/change-password",
    {
      method: "PATCH",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }
  );
}