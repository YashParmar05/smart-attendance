# Smart Attendance System

> AI-powered, role-based attendance management platform built with Next.js, React, TypeScript, FastAPI, PostgreSQL, pgvector, InsightFace, ONNX Runtime, OpenCV, Docker, Nginx, and HTTPS.

---

## Table of Contents

<!-- Table of Contents -->
<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#problem-statement">Problem Statement</a> •
  <a href="#objectives">Objectives</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#user-roles-and-permissions">User Roles and Permissions</a> •
  <a href="#system-architecture">System Architecture</a> •
  <a href="#application-architecture">Application Architecture</a> •
  <a href="#frontend-architecture">Frontend Architecture</a> •
  <a href="#backend-architecture">Backend Architecture</a> •
  <a href="#ai-face-recognition-architecture">AI Face Recognition Architecture</a> •
  <a href="#docker-architecture">Docker Architecture</a> •
  <a href="#project-structure">Project Structure</a>
</p>

---

## Overview

The **Smart Attendance System** is a full-stack, AI-powered attendance management platform designed for educational organizations such as schools, colleges, universities, and training institutions.

The system combines traditional enterprise application functionality with computer vision and face recognition to automate attendance.

Instead of manually selecting students and marking attendance, authorized users can use a camera to recognize enrolled students and automatically record attendance for an active event.

The platform provides separate portals and permissions for:

- Product Owner
- Administrator
- Teacher
- Student

The system is designed around organization-level isolation, role-based access control, event and group management, AI-powered face recognition, attendance analytics, and production deployment using Docker.

---

## Problem Statement

Traditional attendance systems often involve:

- Manual attendance marking
- Paper-based records
- Manual student selection
- Time-consuming attendance processing
- Duplicate data entry
- Difficulty maintaining attendance history
- Limited access control
- Difficulty generating reports
- The possibility of incorrect attendance records

The Smart Attendance System addresses these challenges through an integrated digital platform.

The system allows administrators and teachers to:

1. Manage students and teachers.
2. Create and manage groups.
3. Create attendance events.
4. Assign teachers and groups to events.
5. Enroll students' facial data.
6. Capture faces using a camera.
7. Recognize students using AI.
8. Automatically determine attendance status according to configured rules.
9. Store attendance records in PostgreSQL.
10. View and download attendance reports.

Students receive a separate, read-only portal where they can view their assigned groups, events, and attendance records.

---

## Objectives

The major objectives of the project are:

- Automate attendance using AI-based face recognition.
- Provide centralized attendance management.
- Implement secure authentication.
- Implement role-based access control.
- Implement permission-based authorization.
- Support multiple organizations.
- Manage students, teachers, groups, and events.
- Store face embeddings securely.
- Store attendance records reliably.
- Provide separate portals for different user roles.
- Deploy the complete application using Docker.
- Support production deployment through Nginx and HTTPS.

---

## Key Features

### Authentication

- JWT-based authentication
- Secure password hashing
- Login and authentication workflows
- Token-based API authorization
- Password change workflow
- Temporary password support
- Forced password change after a password reset, where configured

### Authorization

- Role-Based Access Control (RBAC)
- Permission-based authorization
- Organization-level access control
- Backend-enforced authorization
- Role-specific dashboards
- Role-specific navigation

### Organization Management

- Organization and school management
- Administrator management
- Administrator permission management
- Administrator activation and deactivation

### User Management

- Student management
- Teacher management
- Administrator management
- User activation and deactivation
- Password reset
- Temporary password management

### Group Management

- Create groups
- Manage groups
- Assign students to groups
- Assign teachers to groups
- Organization-scoped groups

### Event Management

- Create events
- Manage events
- Assign groups to events
- Assign teachers to events
- Event-based attendance tracking

### AI Face Recognition

- Face detection
- Face recognition
- Face embeddings
- 512-dimensional face vectors
- ONNX-based inference
- InsightFace integration
- OpenCV integration
- Vector storage using pgvector

### Attendance Management

- Camera-based attendance
- AI-based student identification
- Present, late, and absent statuses
- Attendance statistics
- Attendance percentage calculations
- Attendance record viewing
- Permission-controlled attendance modification
- Attendance report downloads

### Deployment

- Docker
- Docker Compose
- PostgreSQL container
- FastAPI container
- Next.js container
- Nginx reverse proxy
- HTTPS configuration
- Let's Encrypt and Certbot
- Ubuntu VPS deployment

---

## User Roles and Permissions

The application follows a hierarchical access model with permissions enforced by the backend.

```
                       Product Owner
                            |
                            v
                     Administrator
                            |
                 +----------+----------+
                 |                     |
                 v                     v
              Teacher               Student
                 |
                 v
           Events / Groups
                 |
                 v
             Attendance
```

Each role has access to specific features and resources according to its assigned permissions. Organization-level restrictions prevent users from accessing resources outside their authorized scope.

---

## System Architecture

```
                         INTERNET
                             |
                             v
                  +----------------------+
                  |        NGINX         |
                  | Reverse Proxy / SSL  |
                  +----------+-----------+
                             |
               +-------------+-------------+
               |                           |
               v                           v
      +------------------+       +------------------+
      |     Next.js      |       |     FastAPI      |
      |     Frontend     |<----->|     Backend      |
      | React + TypeScript| REST | Python           |
      +------------------+  API  +--------+---------+
                                         |
                         +---------------+---------------+
                         |               |               |
                         v               v               v
                +----------------+ +------------+ +----------------+
                |  PostgreSQL    | |  pgvector  | |   AI / CV      |
                |  Relational DB | | Face Vector| | InsightFace    |
                |                | |  Storage   | | ONNX Runtime   |
                +----------------+ +------------+ | OpenCV         |
                                                  +----------------+
```

### Architecture Components

- **Nginx:** Reverse proxy and HTTPS termination.
- **Next.js:** Frontend application and user interface.
- **FastAPI:** Backend API, authentication, authorization, and business logic.
- **PostgreSQL:** Relational data storage for users, organizations, groups, events, and attendance records.
- **pgvector:** Storage and similarity search for face embeddings.
- **InsightFace:** Face analysis and embedding generation.
- **ONNX Runtime:** Model inference.
- **OpenCV:** Image processing and camera-frame handling.

The frontend communicates with the backend through REST APIs. The backend manages database operations and coordinates AI-based face recognition workflows.

---

## Application Architecture

```
+------------------------------------------------------------+
|                         FRONTEND                           |
|                                                            |
|       Next.js + React + TypeScript + Tailwind CSS          |
|                                                            |
|  Product Owner | Administrator | Teacher | Student         |
+------------------------------+-----------------------------+
                               |
                               | HTTP / REST API
                               v
+------------------------------------------------------------+
|                         BACKEND                            |
|                                                            |
|           FastAPI + Python + Pydantic + SQLAlchemy         |
|                                                            |
| Authentication | Authorization | Business Logic | APIs    |
+----------------------+-------------------+-----------------+
                       |                   |
                       v                   v
             +----------------+  +---------------------------+
             |   PostgreSQL   |  |       AI / CV Layer       |
             |                |  |                           |
             | Users          |  | InsightFace               |
             | Organizations  |  | ONNX Runtime              |
             | Groups         |  | OpenCV                    |
             | Events         |  | Face Embeddings           |
             | Attendance     |  |                           |
             +----------------+  +-------------+-------------+
                                              |
                                              v
                                    +------------------+
                                    |     pgvector     |
                                    |   Vector(512)    |
                                    +------------------+
```

The application is divided into frontend, backend, database, and AI/computer vision layers. Each layer has a defined responsibility, helping keep the system maintainable and extensible.

---

## Frontend Architecture

```
       User Interaction
              |
              v
       React Component
              |
              v
        API Utility Layer
              |
              v
        HTTP Request
              |
              v
        FastAPI Backend
              |
              v
           Response
              |
              v
          React State
              |
              v
          Updated UI
```

The frontend is built with Next.js, React, and TypeScript. It provides role-specific dashboards, forms, navigation, attendance interfaces, and API integration.

The API utility layer handles communication with the FastAPI backend. API responses update the application state and user interface.

---

## Backend Architecture

```
        HTTP Request
              |
              v
         FastAPI Router
              |
              v
       Authentication
              |
              v
       Authorization
              |
              v
     Pydantic Validation
              |
              v
       Business Logic
              |
              v
          SQLAlchemy
              |
              v
          PostgreSQL
              |
              v
        HTTP Response
```

The backend is built with FastAPI and Python. It handles API routing, authentication, authorization, request validation, business logic, and database operations.

SQLAlchemy manages database interactions, while Pydantic validates incoming data and structures API responses.

Face recognition requests are processed through the AI/computer vision services as required.

---

## AI Face Recognition Architecture

```
              Camera
                 |
                 v
             Image Frame
                 |
                 v
           Face Detection
                 |
                 v
          Face Processing
                 |
                 v
         Face Recognition
                 |
                 v
          Face Embedding
                 |
                 v
       512-Dimensional Vector
                 |
                 v
          Vector Comparison
                 |
                 v
          Similarity Score
                 |
                 v
          Student Identity
                 |
                 v
       Attendance Validation
                 |
                 v
          Attendance Record
```

The AI face recognition pipeline processes camera frames to detect faces and generate facial embeddings using the configured recognition model.

The generated embeddings are compared with enrolled face embeddings stored in pgvector. When a match satisfies the configured recognition threshold, the system identifies the student and proceeds with attendance validation.

Attendance is recorded only after the backend verifies the relevant event, student eligibility, permissions, and attendance rules.

**Note:** Face matching thresholds, duplicate attendance prevention, and any liveness or anti-spoofing checks should be configured and validated according to the application's security requirements.

---

## Docker Architecture

```
                    Docker Compose
                          |
            +-------------+-------------+
            |             |             |
            v             v             v
      +-------------+ +-----------+ +-----------+
      | PostgreSQL  | |  FastAPI  | |  Next.js  |
      | + pgvector  | |  Backend  | | Frontend  |
      +-------------+ +-----------+ +-----------+
```

Docker Compose manages the application's containerized services, including PostgreSQL with pgvector, the FastAPI backend, and the Next.js frontend.

Nginx can be deployed as an additional service or configured separately as the reverse proxy for HTTPS and external traffic routing.

Persistent volumes, environment variables, service health checks, and database backups should be configured appropriately for production deployments.

---

## Project Structure

```
smart-attendance/
│
├── backend/
│   │
│   ├── app/
│   │   │
│   │   ├── routes/
│   │   │   ├── admin.py
│   │   │   ├── attendance.py
│   │   │   ├── auth.py
│   │   │   ├── event.py
│   │   │   ├── face.py
│   │   │   ├── group.py
│   │   │   ├── organization.py
│   │   │   ├── product_owner.py
│   │   │   ├── student.py
│   │   │   ├── teacher.py
│   │   │   └── ...
│   │   │
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   └── main.py
│   │
│   ├── models/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   │
│   ├── app/
│   │   │
│   │   ├── (app)/
│   │   │   ├── product-owner/
│   │   │   ├── students/
│   │   │   ├── teachers/
│   │   │   ├── groups/
│   │   │   ├── events/
│   │   │   ├── attendance/
│   │   │   └── ...
│   │   │
│   │   ├── login/
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   ├── lib/
│   │   └── api.ts
│   │
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── ...
│
├── docker-compose.yml
├── .gitignore
└── README.md
```


---

## Conclusion

The Smart Attendance System integrates modern web technologies, relational data management, vector search, and AI-powered face recognition to simplify attendance management for educational organizations.

Its modular architecture supports role-specific interfaces, organization-level access control, event-based attendance, and containerized deployment. With appropriate security controls, testing, monitoring, and operational practices, the platform can be adapted for production use.
