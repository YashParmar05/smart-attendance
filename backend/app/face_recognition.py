import numpy as np
from insightface.app import FaceAnalysis


class FaceRecognitionService:

    def __init__(self):

        print("Loading InsightFace ArcFace model...")

        self.app = FaceAnalysis(
            name="buffalo_l"
        )

        # CPU mode.
        # Change to ctx_id=0 later if you have a supported GPU.
        self.app.prepare(
            ctx_id=-1,
            det_size=(640, 640)
        )

        print("InsightFace ArcFace model loaded.")

    
    # ============================================================
    # BASIC EMBEDDING
    # Used by attendance recognition
    # ============================================================

    def get_embedding(self, frame):

        if frame is None:
            return None

        faces = self.app.get(frame)

        if not faces:
            return None

        # Select the largest face.
        #
        # This is useful for attendance recognition because
        # the largest/closest face is normally the intended face.
        face = max(
            faces,
            key=lambda f:
            (f.bbox[2] - f.bbox[0])
            *
            (f.bbox[3] - f.bbox[1])
        )

        embedding = face.embedding.astype(
            np.float32
        )

        # Normalize the embedding.
        norm = np.linalg.norm(embedding)

        if norm == 0:
            return None

        embedding /= norm

        return embedding.tolist()

    # ============================================================
    # ENROLLMENT / REPLACEMENT
    # Returns detailed detection information
    # ============================================================

    def get_enrollment_embedding(self, frame):

        if frame is None:
            return None, "invalid_image"

        faces = self.app.get(frame)

        # --------------------------------------------------------
        # No face
        # --------------------------------------------------------

        if not faces:
            return None, "no_face"

        # --------------------------------------------------------
        # Multiple faces
        # --------------------------------------------------------

        if len(faces) > 1:
            return None, "multiple_faces"

        # --------------------------------------------------------
        # Exactly one face
        # --------------------------------------------------------

        face = faces[0]

        embedding = face.embedding.astype(
            np.float32
        )

        # --------------------------------------------------------
        # Validate embedding
        # --------------------------------------------------------

        norm = np.linalg.norm(embedding)

        if norm == 0:
            return None, "embedding_failed"

        # Normalize
        embedding /= norm

        return embedding.tolist(), "success"


face_recognition_service = FaceRecognitionService()