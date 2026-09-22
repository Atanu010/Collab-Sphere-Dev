# CollabSphere

A real-time collaboration platform designed for teams to communicate, organize workspaces, and collaborate through channels and direct messages.

CollabSphere combines workspace-based communication with real-time messaging, presence, notifications, file sharing, and role-based access control in a single web application.

---

## ✨ Features

### 🔐 Authentication & User Management

- User registration and login
- JWT-based authentication
- HTTP-only authentication cookies
- Bearer-token authentication support
- Password hashing with bcrypt
- User profile management
- Account settings
- Protected application routes

### 🏢 Workspaces

- Create and manage workspaces
- Workspace membership
- Workspace roles and permissions
- Admin, moderator, and member access levels
- Member invitations
- Member removal
- Role management
- Online member presence

### 💬 Channels

- Public channels
- Private channels
- Channel access control
- Create, update, and delete channels
- Channel-based team communication
- Unread message tracking

### 💌 Direct Messaging

- Direct messages between users
- Conversation history
- Message pagination
- Global direct-message navigation

### ⚡ Real-Time Collaboration

CollabSphere uses WebSockets for real-time communication.

Real-time functionality includes:

- Instant message delivery
- Online/offline presence
- Presence snapshots
- Typing indicators
- Read receipts
- Real-time notifications
- WebSocket connection health checks

### 🔎 Messaging

- Message history
- Paginated conversations
- Message search
- `@username` mentions
- Read receipts
- File attachments

### 📁 File Sharing

- Upload files within the collaboration environment
- File metadata management
- File downloads
- Workspace file listing
- Upload size validation

### 🔔 Notifications

- Real-time notifications
- Unread notification count
- Mark individual notifications as read
- Mark all notifications as read

### ⚙️ Profile & Settings

- Profile management
- Application settings
- User-specific configuration

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │      CollabSphere    │
                         │     React Frontend   │
                         └──────────┬───────────┘
                                    │
                         HTTP / REST API
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      FastAPI         │
                         │      Backend        │
                         └───────┬───────┬──────┘
                                 │       │
                         MongoDB │       │ WebSocket
                                 │       │
                                 ▼       ▼
                         ┌──────────┐  ┌──────────────┐
                         │ MongoDB  │  │ Real-Time    │
                         │ Database │  │ Collaboration│
                         └──────────┘  └──────────────┘
