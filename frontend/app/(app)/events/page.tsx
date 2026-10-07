"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addGroupMembers,
  getGroupMembers,
  createEvent,
  createGroup,
  deleteEvent,
  getEvents,
  getGroups,
  getTeachers,
  getUsers,
  reactivateEvent,
  updateEvent,
  updateEventStatus,
  getAvailableEventTeachers,
} from "@/lib/api";


type Group = {
  id: number;
  name: string;
  description?: string | null;
};

type Student = {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  role: string;
};

type Teacher = {
  id: number;
  name: string;
  email?: string;
  employee_id?: string;
  role?: string;
};

type EventItem = {
  id: number;
  title: string;
  group_id?: number | null;
  group_ids: number[];
  teacher_ids: number[];
  created_by: number;
  starts_at: string;
  ends_at?: string | null;
  is_active: boolean;
  is_cancelled: boolean;
};


export default function EventsPage() {

  const [events, setEvents] =
    useState<EventItem[]>([]);

  const [groups, setGroups] =
    useState<Group[]>([]);

  const [teachers, setTeachers] =
    useState<Teacher[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [expandedEventId, setExpandedEventId] =
    useState<number | null>(null);

  const [expandedGroupId, setExpandedGroupId] =
    useState<number | null>(null);

  const [groupMembers, setGroupMembers] =
    useState<Record<number, Student[]>>({});

  const [loadingGroupId, setLoadingGroupId] =
    useState<number | null>(null);

  const [showUpcomingEvents, setShowUpcomingEvents] =
    useState(true);

  const [showPastEvents, setShowPastEvents] =
    useState(false);

  const [showCreateModalMobile, setShowCreateModalMobile] =
    useState(false);

  type EventSortOption =
    | "newest"
    | "oldest"
    | "start_asc"
    | "start_desc"
    | "name_asc"
    | "name_desc";

  const [eventSort, setEventSort] =
    useState<EventSortOption>("newest");


  // ==========================================================
  // EVENT FORM
  // ==========================================================

  const [title, setTitle] =
    useState("");

  const [selectedGroupIds, setSelectedGroupIds] =
    useState<number[]>([]);

  const [selectedTeacherIds, setSelectedTeacherIds] =
    useState<number[]>([]);

  const [startsAt, setStartsAt] =
    useState("");

  const [endsAt, setEndsAt] =
    useState("");


  // ==========================================================
  // INLINE GROUP FORM
  // ==========================================================

  const [showCreateGroup, setShowCreateGroup] =
    useState(false);

  const [newGroupName, setNewGroupName] =
    useState("");

  const [newGroupDescription, setNewGroupDescription] =
    useState("");

  const [selectedStudents, setSelectedStudents] =
    useState<number[]>([]);

  const [studentSearch, setStudentSearch] =
    useState("");


  // ==========================================================
  // UI STATE
  // ==========================================================

  const [loading, setLoading] =
    useState(true);

  const [creatingEvent, setCreatingEvent] =
    useState(false);

  const [creatingGroup, setCreatingGroup] =
    useState(false);

  const [error, setError] =
    useState("");
  
  const [editError, setEditError] = 
    useState("");

  const [success, setSuccess] =
    useState("");


  // ==========================================================
  // DATETIME HELPER: TODAY / NOW & CLEAR
  // ==========================================================
  function setToCurrentDateTime(setter: (val: string) => void) {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setter(localISOTime);
  }


  // ==========================================================
  // AUTO-DISMISS FLASH MESSAGES (EFFECT)
  // ==========================================================
  useEffect(() => {
    if (success || error || editError) {
      const timer = setTimeout(() => {
        setSuccess("");
        setError("");
        setEditError("");
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [success, error, editError]);


  // ==========================================================
  // EVENT MANAGEMENT STATE
  // ==========================================================

  const [currentUserId, setCurrentUserId] =
    useState<number | null>(null);

  const [currentUserRole, setCurrentUserRole] =
    useState("");

  const [editingEventId, setEditingEventId] =
    useState<number | null>(null);

  const [editingTitle, setEditingTitle] =
    useState("");

  const [editingGroupIds, setEditingGroupIds] =
    useState<number[]>([]);

  const [editingTeacherIds, setEditingTeacherIds] =
    useState<number[]>([]);

  const [editingStartsAt, setEditingStartsAt] =
    useState("");

  const [editingEndsAt, setEditingEndsAt] =
    useState("");

  const [savingEvent, setSavingEvent] =
    useState(false);
  
  const [managingEventId, setManagingEventId] =
    useState<number | null>(null);


  // ==========================================================
  // READ CURRENT USER FROM JWT
  // ==========================================================

  useEffect(() => {
    try {
      const token =
        localStorage.getItem("access_token");

      if (!token) {
        return;
      }

      const parts = token.split(".");

      if (parts.length !== 3) {
        return;
      }

      const payload = JSON.parse(
        atob(
          parts[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/")
        )
      );

      const userId = payload.sub ? Number(payload.sub) : null;
      const role = String(payload.role || "").toLowerCase();

      setCurrentUserId(userId);
      setCurrentUserRole(role);

      // Automatically pre-select teacher if user is a teacher
      if (role === "teacher" && userId !== null) {
        setSelectedTeacherIds((current) =>
          current.includes(userId) ? current : [...current, userId]
        );
      }
    } catch {
      setCurrentUserId(null);
      setCurrentUserRole("");
    }
  }, []);


  // ==========================================================
  // LOAD EVENTS, GROUPS AND STUDENTS
  // ==========================================================

  useEffect(() => {

    async function loadData() {

      try {

        setLoading(true);
        setError("");

        let eventsData;
        let groupsData;

        if (currentUserRole === "student") {
          [eventsData, groupsData] = await Promise.all([
            getEvents(),
            getGroups(),
          ]);

          setTeachers([]);
          setStudents([]);
        } else {
          let teachersData;
          let usersData;

          [eventsData, groupsData, teachersData, usersData] =
            await Promise.all([
              getEvents(),
              getGroups(),
              getAvailableEventTeachers(),
              getUsers(),
            ]);

          setTeachers(teachersData);
          setStudents(
            usersData.filter(
              (user: Student) => user.role === "Student"
            )
          );
        }

        setEvents(eventsData);
        setGroups(groupsData);

      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load event data."
        );

      } finally {

        setLoading(false);
      }
    }

    if (!currentUserRole) {
      return;
    }

    loadData();

  }, [currentUserRole]);


  // ==========================================================
  // FILTER STUDENTS IN INLINE GROUP FORM
  // ==========================================================

  const filteredStudents = useMemo(() => {

    const search =
      studentSearch.trim().toLowerCase();

    if (!search) {
      return students;
    }

    return students.filter(
      (student) =>
        student.name
          .toLowerCase()
          .includes(search)
        ||
        student.employee_id
          .toLowerCase()
          .includes(search)
        ||
        student.email
          .toLowerCase()
          .includes(search)
    );

  }, [students, studentSearch]);


  // ==========================================================
  // TOGGLE STUDENT
  // ==========================================================

  function toggleStudent(studentId: number) {

    setSelectedStudents((current) => {

      if (current.includes(studentId)) {

        return current.filter(
          (id) => id !== studentId
        );
      }

      return [
        ...current,
        studentId,
      ];
    });
  }


  // ==========================================================
  // SELECT / UNSELECT ALL VISIBLE STUDENTS
  // ==========================================================

  function toggleAllVisibleStudents() {

    const visibleIds =
      filteredStudents.map(
        (student) => student.id
      );

    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every(
        (id) =>
          selectedStudents.includes(id)
      );

    if (allSelected) {

      setSelectedStudents((current) =>
        current.filter(
          (id) =>
            !visibleIds.includes(id)
        )
      );

    } else {

      setSelectedStudents((current) =>
        Array.from(
          new Set([
            ...current,
            ...visibleIds,
          ])
        )
      );
    }
  }


  // ==========================================================
  // CREATE GROUP + ADD STUDENTS
  // ==========================================================

  async function handleCreateGroupInline() {

    const name =
      newGroupName.trim();

    if (!name) {
      setError("Group name is required.");
      return;
    }

    try {

      setCreatingGroup(true);
      setError("");
      setSuccess("");

      const newGroup =
        await createGroup({
          name,
          description:
            newGroupDescription.trim()
              || undefined,
        });

      if (selectedStudents.length > 0) {

        await addGroupMembers(
          newGroup.id,
          selectedStudents
        );
      }

      setGroups((currentGroups) => [
        ...currentGroups,
        newGroup,
      ]);

      setSelectedGroupIds((current) =>
        current.includes(newGroup.id)
          ? current
          : [...current, newGroup.id]
      );

      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedStudents([]);
      setStudentSearch("");
      setShowCreateGroup(false);

      setSuccess(
        selectedStudents.length > 0
          ? "Group created and students added successfully."
          : "Group created successfully."
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group.");
    } finally {

      setCreatingGroup(false);
    }
  }



  // ==========================================================
  // GROUP MEMBER LIST
  // ==========================================================

  async function toggleGroupMembers(
    eventId: number,
    groupId: number
  ) {
    if (
      expandedEventId === eventId &&
      expandedGroupId === groupId
    ) {
      setExpandedEventId(null);
      setExpandedGroupId(null);
      return;
    }

    setExpandedEventId(eventId);
    setExpandedGroupId(groupId);

    if (groupMembers[groupId]) {
      return;
    }

    try {
      setLoadingGroupId(groupId);

      const members = await getGroupMembers(groupId);

      setGroupMembers((current) => ({
        ...current,
        [groupId]: members,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load group members."
      );
    } finally {
      setLoadingGroupId(null);
    }
  }

  // ==========================================================
  // START EDITING EVENT
  // ==========================================================

  function startEditingEvent(event: EventItem) {
    setEditingEventId(event.id);
    setEditingTitle(event.title);
    setEditError("");
    setEditingGroupIds(
      Array.isArray(event.group_ids)
        ? event.group_ids
        : event.group_id != null
        ? [event.group_id]
        : []
    );

    // Ensure the logged-in teacher is always included in editing teacher IDs if role is teacher
    let initialTeachers = Array.isArray(event.teacher_ids) ? [...event.teacher_ids] : [];
    if (currentUserRole === "teacher" && currentUserId !== null && !initialTeachers.includes(currentUserId)) {
      initialTeachers.push(currentUserId);
    }
    setEditingTeacherIds(initialTeachers);

    setEditingStartsAt(
      event.starts_at
        ? event.starts_at.slice(0, 16)
        : ""
    );
    setEditingEndsAt(
      event.ends_at
        ? event.ends_at.slice(0, 16)
        : ""
    );
    setError("");
    setSuccess("");
  }

  function cancelEditingEvent() {
    setEditingEventId(null);
    setEditingTitle("");
    setEditingGroupIds([]);
    setEditingTeacherIds([]);
    setEditingStartsAt("");
    setEditingEndsAt("");
    setEditError("");
  }


  async function handleSaveEvent(eventId: number) {
    setError("");
    setEditError("");
    setSuccess("");

    if (!editingTitle.trim()) {
      setEditError("Event title is required.");
      return;
    }

    if (editingGroupIds.length === 0) {
      setEditError("Please select at least one group.");
      return;
    }

    if (currentUserRole === "teacher" && editingTeacherIds.length === 0) {
      setEditError("Please select at least one teacher.");
      return;
    }

    if (!editingStartsAt) {
      setEditError("Start date and time are required.");
      return;
    }

    if (editingEndsAt) {
      const endDate = new Date(editingEndsAt);
      const startDate = new Date(editingStartsAt);
      const now = new Date();

      if (endDate <= startDate) {
        setEditError("End time must be after start time.");
        return;
      }

      if (startDate <= now && endDate <= now) {
        setEditError("For a running event, the end time must be set to a future time.");
        return;
      }
    }

    const finalEditingTeacherIds = currentUserRole === "teacher" && currentUserId !== null && !editingTeacherIds.includes(currentUserId)
      ? [...editingTeacherIds, currentUserId]
      : editingTeacherIds;

    try {
      setSavingEvent(true);

      const updatedEvent = await updateEvent(eventId, {
        title: editingTitle.trim(),
        group_ids: editingGroupIds,
        teacher_ids: finalEditingTeacherIds,
        starts_at: editingStartsAt,
        ends_at: editingEndsAt || undefined,
      });

      // The backend may create a new event ID when this edit starts a
      // new attendance cycle. Reload the full event list so the original
      // historical event and the new occurrence are both visible.
      const refreshedEvents = await getEvents();
      setEvents(refreshedEvents);

      const createdNewOccurrence = updatedEvent.id !== eventId;

      cancelEditingEvent();

      setSuccess(
        createdNewOccurrence
          ? "New event occurrence created. Previous attendance history was preserved."
          : "Event updated successfully."
      );
    } catch (error) {
      console.error("Failed to save event:", error);

      setEditError(
        error instanceof Error
          ? error.message
          : "Failed to save event."
      );
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeactivateEvent(
    event: EventItem
  ) {
    setError("");
    setSuccess("");

    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${event.title}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setManagingEventId(event.id);

      const updatedEvent =
        await updateEventStatus(
          event.id,
          false
        );

      setEvents((currentEvents) =>
        currentEvents.map((item) =>
          item.id === event.id
            ? updatedEvent
            : item
        )
      );

      setSuccess(
        "Event deactivated successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to deactivate event."
      );
    } finally {
      setManagingEventId(null);
    }
  }

  async function handleReactivateEvent(
    eventId: number
  ) {
    setError("");
    setEditError("");
    setSuccess("");

    if (!editingTitle.trim()) {
      setEditError(
        "Event title is required."
      );
      return;
    }

    if (editingGroupIds.length === 0) {
      setEditError(
        "Please select at least one group."
      );
      return;
    }

    if (currentUserRole === "teacher" && editingTeacherIds.length === 0) {
      setEditError(
        "Please select at least one teacher."
      );
      return;
    }

    if (!editingStartsAt) {
      setEditError(
        "Start date and time are required."
      );
      return;
    }

    if (!editingEndsAt) {
      setEditError(
        "End date and time are required when reactivating an event."
      );
      return;
    }

    if (
      new Date(editingEndsAt) <=
      new Date(editingStartsAt)
    ) {
      setEditError(
        "End time must be after start time."
      );
      return;
    }

    if (
      new Date(editingEndsAt) <=
      new Date()
    ) {
      setEditError(
        "The new event time must be in the future."
      );
      return;
    }

    const finalReactivateTeacherIds = currentUserRole === "teacher" && currentUserId !== null && !editingTeacherIds.includes(currentUserId)
      ? [...editingTeacherIds, currentUserId]
      : editingTeacherIds;

    try {
      setSavingEvent(true);

      const updatedEvent =
        await reactivateEvent(
          eventId,
          {
            title: editingTitle.trim(),
            group_ids: editingGroupIds,
            teacher_ids: finalReactivateTeacherIds,
            starts_at: editingStartsAt,
            ends_at: editingEndsAt,
          }
        );

      // Reactivation can create a new event ID when the old event already
      // has attendance history. Reload all events so both the historical
      // occurrence and the new attendance cycle remain visible.
      const refreshedEvents = await getEvents();
      setEvents(refreshedEvents);

      const createdNewOccurrence = updatedEvent.id !== eventId;

      cancelEditingEvent();

      setSuccess(
        createdNewOccurrence
          ? "New event occurrence created. Previous attendance history was preserved."
          : "Event reactivated successfully."
      );
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : "Failed to reactivate event."
      );
    } finally {
      setSavingEvent(false);
    }
  }  

  async function handleDeleteEvent(event: EventItem) {
    const confirmed = window.confirm(
      `Finish "${event.title}"? The event will remain in history but become inactive.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      setManagingEventId(event.id);
      const updatedEvent = await deleteEvent(event.id);
      setEvents((currentEvents) =>
        currentEvents.map((item) =>
          item.id === event.id ? updatedEvent : item
        )
      );
      setSuccess("Event finished successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish event.");
    } finally {
      setManagingEventId(null);
    }
  }


  // ==========================================================
  // CREATE EVENT
  // ==========================================================

  async function handleCreateEvent(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setError("");
    setSuccess("");


    if (!title.trim()) {
      setError("Event title is required.");
      return;
    }


    if (selectedGroupIds.length === 0) {
      setError("Please select at least one group.");
      return;
    }

    if (currentUserRole === "teacher" && selectedTeacherIds.length === 0) {
      setError("Please select at least one teacher.");
      return;
    }


    if (!startsAt) {
      setError("Start date and time are required.");
      return;
    }


    if (
      endsAt &&
      new Date(endsAt) <=
        new Date(startsAt)
    ) {
      setError("End time must be after start time.");
      return;
    }

    const finalTeacherIds = currentUserRole === "teacher" && currentUserId !== null && !selectedTeacherIds.includes(currentUserId)
      ? [...selectedTeacherIds, currentUserId]
      : selectedTeacherIds;

    try {

      setCreatingEvent(true);

      const newEvent =
        await createEvent({
          title: title.trim(),
          group_ids: selectedGroupIds,
          teacher_ids: finalTeacherIds,
          starts_at: startsAt,
          ends_at:
            endsAt || undefined,
        });


      setEvents((currentEvents) => [
        newEvent,
        ...currentEvents,
      ]);


      setTitle("");
      setSelectedGroupIds([]);
      setSelectedTeacherIds(
        currentUserRole === "teacher" && currentUserId !== null ? [currentUserId] : []
      );
      setStartsAt("");
      setEndsAt("");

      setSuccess(
        "Event created successfully."
      );
      
      setShowCreateModalMobile(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");

    } finally {

      setCreatingEvent(false);
    }
  }


  function sortEvents(items: EventItem[]) {
    return [...items].sort((a, b) => {
      switch (eventSort) {
        case "oldest":
        case "start_asc":
          return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
        case "start_desc":
        case "newest":
          return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
        case "name_asc":
          return a.title.localeCompare(b.title);
        case "name_desc":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
  }

  const now = new Date();

  const upcomingEvents = sortEvents(
    events.filter((event) => {
      const startsAt = new Date(event.starts_at);
      return event.is_active && !event.is_cancelled && startsAt > now;
    })
  );

  const currentEvents = sortEvents(
    events.filter((event) => {
      const startsAt = new Date(event.starts_at);
      const endsAt = event.ends_at ? new Date(event.ends_at) : null;
      return (
        event.is_active &&
        !event.is_cancelled &&
        startsAt <= now &&
        endsAt !== null &&
        endsAt > now
      );
    })
  );

  const pastEvents = sortEvents(
    events.filter((event) => {
      const endsAt = event.ends_at ? new Date(event.ends_at) : null;
      return (
        event.is_cancelled ||
        !event.is_active ||
        (endsAt !== null && endsAt <= now)
      );
    })
  );

  const renderEvent = (event: EventItem) => {

    const eventGroupIds =
      Array.isArray(event.group_ids)
        ? event.group_ids
        : event.group_id != null
        ? [event.group_id]
        : [];

    const eventGroups = groups.filter((item) =>
      eventGroupIds.includes(item.id)
    );

    const eventTeachers = teachers.filter((teacher) =>
      event.teacher_ids?.includes(teacher.id)
    );

    const startsAt = new Date(event.starts_at);
    const endsAt = event.ends_at ? new Date(event.ends_at) : null;

    const isUpcoming =
      event.is_active &&
      !event.is_cancelled &&
      startsAt > new Date();

    const isCurrent =
      event.is_active &&
      !event.is_cancelled &&
      startsAt <= new Date() &&
      endsAt !== null &&
      endsAt > new Date();

    const isExpired =
      endsAt !== null &&
      endsAt <= new Date();

    const effectiveActive = isCurrent;

    const canManageEvent =
      currentUserRole === "admin" ||
      (
        currentUserRole === "teacher" &&
        currentUserId !== null &&
        event.created_by === currentUserId
      );

    const isEditing = editingEventId === event.id;
    const isManaging = managingEventId === event.id;

    return (

      <div
        key={event.id}
        className="rounded-lg border border-gray-200 p-4"
      >

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-gray-900">
              {event.title}
            </h3>
            <div className="mt-2 space-y-2">
              <div>
                <span className="text-sm text-gray-500">Groups: </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {eventGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleGroupMembers(event.id, group.id)}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-500">Teachers: </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {eventTeachers.length > 0 ? eventTeachers.map((teacher) => (
                    <span key={teacher.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {teacher.name}
                    </span>
                  )) : (
                    <span className="text-xs text-gray-400">No teachers assigned</span>
                  )}
                </div>
              </div>
            </div>

            {expandedEventId === event.id &&
              expandedGroupId !== null && (
                <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <div className="border-b border-gray-200 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Group Members
                    </p>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    {loadingGroupId === expandedGroupId ? (
                      <p className="px-3 py-4 text-center text-sm text-gray-500">
                        Loading members...
                      </p>
                    ) : (groupMembers[expandedGroupId] || []).length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-gray-500">
                        No active students in this group.
                      </p>
                    ) : (
                      (groupMembers[expandedGroupId] || []).map(
                        (member, index) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-800">
                                {index + 1}. {member.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {member.employee_id}
                              </p>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              )}
          </div>

          <span
            className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
              isUpcoming
                ? "bg-blue-100 text-blue-700"
                : isCurrent
                ? "bg-green-100 text-green-700"
                : isExpired
                ? "bg-orange-100 text-orange-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isUpcoming ? "Upcoming" : isCurrent ? "Active" : isExpired ? "Expired" : "Inactive"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-400">Starts</p>
            <p className="mt-1 text-gray-700">
              {new Date(event.starts_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Ends</p>
            <p className="mt-1 text-gray-700">
              {event.ends_at
                ? new Date(event.ends_at).toLocaleString()
                : "No end time"}
            </p>
          </div>
        </div>

        {isEditing && canManageEvent && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">
              Edit Event
            </h4>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Event Title
                </label>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(inputEvent) => {
                    setEditingTitle(inputEvent.target.value);
                    setEditError("");
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Groups
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 bg-white">
                  {groups.map((item) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={editingGroupIds.includes(item.id)}
                        onChange={() => {
                          setEditingGroupIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id]
                          );
                          setEditError("");
                        }}
                      />
                      <span className="text-sm text-gray-800">{item.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Teachers
                </label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white">
                  {teachers.map((teacher) => {
                    const isSelfTeacher = currentUserRole === "teacher" && teacher.id === currentUserId;

                    return (
                      <label 
                        key={teacher.id} 
                        className={`flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 ${
                          isSelfTeacher ? "bg-gray-50 opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isSelfTeacher}
                          checked={isSelfTeacher || editingTeacherIds.includes(teacher.id)}
                          onChange={() => {
                            if (isSelfTeacher) return;
                            setEditingTeacherIds((current) =>
                              current.includes(teacher.id)
                                ? current.filter((id) => id !== teacher.id)
                                : [...current, teacher.id]
                            );
                            setEditError("");
                          }}
                          className={isSelfTeacher ? "cursor-not-allowed accent-gray-400" : ""}
                        />
                        <span className="text-sm text-gray-800">
                          {teacher.name} {isSelfTeacher && <span className="text-xs text-gray-500 font-medium">(You - Auto-assigned)</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">
                      Start Date & Time
                    </label>
                    <div className="flex gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setToCurrentDateTime(setEditingStartsAt)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Today/Now
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setEditingStartsAt("")}
                        className="text-gray-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    value={editingStartsAt}
                    onChange={(inputEvent) =>{
                      setEditingStartsAt(inputEvent.target.value);
                      setEditError("");
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">
                      End Date & Time
                    </label>
                    <div className="flex gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setToCurrentDateTime(setEditingEndsAt)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Today/Now
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setEditingEndsAt("")}
                        className="text-gray-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    value={editingEndsAt}
                    onChange={(inputEvent) =>{
                      setEditingEndsAt(inputEvent.target.value);
                      setEditError("");
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelEditingEvent}
                  disabled={savingEvent}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    event.is_active
                      ? handleSaveEvent(event.id)
                      : handleReactivateEvent(event.id)
                  }
                  disabled={savingEvent}
                  className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEvent
                    ? "Saving..."
                    : event.is_active
                    ? "Save Changes"
                    : "Save & Reactivate"}
                </button>
              </div>
            </div>
          </div>
        )}


        {canManageEvent && !isEditing && (
          <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap">

            {event.is_cancelled ? (

              <div className="w-full rounded-lg bg-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-500">
                  This event has been finished.
                </p>
              </div>

            ) : isExpired ? (

              <button
                type="button"
                onClick={() => startEditingEvent(event)}
                disabled={isManaging}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reactivate / Edit
              </button>

            ) : effectiveActive ? (

              <>
                <button
                  type="button"
                  onClick={() => startEditingEvent(event)}
                  disabled={isManaging}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDeactivateEvent(event)}
                  disabled={isManaging}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isManaging ? "Deactivating..." : "Deactivate"}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteEvent(event)}
                  disabled={isManaging}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isManaging ? "Finishing..." : "Finish Event"}
                </button>
              </>

            ) : (

              <>
                <button
                  type="button"
                  onClick={() => startEditingEvent(event)}
                  disabled={isManaging}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reactivate / Edit
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteEvent(event)}
                  disabled={isManaging}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isManaging ? "Finishing..." : "Finish Event"}
                </button>
              </>
            )}

          </div>
        )}

      </div>

    );

  };

  // Reusable form builder function with Today/Now & Clear controls on datetime fields
  const renderCreateEventForm = () => (
    <form
      onSubmit={handleCreateEvent}
      className="mt-6 space-y-5"
    >
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Event Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setError("");
          }}
          placeholder="e.g. Monday Lecture"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Group
        </label>
        <div className="flex flex-col gap-2">
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white">
            {groups.map((group) => (
              <label key={group.id} className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => {
                    setSelectedGroupIds((current) =>
                      current.includes(group.id)
                        ? current.filter((id) => id !== group.id)
                        : [...current, group.id]
                    );
                    setError("");
                  }}
                />
                <span className="text-sm text-gray-800">{group.name}</span>
              </label>
            ))}
          </div>

          <p className="text-xs text-gray-500">
            {selectedGroupIds.length} group{selectedGroupIds.length === 1 ? "" : "s"} selected
          </p>

          <button
            type="button"
            onClick={() => {
              setShowCreateGroup(
                (current) => !current
              );
              setError("");
              setSuccess("");
            }}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showCreateGroup
              ? "Cancel"
              : "+ Create Group"}
          </button>
        </div>

        {showCreateGroup && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Create New Group
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Create the group and optionally add students
              before creating the event.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-gray-700">
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(event) => {
                  setNewGroupName(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Computer Science A"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
              />
            </div>

            <div className="mt-3">
              <label className="mb-2 block text-xs font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={newGroupDescription}
                onChange={(event) =>
                  setNewGroupDescription(
                    event.target.value
                  )
                }
                placeholder="Optional description"
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
              />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-gray-700">
                  Add Students
                </label>
                <span className="text-xs text-gray-500">
                  {selectedStudents.length} selected
                </span>
              </div>

              <input
                type="text"
                value={studentSearch}
                onChange={(event) =>
                  setStudentSearch(
                    event.target.value
                  )
                }
                placeholder="Search by name, ID or email"
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500"
              />

              <button
                type="button"
                onClick={toggleAllVisibleStudents}
                disabled={
                  filteredStudents.length === 0
                }
                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                Select / Unselect visible students
              </button>

              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {filteredStudents.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-gray-500">
                    No students found.
                  </div>
                ) : (
                  filteredStudents.map(
                    (student) => (
                      <label
                        key={student.id}
                        className="flex cursor-pointer items-start gap-3 border-b border-gray-100 px-3 py-3 last:border-b-0 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(
                            student.id
                          )}
                          onChange={() =>
                            toggleStudent(
                              student.id
                            )
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {student.name}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {student.employee_id}
                            {" · "}
                            {student.email}
                          </p>
                        </div>
                      </label>
                    )
                  )
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateGroupInline}
              disabled={creatingGroup}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingGroup
                ? "Creating Group..."
                : selectedStudents.length > 0
                ? "Create Group & Add Students"
                : "Create Group"}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Teachers
        </label>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white">
          {teachers.map((teacher) => {
            const isSelfTeacher = currentUserRole === "teacher" && teacher.id === currentUserId;

            return (
              <label 
                key={teacher.id} 
                className={`flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 ${
                  isSelfTeacher ? "bg-gray-50 opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={isSelfTeacher}
                  checked={isSelfTeacher || selectedTeacherIds.includes(teacher.id)}
                  onChange={() => {
                    if (isSelfTeacher) return;
                    setSelectedTeacherIds((current) =>
                      current.includes(teacher.id)
                        ? current.filter((id) => id !== teacher.id)
                        : [...current, teacher.id]
                    );
                    setError("");
                  }}
                  className={isSelfTeacher ? "cursor-not-allowed accent-gray-400" : ""}
                />
                <span className="text-sm text-gray-800">
                  {teacher.name} {isSelfTeacher && <span className="text-xs text-gray-500 font-medium">(You - Auto-assigned)</span>}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {currentUserRole === "teacher" 
            ? `You are automatically included as a teacher (${selectedTeacherIds.length} selected total)`
            : `${selectedTeacherIds.length} teacher${selectedTeacherIds.length === 1 ? "" : "s"} selected`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Start Date & Time
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setToCurrentDateTime(setStartsAt)}
                className="text-blue-600 hover:underline font-medium"
              >
                Today/Now
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setStartsAt("")}
                className="text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => {
              setStartsAt(event.target.value);
              setError("");
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              End Date & Time
            </label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setToCurrentDateTime(setEndsAt)}
                className="text-blue-600 hover:underline font-medium"
              >
                Today/Now
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setEndsAt("")}
                className="text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => {
              setEndsAt(event.target.value);
              setError("");
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={
            creatingEvent ||
            loading ||
            creatingGroup
          }
          className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creatingEvent
            ? "Creating Event..."
            : "Create Event"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen w-full overflow-y-auto p-4 sm:p-6 lg:p-8 relative">

      {/* FLOATING TOP TOAST FOR GENERAL/DEACTIVATE/EDIT/CREATE ACTIONS */}
      {(success || error || editError) && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 pointer-events-none transition-all duration-300">
          {success && (
            <div className="pointer-events-auto rounded-xl border border-green-200 bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-xl flex items-center justify-between">
              <span>{success}</span>
              <button onClick={() => setSuccess("")} className="ml-3 text-green-100 hover:text-white font-bold">✕</button>
            </div>
          )}
          {(error || editError) && (
            <div className="pointer-events-auto rounded-xl border border-red-200 bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-xl flex items-center justify-between">
              <span>{error || editError}</span>
              <button onClick={() => { setError(""); setEditError(""); }} className="ml-3 text-red-100 hover:text-white font-bold">✕</button>
            </div>
          )}
        </div>
      )}

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Events
            </h1>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              {currentUserRole === "student"
                ? "View your upcoming, current and past events."
                : "Create and manage attendance events for your groups."}
            </p>
          </div>

          {currentUserRole !== "student" && (
          <div className="block lg:hidden">
            <button
              type="button"
              onClick={() => {
                setShowCreateModalMobile(true);
                setError("");
                setEditError("");
              }}
              className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
            >
              + Create Event
            </button>
          </div>
          )}
        </div>


        {/* Mobile Full Form Modal Overlay */}
        {currentUserRole !== "student" && showCreateModalMobile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 lg:hidden">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl sm:p-6">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Create Event
                  </h2>
                  <p className="text-xs text-gray-500">
                    Create an attendance session for a group.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModalMobile(false);
                    setError("");
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {renderCreateEventForm()}
            </div>
          </div>
        )}


        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* CREATE EVENT (Desktop Sidebar) */}
          {currentUserRole !== "student" && (
          <section className="hidden h-fit rounded-xl bg-white p-5 shadow-sm sm:p-6 lg:col-span-1 lg:block">

            <h2 className="text-lg font-semibold text-gray-900">
              Create Event
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Create an attendance session for a group.
            </p>

            {renderCreateEventForm()}

          </section>
          )}


          {/* EVENT LIST */}
          <section className={`rounded-xl bg-white p-5 shadow-sm sm:p-6 ${currentUserRole === "student" ? "lg:col-span-3" : "lg:col-span-2"}`}>

            <div className="flex items-center justify-between gap-4">

              <div>

                <h2 className="text-lg font-semibold text-gray-900">
                  Events
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {events.length} event
                  {events.length === 1
                    ? ""
                    : "s"}
                </p>

              </div>

            </div>


            {loading ? (

              <div className="py-12 text-center text-sm text-gray-500">
                Loading events...
              </div>

            ) : events.length === 0 ? (

              <div className="mt-6 rounded-lg border border-dashed border-gray-300 py-12 text-center">

                <p className="text-sm font-medium text-gray-700">
                  No events yet
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Create your first attendance event.
                </p>

              </div>

            ) : (

              <>
                <div className="mt-6 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Event Overview</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {upcomingEvents.length} upcoming · {currentEvents.length} current · {pastEvents.length} past / expired
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Sort</span>
                    <select
                      value={eventSort}
                      onChange={(inputEvent) =>
                        setEventSort(inputEvent.target.value as EventSortOption)
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="start_asc">Start Time ↑</option>
                      <option value="start_desc">Start Time ↓</option>
                      <option value="name_asc">Event Name A–Z</option>
                      <option value="name_desc">Event Name Z–A</option>
                    </select>
                  </label>
                </div>

                {/* UPCOMING: COLLAPSIBLE */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUpcomingEvents((current) => !current)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        {showUpcomingEvents ? "▾" : "▸"} Upcoming Events
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {upcomingEvents.length} event{upcomingEvents.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      {showUpcomingEvents ? "Hide" : "Show"}
                    </span>
                  </button>

                  {showUpcomingEvents && (
                    <div className="mt-4 grid grid-cols-1 gap-4">
                      {upcomingEvents.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 py-6 text-center">
                          <p className="text-sm text-gray-500">No upcoming events.</p>
                        </div>
                      ) : (
                        upcomingEvents.map(renderEvent)
                      )}
                    </div>
                  )}
                </div>

                {/* CURRENT: ALWAYS OPEN */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Current Events</span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {currentEvents.length} event{currentEvents.length === 1 ? "" : "s"} · Currently active
                      </span>
                    </span>
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4">
                    {currentEvents.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 py-6 text-center">
                        <p className="text-sm text-gray-500">No current events.</p>
                      </div>
                    ) : (
                      currentEvents.map(renderEvent)
                    )}
                  </div>
                </div>

                {/* PAST / EXPIRED / INACTIVE: COLLAPSIBLE */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPastEvents((current) => !current)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        {showPastEvents ? "▾" : "▸"} Past / Expired Events
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        {pastEvents.length} event{pastEvents.length === 1 ? "" : "s"} · Expired / Inactive
                      </span>
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      {showPastEvents ? "Hide" : "Show"}
                    </span>
                  </button>

                  {showPastEvents && (
                    <div className="mt-4 grid grid-cols-1 gap-4">
                      {pastEvents.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 py-6 text-center">
                          <p className="text-sm text-gray-500">No past or expired events.</p>
                        </div>
                      ) : (
                        pastEvents.map(renderEvent)
                      )}
                    </div>
                  )}
                </div>
              </>

            )}

          </section>

        </div>

      </div>

    </div>
  );
}