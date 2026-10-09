# Smart Attendance System

> AI-powered, role-based attendance management platform built with Next.js, React, TypeScript, FastAPI, PostgreSQL, pgvector, InsightFace, ONNX Runtime, OpenCV, Docker, Nginx, and HTTPS.

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [Key Features](#key-features)
- [User Roles and Permissions](#user-roles-and-permissions)
- [System Architecture](#system-architecture)
- [Application Architecture](#application-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [AI Face Recognition Architecture](#ai-face-recognition-architecture)
- [Docker Architecture](#docker-architecture)
- [Project Structure](#project-structure)

---

# Overview

The **Smart Attendance System** is a full-stack AI-powered attendance management platform designed for educational organizations such as schools, colleges, universities, and training institutions.

The system combines traditional enterprise application functionality with computer vision and face recognition to automate attendance.

Instead of manually selecting students and marking attendance, authorized users can use a camera to recognize enrolled students and automatically record attendance against an active event.

The platform provides separate portals and permissions for:

- Product Owner
- Administrator
- Teacher
- Student

The system is designed around organization-level isolation, role-based access control, event/group management, AI-powered face recognition, attendance analytics, and production deployment using Docker.

---

# Problem Statement

Traditional attendance systems often involve:

- Manual attendance marking
- Paper-based records
- Manual student selection
- Time-consuming attendance processing
- Duplicate data entry
- Difficulty maintaining attendance history
- Limited access control
- Difficulty generating reports
- Possibility of incorrect attendance records

The Smart Attendance System addresses these problems through an integrated digital platform.

The system allows administrators and teachers to:

1. Manage students and teachers.
2. Create and manage groups.
3. Create attendance events.
4. Assign teachers and groups to events.
5. Enroll student face data.
6. Capture faces using a camera.
7. Recognize students using AI.
8. Automatically calculate attendance status.
9. Store attendance in PostgreSQL.
10. View and download attendance reports.

Students receive a separate read-only portal where they can view their assigned groups, events, and attendance.

---

# Objectives

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
- Provide separate portals for different roles.
- Deploy the complete application using Docker.
- Support production deployment through Nginx and HTTPS.

---

# Key Features

## Authentication

- JWT-based authentication
- Secure password hashing
- Login and authentication flow
- Token-based API authorization
- Password change workflow
- Temporary password support
- Forced password change after password reset

## Authorization

- Role-Based Access Control
- Permission-based authorization
- Organization-level access control
- Backend authorization
- Role-specific dashboards
- Role-specific navigation

## Organization Management

- Organization/school management
- Administrator management
- Administrator permissions
- Administrator activation/deactivation

## User Management

- Student management
- Teacher management
- Administrator management
- User activation/deactivation
- Password reset
- Temporary passwords

## Group Management

- Create groups
- Manage groups
- Assign students to groups
- Assign teachers to groups
- Organization-scoped groups

## Event Management

- Create events
- Manage events
- Assign groups to events
- Assign teachers to events
- Event-based attendance

## AI Face Recognition

- Face detection
- Face recognition
- Face embeddings
- 512-dimensional face vectors
- ONNX-based inference
- InsightFace
- OpenCV
- Vector storage using pgvector

## Attendance

- Camera-based attendance
- AI-based student identification
- Present status
- Late status
- Absent status
- Attendance statistics
- Attendance percentage
- Attendance viewing
- Attendance modification according to permissions
- Attendance download

## Deployment

- Docker
- Docker Compose
- PostgreSQL container
- FastAPI container
- Next.js container
- Nginx reverse proxy
- HTTPS
- Let's Encrypt / Certbot
- Ubuntu VPS deployment

---

# User Roles and Permissions

The application follows a hierarchical access model.

```text
                         Product Owner
                              |
                              v
                            Admin
                              |
                    +---------+---------+
                    |                   |
                    v                   v
                 Teacher             Student
                    |
                    v
              Events / Groups
                    |
                    v
                Attendance

```
---

# System Architecture

```text

                                INTERNET
                                    |
                                    v
                         +---------------------+
                         |       NGINX         |
                         | Reverse Proxy / SSL |
                         +----------+----------+
                                    |
                  +-----------------+-----------------+
                  |                                   |
                  v                                   v
        +-------------------+               +-------------------+
        |     Next.js       |               |      FastAPI      |
        |     Frontend      |<------------->|      Backend      |
        | React + TypeScript|    REST API   | Python            |
        +-------------------+               +---------+---------+
                                                      |
                                  +-------------------+-------------------+
                                  |                   |                   |
                                  v                   v                   v
                         +----------------+   +----------------+   +----------------+
                         |  PostgreSQL    |   |    pgvector    |   |  InsightFace   |
                         |   Database     |   | Vector Storage  |   | ONNX Runtime   |
                         +----------------+   +----------------+   +----------------+

```
---

# Application Architecture

```text

+------------------------------------------------------------+
|                         FRONTEND                           |
|                                                            |
| Next.js + React + TypeScript + Tailwind CSS               |
|                                                            |
| Product Owner | Admin | Teacher | Student                 |
+------------------------------+-----------------------------+
                               |
                               | HTTP / REST API
                               v
+------------------------------------------------------------+
|                         BACKEND                            |
|                                                            |
| FastAPI + Python + Pydantic + SQLAlchemy                  |
|                                                            |
| Authentication | Authorization | Business Logic | APIs   |
+----------------------+-------------------+-----------------+
                       |                   |
                       v                   v
             +----------------+   +------------------------+
             |   PostgreSQL   |   |      AI / CV Layer     |
             |                |   |                        |
             | Users          |   | InsightFace             |
             | Organizations  |   | ONNX Runtime            |
             | Groups         |   | OpenCV                  |
             | Events         |   | Face Embeddings         |
             | Attendance     |   |                        |
             +----------------+   +-----------+------------+
                                             |
                                             v
                                      +--------------+
                                      |   pgvector   |
                                      |  Vector(512) |
                                      +--------------+


```
---

# Frontend Architecture

```text

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
---

# Backend Architecture

```text

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
---

# AI Face Recognition Architecture

```text

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
                       Model
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
                 Similarity / Score
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
---


# Docker Architecture

```text

                         Docker Compose
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
       +-------------+ +-------------+ +-------------+
       | PostgreSQL  | |   FastAPI   | |   Next.js   |
       | + pgvector  | |   Backend   | |  Frontend   |
       +-------------+ +-------------+ +-------------+

```
---


# Project Structure

```text

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
│   │   │
│   │   ├── schemas/
│   │   │
│   │   ├── services/
│   │   │
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   └── main.py
│   │
│   ├── models/
│   │
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
│   │
│   ├── lib/
│   │   └── api.ts
│   │
│   ├── public/
│   │
│   ├── Dockerfile
│   ├── package.json
│   └── ...
│
├── docker-compose.yml
├── .gitignore
└── README.md

```



