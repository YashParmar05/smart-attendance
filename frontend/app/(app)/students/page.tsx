"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getUsers,
  createStudentWithFace,
  updateStudent,
  getStudentFacePhoto,
  replaceStudentFace,
  updateUserStatus,
  bulkUpdateUserStatus,
  resetUserPassword
} from "@/lib/api";


export default function StudentsPage() {

  // ============================================================
  // STUDENTS
  // ============================================================

  const [students, setStudents] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  // ============================================================
  // STUDENT TABLE MANAGEMENT
  // ============================================================

  const [selectedStudents, setSelectedStudents] =
    useState<number[]>([]);

  const [sortField, setSortField] = useState<
    "name" | "student_id" | "email" | "status"
  >("name");

  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  const [studentPhotos, setStudentPhotos] =
    useState<Record<number, string>>({});

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [editingStudent, setEditingStudent] =
    useState<any | null>(null);

  const [editFaceImage, setEditFaceImage] = 
    useState<File | null>(null);

  const [editFacePreview, setEditFacePreview] = 
    useState<string | null>(null);

  const [editName, setEditName] =
    useState("");

  const [editEmail, setEditEmail] =
    useState("");

  const [editStudentId, setEditStudentId] =
    useState("");

  const [savingEdit, setSavingEdit] =
    useState(false);

  const [editModalError, setEditModalError] =
    useState("");

  // ============================================================
  // RESET PASSWORD
  // ============================================================

  const [showPasswordModal, setShowPasswordModal] =
    useState(false);

  const [passwordStudent, setPasswordStudent] =
    useState<any | null>(null);

  const [newStudentPassword, setNewStudentPassword] =
    useState("");

  const [savingPassword, setSavingPassword] =
    useState(false);


  const [showReplaceFaceModal, setShowReplaceFaceModal] =
    useState(false);

  const [replaceFaceStudent, setReplaceFaceStudent] =
    useState<any | null>(null);

  const [replaceFaceImage, setReplaceFaceImage] =
    useState<File | null>(null);

  const [replaceFacePreview, setReplaceFacePreview] =
    useState<string | null>(null);

  const [replacingFace, setReplacingFace] =
    useState(false);

  const [replaceFaceModalError, setReplaceFaceModalError] =
    useState("");

  const [deactivatingStudentId, setDeactivatingStudentId] =
    useState<number | null>(null);


  // ============================================================
  // FORM
  // ============================================================

  const [showForm, setShowForm] =
    useState(false);

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [studentId, setStudentId] =
    useState("");

  const [password, setPassword] =
    useState("");


  // ============================================================
  // FACE ENROLLMENT & CAMERA STATE
  // ============================================================

  const [faceImage, setFaceImage] =
    useState<File | null>(null);

  const [showCamera, setShowCamera] =
    useState(false);

  const [cameraFacingMode, setCameraFacingMode] =
    useState<"user" | "environment">("user");

  const [cameraStream, setCameraStream] =
    useState<MediaStream | null>(null);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  // Active modal/form context for camera or drag-drop targets
  const [activeCameraContext, setActiveCameraContext] =
    useState<"create" | "edit" | "replace">("create");

  const [isDraggingOver, setIsDraggingOver] =
    useState(false);


  // ============================================================
  // FILE PROCESSORS & DRAG/DROP HELPERS
  // ============================================================

  const processSelectedFile = (
    file: File,
    context: "create" | "edit" | "replace"
  ) => {
    if (
      file.type !== "image/jpeg" &&
      file.type !== "image/png"
    ) {
      const errMsg = "Please select a JPG or PNG image.";
      if (context === "edit") setEditModalError(errMsg);
      else if (context === "replace") setReplaceFaceModalError(errMsg);
      else setError(errMsg);
      return;
    }

    const url = URL.createObjectURL(file);
    setCropMode(context);
    setCropImage(url);
    setShowCropEditor(true);

    if (context === "edit") setEditModalError("");
    else if (context === "replace") setReplaceFaceModalError("");
    else setError("");
  };

  const handleEditFaceUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file, "edit");
  };

  const handleReplaceFaceUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file, "replace");
  };

  const handleFaceUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) processSelectedFile(file, "create");
  };


  // Interactive crop editor
  const [showCropEditor, setShowCropEditor] =
    useState(false);

  const [cropImage, setCropImage] =
    useState<string | null>(null);

  const [cropMode, setCropMode] =
    useState<"create" | "edit" | "replace">("create");

  const [cropBox, setCropBox] = useState({
    x: 70,
    y: 70,
    size: 220,
  });

  const [imageBounds, setImageBounds] = useState({
    x: 0,
    y: 0,
    width: 360,
    height: 360,
  });

  const [cropDragging, setCropDragging] =
    useState(false);

  const [resizeCorner, setResizeCorner] =
    useState<
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right"
      | null
    >(null);

  const cropEditorRef =
    useRef<HTMLDivElement | null>(null);

  const cropSourceImageRef =
    useRef<HTMLImageElement | null>(null);

  const cropPointerStart =
    useRef({
      x: 0,
      y: 0,
    });

  const cropStartBox =
    useRef({
      x: 0,
      y: 0,
      size: 0,
    });


  // ============================================================
  // SEARCH / MESSAGES
  // ============================================================

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [creating, setCreating] =
    useState(false);


  // ============================================================
  // LOAD STUDENT PHOTOS
  // ============================================================

  async function loadStudentPhotos(
    users: any[]
  ) {
    const photoResults =
      await Promise.all(
        users.map(
          async (student) => {
            try {
              const blob =
                await getStudentFacePhoto(
                  student.id
                );

              return {
                id: student.id,
                url: URL.createObjectURL(
                  blob
                ),
              };
            } catch {
              return null;
            }
          }
        )
      );

    setStudentPhotos((current) => {
      const next = {
        ...current,
      };

      photoResults.forEach(
        (result) => {
          if (!result) {
            return;
          }

          if (next[result.id]) {
            URL.revokeObjectURL(
              next[result.id]
            );
          }

          next[result.id] =
            result.url;
        }
      );

      return next;
    });
  }

  // ============================================================
  // LOAD STUDENTS
  // ============================================================

  async function loadStudents() {

    try {

      setLoading(true);

      const users =
        await getUsers();

      const studentUsers =
        users.filter(
          (user: any) =>
            user.role?.toLowerCase() === "student"
        );

      setStudents(studentUsers);
      await loadStudentPhotos(
        studentUsers
      );

    } catch (error) {

      console.error(
        "Failed to load students:",
        error
      );

      setError(
        "Failed to load students."
      );

    } finally {

      setLoading(false);

    }
  }


  useEffect(() => {

    loadStudents();

  }, []);


  // ============================================================
  // START CAMERA (WITH FACING MODE & FLIP SUPPORT)
  // ============================================================

  async function startCamera(context: "create" | "edit" | "replace", forcedFacingMode?: "user" | "environment") {
    try {
      setError("");
      setEditModalError("");
      setReplaceFaceModalError("");

      const modeToUse = forcedFacingMode || cameraFacingMode;
      setActiveCameraContext(context);

      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: modeToUse,
          },
          audio: false,
        });

      setCameraStream(stream);
      setShowCamera(true);

    } catch (error) {
      console.error(
        "Camera access failed:",
        error
      );

      const errMsg = "Unable to access camera. Please allow camera permission.";
      if (context === "edit") setEditModalError(errMsg);
      else if (context === "replace") setReplaceFaceModalError(errMsg);
      else setError(errMsg);
    }
  }

  async function switchCamera() {
    const nextMode = cameraFacingMode === "user" ? "environment" : "user";
    setCameraFacingMode(nextMode);
    await startCamera(activeCameraContext, nextMode);
  }


  // ============================================================
  // CONNECT CAMERA STREAM TO VIDEO
  // ============================================================

  useEffect(() => {

    if (
      videoRef.current &&
      cameraStream
    ) {

      videoRef.current.srcObject =
        cameraStream;
    }

  }, [cameraStream]);


  // ============================================================
  // STOP CAMERA
  // ============================================================

  function stopCamera() {

    if (cameraStream) {

      cameraStream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

    }

    setCameraStream(null);

    setShowCamera(false);
  }


  // ============================================================
  // CAPTURE PHOTO
  // ============================================================

  function capturePhoto() {

    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {

      const errMsg = "Camera is not ready yet. Please wait a moment.";
      if (activeCameraContext === "edit") setEditModalError(errMsg);
      else if (activeCameraContext === "replace") setReplaceFaceModalError(errMsg);
      else setError(errMsg);

      return;
    }


    const canvas =
      document.createElement("canvas");

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }


    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );


    canvas.toBlob(
      (blob) => {

        if (!blob) {
          const errMsg = "Failed to capture photo.";
          if (activeCameraContext === "edit") setEditModalError(errMsg);
          else if (activeCameraContext === "replace") setReplaceFaceModalError(errMsg);
          else setError(errMsg);
          return;
        }


        const file =
          new File(
            [blob],
            "face-capture.jpg",
            {
              type: "image/jpeg",
            }
          );


        openCropEditor(file, activeCameraContext);

        setError("");
        setEditModalError("");
        setReplaceFaceModalError("");

        stopCamera();

      },
      "image/jpeg",
      0.92
    );
  }

  // ============================================================
  // INTERACTIVE CROP EDITOR
  // ============================================================

  function clamp(
    value: number,
    min: number,
    max: number
  ) {
    return Math.min(
      Math.max(value, min),
      max
    );
  }

  function getImageBounds() {
    const editor =
      cropEditorRef.current;

    const image =
      cropSourceImageRef.current;

    if (!editor || !image) {
      return null;
    }

    const editorRect =
      editor.getBoundingClientRect();

    const imageRect =
      image.getBoundingClientRect();

    return {
      x:
        imageRect.left -
        editorRect.left,

      y:
        imageRect.top -
        editorRect.top,

      width:
        imageRect.width,

      height:
        imageRect.height,
    };
  }

  function initializeCropBox() {
    const bounds =
      getImageBounds();

    if (!bounds) {
      return;
    }

    setImageBounds(bounds);

    const size =
      Math.min(
        bounds.width,
        bounds.height
      ) * 0.72;

    const cropSize =
      Math.max(
        120,
        Math.min(size, 280)
      );

    setCropBox({
      x:
        bounds.x +
        (bounds.width - cropSize) / 2,

      y:
        bounds.y +
        (bounds.height - cropSize) / 2,

      size: cropSize,
    });
  }

  function startCropMove(
    event: React.PointerEvent
  ) {
    event.preventDefault();

    setCropDragging(true);

    cropPointerStart.current = {
      x: event.clientX,
      y: event.clientY,
    };

    cropStartBox.current = {
      ...cropBox,
    };

    (
      event.currentTarget as HTMLElement
    ).setPointerCapture(event.pointerId);
  }

  function moveCrop(
    event: React.PointerEvent
  ) {
    if (!cropDragging) {
      return;
    }

    const dx =
      event.clientX -
      cropPointerStart.current.x;

    const dy =
      event.clientY -
      cropPointerStart.current.y;

    const bounds =
      imageBounds;

    const nextX =
      clamp(
        cropStartBox.current.x + dx,
        bounds.x,
        bounds.x +
          bounds.width -
          cropStartBox.current.size
      );

    const nextY =
      clamp(
        cropStartBox.current.y + dy,
        bounds.y,
        bounds.y +
          bounds.height -
          cropStartBox.current.size
      );

    setCropBox({
      ...cropStartBox.current,
      x: nextX,
      y: nextY,
    });
  }

  function stopCropMove() {
    setCropDragging(false);
  }

  function startResize(
    corner:
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right",
    event: React.PointerEvent
  ) {
    event.preventDefault();
    event.stopPropagation();

    setResizeCorner(corner);

    cropPointerStart.current = {
      x: event.clientX,
      y: event.clientY,
    };

    cropStartBox.current = {
      ...cropBox,
    };

    (
      event.currentTarget as HTMLElement
    ).setPointerCapture(event.pointerId);
  }

  function resizeCrop(
    event: React.PointerEvent
  ) {
    if (!resizeCorner) {
      return;
    }

    const start =
      cropStartBox.current;

    const dx =
      event.clientX -
      cropPointerStart.current.x;

    const dy =
      event.clientY -
      cropPointerStart.current.y;

    const bounds =
      imageBounds;

    const MIN_SIZE = 100;

    let newSize =
      start.size;

    let newX =
      start.x;

    let newY =
      start.y;

    if (resizeCorner === "top-left") {
      const delta =
        Math.min(dx, dy);

      newSize =
        start.size - delta;

      newSize =
        clamp(
          newSize,
          MIN_SIZE,
          Math.min(
            start.x +
              start.size -
              bounds.x,
            start.y +
              start.size -
              bounds.y
          )
        );

      newX =
        start.x +
        start.size -
        newSize;

      newY =
        start.y +
        start.size -
        newSize;
    }

    if (resizeCorner === "top-right") {
      const delta =
        Math.max(dx, -dy);

      newSize =
        start.size + delta;

      newSize =
        clamp(
          newSize,
          MIN_SIZE,
          Math.min(
            bounds.x +
              bounds.width -
              start.x,
            start.y +
              start.size -
              bounds.y
          )
        );

      newY =
        start.y +
        start.size -
        newSize;
    }

    if (resizeCorner === "bottom-left") {
      const delta =
        Math.max(-dx, dy);

      newSize =
        start.size + delta;

      newSize =
        clamp(
          newSize,
          MIN_SIZE,
          Math.min(
            start.x +
              start.size -
              bounds.x,
            bounds.y +
              bounds.height -
              start.y
          )
        );

      newX =
        start.x +
        start.size -
        newSize;
    }

    if (resizeCorner === "bottom-right") {
      const delta =
        Math.max(dx, dy);

      newSize =
        clamp(
          start.size + delta,
          MIN_SIZE,
          Math.min(
            bounds.x +
              bounds.width -
              start.x,
            bounds.y +
              bounds.height -
              start.y
          )
        );
    }

    setCropBox({
      x: newX,
      y: newY,
      size: newSize,
    });
  }

  function stopResize() {
    setResizeCorner(null);
  }

  function cancelCropEditor() {
    if (cropImage) {
      URL.revokeObjectURL(cropImage);
    }

    setCropImage(null);
    setShowCropEditor(false);
    setResizeCorner(null);
    setCropDragging(false);
  }

  async function confirmCrop() {
    const image =
      cropSourceImageRef.current;

    const editor =
      cropEditorRef.current;

    if (!image || !editor) {
      return;
    }

    const bounds =
      getImageBounds();

    if (!bounds) {
      if (cropMode === "edit") {
        setEditModalError("Unable to process the selected photo.");
      } else if (cropMode === "replace") {
        setReplaceFaceModalError("Unable to process the selected photo.");
      } else {
        setError("Unable to process the selected photo.");
      }
      return;
    }

    const scaleX =
      image.naturalWidth /
      bounds.width;

    const scaleY =
      image.naturalHeight /
      bounds.height;

    const sourceX =
      (cropBox.x - bounds.x) *
      scaleX;

    const sourceY =
      (cropBox.y - bounds.y) *
      scaleY;

    const sourceSize =
      cropBox.size *
      Math.min(scaleX, scaleY);

    const OUTPUT_SIZE = 320;

    const canvas =
      document.createElement("canvas");

    canvas.width =
      OUTPUT_SIZE;

    canvas.height =
      OUTPUT_SIZE;

    const context =
      canvas.getContext("2d");

    if (!context) {
      if (cropMode === "edit") {
        setEditModalError("Unable to process the selected photo.");
      } else if (cropMode === "replace") {
        setReplaceFaceModalError("Unable to process the selected photo.");
      } else {
        setError("Unable to process the selected photo.");
      }
      return;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    const blob =
      await new Promise<Blob | null>(
        (resolve) => {
          canvas.toBlob(
            (result) =>
              resolve(result),
            "image/jpeg",
            0.92
          );
        }
      );

    if (!blob) {
      if (cropMode === "edit") {
        setEditModalError("Failed to create cropped photo.");
      } else if (cropMode === "replace") {
        setReplaceFaceModalError("Failed to create cropped photo.");
      } else {
        setError("Failed to create cropped photo.");
      }
      return;
    }

    const file =
      new File(
        [blob],
        "face-capture.jpg",
        {
          type: "image/jpeg",
        }
      );

    if (cropMode === "edit") {
      setEditFaceImage(file);

      if (editFacePreview) {
        URL.revokeObjectURL(editFacePreview);
      }

      setEditFacePreview(
        URL.createObjectURL(file)
      );
      setEditModalError("");
    } else if (cropMode === "replace") {
      setReplaceFaceImage(file);

      if (replaceFacePreview) {
        URL.revokeObjectURL(replaceFacePreview);
      }

      setReplaceFacePreview(
        URL.createObjectURL(file)
      );
      setReplaceFaceModalError("");
    } else {
      setFaceImage(file);
      setError("");
    }

    cancelCropEditor();
  }


  // ============================================================
  // DRAG AND DROP HANDLERS
  // ============================================================

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }

  function handleDrop(e: React.DragEvent, context: "create" | "edit" | "replace") {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file, context);
    }
  }


  // ============================================================
  // REMOVE SELECTED PHOTO
  // ============================================================

  function removeFacePhoto() {

    setFaceImage(null);

    setError("");
  }


  // ============================================================
  // OPEN CROP EDITOR FOR A CONTEXT
  // ============================================================

  function openCropEditor(file: File, context: "create" | "edit" | "replace") {
    const url =
      URL.createObjectURL(file);

    setCropImage(url);
    setCropMode(context);
    setShowCropEditor(true);
  }


  // ============================================================
  // CREATE STUDENT + ENROLL FACE
  // ============================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setError("");

    setSuccess("");

    setCreating(true);


    try {

      if (!faceImage) {

        throw new Error(
          "Please capture or upload a face photo."
        );
      }

      await createStudentWithFace(
        {
          name,
          email,
          student_id: studentId,
          password,
        },
        faceImage
      );

      setSuccess(
        "Student created and face enrolled successfully."
      );

      setName("");

      setEmail("");

      setStudentId("");

      setPassword("");

      setFaceImage(null);

      setShowForm(false);

      await loadStudents();

    } catch (error) {

      console.error(
        "Student creation failed:",
        error
      );

      if (error instanceof Error) {

        setError(
          error.message
        );

      } else {

        setError(
          "Failed to create student."
        );
      }

    } finally {

      setCreating(false);

    }
  }


  // ============================================================
  // STUDENT TABLE MANAGEMENT
  // ============================================================

  function toggleSort(
    field:
      | "name"
      | "student_id"
      | "email"
      | "status"
  ) {
    if (sortField === field) {
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
      | "student_id"
      | "email"
      | "status"
  ) {
    if (sortField !== field) {
      return "↕";
    }

    return sortDirection === "asc"
      ? "↑"
      : "↓";
  }

  function toggleStudentSelection(
    studentId: number
  ) {
    setSelectedStudents(
      (current) =>
        current.includes(studentId)
          ? current.filter(
              (id) => id !== studentId
            )
          : [...current, studentId]
    );
  }

  function selectAllStudents() {
    setSelectedStudents(
      filteredStudents.map(
        (student) => student.id
      )
    );
  }

  function unselectAllStudents() {
    setSelectedStudents([]);
  }

  function openEditStudent(
    student: any
  ) {
    setEditingStudent(student);

    if (editFacePreview) {
      URL.revokeObjectURL(editFacePreview);
    }

    setEditFaceImage(null);
    setEditFacePreview(null);

    setEditName(student.name || "");
    setEditEmail(student.email || "");
    setEditStudentId(
      student.student_id ||
      student.employee_id ||
      ""
    );
    setShowEditModal(true);
    setEditModalError("");
  }


  function closeEditStudentModal() {
    if (editFacePreview) {
      URL.revokeObjectURL(editFacePreview);
    }

    setEditFacePreview(null);
    setEditFaceImage(null);
    setEditingStudent(null);
    setEditModalError("");
    setShowEditModal(false);
  }

  async function handleEditStudent() {
    if (!editingStudent) {
      return;
    }

    try {
      setSavingEdit(true);
      setEditModalError("");

      await updateStudent(
        editingStudent.id,
        {
          name: editName.trim(),
          email: editEmail.trim(),
          employee_id:
          editStudentId.trim(),
        }, 
        editFaceImage
      );

      setSuccess(
        "Student details updated successfully."
      );

      setShowEditModal(false);
      setEditingStudent(null);

      await loadStudents();
    } catch (error) {
      console.error(
        "Student update failed:",
        error
      );

      setEditModalError(
        error instanceof Error
          ? error.message
          : "Failed to update student."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  function openStudentPasswordModal(student: any) {
    setPasswordStudent(student);
    setNewStudentPassword("");
    setEditModalError("");
    setShowPasswordModal(true);
  }

  function closeStudentPasswordModal() {
    if (savingPassword) return;
    setShowPasswordModal(false);
    setPasswordStudent(null);
    setNewStudentPassword("");
  }

  async function handleResetStudentPassword() {
    if (!passwordStudent || newStudentPassword.length < 6) return;

    try {
      setSavingPassword(true);
      setError("");
      setSuccess("");

      await resetUserPassword(
        passwordStudent.id,
        newStudentPassword
      );

      setSuccess("Student password reset successfully.");
      closeStudentPasswordModal();
    } catch (error) {
      console.error("Student password reset failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to reset student password."
      );
    } finally {
      setSavingPassword(false);
    }
  }


  function openReplaceFace(
    student: any
  ) {
    setReplaceFaceStudent(student);
    setReplaceFaceImage(null);

    if (replaceFacePreview) {
      URL.revokeObjectURL(
        replaceFacePreview
      );
    }

    setReplaceFacePreview(null);
    setReplaceFaceModalError("");
    setShowReplaceFaceModal(true);
  }

  function closeReplaceFaceModal() {
    if (replaceFacePreview) {
      URL.revokeObjectURL(
        replaceFacePreview
      );
    }

    setReplaceFacePreview(null);
    setReplaceFaceImage(null);
    setReplaceFaceStudent(null);
    setReplaceFaceModalError("");
    setShowReplaceFaceModal(false);
  }

  async function handleReplaceFace() {
    if (
      !replaceFaceStudent ||
      !replaceFaceImage
    ) {
      return;
    }

    try {
      setReplacingFace(true);
      setReplaceFaceModalError("");

      await replaceStudentFace(
        replaceFaceStudent.id,
        replaceFaceImage,
        {
          name: replaceFaceStudent.name || "",
          email: replaceFaceStudent.email || "",
          employee_id:
            replaceFaceStudent.student_id ||
            replaceFaceStudent.employee_id ||
            "",
        }
      );

      setSuccess(
        "Student face replaced successfully."
      );

      closeReplaceFaceModal();

      await loadStudents();
    } catch (error) {
      console.error(
        "Face replacement failed:",
        error
      );

      setReplaceFaceModalError(
        error instanceof Error
          ? error.message
          : "Failed to replace student face."
      );
    } finally {
      setReplacingFace(false);
    }
  }

  async function handleStudentStatus(
    student: any,
    isActive: boolean
  ) {
    const action =
      isActive
        ? "activate"
        : "deactivate";

    const confirmed =
      window.confirm(
        `${isActive ? "Activate" : "Deactivate"} ${student.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeactivatingStudentId(
        student.id
      );

      setError("");
      setSuccess("");

      await updateUserStatus(
        student.id,
        isActive
      );

      setSuccess(
        `Student ${action}d successfully.`
      );

      await loadStudents();
    } catch (error) {
      console.error(
        `Student ${action} failed:`,
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : `Failed to ${action} student.`
      );
    } finally {
      setDeactivatingStudentId(null);
    }
  }

  async function handleBulkStatus(
    isActive: boolean
  ) {
    if (
      selectedStudents.length === 0
    ) {
      return;
    }

    const selectedUsers =
      students.filter(
        (student) =>
          selectedStudents.includes(
            student.id
          )
      );

    const action =
      isActive
        ? "activate"
        : "deactivate";

    const confirmed =
      window.confirm(
        `${isActive ? "Activate" : "Deactivate"} ${selectedUsers.length} selected student${selectedUsers.length === 1 ? "" : "s"}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeactivatingStudentId(
        -1
      );

      setError("");
      setSuccess("");

      await bulkUpdateUserStatus(
        selectedStudents,
        isActive
      );

      setSuccess(
        `${selectedUsers.length} student${selectedUsers.length === 1 ? "" : "s"} ${action}d successfully.`
      );

      setSelectedStudents([]);

      await loadStudents();
    } catch (error) {
      console.error(
        `Bulk student ${action} failed:`,
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : `Failed to ${action} selected students.`
      );
    } finally {
      setDeactivatingStudentId(null);
    }
  }

  // ============================================================
  // SEARCH + SORT
  // ============================================================

  const filteredStudents =
    students.filter(
      (student) => {
        const query =
          search.toLowerCase();

        const studentId =
          student.student_id ||
          student.employee_id ||
          "";

        return (
          student.name
            ?.toLowerCase()
            .includes(query) ||
          student.email
            ?.toLowerCase()
            .includes(query) ||
          studentId
            .toLowerCase()
            .includes(query)
        );
      }
    );

  const sortedStudents =
    [...filteredStudents].sort(
      (a, b) => {
        let valueA = "";
        let valueB = "";

        if (sortField === "name") {
          valueA =
            (a.name || "")
              .toLowerCase();

          valueB =
            (b.name || "")
              .toLowerCase();
        } else if (
          sortField === "student_id"
        ) {
          valueA =
            (
              a.student_id ||
              a.employee_id ||
              ""
            ).toLowerCase();

          valueB =
            (
              b.student_id ||
              b.employee_id ||
              ""
            ).toLowerCase();
        } else if (
          sortField === "email"
        ) {
          valueA =
            (a.email || "")
              .toLowerCase();

          valueB =
            (b.email || "")
              .toLowerCase();
        } else {
          valueA = a.is_active
            ? "active"
            : "inactive";

          valueB = b.is_active
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
            Students
          </h1>

          <p className="text-gray-500 mt-1">
            Manage students in your organization.
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
            : "+ Add Student"}

        </button>

      </div>


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">

          {error}

        </div>

      )}


      {/* ======================================================
          SUCCESS
      ====================================================== */}

      {success && (

        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">

          {success}

        </div>

      )}


      {/* ======================================================
          ADD STUDENT FORM
      ====================================================== */}

      {showForm && (

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">

          <h2 className="text-lg font-semibold text-gray-900">
            Add New Student
          </h2>


          <form
            onSubmit={handleSubmit}
            className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5"
          >


            {/* ==================================================
                NAME
            ================================================== */}

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
                placeholder="Rahul Patel"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            {/* ==================================================
                STUDENT ID
            ================================================== */}

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student ID
              </label>

              <input
                value={studentId}
                onChange={(e) =>
                  setStudentId(e.target.value)
                }
                required
                placeholder="ST007"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            {/* ==================================================
                EMAIL
            ================================================== */}

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
                placeholder="student@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            {/* ==================================================
                PASSWORD
            ================================================== */}

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                placeholder="Temporary password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            {/* ==================================================
                FACE ENROLLMENT
            ================================================== */}

            <div className="md:col-span-2">

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Face Enrollment
              </label>


              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">


                {/* ==================================================
                    CAMERA VIEW
                ================================================== */}

                {showCamera && activeCameraContext === "create" ? (

                  <div>

                    <div className="relative mx-auto max-w-md overflow-hidden rounded-xl bg-black">

                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-auto w-full"
                      />


                      {/* Face guide */}

                      <div className="absolute inset-0 pointer-events-none">

                        <div className="absolute left-1/2 top-1/2 h-64 w-48 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white" />

                      </div>

                    </div>


                    <div className="mt-4 flex flex-wrap justify-center gap-3">

                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
                      >
                        📷 Capture Photo
                      </button>

                      <button
                        type="button"
                        onClick={switchCamera}
                        className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        🔄 Flip Camera ({cameraFacingMode === "user" ? "Selfie" : "Rear"})
                      </button>


                      <button
                        type="button"
                        onClick={stopCamera}
                        className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </button>

                    </div>

                  </div>

                ) : (

                  <div>


                    {/* ==================================================
                        PHOTO PREVIEW BOX WITH DRAG & DROP
                    ================================================== */}

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, "create")}
                      className={`mx-auto flex h-72 max-w-md items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-white transition-all ${
                        isDraggingOver ? "border-blue-600 bg-blue-50/50" : "border-gray-300"
                      }`}
                    >

                      {faceImage ? (

                        <img
                          src={URL.createObjectURL(
                            faceImage
                          )}
                          alt="Selected face"
                          className="h-full w-full object-contain"
                        />

                      ) : (

                        <div className="text-center text-gray-400 p-4">

                          <div className="text-5xl">
                            👤
                          </div>

                          <p className="mt-3 text-sm font-medium text-gray-600">
                            Drag & drop face photo here
                          </p>

                          <p className="mt-1 text-xs text-gray-400">
                            or use camera/gallery buttons below
                          </p>

                        </div>

                      )}

                    </div>


                    {/* ==================================================
                        ACTION BUTTONS
                    ================================================== */}

                    <div className="mt-4 flex flex-wrap justify-center gap-3">


                      {/* CAMERA */}

                      <button
                        type="button"
                        onClick={() => startCamera("create")}
                        disabled={creating}
                        className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        📷 Live Camera
                      </button>


                      {/* UPLOAD */}

                      <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100">

                        📁 Gallery Upload

                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={handleFaceUpload}
                          disabled={creating}
                        />

                      </label>

                    </div>


                    {/* ==================================================
                        SELECTED IMAGE INFO
                    ================================================== */}

                    {faceImage && (

                      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">

                        <div className="flex items-center justify-between gap-3">

                          <div>

                            <p className="text-sm font-semibold text-green-800">
                              ✓ Face photo selected
                            </p>

                            <p className="mt-1 text-xs text-green-700">
                              {faceImage.name}
                            </p>

                          </div>


                          <button
                            type="button"
                            onClick={removeFacePhoto}
                            disabled={creating}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            Remove
                          </button>

                        </div>

                      </div>

                    )}


                    <p className="mt-3 text-center text-xs text-gray-500">
                      Use a clear photo with exactly one visible face.
                      JPG and PNG supported.
                    </p>

                  </div>

                )}

              </div>

            </div>

            {/* ==================================================
                SUBMIT
            ================================================== */}

            <div className="md:col-span-2 flex justify-end">

              <button
                type="submit"
                disabled={
                  creating ||
                  showCamera
                }
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >

                {creating
                  ? "Creating & Enrolling..."
                  : "Create Student"}

              </button>

            </div>

          </form>

        </div>

      )}


      {/* ======================================================
          SEARCH + COUNT
      ====================================================== */}

      <div className="mt-8 flex flex-col gap-4">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <p className="text-gray-500">
              Total Students
            </p>

            <p className="text-2xl font-bold text-gray-900">
              {students.length}
            </p>
          </div>

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search students..."
            className="w-full lg:w-80 rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />

        </div>

        <div className="flex flex-wrap items-center gap-3">

          <button
            type="button"
            onClick={selectAllStudents}
            disabled={
              sortedStudents.length === 0
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Select All
          </button>

          <button
            type="button"
            onClick={unselectAllStudents}
            disabled={
              selectedStudents.length === 0
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Unselect All
          </button>

          <span className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            {selectedStudents.length} selected
          </span>

          {selectedStudents.length > 0 && (
            <>
              <button
                type="button"
                onClick={() =>
                  handleBulkStatus(true)
                }
                disabled={
                  !selectedStudents.some(
                    (id) =>
                      !students.find(
                        (student) =>
                          student.id === id
                      )?.is_active
                  ) ||
                  deactivatingStudentId === -1
                }
                className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                Activate
              </button>

              <button
                type="button"
                onClick={() =>
                  handleBulkStatus(false)
                }
                disabled={
                  !selectedStudents.some(
                    (id) =>
                      students.find(
                        (student) =>
                          student.id === id
                      )?.is_active
                  ) ||
                  deactivatingStudentId === -1
                }
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Deactivate
              </button>
            </>
          )}

          {search && (
            <span className="text-sm text-gray-500">
              {sortedStudents.length} matching
            </span>
          )}

        </div>

      </div>

      {/* ======================================================
          STUDENTS TABLE
      ====================================================== */}

      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">

        {loading ? (

          <div className="p-8 text-center text-gray-500">
            Loading students...
          </div>

        ) : sortedStudents.length === 0 ? (

          <div className="p-8 text-center text-gray-500">
            No students found.
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-gray-50 border-b">

                <tr>

                  <th className="w-12 px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={
                        sortedStudents.length > 0 &&
                        sortedStudents.every(
                          (student) =>
                            selectedStudents.includes(
                              student.id
                            )
                        )
                      }
                      onChange={() => {
                        const allSelected =
                          sortedStudents.length > 0 &&
                          sortedStudents.every(
                            (student) =>
                              selectedStudents.includes(
                                student.id
                              )
                          );

                        if (allSelected) {
                          setSelectedStudents(
                            (current) =>
                              current.filter(
                                (id) =>
                                  !sortedStudents.some(
                                    (student) =>
                                      student.id === id
                                  )
                              )
                          );
                        } else {
                          setSelectedStudents(
                            (current) =>
                              Array.from(
                                new Set([
                                  ...current,
                                  ...sortedStudents.map(
                                    (student) =>
                                      student.id
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
                    Photo
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    <button
                      type="button"
                      onClick={() =>
                        toggleSort("name")
                      }
                      className="inline-flex items-center gap-2 hover:text-blue-600"
                    >
                      Student
                      <span className="text-xs text-gray-400">
                        {sortIcon("name")}
                      </span>
                    </button>
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    <button
                      type="button"
                      onClick={() =>
                        toggleSort("student_id")
                      }
                      className="inline-flex items-center gap-2 hover:text-blue-600"
                    >
                      Student ID
                      <span className="text-xs text-gray-400">
                        {sortIcon("student_id")}
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
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y">

                {sortedStudents.map(
                  (student) => (

                    <tr
                      key={student.id}
                      className="hover:bg-gray-50"
                    >

                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(
                            student.id
                          )}
                          onChange={() =>
                            toggleStudentSelection(
                              student.id
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>

                      <td className="px-6 py-4">
                        {studentPhotos[
                          student.id
                        ] ? (
                          <img
                            src={
                              studentPhotos[
                                student.id
                              ]
                            }
                            alt={student.name}
                            className="h-11 w-11 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-400">
                            👤
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {student.name}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {student.student_id ||
                          student.employee_id}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {student.email}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={
                            student.is_active
                              ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                              : "rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
                          }
                        >
                          {student.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              openEditStudent(
                                student
                              )
                            }
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openStudentPasswordModal(student)
                            }
                            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                          >
                            Reset Password
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openReplaceFace(
                                student
                              )
                            }
                            disabled={
                              !student.is_active
                            }
                            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            Face
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleStudentStatus(
                                student,
                                !student.is_active
                              )
                            }
                            disabled={
                              deactivatingStudentId ===
                              student.id
                            }
                            className={
                              student.is_active
                                ? "rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                : "rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                            }
                          >
                            {deactivatingStudentId ===
                            student.id
                              ? "..."
                              : student.is_active
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


      {/* ============================================================
          SHARED INTERACTIVE CROP EDITOR MODAL
      ============================================================ */}

      {showCropEditor &&
        cropImage && (
          <div className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/75
            p-4
          ">

            <div className="
              w-full
              max-w-xl
              rounded-2xl
              bg-white
              p-6
              shadow-2xl
            ">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2 className="
                    text-xl
                    font-semibold
                    text-gray-900
                  ">
                    Set Face Photo
                  </h2>

                  <p
                    style={{
                      color: "#dc2626",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    Upload a clear face photo with some extra space around the face. Avoid tightly cropped face-only photos.
                  </p>


                </div>

              </div>

              {/* ==================================================
                  INTERACTIVE CROP AREA
              ================================================== */}

              <div
                ref={cropEditorRef}
                className="
                  relative
                  mx-auto
                  mt-5
                  h-[360px]
                  w-[360px]
                  max-w-full
                  overflow-hidden
                  rounded-xl
                  bg-gray-900
                  select-none
                  touch-none
                "
                onPointerMove={(event) => {
                  if (cropDragging) {
                    moveCrop(event);
                  }

                  if (resizeCorner) {
                    resizeCrop(event);
                  }
                }}
                onPointerUp={() => {
                  stopCropMove();
                  stopResize();
                }}
                onPointerCancel={() => {
                  stopCropMove();
                  stopResize();
                }}
              >

                {/* Original image */}

                <img
                  ref={cropSourceImageRef}
                  src={cropImage}
                  alt="Crop face"
                  draggable={false}
                  onLoad={initializeCropBox}
                  className="
                    absolute
                    left-1/2
                    top-1/2
                    max-h-full
                    max-w-full
                    -translate-x-1/2
                    -translate-y-1/2
                    object-contain
                    select-none
                  "
                />

                {/* Dark overlay */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-black/45
                  "
                />

                {/* Selected crop area */}

                <div
                  className="
                    absolute
                    cursor-move
                    border-2
                    border-white
                    bg-transparent
                  "
                  style={{
                    left:
                      cropBox.x,
                    top:
                      cropBox.y,
                    width:
                      cropBox.size,
                    height:
                      cropBox.size,
                    boxShadow:
                      "0 0 0 9999px rgba(0,0,0,0.45)",
                  }}
                  onPointerDown={
                    startCropMove
                  }
                >

                  {/* Corner: top-left */}

                  <button
                    type="button"
                    aria-label="Resize crop from top left"
                    className="
                      absolute
                      -left-3
                      -top-3
                      h-6
                      w-6
                      cursor-nwse-resize
                      rounded-full
                      border-2
                      border-white
                      bg-blue-600
                    "
                    onPointerDown={(event) =>
                      startResize(
                        "top-left",
                        event
                      )
                    }
                  />

                  {/* Corner: top-right */}

                  <button
                    type="button"
                    aria-label="Resize crop from top right"
                    className="
                      absolute
                      -right-3
                      -top-3
                      h-6
                      w-6
                      cursor-nesw-resize
                      rounded-full
                      border-2
                      border-white
                      bg-blue-600
                    "
                    onPointerDown={(event) =>
                      startResize(
                        "top-right",
                        event
                      )
                    }
                  />

                  {/* Corner: bottom-left */}

                  <button
                    type="button"
                    aria-label="Resize crop from bottom left"
                    className="
                      absolute
                      -bottom-3
                      -left-3
                      h-6
                      w-6
                      cursor-nesw-resize
                      rounded-full
                      border-2
                      border-white
                      bg-blue-600
                    "
                    onPointerDown={(event) =>
                      startResize(
                        "bottom-left",
                        event
                      )
                    }
                  />

                  {/* Corner: bottom-right */}

                  <button
                    type="button"
                    aria-label="Resize crop from bottom right"
                    className="
                      absolute
                      -bottom-3
                      -right-3
                      h-6
                      w-6
                      cursor-nwse-resize
                      rounded-full
                      border-2
                      border-white
                      bg-blue-600
                    "
                    onPointerDown={(event) =>
                      startResize(
                        "bottom-right",
                        event
                      )
                    }
                  />

                </div>

              </div>

              <p className="
                mt-3
                text-center
                text-xs
                text-gray-500
              ">
                The selected area will be saved
                as a 320 × 320 face photo.
              </p>

              {/* Actions */}

              <div className="
                mt-6
                flex
                justify-end
                gap-3
              ">

                <button
                  type="button"
                  onClick={cancelCropEditor}
                  className="
                    rounded-lg
                    border
                    border-gray-300
                    px-5
                    py-2.5
                    font-medium
                    text-gray-700
                    hover:bg-gray-50
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmCrop}
                  className="
                    rounded-lg
                    bg-blue-600
                    px-5
                    py-2.5
                    font-semibold
                    text-white
                    hover:bg-blue-700
                  "
                >
                  Use This Photo
                </button>

              </div>

            </div>

          </div>
        )}


      {/* ============================================================
          EDIT STUDENT MODAL
      ============================================================ */}

      {showEditModal &&
        editingStudent && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Edit Student
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Update student account details.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeEditStudentModal}
                  disabled={savingEdit}
                  className="text-xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>

              </div>

              {editModalError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editModalError}
                </div>
              )}

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
                    Student ID
                  </label>

                  <input
                    value={editStudentId}
                    onChange={(e) =>
                      setEditStudentId(
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

                <div className="space-y-3">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Face Photo
                  </label>

                  {showCamera && activeCameraContext === "edit" ? (
                    <div>
                      <div className="relative mx-auto max-w-sm overflow-hidden rounded-xl bg-black">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="h-auto w-full"
                        />
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute left-1/2 top-1/2 h-48 w-36 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white" />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          📷 Capture Photo
                        </button>
                        <button
                          type="button"
                          onClick={switchCamera}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          🔄 Flip ({cameraFacingMode === "user" ? "Selfie" : "Rear"})
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, "edit")}
                        className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-all ${
                          isDraggingOver ? "border-blue-600 bg-blue-50/50" : "border-gray-300 bg-gray-50"
                        }`}
                      >
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-white">
                          {(editFacePreview ||
                            studentPhotos[editingStudent.id]) ? (
                            <img
                              src={
                                editFacePreview ||
                                studentPhotos[editingStudent.id]
                              }
                              alt="Student face"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl text-gray-400">
                              👤
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 mb-2">
                            Drag & drop or choose source:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startCamera("edit")}
                              disabled={savingEdit}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              📷 Camera
                            </button>

                            <label
                              htmlFor="edit-face-upload"
                              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              📁 Gallery
                            </label>

                            <input
                              id="edit-face-upload"
                              type="file"
                              accept="image/jpeg,image/png"
                              className="hidden"
                              onChange={handleEditFaceUpload}
                              disabled={savingEdit}
                            />
                          </div>
                        </div>
                      </div>

                      {editFaceImage && (
                        <p className="mt-2 text-xs font-medium text-green-700">
                          ✓ New face photo selected
                        </p>
                      )}
                    </div>
                  )}
                </div>

              </div>

              <div className="mt-6 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={closeEditStudentModal}
                  disabled={savingEdit}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleEditStudent}
                  disabled={
                    savingEdit ||
                    !editName.trim() ||
                    !editEmail.trim() ||
                    !editStudentId.trim()
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


      {/* ============================================================
          RESET STUDENT PASSWORD MODAL
      ============================================================ */}

      {showPasswordModal && passwordStudent && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Reset Student Password
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Set a new temporary password for {passwordStudent.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeStudentPasswordModal}
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
                value={newStudentPassword}
                onChange={(e) => setNewStudentPassword(e.target.value)}
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
                onClick={closeStudentPasswordModal}
                disabled={savingPassword}
                className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetStudentPassword}
                disabled={savingPassword || newStudentPassword.length < 6}
                className="rounded-lg bg-amber-600 px-5 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPassword ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ============================================================
          REPLACE FACE MODAL
      ============================================================ */}

      {showReplaceFaceModal &&
        replaceFaceStudent && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Replace Face
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Replace the face identity for{" "}
                    <span className="font-medium text-gray-700">
                      {replaceFaceStudent.name}
                    </span>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeReplaceFaceModal}
                  disabled={replacingFace}
                  className="text-xl text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>

              </div>

              {replaceFaceModalError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {replaceFaceModalError}
                </div>
              )}

              <div className="mt-6 space-y-4">

                <div className="space-y-3">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Face Photo
                  </label>

                  {showCamera && activeCameraContext === "replace" ? (
                    <div>
                      <div className="relative mx-auto max-w-sm overflow-hidden rounded-xl bg-black">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="h-auto w-full"
                        />
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute left-1/2 top-1/2 h-48 w-36 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white" />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          📷 Capture Photo
                        </button>
                        <button
                          type="button"
                          onClick={switchCamera}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          🔄 Flip ({cameraFacingMode === "user" ? "Selfie" : "Rear"})
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, "replace")}
                        className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-all ${
                          isDraggingOver ? "border-blue-600 bg-blue-50/50" : "border-gray-300 bg-gray-50"
                        }`}
                      >
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-white">
                          {(replaceFacePreview ||
                            studentPhotos[replaceFaceStudent.id]) ? (
                            <img
                              src={
                                replaceFacePreview ||
                                studentPhotos[replaceFaceStudent.id]
                              }
                              alt="Student face"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl text-gray-400">
                              👤
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 mb-2">
                            Drag & drop or choose source:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startCamera("replace")}
                              disabled={replacingFace}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              📷 Camera
                            </button>

                            <label
                              htmlFor="replace-face-upload"
                              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              📁 Gallery
                            </label>

                            <input
                              id="replace-face-upload"
                              type="file"
                              accept="image/jpeg,image/png"
                              className="hidden"
                              onChange={handleReplaceFaceUpload}
                              disabled={replacingFace}
                            />
                          </div>
                        </div>
                      </div>

                      {replaceFaceImage && (
                        <p className="mt-2 text-xs font-medium text-green-700">
                          ✓ New face photo selected
                        </p>
                      )}
                    </div>
                  )}
                </div>

              </div>

              <div className="mt-6 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={closeReplaceFaceModal}
                  disabled={replacingFace}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleReplaceFace}
                  disabled={
                    replacingFace ||
                    !replaceFaceImage
                  }
                  className="rounded-lg bg-black px-5 py-2.5 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {replacingFace
                    ? "Replacing..."
                    : "Replace Face"}
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}