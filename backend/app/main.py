from fastapi import FastAPI
from app.routes.auth import router as auth_router
from app.database import engine, Base
from app import models

from fastapi.middleware.cors import CORSMiddleware

from app.routes.organizations import router as organization_router
from app.routes.users import router as user_router
from app.routes.attendance import router as attendance_router
from app.routes.face import router as face_router
from app.routes.groups import router as group_router
from app.routes.events import router as event_router
from app.routes import admin

from app.routes.product_owner import router as product_owner_router
from app.routes.teacher import router as teacher_router
from app.routes.student import router as student_router

# Create database tables
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Smart Attendance API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(organization_router)
app.include_router(user_router)
app.include_router(auth_router)
app.include_router(attendance_router)
app.include_router(face_router)
app.include_router(group_router)
app.include_router(event_router)
app.include_router(product_owner_router)
app.include_router(admin.router)
app.include_router(teacher_router)
app.include_router(student_router)


@app.get("/")
def root():
    return {
        "message": "Smart Attendance API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }