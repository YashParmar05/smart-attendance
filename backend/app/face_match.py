from collections import Counter, defaultdict

import numpy as np

from app.database import SessionLocal
from app import models
# from app.face_recognition import FaceRecognitionService

from app.face_recognition import face_recognition_service


# ============================================================
# CONFIGURATION
# ============================================================

# Determined from our verification tests.
MATCH_THRESHOLD = 0.35

# Number of recognition decisions required.
VOTING_FRAMES = 1

# Minimum votes required.
MIN_VOTES = 1


# ============================================================
# ARCFACE SERVICE
# ============================================================

# face_service = FaceRecognitionService()


# ============================================================
# SINGLE FRAME MATCH
# ============================================================

def _match_single_frame(
    frame,
    event_id,
    db
):
    """
    Recognize one frame.

    Only students belonging to ANY group assigned
    to the event are considered as candidates.

    Returns:
        user, similarity
    """

    # --------------------------------------------------------
    # 1. Generate ArcFace 512-D embedding
    # --------------------------------------------------------

    embedding = face_recognition_service.get_embedding(
        frame
    )

    if embedding is None:
        return None, None

    embedding = np.asarray(
        embedding,
        dtype=np.float32
    )


    # --------------------------------------------------------
    # 2. Find event
    # --------------------------------------------------------

    event = (
        db.query(models.Event)
        .filter(
            models.Event.id == event_id
        )
        .first()
    )

    if event is None:
        return None, None


    # --------------------------------------------------------
    # 3. Get event groups
    # --------------------------------------------------------
    #
    # FINAL EVENT MODEL:
    #
    # Event
    #   ├── Group A
    #   ├── Group B
    #   └── Group C
    #
    # Therefore we cannot use only event.group_id.
    # --------------------------------------------------------

    event_group_ids = [
        assignment.group_id
        for assignment in event.group_assignments
    ]


    # --------------------------------------------------------
    # Legacy compatibility
    # --------------------------------------------------------
    #
    # Older events may only have event.group_id.
    # --------------------------------------------------------

    if (
        not event_group_ids
        and event.group_id is not None
    ):

        event_group_ids = [
            event.group_id
        ]


    if not event_group_ids:
        return None, None


    # --------------------------------------------------------
    # 4. Get students belonging to ANY event group
    # --------------------------------------------------------
    #
    # distinct() is important because:
    #
    # Student X
    #   ├── Group A
    #   └── Group B
    #
    # should appear only once.
    # --------------------------------------------------------

# --------------------------------------------------------
# Get UNIQUE student IDs from ALL event groups
# --------------------------------------------------------

    student_ids = (
        db.query(
            models.GroupMember.user_id
        )
        .filter(
            models.GroupMember.group_id.in_(
                event_group_ids
            )
        )
        .distinct()
        .subquery()
    )


    # --------------------------------------------------------
    # Get actual student users
    # --------------------------------------------------------

    users = (
        db.query(models.User)
        .filter(
            models.User.id.in_(
                student_ids
            ),

            models.User.organization_id
            == event.organization_id,

            models.User.role == "student",

            models.User.is_active == True
        )
        .all()
    )


    if not users:
        return None, None


    # --------------------------------------------------------
    # 5. Create user lookup
    # --------------------------------------------------------

    users_by_id = {
        user.id: user
        for user in users
    }


    user_ids = list(
        users_by_id.keys()
    )


    # --------------------------------------------------------
    # 6. Get active face embeddings
    # --------------------------------------------------------

    embeddings = (
        db.query(models.FaceEmbedding)
        .filter(
            models.FaceEmbedding.user_id.in_(
                user_ids
            ),

            models.FaceEmbedding.is_active == True
        )
        .all()
    )


    if not embeddings:
        return None, None


    # --------------------------------------------------------
    # 7. Compare query embedding against candidates
    # --------------------------------------------------------

    best_user = None

    best_score = -1.0


    for face_embedding in embeddings:

        stored = np.asarray(
            face_embedding.embedding,
            dtype=np.float32
        )


        # ----------------------------------------------------
        # Safety check
        # ----------------------------------------------------
        #
        # ArcFace embeddings should have the same dimension.
        # If a stale/invalid embedding exists, skip it.
        # ----------------------------------------------------

        if (
            stored.ndim != 1
            or stored.shape != embedding.shape
        ):
            continue


        # ----------------------------------------------------
        # Both vectors are normalized.
        #
        # Therefore:
        #
        # dot(query, stored)
        #
        # is cosine similarity.
        # ----------------------------------------------------

        score = float(
            np.dot(
                embedding,
                stored
            )
        )


        if score > best_score:

            best_score = score

            best_user = users_by_id.get(
                face_embedding.user_id
            )


    # --------------------------------------------------------
    # 8. Apply recognition threshold
    # --------------------------------------------------------

    if (
        best_user is None
        or best_score < MATCH_THRESHOLD
    ):

        return None, best_score


    return best_user, best_score


# ============================================================
# MULTI-FRAME VOTING
# ============================================================

def recognize_face(
    frame,
    event_id
):
    """
    Recognize a face for an event.

    The frontend sends one frame at a time.

    A small voting state is maintained per event.
    """

    # --------------------------------------------------------
    # 1. Initialize voting state
    # --------------------------------------------------------

    if not hasattr(
        recognize_face,
        "_voting_state"
    ):

        recognize_face._voting_state = {}


    state = recognize_face._voting_state


    # --------------------------------------------------------
    # 2. Create state for this event
    # --------------------------------------------------------

    if event_id not in state:

        state[event_id] = {

            "votes": Counter(),

            "scores": defaultdict(list),

            "frames": 0
        }


    current = state[event_id]


    # --------------------------------------------------------
    # 3. Database session
    # --------------------------------------------------------

    db = SessionLocal()

    try:

        user, score = _match_single_frame(
            frame,
            event_id,
            db
        )

    finally:

        db.close()


    # --------------------------------------------------------
    # 4. No match
    # --------------------------------------------------------

    if user is None:

        current["frames"] += 1


        # Reset after voting window.

        if (
            current["frames"]
            >= VOTING_FRAMES
        ):

            current["votes"].clear()

            current["scores"].clear()

            current["frames"] = 0


        return None, score


    # --------------------------------------------------------
    # 5. Record vote
    # --------------------------------------------------------

    current["votes"][user.id] += 1


    current["scores"][
        user.id
    ].append(
        score
    )


    current["frames"] += 1


    # --------------------------------------------------------
    # 6. Find current winner
    # --------------------------------------------------------

    winner_id, vote_count = (
        current["votes"].most_common(1)[0]
    )


    # --------------------------------------------------------
    # 7. Check voting window
    # --------------------------------------------------------

    if (
        current["frames"]
        >= VOTING_FRAMES
    ):

        winner_scores = (
            current["scores"][winner_id]
        )


        average_score = float(
            np.mean(
                winner_scores
            )
        )


        # ----------------------------------------------------
        # 8. Final recognition decision
        # ----------------------------------------------------

        if (
            vote_count >= MIN_VOTES
            and average_score >= MATCH_THRESHOLD
        ):

            # -----------------------------------------------
            # Get actual user
            # -----------------------------------------------

            db = SessionLocal()

            try:

                winner = (
                    db.query(models.User)
                    .filter(
                        models.User.id
                        == winner_id
                    )
                    .first()
                )

            finally:

                db.close()


            # -----------------------------------------------
            # Reset state
            # -----------------------------------------------

            current["votes"].clear()

            current["scores"].clear()

            current["frames"] = 0


            if winner:

                return (
                    winner,
                    average_score
                )


        # ----------------------------------------------------
        # No reliable winner
        # ----------------------------------------------------

        current["votes"].clear()

        current["scores"].clear()

        current["frames"] = 0


    # --------------------------------------------------------
    # Still collecting votes
    # --------------------------------------------------------

    return None, score