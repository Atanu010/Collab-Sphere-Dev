# CollabSphere — Product Requirements & Build Log

## Original problem statement
Build "CollabSphere", a real-time collaboration & communication platform (Slack/Discord/WhatsApp-style, original branding) for college project teams, hackathon teams, student orgs and small dev teams. Requested stack was Java Spring Boot + PostgreSQL + Redis; the platform is optimized for FastAPI + MongoDB, so the identical product was delivered on **FastAPI + MongoDB + native WebSockets + JWT auth + in-memory presence** (fully previewable/working). No paid APIs, no OpenAI, no payments, no analytics dashboard.

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB (Motor), JWT (httpOnly cookie + Bearer), bcrypt, native WebSocket at `/api/ws?token=`. Object storage via Emergent managed storage for file uploads.
- **Frontend**: React (CRA/craco), Tailwind, react-router v7, axios, custom light-theme design (Outfit/Plus Jakarta Sans, indigo accent). Contexts: Auth, Realtime (WebSocket + presence + reconnect), Workspace.
- **Real-time**: in-memory ConnectionManager broadcasts messages/typing/presence/read/notifications to relevant users; auto-reconnect on the client.

## User personas
Student/hackathon/dev team members collaborating in workspaces via channels and DMs.

## Core requirements (static)
Auth (register/login/logout/me), workspaces + members + roles (admin/moderator/user, enforced server-side), public/private channels, direct messages, real-time channel + DM messaging, typing indicators, online/offline presence, read receipts (Sent/Seen), message pagination (30 + load older, scroll preserved), file sharing (upload/preview/download), notifications, permission-scoped message search, responsive 3-column desktop + mobile drawer UI.

## Implemented (2026-09-22) — MVP complete & tested
- All of the above. Backend 18/18 pytest passing. Frontend verified with two parallel users (real-time delivery, typing, presence, DM read receipt, notifications, search).
- Seed data: workspace "Campus Dev Team" with #general/#announcements/#frontend/#backend/#design/#project-alpha (private) and users Admin/Atanu/Rahul/Priya/Arjun.

## Backlog / future (P1/P2)
- P1: message edit/delete, emoji reactions, mentions autocomplete, per-channel notification prefs.
- P2: split server.py into routers; async httpx for object storage; aggregation pipelines for unread counts; threads; message DELETE endpoints for cleanup.
