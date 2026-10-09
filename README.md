# Smart Attendance System

<p align="center">

  <h1 align="center">Smart Attendance System</h1>

  <p align="center">
    AI-powered attendance management platform using face recognition, role-based access control, FastAPI, Next.js, PostgreSQL, pgvector and Docker.
  </p>

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#ai-face-recognition">AI Face Recognition</a> •
    <a href="#authentication--authorization">Authentication</a> •
    <a href="#database-architecture">Database</a> •
    <a href="#installation">Installation</a> •
    <a href="#deployment">Deployment</a>
  </p>

</p>

---

# 📌 Overview

The **Smart Attendance System** is a full-stack, AI-powered attendance management platform designed for educational organizations such as schools, colleges and training institutions.

The system replaces traditional manual attendance workflows with an automated platform where authorized users can create events, organize students into groups, enroll face data and take attendance using a camera.

The platform combines:

- Artificial Intelligence
- Computer Vision
- Face Recognition
- Vector Embeddings
- REST APIs
- Role-Based Access Control
- JWT Authentication
- PostgreSQL
- pgvector
- Next.js
- React
- FastAPI
- Docker
- Nginx
- HTTPS
- Linux server deployment

The application provides different portals for:

- Product Owner
- Administrator
- Teacher
- Student

Each role receives different capabilities according to its responsibilities and assigned permissions.

---

# 🎯 Problem Statement

Traditional attendance systems often require:

- Manual student selection
- Paper-based attendance
- Manual data entry
- Time-consuming attendance processing
- Difficulty maintaining attendance history
- Limited access control
- Difficult attendance reporting
- Possibility of incorrect attendance marking

The Smart Attendance System addresses these problems by providing an integrated platform where:

1. Administrators manage students, teachers and groups.
2. Teachers manage their assigned groups and events.
3. Authorized users can capture students through a camera.
4. AI-based face recognition identifies enrolled students.
5. Attendance is automatically recorded.
6. Attendance status is calculated according to event timing.
7. Students can view their own attendance.
8. Access is controlled through authentication, roles and permissions.

---

# ✨ Features

## 🔐 Authentication

- JWT-based authentication
- Secure password hashing
- Login/logout workflow
- Authenticated API requests
- Password change workflow
- Temporary password support
- Forced password change after reset
- Role information inside authentication context

---

## 👥 Role-Based Access Control

The system supports multiple user roles:

```text
                    Product Owner
                         │
                         ▼
                       Admin
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
           Teacher               Student
              │
              ▼
       Events / Groups
              │
              ▼
          Attendance
---

## 🏗️ High-Level Architecture

```text

                              INTERNET
                                  │
                                  ▼
                         ┌─────────────────┐
                         │      Nginx      │
                         │ Reverse Proxy   │
                         │  HTTPS / SSL    │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
             ┌──────────────┐            ┌──────────────┐
             │   Next.js    │            │   FastAPI    │
             │   Frontend   │◄──────────►│   Backend    │
             │ React/TS     │    HTTP    │    Python    │
             └──────────────┘            └──────┬───────┘
                                                │
                         ┌──────────────────────┼──────────────────────┐
                         │                      │                      │
                         ▼                      ▼                      ▼
                  ┌──────────────┐       ┌──────────────┐      ┌──────────────┐
                  │ PostgreSQL   │       │   pgvector   │      │ InsightFace  │
                  │ Database     │       │ Vector Store │      │ ONNX Runtime │
                  └──────────────┘       └──────────────┘      └──────────────┘

---

## 🧩 Application Architecture

```text

┌──────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│                                                              │
│  Next.js + React + TypeScript + Tailwind CSS                │
│                                                              │
│  Product Owner │ Admin │ Teacher │ Student                  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               │ HTTP / REST API
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                         BACKEND                              │
│                                                              │
│  FastAPI + Python + Pydantic + SQLAlchemy                   │
│                                                              │
│ Authentication │ Authorization │ Business Logic │ APIs      │
└───────────────┬─────────────────────┬────────────────────────┘
                │                     │
                │                     │
                ▼                     ▼
       ┌─────────────────┐    ┌────────────────────┐
       │   PostgreSQL    │    │    AI / CV Layer   │
       │                 │    │                    │
       │ Users           │    │ InsightFace        │
       │ Organizations   │    │ ONNX Runtime       │
       │ Groups          │    │ OpenCV             │
       │ Events          │    │ Face Embeddings    │
       │ Attendance      │    │                    │
       └────────┬────────┘    └─────────┬──────────┘
                │                       │
                │                       │
                └───────────┬───────────┘
                            ▼
                     ┌──────────────┐
                     │   pgvector   │
                     │  512D Vector │
                     └──────────────┘

---





