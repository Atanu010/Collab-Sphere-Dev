from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import (
    FastAPI, APIRouter, HTTPException, Request, Response, Depends,
    UploadFile, File, Form, WebSocket, WebSocketDisconnect, Query,
)
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Set
from datetime import datetime, timezone, timedelta
import logging
import uuid
import re
import jwt
import bcrypt
import requests

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_DAYS = 7

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB
APP_NAME = "collabsphere"

# MongoDB GridFS object storage
gridfs_bucket = AsyncIOMotorGridFSBucket(db)


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    import io

    file_id = await gridfs_bucket.upload_from_stream(
        path,
        io.BytesIO(data),
        metadata={"contentType": content_type},
    )

    return {"path": str(file_id)}


async def get_object(path: str):
    from bson import ObjectId

    file_id = ObjectId(path)

    stream = await gridfs_bucket.open_download_stream(file_id)
    data = await stream.read()

    metadata = stream.metadata or {}
    content_type = metadata.get(
        "contentType",
        "application/octet-stream",
    )

    return data, content_type

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("collabsphere")

app = FastAPI(title="CollabSphere API")
api = APIRouter(prefix="/api")

AVATAR_COLORS = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def public_user(user: dict) -> dict:
    if not user:
        return None
    return {
        "id": user["_id"],
        "name": user.get("name"),
        "email": user.get("email"),
        "avatarColor": user.get("avatar_color", "#4F46E5"),
        "avatarUrl": user.get("avatar_url"),
        "status": user.get("status", "active"),
        "title": user.get("title", ""),
        "online": user["_id"] in manager.online_user_ids(),
    }


async def get_token_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token


async def get_current_user(request: Request) -> dict:
    token = await get_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"_id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=TOKEN_EXPIRY_DAYS * 86400, path="/",
    )


# ---------------------------------------------------------------------------
# Authorization helpers
# ---------------------------------------------------------------------------
async def get_membership(workspace_id: str, user_id: str) -> Optional[dict]:
    return await db.workspace_members.find_one({"workspace_id": workspace_id, "user_id": user_id})


async def require_membership(workspace_id: str, user_id: str) -> dict:
    m = await get_membership(workspace_id, user_id)
    if not m:
        raise HTTPException(status_code=403, detail="You are not a member of this workspace")
    return m


async def require_role(workspace_id: str, user_id: str, roles: List[str]) -> dict:
    m = await require_membership(workspace_id, user_id)
    if m["role"] not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return m


async def can_access_channel(channel: dict, user_id: str) -> bool:
    m = await get_membership(channel["workspace_id"], user_id)
    if not m:
        return False
    if not channel.get("is_private"):
        return True
    if m["role"] == "admin":
        return True
    cm = await db.channel_members.find_one({"channel_id": channel["_id"], "user_id": user_id})
    return cm is not None


async def channel_recipient_ids(channel: dict) -> List[str]:
    if channel.get("is_private"):
        members = await db.channel_members.find({"channel_id": channel["_id"]}).to_list(1000)
        return [m["user_id"] for m in members]
    members = await db.workspace_members.find({"workspace_id": channel["workspace_id"]}).to_list(5000)
    return [m["user_id"] for m in members]


# ---------------------------------------------------------------------------
# WebSocket connection manager (in-memory presence + typing)
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, Set[WebSocket]] = {}

    def online_user_ids(self) -> Set[str]:
        return set(self.connections.keys())

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> bool:
        conns = self.connections.get(user_id)
        if not conns:
            return False
        conns.discard(ws)
        if not conns:
            self.connections.pop(user_id, None)
            return True  # went fully offline
        return False

    async def send_to_users(self, user_ids: List[str], message: dict):
        for uid in set(user_ids):
            for ws in list(self.connections.get(uid, [])):
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    async def broadcast_all(self, message: dict):
        for uid in list(self.connections.keys()):
            for ws in list(self.connections.get(uid, [])):
                try:
                    await ws.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Pydantic request models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class WorkspaceBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = ""


class ChannelBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: Optional[str] = ""
    isPrivate: bool = False


class ChannelUpdateBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class InviteBody(BaseModel):
    email: EmailStr
    role: str = "user"


class RoleBody(BaseModel):
    role: str


class MessageBody(BaseModel):
    content: str = ""
    attachments: List[str] = []


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = new_id()
    idx = len(await db.users.find().to_list(1000)) % len(AVATAR_COLORS)
    doc = {
        "_id": uid, "name": body.name.strip(), "email": email,
        "password_hash": hash_password(body.password),
        "avatar_color": AVATAR_COLORS[idx], "avatar_url": None,
        "status": "active", "title": "", "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(uid, email)
    set_auth_cookie(response, token)
    return {"user": public_user(doc), "token": token}


@api.post("/auth/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["_id"], email)
    set_auth_cookie(response, token)
    return {"user": public_user(user), "token": token}


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/", samesite="none", secure=True)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


class ProfileBody(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None


@api.patch("/auth/profile")
async def update_profile(body: ProfileBody, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return {"user": public_user(fresh)}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@api.get("/users/search")
async def search_users(q: str = "", user: dict = Depends(get_current_user)):
    query = {"email": {"$ne": user["email"]}}
    if q:
        query["$or"] = [
            {"name": {"$regex": re.escape(q), "$options": "i"}},
            {"email": {"$regex": re.escape(q), "$options": "i"}},
        ]
    users = await db.users.find(query).limit(20).to_list(20)
    return {"users": [public_user(u) for u in users]}


# ---------------------------------------------------------------------------
# Workspaces
# ---------------------------------------------------------------------------
@api.get("/workspaces")
async def list_workspaces(user: dict = Depends(get_current_user)):
    memberships = await db.workspace_members.find({"user_id": user["_id"]}).to_list(1000)
    result = []
    for m in memberships:
        ws = await db.workspaces.find_one({"_id": m["workspace_id"]})
        if not ws:
            continue
        member_count = await db.workspace_members.count_documents({"workspace_id": ws["_id"]})
        unread = await workspace_unread_count(ws["_id"], user["_id"])
        last = await db.messages.find({"workspace_id": ws["_id"]}).sort("created_at", -1).limit(1).to_list(1)
        result.append({
            "id": ws["_id"], "name": ws["name"], "description": ws.get("description", ""),
            "ownerId": ws["owner_id"], "role": m["role"], "memberCount": member_count,
            "unread": unread, "lastActivity": last[0]["created_at"] if last else ws.get("created_at"),
            "createdAt": ws.get("created_at"),
        })
    result.sort(key=lambda x: x["lastActivity"] or "", reverse=True)
    return {"workspaces": result}


@api.post("/workspaces")
async def create_workspace(body: WorkspaceBody, user: dict = Depends(get_current_user)):
    wid = new_id()
    doc = {
        "_id": wid, "name": body.name.strip(), "description": (body.description or "").strip(),
        "owner_id": user["_id"], "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.workspaces.insert_one(doc)
    await db.workspace_members.insert_one({
        "_id": new_id(), "workspace_id": wid, "user_id": user["_id"],
        "role": "admin", "joined_at": now_iso(),
    })
    # default general channel
    await _create_channel(wid, user["_id"], "general", "Team-wide announcements and chatter", False)
    return {"id": wid}


@api.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, user: dict = Depends(get_current_user)):
    m = await require_membership(workspace_id, user["_id"])
    ws = await db.workspaces.find_one({"_id": workspace_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {
        "id": ws["_id"], "name": ws["name"], "description": ws.get("description", ""),
        "ownerId": ws["owner_id"], "role": m["role"], "createdAt": ws.get("created_at"),
    }


@api.delete("/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, user: dict = Depends(get_current_user)):
    ws = await db.workspaces.find_one({"_id": workspace_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if ws["owner_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete this workspace")
    chans = await db.channels.find({"workspace_id": workspace_id}).to_list(1000)
    cids = [c["_id"] for c in chans]
    await db.messages.delete_many({"workspace_id": workspace_id})
    await db.channels.delete_many({"workspace_id": workspace_id})
    await db.channel_members.delete_many({"channel_id": {"$in": cids}})
    await db.workspace_members.delete_many({"workspace_id": workspace_id})
    await db.workspaces.delete_one({"_id": workspace_id})
    return {"ok": True}


@api.get("/workspaces/{workspace_id}/members")
async def workspace_members(workspace_id: str, user: dict = Depends(get_current_user)):
    await require_membership(workspace_id, user["_id"])
    members = await db.workspace_members.find({"workspace_id": workspace_id}).to_list(5000)
    result = []
    for m in members:
        u = await db.users.find_one({"_id": m["user_id"]})
        if u:
            result.append({**public_user(u), "role": m["role"], "joinedAt": m["joined_at"]})
    online = manager.online_user_ids()
    result.sort(key=lambda x: (x["id"] not in online, x["name"].lower()))
    return {"members": result}


@api.post("/workspaces/{workspace_id}/invite")
async def invite_member(workspace_id: str, body: InviteBody, user: dict = Depends(get_current_user)):
    await require_role(workspace_id, user["_id"], ["admin"])
    invitee = await db.users.find_one({"email": body.email.lower()})
    if not invitee:
        raise HTTPException(status_code=404, detail="No user found with that email")
    if await get_membership(workspace_id, invitee["_id"]):
        raise HTTPException(status_code=400, detail="User is already a member")
    role = body.role if body.role in ("admin", "moderator", "user") else "user"
    await db.workspace_members.insert_one({
        "_id": new_id(), "workspace_id": workspace_id, "user_id": invitee["_id"],
        "role": role, "joined_at": now_iso(),
    })
    ws = await db.workspaces.find_one({"_id": workspace_id})
    await create_notification(invitee["_id"], "invite", "Added to a workspace",
                              f"You were added to {ws['name']}", {"workspaceId": workspace_id})
    return {"ok": True, "member": {**public_user(invitee), "role": role}}


@api.patch("/workspaces/{workspace_id}/members/{member_id}/role")
async def change_role(workspace_id: str, member_id: str, body: RoleBody, user: dict = Depends(get_current_user)):
    await require_role(workspace_id, user["_id"], ["admin"])
    if body.role not in ("admin", "moderator", "user"):
        raise HTTPException(status_code=400, detail="Invalid role")
    ws = await db.workspaces.find_one({"_id": workspace_id})
    if member_id == ws["owner_id"]:
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")
    await db.workspace_members.update_one(
        {"workspace_id": workspace_id, "user_id": member_id}, {"$set": {"role": body.role}})
    return {"ok": True}


@api.delete("/workspaces/{workspace_id}/members/{member_id}")
async def remove_member(workspace_id: str, member_id: str, user: dict = Depends(get_current_user)):
    ws = await db.workspaces.find_one({"_id": workspace_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if member_id != user["_id"]:
        await require_role(workspace_id, user["_id"], ["admin"])
    if member_id == ws["owner_id"]:
        raise HTTPException(status_code=400, detail="The owner cannot leave. Delete the workspace instead.")
    await db.workspace_members.delete_one({"workspace_id": workspace_id, "user_id": member_id})
    chans = await db.channels.find({"workspace_id": workspace_id}).to_list(1000)
    await db.channel_members.delete_many(
        {"channel_id": {"$in": [c["_id"] for c in chans]}, "user_id": member_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Channels
# ---------------------------------------------------------------------------
async def _create_channel(workspace_id, creator_id, name, description, is_private):
    cid = new_id()
    name = name.lstrip("#").strip().replace(" ", "-").lower()
    doc = {
        "_id": cid, "workspace_id": workspace_id, "name": name,
        "description": description or "", "is_private": is_private,
        "created_by": creator_id, "created_at": now_iso(),
    }
    await db.channels.insert_one(doc)
    if is_private:
        await db.channel_members.insert_one({
            "_id": new_id(), "channel_id": cid, "user_id": creator_id, "joined_at": now_iso()})
    return doc


async def channel_unread(channel_id, user_id) -> int:
    read = await db.message_reads.find_one({"target_id": channel_id, "user_id": user_id})
    last = read["last_read_at"] if read else "1970-01-01T00:00:00+00:00"
    return await db.messages.count_documents({
        "channel_id": channel_id, "created_at": {"$gt": last}, "sender_id": {"$ne": user_id}})


async def workspace_unread_count(workspace_id, user_id) -> int:
    chans = await db.channels.find({"workspace_id": workspace_id}).to_list(1000)
    total = 0
    for c in chans:
        if await can_access_channel(c, user_id):
            total += await channel_unread(c["_id"], user_id)
    return total


@api.get("/workspaces/{workspace_id}/channels")
async def list_channels(workspace_id: str, user: dict = Depends(get_current_user)):
    await require_membership(workspace_id, user["_id"])
    chans = await db.channels.find({"workspace_id": workspace_id}).sort("created_at", 1).to_list(1000)
    result = []
    for c in chans:
        if not await can_access_channel(c, user["_id"]):
            continue
        result.append({
            "id": c["_id"], "name": c["name"], "description": c.get("description", ""),
            "isPrivate": c.get("is_private", False), "createdBy": c.get("created_by"),
            "unread": await channel_unread(c["_id"], user["_id"]),
        })
    return {"channels": result}


@api.post("/workspaces/{workspace_id}/channels")
async def create_channel(workspace_id: str, body: ChannelBody, user: dict = Depends(get_current_user)):
    await require_role(workspace_id, user["_id"], ["admin", "moderator"])
    doc = await _create_channel(workspace_id, user["_id"], body.name, body.description, body.isPrivate)
    return {"id": doc["_id"], "name": doc["name"]}


@api.get("/channels/{channel_id}")
async def get_channel(channel_id: str, user: dict = Depends(get_current_user)):
    c = await db.channels.find_one({"_id": channel_id})
    if not c:
        raise HTTPException(status_code=404, detail="Channel not found")
    if not await can_access_channel(c, user["_id"]):
        raise HTTPException(status_code=403, detail="You cannot access this channel")
    return {
        "id": c["_id"], "workspaceId": c["workspace_id"], "name": c["name"],
        "description": c.get("description", ""), "isPrivate": c.get("is_private", False),
        "createdBy": c.get("created_by"),
    }


@api.patch("/channels/{channel_id}")
async def update_channel(channel_id: str, body: ChannelUpdateBody, user: dict = Depends(get_current_user)):
    c = await db.channels.find_one({"_id": channel_id})
    if not c:
        raise HTTPException(status_code=404, detail="Channel not found")
    await require_role(c["workspace_id"], user["_id"], ["admin", "moderator"])
    updates = {}
    if body.name is not None:
        updates["name"] = body.name.lstrip("#").strip().replace(" ", "-").lower()
    if body.description is not None:
        updates["description"] = body.description
    if updates:
        await db.channels.update_one({"_id": channel_id}, {"$set": updates})
    return {"ok": True}


@api.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, user: dict = Depends(get_current_user)):
    c = await db.channels.find_one({"_id": channel_id})
    if not c:
        raise HTTPException(status_code=404, detail="Channel not found")
    await require_role(c["workspace_id"], user["_id"], ["admin", "moderator"])
    await db.messages.delete_many({"channel_id": channel_id})
    await db.channel_members.delete_many({"channel_id": channel_id})
    await db.channels.delete_one({"_id": channel_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Direct message conversations
# ---------------------------------------------------------------------------
@api.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    convs = await db.conversations.find({"member_ids": user["_id"]}).to_list(1000)
    result = []
    for c in convs:
        other_id = next((m for m in c["member_ids"] if m != user["_id"]), None)
        other = await db.users.find_one({"_id": other_id}) if other_id else None
        if not other:
            continue
        last = await db.messages.find({"conversation_id": c["_id"]}).sort("created_at", -1).limit(1).to_list(1)
        read = await db.message_reads.find_one({"target_id": c["_id"], "user_id": user["_id"]})
        last_read = read["last_read_at"] if read else "1970-01-01T00:00:00+00:00"
        unread = await db.messages.count_documents({
            "conversation_id": c["_id"], "created_at": {"$gt": last_read}, "sender_id": {"$ne": user["_id"]}})
        result.append({
            "id": c["_id"], "user": public_user(other),
            "lastMessage": last[0]["content"] if last else "",
            "lastActivity": last[0]["created_at"] if last else c.get("created_at"),
            "unread": unread,
        })
    result.sort(key=lambda x: x["lastActivity"] or "", reverse=True)
    return {"conversations": result}


@api.post("/conversations")
async def start_conversation(body: dict, user: dict = Depends(get_current_user)):
    other_id = body.get("userId")
    other = await db.users.find_one({"_id": other_id})
    if not other or other_id == user["_id"]:
        raise HTTPException(status_code=400, detail="Invalid user")
    existing = await db.conversations.find_one({"member_ids": {"$all": [user["_id"], other_id], "$size": 2}})
    if existing:
        return {"id": existing["_id"]}
    cid = new_id()
    await db.conversations.insert_one({
        "_id": cid, "member_ids": [user["_id"], other_id], "created_at": now_iso()})
    return {"id": cid}


@api.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    c = await db.conversations.find_one({"_id": conversation_id})
    if not c or user["_id"] not in c["member_ids"]:
        raise HTTPException(status_code=403, detail="You cannot access this conversation")
    other_id = next((m for m in c["member_ids"] if m != user["_id"]), None)
    other = await db.users.find_one({"_id": other_id})
    return {"id": c["_id"], "user": public_user(other)}


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
async def serialize_message(m: dict) -> dict:
    sender = await db.users.find_one({"_id": m["sender_id"]})
    attachments = []
    for fid in m.get("attachments", []):
        f = await db.files.find_one({"_id": fid})
        if f:
            attachments.append({
                "id": f["_id"], "name": f["filename"], "size": f["size"],
                "contentType": f["content_type"], "isImage": f["content_type"].startswith("image/"),
            })
    read_by = m.get("read_by", [])
    return {
        "id": m["_id"], "content": m.get("content", ""),
        "senderId": m["sender_id"], "sender": public_user(sender) if sender else None,
        "channelId": m.get("channel_id"), "conversationId": m.get("conversation_id"),
        "attachments": attachments, "mentions": m.get("mentions", []),
        "createdAt": m["created_at"], "updatedAt": m.get("updated_at"),
        "readBy": read_by,
    }


def extract_mentions(content: str) -> List[str]:
    return re.findall(r"@(\w+)", content or "")


async def _persist_message(sender_id, content, attachments, channel_id=None, conversation_id=None):
    if channel_id:
        channel = await db.channels.find_one({"_id": channel_id})
        if not channel or not await can_access_channel(channel, sender_id):
            raise HTTPException(status_code=403, detail="Cannot post to this channel")
        workspace_id = channel["workspace_id"]
        recipients = await channel_recipient_ids(channel)
    elif conversation_id:
        conv = await db.conversations.find_one({"_id": conversation_id})
        if not conv or sender_id not in conv["member_ids"]:
            raise HTTPException(status_code=403, detail="Cannot post to this conversation")
        workspace_id = None
        recipients = conv["member_ids"]
    else:
        raise HTTPException(status_code=400, detail="Missing target")

    mid = new_id()
    doc = {
        "_id": mid, "workspace_id": workspace_id, "channel_id": channel_id,
        "conversation_id": conversation_id, "sender_id": sender_id,
        "content": content or "", "attachments": attachments or [],
        "mentions": extract_mentions(content), "read_by": [sender_id],
        "created_at": now_iso(), "updated_at": None,
    }
    await db.messages.insert_one(doc)
    # mark sender caught up
    await db.message_reads.update_one(
        {"target_id": channel_id or conversation_id, "user_id": sender_id},
        {"$set": {"last_read_at": doc["created_at"]}}, upsert=True)
    serialized = await serialize_message(doc)

    # notifications for DM + mentions
    if conversation_id:
        for uid in recipients:
            if uid != sender_id:
                await create_notification(uid, "dm", f"{serialized['sender']['name']}",
                                          content[:80] or "Sent an attachment",
                                          {"conversationId": conversation_id})
    return serialized, recipients


@api.get("/channels/{channel_id}/messages")
async def channel_messages(channel_id: str, before: Optional[str] = None, limit: int = 30,
                           user: dict = Depends(get_current_user)):
    channel = await db.channels.find_one({"_id": channel_id})
    if not channel or not await can_access_channel(channel, user["_id"]):
        raise HTTPException(status_code=403, detail="Cannot access this channel")
    q = {"channel_id": channel_id}
    if before:
        q["created_at"] = {"$lt": before}
    docs = await db.messages.find(q).sort("created_at", -1).limit(min(limit, 50)).to_list(50)
    docs.reverse()
    messages = [await serialize_message(m) for m in docs]
    return {"messages": messages, "hasMore": len(docs) == min(limit, 50)}


@api.get("/conversations/{conversation_id}/messages")
async def conversation_messages(conversation_id: str, before: Optional[str] = None, limit: int = 30,
                                user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"_id": conversation_id})
    if not conv or user["_id"] not in conv["member_ids"]:
        raise HTTPException(status_code=403, detail="Cannot access this conversation")
    q = {"conversation_id": conversation_id}
    if before:
        q["created_at"] = {"$lt": before}
    docs = await db.messages.find(q).sort("created_at", -1).limit(min(limit, 50)).to_list(50)
    docs.reverse()
    messages = [await serialize_message(m) for m in docs]
    return {"messages": messages, "hasMore": len(docs) == min(limit, 50)}


@api.post("/channels/{channel_id}/messages")
async def post_channel_message(channel_id: str, body: MessageBody, user: dict = Depends(get_current_user)):
    serialized, recipients = await _persist_message(
        user["_id"], body.content, body.attachments, channel_id=channel_id)
    await manager.send_to_users(recipients, {"type": "message", "message": serialized})
    return serialized


@api.post("/conversations/{conversation_id}/messages")
async def post_dm_message(conversation_id: str, body: MessageBody, user: dict = Depends(get_current_user)):
    serialized, recipients = await _persist_message(
        user["_id"], body.content, body.attachments, conversation_id=conversation_id)
    await manager.send_to_users(recipients, {"type": "message", "message": serialized})
    return serialized


@api.post("/messages/{target_id}/read")
async def mark_read(target_id: str, user: dict = Depends(get_current_user)):
    ts = now_iso()
    await db.message_reads.update_one(
        {"target_id": target_id, "user_id": user["_id"]},
        {"$set": {"last_read_at": ts}}, upsert=True)
    # mark DM messages read + notify senders (read receipts)
    unread = await db.messages.find({
        "$or": [{"channel_id": target_id}, {"conversation_id": target_id}],
        "read_by": {"$ne": user["_id"]}}).to_list(1000)
    recipients = set()
    ids = []
    for m in unread:
        ids.append(m["_id"])
        recipients.add(m["sender_id"])
    if ids:
        await db.messages.update_many({"_id": {"$in": ids}}, {"$addToSet": {"read_by": user["_id"]}})
        await manager.send_to_users(list(recipients), {
            "type": "read", "targetId": target_id, "userId": user["_id"], "at": ts})
    return {"ok": True}


@api.get("/messages/search")
async def search_messages(q: str, workspaceId: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not q or len(q) < 2:
        return {"results": []}
    # channels the user can access
    memberships = await db.workspace_members.find({"user_id": user["_id"]}).to_list(1000)
    ws_ids = [m["workspace_id"] for m in memberships]
    if workspaceId:
        ws_ids = [w for w in ws_ids if w == workspaceId]
    accessible_channels = []
    for c in await db.channels.find({"workspace_id": {"$in": ws_ids}}).to_list(2000):
        if await can_access_channel(c, user["_id"]):
            accessible_channels.append(c["_id"])
    convs = await db.conversations.find({"member_ids": user["_id"]}).to_list(1000)
    conv_ids = [c["_id"] for c in convs]
    query = {
        "content": {"$regex": re.escape(q), "$options": "i"},
        "$or": [{"channel_id": {"$in": accessible_channels}}, {"conversation_id": {"$in": conv_ids}}],
    }
    docs = await db.messages.find(query).sort("created_at", -1).limit(30).to_list(30)
    results = []
    for m in docs:
        s = await serialize_message(m)
        context = ""
        if m.get("channel_id"):
            ch = await db.channels.find_one({"_id": m["channel_id"]})
            context = f"#{ch['name']}" if ch else "channel"
            s["workspaceId"] = ch["workspace_id"] if ch else None
        elif m.get("conversation_id"):
            context = "Direct message"
        s["context"] = context
        results.append(s)
    return {"results": results}


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------
@api.post("/files")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds the 15MB limit")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    fid = new_id()
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin")
    content_type = file.content_type or "application/octet-stream"
    path = f"{APP_NAME}/uploads/{user['_id']}/{fid}.{ext}"
    try:
        result = await put_object(path, contents, content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=502, detail="File storage unavailable")
    doc = {
        "_id": fid, "filename": file.filename, "storage_path": result["path"],
        "content_type": content_type, "size": len(contents),
        "uploaded_by": user["_id"], "is_deleted": False, "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    return {"id": fid, "name": file.filename, "size": len(contents),
            "contentType": content_type, "isImage": content_type.startswith("image/")}


@api.get("/files/{file_id}/download")
async def download_file(file_id: str, request: Request):
    token = request.query_params.get("token") or await get_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decode_token(token)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    f = await db.files.find_one({"_id": file_id, "is_deleted": False})
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, content_type = await get_object(f["storage_path"])
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=502, detail="File storage unavailable")
    return Response(content=data, media_type=f.get("content_type", content_type),
                    headers={"Content-Disposition": f'inline; filename="{f["filename"]}"'})


@api.get("/workspaces/{workspace_id}/files")
async def workspace_files(workspace_id: str, user: dict = Depends(get_current_user)):
    await require_membership(workspace_id, user["_id"])
    chans = await db.channels.find({"workspace_id": workspace_id}).to_list(1000)
    accessible = [c["_id"] for c in chans if await can_access_channel(c, user["_id"])]
    msgs = await db.messages.find(
        {"channel_id": {"$in": accessible}, "attachments": {"$ne": []}}
    ).sort("created_at", -1).limit(50).to_list(50)
    files = []
    for m in msgs:
        for fid in m.get("attachments", []):
            f = await db.files.find_one({"_id": fid})
            if f:
                files.append({
                    "id": f["_id"], "name": f["filename"], "size": f["size"],
                    "contentType": f["content_type"], "isImage": f["content_type"].startswith("image/"),
                    "uploadedAt": f["created_at"],
                })
    return {"files": files}


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
async def create_notification(user_id, ntype, title, body, ref):
    doc = {
        "_id": new_id(), "user_id": user_id, "type": ntype, "title": title,
        "body": body, "ref": ref, "read": False, "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    await manager.send_to_users([user_id], {"type": "notification", "notification": {
        "id": doc["_id"], "type": ntype, "title": title, "body": body,
        "ref": ref, "read": False, "createdAt": doc["created_at"]}})


@api.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    docs = await db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(50).to_list(50)
    items = [{
        "id": d["_id"], "type": d["type"], "title": d["title"], "body": d["body"],
        "ref": d.get("ref", {}), "read": d.get("read", False), "createdAt": d["created_at"],
    } for d in docs]
    unread = sum(1 for d in docs if not d.get("read"))
    return {"notifications": items, "unread": unread}


@api.patch("/notifications/{notification_id}/read")
async def read_notification(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"_id": notification_id, "user_id": user["_id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all_notifications(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["_id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
async def authenticate_ws(websocket: WebSocket) -> Optional[dict]:
    token = websocket.query_params.get("token") or websocket.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = decode_token(token)
        return await db.users.find_one({"_id": payload["sub"]})
    except Exception:
        return None


async def presence_peers(user_id: str) -> List[str]:
    memberships = await db.workspace_members.find({"user_id": user_id}).to_list(1000)
    ws_ids = [m["workspace_id"] for m in memberships]
    peers = set()
    for m in await db.workspace_members.find({"workspace_id": {"$in": ws_ids}}).to_list(5000):
        peers.add(m["user_id"])
    return list(peers)


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    user = await authenticate_ws(websocket)
    if not user:
        await websocket.close(code=4401)
        return
    uid = user["_id"]
    await manager.connect(uid, websocket)
    peers = await presence_peers(uid)
    await manager.send_to_users(peers, {"type": "presence", "userId": uid, "online": True})
    # send current online snapshot to the new client
    await websocket.send_json({"type": "presence_snapshot", "online": list(manager.online_user_ids())})
    try:
        while True:
            data = await websocket.receive_json()
            mtype = data.get("type")
            if mtype == "typing":
                target = data.get("channelId") or data.get("conversationId")
                recipients = []
                if data.get("channelId"):
                    ch = await db.channels.find_one({"_id": data["channelId"]})
                    if ch:
                        recipients = await channel_recipient_ids(ch)
                elif data.get("conversationId"):
                    conv = await db.conversations.find_one({"_id": data["conversationId"]})
                    if conv:
                        recipients = conv["member_ids"]
                recipients = [r for r in recipients if r != uid]
                await manager.send_to_users(recipients, {
                    "type": "typing", "targetId": target, "userId": uid,
                    "userName": user["name"], "isTyping": data.get("isTyping", False)})
            elif mtype == "message":
                try:
                    serialized, recipients = await _persist_message(
                        uid, data.get("content", ""), data.get("attachments", []),
                        channel_id=data.get("channelId"), conversation_id=data.get("conversationId"))
                    await manager.send_to_users(recipients, {
                        "type": "message", "message": serialized, "tempId": data.get("tempId")})
                except HTTPException as e:
                    await websocket.send_json({"type": "error", "detail": e.detail})
            elif mtype == "read":
                target = data.get("targetId")
                if target:
                    ts = now_iso()
                    await db.message_reads.update_one(
                        {"target_id": target, "user_id": uid},
                        {"$set": {"last_read_at": ts}}, upsert=True)
                    unread = await db.messages.find({
                        "$or": [{"channel_id": target}, {"conversation_id": target}],
                        "read_by": {"$ne": uid}}).to_list(1000)
                    recipients = set()
                    ids = []
                    for m in unread:
                        ids.append(m["_id"])
                        recipients.add(m["sender_id"])
                    if ids:
                        await db.messages.update_many({"_id": {"$in": ids}}, {"$addToSet": {"read_by": uid}})
                        await manager.send_to_users(list(recipients), {
                            "type": "read", "targetId": target, "userId": uid, "at": ts})
            elif mtype == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WS error: {e}")
    finally:
        went_offline = manager.disconnect(uid, websocket)
        if went_offline:
            peers = await presence_peers(uid)
            await manager.send_to_users(peers, {"type": "presence", "userId": uid, "online": False})


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"message": "CollabSphere API", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup: indexes + seed sample data
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.workspace_members.create_index([("workspace_id", 1), ("user_id", 1)])
    await db.messages.create_index([("channel_id", 1), ("created_at", -1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
    await db.messages.create_index([("content", "text")])
    await db.channels.create_index("workspace_id")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await seed_data()


async def seed_data():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@collabsphere.com")
    if await db.users.find_one({"email": admin_email}):
        return  # already seeded

    def mk_user(name, email, color, title):
        return {
            "_id": new_id(), "name": name, "email": email.lower(),
            "password_hash": hash_password("password123" if email != admin_email else os.environ.get("ADMIN_PASSWORD", "admin123")),
            "avatar_color": color, "avatar_url": None, "status": "active",
            "title": title, "created_at": now_iso(),
        }

    admin = mk_user("Admin", admin_email, "#4F46E5", "Workspace Admin")
    atanu = mk_user("Atanu", "atanu@collabsphere.com", "#0EA5E9", "Full-stack Developer")
    rahul = mk_user("Rahul", "rahul@collabsphere.com", "#10B981", "Backend Engineer")
    priya = mk_user("Priya", "priya@collabsphere.com", "#F59E0B", "Project Lead")
    arjun = mk_user("Arjun", "arjun@collabsphere.com", "#EC4899", "UI/UX Designer")
    users = [admin, atanu, rahul, priya, arjun]
    await db.users.insert_many(users)

    wid = new_id()
    await db.workspaces.insert_one({
        "_id": wid, "name": "Campus Dev Team", "description": "Our hackathon & project HQ",
        "owner_id": admin["_id"], "created_at": now_iso(), "updated_at": now_iso()})
    roles = {admin["_id"]: "admin", priya["_id"]: "moderator"}
    for u in users:
        await db.workspace_members.insert_one({
            "_id": new_id(), "workspace_id": wid, "user_id": u["_id"],
            "role": roles.get(u["_id"], "user"), "joined_at": now_iso()})

    channel_defs = [
        ("general", "Team-wide announcements and chatter", False),
        ("announcements", "Important updates only", False),
        ("frontend", "React, UI and styling", False),
        ("backend", "APIs, database and infra", False),
        ("design", "Mockups, assets and design reviews", False),
        ("project-alpha", "Private squad for Project Alpha", True),
    ]
    channels = {}
    for name, desc, priv in channel_defs:
        c = await _create_channel(wid, admin["_id"], name, desc, priv)
        channels[name] = c
        if priv:
            for u in [admin, atanu, priya]:
                await db.channel_members.update_one(
                    {"channel_id": c["_id"], "user_id": u["_id"]},
                    {"$setOnInsert": {"_id": new_id(), "channel_id": c["_id"], "user_id": u["_id"], "joined_at": now_iso()}},
                    upsert=True)

    base = datetime.now(timezone.utc) - timedelta(hours=3)
    convo = [
        ("general", priya, "Morning team! Standup in 10 minutes 🙌"),
        ("general", atanu, "On it. Pushing the auth branch now."),
        ("general", rahul, "Backend deploy is green. WebSocket gateway is live."),
        ("frontend", arjun, "New message bubble design is in the design channel, take a look."),
        ("frontend", atanu, "Looks clean. Wiring it into the composer today."),
        ("backend", rahul, "Added cursor-based pagination for message history."),
        ("backend", priya, "Nice. Let's make sure read receipts stay efficient."),
        ("announcements", admin, "Demo day is Friday 3pm. Let's get the real-time flow polished."),
        ("project-alpha", priya, "Alpha squad — private channel is set up. Kickoff notes incoming."),
    ]
    step = 0
    for cname, sender, text in convo:
        step += 1
        ts = (base + timedelta(minutes=step * 7)).isoformat()
        await db.messages.insert_one({
            "_id": new_id(), "workspace_id": wid, "channel_id": channels[cname]["_id"],
            "conversation_id": None, "sender_id": sender["_id"], "content": text,
            "attachments": [], "mentions": [], "read_by": [sender["_id"]],
            "created_at": ts, "updated_at": None})

    # a sample DM between atanu and rahul
    conv_id = new_id()
    await db.conversations.insert_one({
        "_id": conv_id, "member_ids": [atanu["_id"], rahul["_id"]], "created_at": now_iso()})
    for i, (sender, text) in enumerate([
        (rahul, "Hey, can you review my PR for the STOMP gateway?"),
        (atanu, "Sure, sending comments in 5."),
    ]):
        await db.messages.insert_one({
            "_id": new_id(), "workspace_id": None, "channel_id": None,
            "conversation_id": conv_id, "sender_id": sender["_id"], "content": text,
            "attachments": [], "mentions": [], "read_by": [sender["_id"]],
            "created_at": (base + timedelta(minutes=80 + i)).isoformat(), "updated_at": None})

    logger.info("Seeded CollabSphere sample data")


@app.on_event("shutdown")
async def shutdown():
    client.close()
