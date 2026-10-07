import cv2


class FaceRecognitionService:

    def __init__(self):
        self.camera = None

    def start_camera(self):
        self.camera = cv2.VideoCapture(0)

        if not self.camera.isOpened():
            raise RuntimeError("Could not open webcam")

    def capture_frame(self):
        if self.camera is None:
            raise RuntimeError("Camera is not started")

        success, frame = self.camera.read()

        if not success:
            raise RuntimeError("Could not read camera frame")

        return frame

    def stop_camera(self):
        if self.camera:
            self.camera.release()
            self.camera = None