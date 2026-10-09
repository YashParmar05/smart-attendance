# Smart Attendance System

> An AI-powered, role-based attendance management platform that uses face recognition to automate student attendance, manage events and groups, and provide separate portals for Product Owners, Administrators, Teachers, and Students.

---

## 📌 Overview

The Smart Attendance System is a full-stack attendance management platform designed for schools and educational organizations.

The system combines:

- AI-based face recognition
- Role-Based Access Control (RBAC)
- JWT authentication
- Event and group management
- Automated attendance marking
- Student/teacher/admin management
- PostgreSQL database
- Vector embeddings using pgvector
- Docker containerization
- Nginx reverse proxy
- HTTPS production deployment

Instead of manually selecting students and marking attendance, authorized users can use a camera to recognize students and automatically record their attendance.

---

# ✨ Key Features

## 🤖 AI-Based Face Recognition

- Face detection using InsightFace / ONNX Runtime
- Face embedding generation
- 512-dimensional face embeddings
- Stored embeddings for enrolled users
- Face similarity/confidence-based identification
- Camera-based attendance recognition

### Recognition Pipeline

```text
Camera
   │
   ▼
Face Detection
   │
   ▼
Face Processing
   │
   ▼
Face Embedding
   │
   ▼
512-Dimensional Vector
   │
   ▼
Vector / Similarity Comparison
   │
   ▼
Identity Recognition
   │
   ▼
Attendance Marking
```


# 🔐 Authentication & Authorization

```text
User
 │
 ▼
Login
 │
 ▼
FastAPI Authentication API
 │
 ▼
Credentials Verification
 │
 ▼
JWT Access Token
 │
 ▼
Frontend
 │
 ▼
Authenticated Requests

```


# 👥 User Roles

```text
                    Product Owner
                         │
                         ▼
                       Admin
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
           Teacher                Student
              │
              ▼
        Events / Groups
              │
              ▼
          Attendance

```
# 🏗️ System Architecture

```text


                         Internet
                            │
                            ▼
                     ┌─────────────┐
                     │    Nginx    │
                     │ Reverse     │
                     │ Proxy + SSL │
                     └──────┬──────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       ┌──────────────┐           ┌──────────────┐
       │   Next.js    │           │   FastAPI    │
       │   Frontend   │ ────────► │   Backend    │
       └──────────────┘           └──────┬───────┘
                                         │
                         ┌───────────────┼───────────────┐
                         │               │               │
                         ▼               ▼               ▼
                  ┌────────────┐  ┌────────────┐  ┌─────────────┐
                  │ PostgreSQL │  │  pgvector  │  │ InsightFace │
                  │            │  │            │  │ ONNXRuntime │
                  └────────────┘  └────────────┘  └─────────────┘

```
