# CollabSphere

> A full-stack, real-time collaboration platform built with React, FastAPI, MongoDB, WebSockets, JWT authentication, and Docker — deployed as a production web service on Render.

[![Live Demo](https://img.shields.io/badge/Live-Demo-46E3B7?style=for-the-badge)](https://collabsphere-oq5z.onrender.com)
[![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Real--Time](https://img.shields.io/badge/Real--Time-WebSockets-000000?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
[![Deployment](https://img.shields.io/badge/Deployment-Docker%20%2B%20Render-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

## Overview

**CollabSphere** is a full-stack real-time collaboration platform designed to demonstrate how a modern web application can combine a responsive frontend, asynchronous backend services, persistent database storage, authentication, and real-time communication into a single production-oriented system.

The application uses **React** for the frontend and **FastAPI** for the backend, with **MongoDB Atlas** providing persistent data storage.

Real-time functionality is implemented using **WebSockets**, allowing the application to maintain persistent communication between clients and the backend.

The application is containerized using **Docker** and deployed as a **Docker Web Service on Render**.

The frontend and backend are served through the same production domain, providing a simple deployment architecture while also avoiding unnecessary cross-origin complexity.

---

## Live Application

### 🌐 Live Demo

**https://collabsphere-oq5z.onrender.com**

The production deployment has been tested for:

- Homepage availability
- React application loading
- Static asset delivery
- API availability
- SPA client-side routing
- Deep-link routing
- Authentication middleware
- MongoDB connectivity
- WebSocket endpoint availability

---

# Features

## Frontend

- React-based Single Page Application
- Client-side routing
- Responsive application interface
- Production React bundle
- Static asset serving
- SPA deep-link support
- Same-origin communication with the backend

## Backend

- FastAPI REST API
- Python 3.11 runtime
- Structured API architecture
- Authentication middleware
- Protected API routes
- JSON-based API responses
- WebSocket support
- MongoDB integration

## Authentication

CollabSphere includes authentication infrastructure based around:

- JWT authentication
- Authentication middleware
- Protected API endpoints
- User authentication state
- `/api/auth/me` authentication verification endpoint

An unauthenticated request to the protected authentication endpoint correctly returns:

```text
HTTP 401 Unauthorized
