"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import ExcelJS from "exceljs";

import {
  getEvents,
  getGroups,
  getGroupMembers,
  recognizeFace,
  confirmAttendance,
  getEventAttendanceDetails,
  getMyAttendance,
} from "@/lib/api";

type Event = {
  id: number;
  organization_id: number;
  group_id: number;
  group_ids?: number[];
  title: string;
  created_by: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  is_cancelled: boolean;
};

type Group = {
  id: number;
  name: string;
};

type AttendanceStudent = {
  user_id: number;
  name: string;
  employee_id: string;
  status: string | null;
  check_in: string | null;
  confidence: number | null;
};

type EventAttendanceDetails = {
  event_id: number;
  event_title: string;
  group_id: number;

  total_students: number;
  marked_students: number;
  not_marked: number;

  present: number;
  late: number;
  absent: number;

  students: AttendanceStudent[];
};

type StudentAttendanceRecord = {
  event_id: number;
  event_title: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  is_cancelled: boolean;
  status: "Present" | "Late" | "Absent" | "Not Marked";
  check_in: string | null;
};

type StudentAttendanceSummary = {
  total_events: number;
  completed_events: number;
  present: number;
  late: number;
  absent: number;
  attendance_rate: number;
  records: StudentAttendanceRecord[];
};

export default function AttendancePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUserRole, setCurrentUserRole] = useState("");
  const [studentAttendance, setStudentAttendance] =
    useState<StudentAttendanceSummary | null>(null);
  const [studentAttendanceSort, setStudentAttendanceSort] =
    useState<"newest" | "oldest" | "name_asc" | "name_desc" | "present" | "late" | "absent">("newest");
  const [studentAttendanceStatus, setStudentAttendanceStatus] =
    useState<"all" | "Present" | "Late" | "Absent" | "Not Marked">("all");
  const [studentAttendanceSearch, setStudentAttendanceSearch] = useState("");

  const [selectedEvent, setSelectedEvent] =
    useState<Event | null>(null);

  const [expandedEventId, setExpandedEventId] =
    useState<number | null>(null);

  const [expandedGroupId, setExpandedGroupId] =
    useState<number | null>(null);

  const [groupMembers, setGroupMembers] =
    useState<Record<number, AttendanceStudent[]>>({});

  const [loadingGroupId, setLoadingGroupId] =
    useState<number | null>(null);

  const [showPreviousEvents, setShowPreviousEvents] =
    useState(false);

  const [showUpcomingEvents, setShowUpcomingEvents] =
    useState(false);

  type EventSortOption =
    | "newest"
    | "oldest"
    | "name_asc"
    | "name_desc";

  const [eventSort, setEventSort] =
    useState<EventSortOption>("newest");

  const [attendanceDetails, setAttendanceDetails] =
    useState<EventAttendanceDetails | null>(null);

  const [attendanceDetailsLoading, setAttendanceDetailsLoading] =
    useState(false);

  const [attendanceDetailsError, setAttendanceDetailsError] =
    useState("");

  const [keepCameraOn, setKeepCameraOn] =
    useState(false);

  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const soundEnabledRef = useRef(true);

  const cameraIdleTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastCameraActivityRef =
    useRef<number>(Date.now());

  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoStream, setVideoStream] =
    useState<MediaStream | null>(null);

  const [cameras, setCameras] =
    useState<MediaDeviceInfo[]>([]);

  const [selectedCamera, setSelectedCamera] =
    useState<string>("");

  const [scanning, setScanning] = useState(false);

  const [recognizedStudent, setRecognizedStudent] =
    useState<{
      user_id: number;
      name: string;
      employee_id: string;
      confidence: number;
    } | null>(null);

  const [alreadyMarkedNotice, setAlreadyMarkedNotice] =
    useState<string | null>(null);

  const [confirmationSeconds, setConfirmationSeconds] =
    useState(2);

  const [scanMessage, setScanMessage] =
    useState("Automatically scanning...");  

  const recognitionInProgress =
    useRef(false);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const videoStreamRef =
    useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] =
  useState("");

  function speakText(text: string) {
    if (!soundEnabledRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Ignore speech errors
    }
  }

  function playMatchSound() {
    if (!soundEnabledRef.current) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio playback ignored
    }
  }

  useEffect(() => {
    const savedKeepCameraOn =
      localStorage.getItem("attendance_keep_camera_on");

    setKeepCameraOn(savedKeepCameraOn === "true");

    const savedSound = localStorage.getItem("attendance_sound_enabled");
    if (savedSound !== null) {
      const parsed = savedSound === "true";
      setSoundEnabled(parsed);
      soundEnabledRef.current = parsed;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "attendance_keep_camera_on",
      String(keepCameraOn)
    );
  }, [keepCameraOn]);

  useEffect(() => {
    localStorage.setItem(
      "attendance_sound_enabled",
      String(soundEnabled)
    );
    soundEnabledRef.current = soundEnabled;
    
    if (!soundEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [soundEnabled]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("access_token");
        let role = "";

        if (token) {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(
              atob(
                parts[1].replace(/-/g, "+").replace(/_/g, "/")
              )
            );
            role = String(payload.role || "").toLowerCase();
          }
        }

        setCurrentUserRole(role);

        if (role === "student") {
          const attendance = await getMyAttendance();
          setStudentAttendance(attendance);
          return;
        }

        const [eventsData, groupsData] = await Promise.all([
          getEvents(),
          getGroups(),
        ]);

        setEvents(eventsData);
        setGroups(groupsData);
      } catch (err: any) {
        setError(
          err?.message ||
            "Failed to load attendance data"
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!recognizedStudent) {
      return;
    }

    if (confirmationSeconds <= 0) {
      confirmRecognizedStudent();
      return;
    }

    const timer =
      setTimeout(() => {
        setConfirmationSeconds(
          (seconds) => seconds - 1
        );
      }, 1000);

    return () =>
      clearTimeout(timer);

  }, [
    recognizedStudent,
    confirmationSeconds,
  ]);

  async function confirmRecognizedStudent() {

    if (!recognizedStudent || !selectedEvent) {
      return;
    }

    const studentToMark = recognizedStudent;
    setRecognizedStudent(null);

    try {
      setScanMessage("Confirming attendance...");

      const result =
        await confirmAttendance(
          selectedEvent.id,
          studentToMark.user_id,
          studentToMark.confidence
        );

      if (result.success) {
        const successMsg = `${result.name} marked ${result.status || "Present"}`;
        setScanMessage(`✓ ${successMsg}`);
        speakText(successMsg);

        setTimeout(() => {
          setScanMessage("Automatically scanning...");
        }, 1500);
      }

    } catch (error: any) {

      console.error(
        "Attendance confirmation error:",
        error
      );

      setScanMessage(
        error?.message ||
          "Failed to mark attendance"
      );
    }
  }

  async function toggleGroupMembers(
    eventId: number,
    groupId: number
  ) {
    if (expandedEventId === eventId && expandedGroupId === groupId) {
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

      const members =
        await getGroupMembers(groupId);

      setGroupMembers((current) => ({
        ...current,
        [groupId]: members.map((member: any) => ({
          user_id: member.id,
          name: member.name,
          employee_id: member.employee_id,
          status: null,
          check_in: null,
          confidence: null,
        })),
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load group students."
      );
    } finally {
      setLoadingGroupId(null);
    }
  }

  function checkIfEventExpired(event: Event) {
    const now = new Date();
    const expired =
      event.ends_at !== null &&
      new Date(event.ends_at) <= now;
    return expired || !event.is_active || event.is_cancelled;
  }

  function getEventStatus(event: Event) {
    const now = new Date();

    if (event.is_cancelled) {
      return "cancelled";
    }

    if (
      event.ends_at !== null &&
      new Date(event.ends_at) <= now
    ) {
      return "expired";
    }

    if (!event.is_active) {
      return "inactive";
    }

    if (new Date(event.starts_at) > now) {
      return "upcoming";
    }

    return "active";
  }

  // Helper to determine accurate status considering 10-min rule & expiration
  function getResolvedStudentStatus(
    student: AttendanceStudent,
    event: Event | null
  ) {
    const isExpired = event ? checkIfEventExpired(event) : false;

    if (student.check_in && event?.starts_at) {
      const startMs = new Date(event.starts_at).getTime();
      const checkInMs = new Date(student.check_in).getTime();
      const diffMins = (checkInMs - startMs) / (1000 * 60);

      if (diffMins > 10) {
        return "Late";
      }
      return "Present";
    }

    if (student.status && student.status !== "Not Marked") {
      if (student.status === "Present" && student.check_in && event?.starts_at) {
        const startMs = new Date(event.starts_at).getTime();
        const checkInMs = new Date(student.check_in).getTime();
        const diffMins = (checkInMs - startMs) / (1000 * 60);
        if (diffMins > 10) return "Late";
      }
      return student.status;
    }

    if (isExpired) {
      return "Absent";
    }

    return "Not Marked";
  }

  // Compute accurate statistics dynamically from students list
  function getComputedAttendanceStats(
    students: AttendanceStudent[],
    event: Event | null
  ) {
    const isExpired = event ? checkIfEventExpired(event) : false;
    let present = 0;
    let late = 0;
    let absent = 0;
    let notMarked = 0;

    students.forEach((student) => {
      const resolvedStatus = getResolvedStudentStatus(student, event);
      if (resolvedStatus === "Present") present++;
      else if (resolvedStatus === "Late") late++;
      else if (resolvedStatus === "Absent") absent++;
      else if (resolvedStatus === "Not Marked") notMarked++;
    });

    return {
      total: students.length,
      present,
      late,
      absent,
      notMarked,
    };
  }

  const currentAttendanceEvent = useMemo(() => {
    if (!attendanceDetails) return null;
    return events.find((e) => e.id === attendanceDetails.event_id) || null;
  }, [events, attendanceDetails]);

  const computedStats = useMemo(() => {
    if (!attendanceDetails) return { total: 0, present: 0, late: 0, absent: 0, notMarked: 0 };
    return getComputedAttendanceStats(attendanceDetails.students, currentAttendanceEvent);
  }, [attendanceDetails, currentAttendanceEvent]);

  async function downloadAttendance(
    event: Event,
    details: EventAttendanceDetails
  ) {
    const isExpired = checkIfEventExpired(event);
    const stats = getComputedAttendanceStats(details.students, event);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Smart Attendance";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Attendance");

    const colors = {
      green: "DCFCE7",
      greenText: "166534",
      red: "FEE2E2",
      redText: "B91C1C",
      blue: "DBEAFE",
      blueText: "1D4ED8",
      orange: "FFEDD5",
      orangeText: "C2410C",
      gray: "F3F4F6",
      dark: "111827",
      border: "D1D5DB",
      white: "FFFFFF",
    };

    worksheet.mergeCells("A1:D1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "SMART ATTENDANCE REPORT";
    titleCell.font = {
      bold: true,
      size: 18,
      color: { argb: colors.dark },
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 30;

    worksheet.getCell("A3").value = "Event";
    worksheet.getCell("B3").value = event.title;

    worksheet.getCell("A4").value = "Group";
    const group = groups.find((item) => item.id === event.group_id);
    worksheet.getCell("B4").value = group?.name || `Group ${event.group_id}`;

    worksheet.getCell("A5").value = "Start";
    worksheet.getCell("B5").value = event.starts_at ? formatDateTime(event.starts_at) : "-";

    worksheet.getCell("A6").value = "End";
    worksheet.getCell("B6").value = event.ends_at ? formatDateTime(event.ends_at) : "-";

    worksheet.getCell("A7").value = "Event Status";
    worksheet.getCell("B7").value = event.is_cancelled
      ? "Cancelled"
      : isExpired
        ? "Expired"
        : "Active";

    for (let row = 3; row <= 7; row++) {
      worksheet.getCell(`A${row}`).font = { bold: true, color: { argb: colors.dark } };
      worksheet.getCell(`A${row}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colors.gray },
      };
    }

    worksheet.mergeCells("A9:D9");
    worksheet.getCell("A9").value = "ATTENDANCE STATISTICS";
    worksheet.getCell("A9").font = { bold: true, size: 13, color: { argb: colors.dark } };
    worksheet.getCell("A9").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colors.gray },
    };

    const statistics = [
      ["Total Students", stats.total],
      ["Present", stats.present],
      ["Late", stats.late],
      ["Absent", stats.absent],
      ...(stats.notMarked > 0 ? [["Not Marked", stats.notMarked]] : []),
    ];

    let statisticsRow = 10;
    for (const [label, value] of statistics) {
      worksheet.getCell(`A${statisticsRow}`).value = label;
      worksheet.getCell(`B${statisticsRow}`).value = value;
      worksheet.getCell(`A${statisticsRow}`).font = { bold: true };
      statisticsRow++;
    }

    const tableStartRow = statisticsRow + 2;

    worksheet.mergeCells(`A${tableStartRow}:D${tableStartRow}`);
    worksheet.getCell(`A${tableStartRow}`).value = "STUDENT ATTENDANCE";
    worksheet.getCell(`A${tableStartRow}`).font = { bold: true, size: 13 };
    worksheet.getCell(`A${tableStartRow}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colors.gray },
    };

    const headerRow = tableStartRow + 1;
    const headers = ["Student Name", "Student ID", "Attendance Status", "Check-in"];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: colors.white } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "374151" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    details.students.forEach((student, index) => {
      const rowNumber = headerRow + 1 + index;
      const status = getResolvedStudentStatus(student, event);

      const row = worksheet.getRow(rowNumber);
      row.values = [
        student.name,
        student.employee_id,
        status,
        student.check_in ? formatDateTime(student.check_in) : "-",
      ];

      
      let background = colors.orange;
      let textColor = colors.orangeText;

      if (status === "Present") {
        background = colors.green;
        textColor = colors.greenText;
      } else if (status === "Late") {
        background = colors.blue;
        textColor = colors.blueText;
      } else if (
        status === "Absent" ||
        status === "Not Marked"
      ) {
        background = colors.red;
        textColor = colors.redText;
      }

      const statusCell = row.getCell(3);
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: background },
      };
      statusCell.font = {
        bold: true,
        color: { argb: textColor },
      };
      statusCell.alignment = { horizontal: "center", vertical: "middle" };

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: colors.border } },
          bottom: { style: "thin", color: { argb: colors.border } },
          left: { style: "thin", color: { argb: colors.border } },
          right: { style: "thin", color: { argb: colors.border } },
        };
      });
    });

    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 18;
    worksheet.getColumn(3).width = 22;
    worksheet.getColumn(4).width = 25;

    worksheet.views = [
      {
        state: "frozen",
        ySplit: headerRow,
      },
    ];

    worksheet.autoFilter = {
      from: `A${headerRow}`,
      to: `D${headerRow + details.students.length}`,
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9-_]+/gi, "_")}_attendance.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function viewAttendance(event: Event) {
    try {
      setAttendanceDetailsLoading(true);
      setAttendanceDetailsError("");
      setAttendanceDetails(null);

      const details = await getEventAttendanceDetails(event.id);
      setAttendanceDetails(details);
    } catch (err) {
      setAttendanceDetailsError(
        err instanceof Error ? err.message : "Failed to load attendance."
      );
    } finally {
      setAttendanceDetailsLoading(false);
    }
  }

  const isAttendanceEventExpired = useMemo(() => {
    if (!currentAttendanceEvent) return false;
    return checkIfEventExpired(currentAttendanceEvent);
  }, [currentAttendanceEvent]);

  async function startCamera(deviceId?: string) {
    try {
      setCameraError("");

      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "user" },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoStreamRef.current = stream;
      setVideoStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
      setCameras(videoDevices);

      const activeDevice = videoDevices.find((device) => device.deviceId === deviceId);
      if (activeDevice) {
        setSelectedCamera(activeDevice.deviceId);
      } else if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error("Camera error:", error);
      setCameraError("Unable to access camera. Please allow camera permission.");
    }
  }

  function resetCameraIdleTimer() {
    lastCameraActivityRef.current = Date.now();

    if (cameraIdleTimerRef.current) {
      clearTimeout(cameraIdleTimerRef.current);
      cameraIdleTimerRef.current = null;
    }

    if (keepCameraOn) {
      return;
    }

    cameraIdleTimerRef.current = setTimeout(() => {
      if (!keepCameraOn && cameraOpen) {
        stopCamera();
        setScanMessage("Camera turned off after 1 minute of inactivity.");
      }
    }, 60_000);
  }

  function stopCamera() {
    if (cameraIdleTimerRef.current) {
      clearTimeout(cameraIdleTimerRef.current);
      cameraIdleTimerRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    const stream = videoStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setVideoStream(null);
    setCameraOpen(false);
    setScanning(false);
    setRecognizedStudent(null);
    setAlreadyMarkedNotice(null);
    recognitionInProgress.current = false;
  }

  async function openCamera() {
    setCameraOpen(true);
    resetCameraIdleTimer();
    await startCamera();
  }

  async function switchCamera() {
    if (cameras.length < 2) return;

    const currentIndex = cameras.findIndex((camera) => camera.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    await startCamera(nextCamera.deviceId);
  }

  async function captureFrame() {
    if (!videoRef.current) return null;

    const video = videoRef.current;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  }

  async function scanFace() {
    if (
      !selectedEvent ||
      !cameraOpen ||
      recognizedStudent ||
      recognitionInProgress.current
    ) {
      return;
    }

    recognitionInProgress.current = true;

    try {
      const image = await captureFrame();
      if (!image) return;

      const result = await recognizeFace(selectedEvent.id, image);
      if (!result.recognized) return;

      resetCameraIdleTimer();
      playMatchSound();

      if (result.already_marked) {
        const msg = `${result.name} already marked`;
        setAlreadyMarkedNotice(msg);
        speakText(msg);

        setTimeout(() => {
          setAlreadyMarkedNotice(null);
        }, 2000);

        return;
      }

      setRecognizedStudent({
        user_id: result.user_id,
        name: result.name,
        employee_id: result.employee_id,
        confidence: result.confidence,
      });

      setConfirmationSeconds(2);
      speakText(`${result.name} marked`);
    } catch (error) {
      console.error("Recognition error:", error);
    } finally {
      recognitionInProgress.current = false;
    }
  }

  useEffect(() => {
    if (!cameraOpen || !videoStream || recognizedStudent) {
      return;
    }

    setScanning(true);
    const interval = setInterval(() => {
      scanFace();
    }, 1500);

    return () => {
      clearInterval(interval);
      setScanning(false);
    };
  }, [cameraOpen, videoStream, recognizedStudent]);

  useEffect(() => {
    if (!cameraOpen || keepCameraOn) {
      if (cameraIdleTimerRef.current) {
        clearTimeout(cameraIdleTimerRef.current);
        cameraIdleTimerRef.current = null;
      }
      return;
    }

    resetCameraIdleTimer();

    return () => {
      if (cameraIdleTimerRef.current) {
        clearTimeout(cameraIdleTimerRef.current);
        cameraIdleTimerRef.current = null;
      }
    };
  }, [cameraOpen, keepCameraOn]);

  const upcomingEvents = useMemo(() => {
    return events.filter((event) => getEventStatus(event) === "upcoming");
  }, [events]);

  const activeEvents = useMemo(() => {
    return events.filter((event) => getEventStatus(event) === "active");
  }, [events]);

  const previousEvents = useMemo(() => {
    return events.filter((event) => {
      const status = getEventStatus(event);
      return status === "expired" || status === "inactive" || status === "cancelled";
    });
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = [...activeEvents];

    const filtered = query
      ? source.filter(
          (event) =>
            event.title.toLowerCase().includes(query) ||
            getEventGroups(event).some((group) =>
              group.name.toLowerCase().includes(query)
            )
        )
      : source;

    return filtered.sort((a, b) => {
      if (eventSort === "oldest") {
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      }
      if (eventSort === "name_asc") {
        return a.title.localeCompare(b.title);
      }
      if (eventSort === "name_desc") {
        return b.title.localeCompare(a.title);
      }
      return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    });
  }, [activeEvents, search, eventSort]);

  const sortedPreviousEvents = useMemo(() => {
    return [...previousEvents].sort((a, b) => {
      if (eventSort === "oldest") {
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      }
      if (eventSort === "name_asc") {
        return a.title.localeCompare(b.title);
      }
      if (eventSort === "name_desc") {
        return b.title.localeCompare(a.title);
      }
      return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    });
  }, [previousEvents, eventSort]);

  function getEventGroupIds(event: Event) {
    if (Array.isArray(event.group_ids) && event.group_ids.length > 0) {
      return event.group_ids;
    }
    return event.group_id != null ? [event.group_id] : [];
  }

  function getEventGroups(event: Event) {
    const groupIds = getEventGroupIds(event);
    return groupIds
      .map((groupId) => groups.find((group) => group.id === groupId))
      .filter((group): group is Group => Boolean(group));
  }

  function formatDateTime(value: string | null) {
    if (!value) return "No end time";
    return new Date(value).toLocaleString();
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="mt-3 text-gray-500">Loading attendance...</p>
      </div>
    );
  }

  if (currentUserRole === "student") {
    const summary = studentAttendance || {
      total_events: 0,
      completed_events: 0,
      present: 0,
      late: 0,
      absent: 0,
      attendance_rate: 0,
      records: [],
    };

    const query = studentAttendanceSearch.trim().toLowerCase();

    const filteredStudentRecords = summary.records
      .filter((record) =>
        studentAttendanceStatus === "all"
          ? true
          : record.status === studentAttendanceStatus
      )
      .filter((record) =>
        query
          ? record.event_title.toLowerCase().includes(query)
          : true
      )
      .sort((a, b) => {
        switch (studentAttendanceSort) {
          case "oldest":
            return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
          case "name_asc":
            return a.event_title.localeCompare(b.event_title);
          case "name_desc":
            return b.event_title.localeCompare(a.event_title);
          case "present":
            return Number(b.status === "Present") - Number(a.status === "Present");
          case "late":
            return Number(b.status === "Late") - Number(a.status === "Late");
          case "absent":
            return Number(b.status === "Absent") - Number(a.status === "Absent");
          case "newest":
          default:
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
        }
      });

    const statusClass = (status: StudentAttendanceRecord["status"]) => {
      if (status === "Present") return "bg-green-100 text-green-700 border-green-200";
      if (status === "Late") return "bg-blue-100 text-blue-700 border-blue-200";
      if (status === "Absent") return "bg-red-100 text-red-700 border-red-200";
      return "bg-orange-100 text-orange-700 border-orange-200";
    };

    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My Attendance</h1>
            <p className="mt-2 text-sm text-gray-500">View your attendance performance and class-wise records.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Attendance Rate</p>
              <p className="mt-2 text-3xl font-bold text-blue-700">{summary.attendance_rate.toFixed(2)}%</p>
              <p className="mt-1 text-xs text-gray-400">(Present + Late) / Total Classes</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Present</p>
              <p className="mt-2 text-3xl font-bold text-green-700">{summary.present}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Late</p>
              <p className="mt-2 text-3xl font-bold text-blue-700">{summary.late}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Absent</p>
              <p className="mt-2 text-3xl font-bold text-red-600">{summary.absent}</p>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  value={studentAttendanceSearch}
                  onChange={(e) => setStudentAttendanceSearch(e.target.value)}
                  placeholder="Search event..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={studentAttendanceStatus}
                  onChange={(e) => setStudentAttendanceStatus(e.target.value as typeof studentAttendanceStatus)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                  <option value="Not Marked">Not Marked</option>
                </select>

                <select
                  value={studentAttendanceSort}
                  onChange={(e) => setStudentAttendanceSort(e.target.value as typeof studentAttendanceSort)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="name_asc">Sort: Event A-Z</option>
                  <option value="name_desc">Sort: Event Z-A</option>
                  <option value="present">Sort: Present First</option>
                  <option value="late">Sort: Late First</option>
                  <option value="absent">Sort: Absent First</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Attendance History</h2>
                  <p className="mt-1 text-xs text-gray-500">{filteredStudentRecords.length} record{filteredStudentRecords.length === 1 ? "" : "s"}</p>
                </div>
                <span className="text-xs text-gray-500">{summary.completed_events} completed class{summary.completed_events === 1 ? "" : "es"}</span>
              </div>
            </div>

            {filteredStudentRecords.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-4xl">📋</div>
                <p className="mt-3 text-sm font-medium text-gray-700">No attendance records found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredStudentRecords.map((record) => (
                  <div key={record.event_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">{record.event_title}</h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>📅 {formatDateTime(record.starts_at)}</span>
                        <span>⏰ {record.check_in ? `Check-in: ${formatDateTime(record.check_in)}` : "No check-in"}</span>
                      </div>
                    </div>
                    <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(record.status)}`}>
                      {record.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="mt-2 text-sm text-gray-500">
            Select an active event to mark attendance.
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* SEARCH */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event by name..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* UPCOMING EVENTS */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowUpcomingEvents((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-gray-50"
          >
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                {showUpcomingEvents ? "▾" : "▸"} Upcoming Events
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                {upcomingEvents.length} event{upcomingEvents.length !== 1 ? "s" : ""} scheduled
              </span>
            </span>
            <span className="text-xs font-medium text-gray-500">
              {showUpcomingEvents ? "Hide" : "Show"}
            </span>
          </button>

          {showUpcomingEvents && (
            <div className="mt-4">
              {upcomingEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center">
                  <div className="text-3xl">📅</div>
                  <p className="mt-3 text-sm font-medium text-gray-700">No upcoming events</p>
                  <p className="mt-1 text-sm text-gray-500">There are no future events scheduled.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {upcomingEvents.map((event) => {
                    const eventGroups = getEventGroups(event);
                    return (
                      <div
                        key={event.id}
                        className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-semibold text-gray-900">
                              {event.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-sm text-gray-500">Groups:</span>
                              {eventGroups.length > 0 ? (
                                eventGroups.map((group) => (
                                  <span
                                    key={group.id}
                                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                                  >
                                    {group.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-400">Unknown Group</span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Upcoming
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              Starts
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-700">
                              {formatDateTime(event.starts_at)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                              Ends
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-700">
                              {formatDateTime(event.ends_at)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
                          <p className="text-sm font-medium text-blue-700">
                            Attendance will be available when the event starts.
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ACTIVE EVENTS & SORT HEADER */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Active Events</h2>
            <p className="text-xs sm:text-sm text-gray-500">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""} available
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600">
            <span className="font-medium">Sort</span>
            <select
              value={eventSort}
              onChange={(e) => setEventSort(e.target.value as EventSortOption)}
              className="w-28 sm:w-auto rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-sm outline-none focus:border-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name_asc">Event Name A-Z</option>
              <option value="name_desc">Event Name Z-A</option>
            </select>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <div className="text-4xl">📅</div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              {search ? "No matching events" : "No active events"}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {search
                ? "Try searching with a different event or group name."
                : "There are currently no events available for attendance."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {filteredEvents.map((event) => {
              const eventGroups = getEventGroups(event);
              const isExpanded =
                expandedEventId === event.id && expandedGroupId !== null;
              const members =
                expandedGroupId !== null ? groupMembers[expandedGroupId] || [] : [];

              return (
                <div
                  key={event.id}
                  className={`rounded-xl border bg-white p-5 shadow-sm transition ${
                    selectedEvent?.id === event.id
                      ? "border-blue-500 ring-2 ring-blue-100"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-gray-900">
                        {event.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-500">Groups:</span>
                        {eventGroups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => toggleGroupMembers(event.id, group.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                              expandedEventId === event.id && expandedGroupId === group.id
                                ? "bg-blue-600 text-white"
                                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                            }`}
                          >
                            {group.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      <div className="border-b border-gray-200 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Group Students
                        </p>
                      </div>

                      <div className="max-h-56 overflow-y-auto">
                        {loadingGroupId === expandedGroupId ? (
                          <p className="px-3 py-4 text-center text-sm text-gray-500">
                            Loading students...
                          </p>
                        ) : members.length === 0 ? (
                          <p className="px-3 py-4 text-center text-sm text-gray-500">
                            No active students in this group.
                          </p>
                        ) : (
                          members.map((member, index) => (
                            <div
                              key={member.user_id}
                              className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5 last:border-b-0"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {index + 1}. {member.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {member.employee_id}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Starts
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-700">
                        {formatDateTime(event.starts_at)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Ends
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-700">
                        {formatDateTime(event.ends_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => viewAttendance(event)}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      👥 View Attendance
                    </button>

                    {selectedEvent?.id === event.id ? (
                      <button
                        type="button"
                        onClick={openCamera}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 hover:shadow-md"
                      >
                        📷 Mark Attendance
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className="rounded-lg border border-blue-600 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                      >
                        Select Event
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PREVIOUS / EXPIRED EVENTS */}
        <div className="mt-8 border-t border-gray-200 pt-5">
          <button
            type="button"
            onClick={() => setShowPreviousEvents((current) => !current)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-gray-50"
          >
            <span>
              <span className="block text-sm font-semibold text-gray-900">
                {showPreviousEvents ? "▾" : "▸"} Previous / Expired Events
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                {sortedPreviousEvents.length} event{sortedPreviousEvents.length !== 1 ? "s" : ""}
              </span>
            </span>
            <span className="text-xs font-medium text-gray-500">
              {showPreviousEvents ? "Hide" : "Show"}
            </span>
          </button>

          {showPreviousEvents && (
            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {sortedPreviousEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center lg:col-span-2">
                  <p className="text-sm text-gray-500">No previous events.</p>
                </div>
              ) : (
                sortedPreviousEvents.map((event) => {
                  const eventGroups = getEventGroups(event);
                  const isExpanded =
                    expandedEventId === event.id && expandedGroupId !== null;
                  const members =
                    expandedGroupId !== null ? groupMembers[expandedGroupId] || [] : [];

                  return (
                    <div
                      key={event.id}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-gray-900">
                            {event.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-500">Groups:</span>
                            {eventGroups.map((group) => (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => toggleGroupMembers(event.id, group.id)}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                  expandedEventId === event.id && expandedGroupId === group.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                                }`}
                              >
                                {group.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                          {event.is_cancelled ? "Cancelled" : "Expired"}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                          <div className="border-b border-gray-200 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Group Students
                            </p>
                          </div>

                          <div className="max-h-56 overflow-y-auto">
                            {loadingGroupId === expandedGroupId ? (
                              <p className="px-3 py-4 text-center text-sm text-gray-500">
                                Loading students...
                              </p>
                            ) : members.length === 0 ? (
                              <p className="px-3 py-4 text-center text-sm text-gray-500">
                                No active students in this group.
                              </p>
                            ) : (
                              members.map((member, index) => (
                                <div
                                  key={member.user_id}
                                  className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5 last:border-b-0"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">
                                      {index + 1}. {member.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {member.employee_id}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Starts
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-700">
                            {formatDateTime(event.starts_at)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Ends
                          </p>
                          <p className="mt-1 text-sm font-medium text-gray-700">
                            {formatDateTime(event.ends_at)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => viewAttendance(event)}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          👥 View Attendance
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const details = await getEventAttendanceDetails(event.id);
                              downloadAttendance(event, details);
                            } catch (err) {
                              setAttendanceDetailsError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to download attendance."
                              );
                            }
                          }}
                          className="rounded-lg border border-green-600 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-100"
                        >
                          ⬇️ Download
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ATTENDANCE DETAILS MODAL */}
        {attendanceDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Attendance</h2>
                  <p className="text-sm text-gray-500">{attendanceDetails.event_title}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadAttendance(
                        currentAttendanceEvent || {
                          id: attendanceDetails.event_id,
                          organization_id: 0,
                          group_id: attendanceDetails.group_id,
                          title: attendanceDetails.event_title,
                          created_by: 0,
                          starts_at: "",
                          ends_at: null,
                          is_active: true,
                          created_at: "",
                          is_cancelled: false,
                        },
                        attendanceDetails
                      )
                    }
                    className="rounded-lg border border-green-600 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
                  >
                    ⬇️ Download
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttendanceDetails(null)}
                    className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* STATS SUMMARY (Fixed count bug using computedStats) */}
              <div className="border-b bg-gray-50 px-5 py-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-xl font-bold text-gray-900">{computedStats.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Present</p>
                    <p className="text-xl font-bold text-green-700">{computedStats.present}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Late</p>
                    <p className="text-xl font-bold text-emerald-700">{computedStats.late}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      {isAttendanceEventExpired ? "Absent" : "Not Marked"}
                    </p>
                    <p
                      className={`text-xl font-bold ${
                        isAttendanceEventExpired ? "text-red-600" : "text-orange-700"
                      }`}
                    >
                      {isAttendanceEventExpired ? computedStats.absent : computedStats.notMarked}
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {attendanceDetails.students.map((student) => {
                    const status = getResolvedStudentStatus(student, currentAttendanceEvent);

                    const isPresent = status === "Present";
                    const isLate = status === "Late";
                    const isAbsent = status === "Absent";

                    return (
                      <div
                        key={student.user_id}
                        className={`rounded-lg border p-3 ${
                          isPresent
                            ? "border-green-200 bg-green-50"
                            : isLate
                              ? "border-blue-200 bg-blue-50"
                              : isAbsent
                                ? "border-red-200 bg-red-50"
                                : "border-orange-200 bg-orange-50"
                        }`}
                      >
                      
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.employee_id}</p>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              isPresent
                                ? "bg-green-100 text-green-700"
                                : isLate
                                  ? "bg-blue-100 text-blue-700"
                                  : isAbsent
                                    ? "bg-red-100 text-red-700"
                                    : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        {student.check_in && (
                          <p className="mt-2 text-xs text-gray-500">
                            Check-in: {formatDateTime(student.check_in)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {attendanceDetailsLoading && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
            <div className="rounded-xl bg-white px-6 py-5 shadow-xl">
              <p className="text-sm font-medium text-gray-700">Loading attendance...</p>
            </div>
          </div>
        )}

        {attendanceDetailsError && (
          <div className="fixed bottom-5 right-5 z-[70] max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
            {attendanceDetailsError}
            <button
              type="button"
              onClick={() => setAttendanceDetailsError("")}
              className="ml-3 font-semibold underline"
            >
              Close
            </button>
          </div>
        )}

        {cameraOpen && selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* HEADER */}
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="font-semibold text-gray-900">Mark Attendance</h2>
                  <p className="text-sm text-gray-500">{selectedEvent.title}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !soundEnabled;
                      setSoundEnabled(nextState);
                      soundEnabledRef.current = nextState;
                      if (!nextState && typeof window !== "undefined" && "speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                      }
                    }}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                    title={soundEnabled ? "Mute Match Sound" : "Enable Match Sound"}
                  >
                    {soundEnabled ? "🔊 Sound: On" : "🔇 Sound: Off"}
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* CAMERA */}
              <div className="relative bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full object-cover"
                />

                {/* FACE GUIDE */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-64 w-48 rounded-[50%] border-2 border-white/80" />
                </div>
              </div>

              {/* ERROR */}
              {cameraError && (
                <div className="mx-5 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {cameraError}
                </div>
              )}

              {/* AUTOMATIC SCANNING UI */}
              <div className="px-5 py-4 text-center">
                {alreadyMarkedNotice ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                    <span className="text-sm font-bold text-amber-800">
                      ⚠ {alreadyMarkedNotice}
                    </span>
                  </div>
                ) : recognizedStudent ? (
                  <div>
                    <p className="text-sm text-gray-500">Face recognized</p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-900">
                      {recognizedStudent.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      ID: {recognizedStudent.employee_id}
                    </p>
                    <p className="mt-3 text-sm font-medium text-blue-600">
                      Confirming automatically in {confirmationSeconds}s
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRecognizedStudent(null);
                        setConfirmationSeconds(2);
                        setScanMessage("Automatically scanning...");
                      }}
                      className="mt-4 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      ❌ Wrong Name
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-600">🔍 {scanMessage}</p>
                    {scanning && (
                      <div className="mx-auto mt-3 h-2 w-40 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CONTROLS */}
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={cameras.length < 2}
                  onClick={switchCamera}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🔄 Switch Camera
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setKeepCameraOn((current) => !current);
                    resetCameraIdleTimer();
                  }}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
                    keepCameraOn
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {keepCameraOn ? "🔒 Keep Camera On: ON" : "⏱ Keep Camera On: OFF"}
                </button>
              </div>

              <div className="px-5 pb-4 text-center text-xs text-gray-500">
                {keepCameraOn
                  ? "Camera will stay on until you close it."
                  : "If no face is detected for 1 minute, the camera turns off automatically."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}