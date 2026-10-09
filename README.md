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
- [Attendance Workflow](#attendance-workflow)
- [Authentication and Authorization](#authentication-and-authorization)
- [Password Management](#password-management)
- [Database Architecture](#database-architecture)
- [Entity Relationships](#entity-relationships)
- [Event and Group Architecture](#event-and-group-architecture)
- [API Architecture](#api-architecture)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Docker Architecture](#docker-architecture)
- [Production Deployment Architecture](#production-deployment-architecture)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Data and Privacy](#data-and-privacy)
- [Attendance Reporting](#attendance-reporting)
- [Application Workflows](#application-workflows)
- [Development Guidelines](#development-guidelines)
- [Future Improvements](#future-improvements)
- [Learning Outcomes](#learning-outcomes)
- [Author](#author)
- [License](#license)

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
