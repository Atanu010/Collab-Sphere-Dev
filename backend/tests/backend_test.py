"""CollabSphere backend regression tests via public ingress."""
import os
import io
import time
import uuid
import pytest
import requests
import websocket  # websocket-client
import threading
import json

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # fallback read from frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

USERS = {
    "atanu":  ("atanu@collabsphere.com",  "password123"),
    "rahul":  ("rahul@collabsphere.com",  "password123"),
    "priya":  ("priya@collabsphere.com",  "password123"),
    "arjun":  ("arjun@collabsphere.com",  "password123"),
    "admin":  ("admin@collabsphere.com",  "admin123"),
}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="module")
def sessions():
    out = {}
    for k, (e, p) in USERS.items():
        tok, user = login(e, p)
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
        out[k] = {"session": s, "token": tok, "user": user}
    return out


# ---------- Auth ----------
class TestAuth:
    def test_login_ok(self):
        tok, user = login(*USERS["atanu"])
        assert tok and user["email"] == "atanu@collabsphere.com"

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "atanu@collabsphere.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_ok(self, sessions):
        r = sessions["atanu"]["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "atanu@collabsphere.com"

    def test_register_and_persist(self):
        email = f"test_{uuid.uuid4().hex[:8]}@collabsphere.com"
        r = requests.post(f"{API}/auth/register", json={"name": "TEST User", "email": email, "password": "password123"})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == email
        # login again
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "password123"})
        assert r2.status_code == 200


# ---------- Workspaces / Channels ----------
class TestWorkspaces:
    def test_list_workspaces_seeded(self, sessions):
        r = sessions["atanu"]["session"].get(f"{API}/workspaces")
        assert r.status_code == 200
        wss = r.json()["workspaces"]
        assert any(w["name"] == "Campus Dev Team" for w in wss)

    def test_channels_listed_for_member(self, sessions):
        s = sessions["atanu"]["session"]
        wid = next(w["id"] for w in s.get(f"{API}/workspaces").json()["workspaces"] if w["name"] == "Campus Dev Team")
        r = s.get(f"{API}/workspaces/{wid}/channels")
        assert r.status_code == 200
        names = [c["name"] for c in r.json()["channels"]]
        # atanu is a member of private project-alpha
        for expected in ["general", "announcements", "frontend", "backend", "design", "project-alpha"]:
            assert expected in names, f"missing {expected} in {names}"

    def test_private_channel_hidden_for_non_member(self, sessions):
        s = sessions["rahul"]["session"]
        wid = next(w["id"] for w in s.get(f"{API}/workspaces").json()["workspaces"] if w["name"] == "Campus Dev Team")
        chans = s.get(f"{API}/workspaces/{wid}/channels").json()["channels"]
        assert "project-alpha" not in [c["name"] for c in chans]

    def test_workspace_membership_forbidden(self, sessions):
        # Register a new user with no workspace
        email = f"test_{uuid.uuid4().hex[:8]}@collabsphere.com"
        r = requests.post(f"{API}/auth/register", json={"name": "Outsider", "email": email, "password": "password123"})
        tok = r.json()["token"]
        wid = next(w["id"] for w in sessions["atanu"]["session"].get(f"{API}/workspaces").json()["workspaces"]
                   if w["name"] == "Campus Dev Team")
        r = requests.get(f"{API}/workspaces/{wid}/channels", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403


# ---------- Messages ----------
class TestMessages:
    def _get_channel(self, s, name):
        wid = next(w["id"] for w in s.get(f"{API}/workspaces").json()["workspaces"] if w["name"] == "Campus Dev Team")
        return next(c for c in s.get(f"{API}/workspaces/{wid}/channels").json()["channels"] if c["name"] == name)

    def test_list_messages_general(self, sessions):
        s = sessions["atanu"]["session"]
        ch = self._get_channel(s, "general")
        r = s.get(f"{API}/channels/{ch['id']}/messages")
        assert r.status_code == 200
        assert isinstance(r.json()["messages"], list)

    def test_post_and_persist(self, sessions):
        s = sessions["atanu"]["session"]
        ch = self._get_channel(s, "general")
        text = f"TEST_msg_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/channels/{ch['id']}/messages", json={"content": text, "attachments": []})
        assert r.status_code == 200
        mid = r.json()["id"]
        # GET verification
        msgs = s.get(f"{API}/channels/{ch['id']}/messages").json()["messages"]
        assert any(m["id"] == mid and m["content"] == text for m in msgs)

    def test_post_to_private_forbidden_for_non_member(self, sessions):
        s_admin = sessions["admin"]["session"]
        priv = self._get_channel(s_admin, "project-alpha")
        s_rahul = sessions["rahul"]["session"]
        r = s_rahul.post(f"{API}/channels/{priv['id']}/messages", json={"content": "sneak", "attachments": []})
        assert r.status_code == 403

    def test_search_permission_scope(self, sessions):
        # atanu posts in private channel; rahul (not member) shouldn't see in search
        s_a = sessions["atanu"]["session"]
        priv = self._get_channel(s_a, "project-alpha")
        token_word = f"secretalpha{uuid.uuid4().hex[:6]}"
        s_a.post(f"{API}/channels/{priv['id']}/messages", json={"content": token_word, "attachments": []})
        s_r = sessions["rahul"]["session"]
        r = s_r.get(f"{API}/messages/search", params={"q": token_word})
        assert r.status_code == 200
        assert r.json()["results"] == []
        # atanu can find it
        r2 = s_a.get(f"{API}/messages/search", params={"q": token_word})
        assert any(token_word in m["content"] for m in r2.json()["results"])


# ---------- Conversations / DM ----------
class TestDMs:
    def test_start_and_message(self, sessions):
        s_a = sessions["atanu"]["session"]
        rahul_id = sessions["rahul"]["user"]["id"]
        r = s_a.post(f"{API}/conversations", json={"userId": rahul_id})
        assert r.status_code == 200
        cid = r.json()["id"]
        text = f"dm_{uuid.uuid4().hex[:6]}"
        r2 = s_a.post(f"{API}/conversations/{cid}/messages", json={"content": text, "attachments": []})
        assert r2.status_code == 200
        # rahul reads
        r3 = sessions["rahul"]["session"].get(f"{API}/conversations/{cid}/messages")
        assert any(m["content"] == text for m in r3.json()["messages"])

    def test_dm_forbidden_third_party(self, sessions):
        s_a = sessions["atanu"]["session"]
        rahul_id = sessions["rahul"]["user"]["id"]
        cid = s_a.post(f"{API}/conversations", json={"userId": rahul_id}).json()["id"]
        s_p = sessions["priya"]["session"]
        r = s_p.get(f"{API}/conversations/{cid}/messages")
        assert r.status_code == 403


# ---------- Notifications ----------
class TestNotifications:
    def test_list_and_read_all(self, sessions):
        s = sessions["atanu"]["session"]
        assert s.get(f"{API}/notifications").status_code == 200
        r = s.post(f"{API}/notifications/read-all")
        assert r.status_code == 200
        data = s.get(f"{API}/notifications").json()
        assert data["unread"] == 0


# ---------- Files ----------
class TestFiles:
    def test_upload_and_download(self, sessions):
        s = sessions["atanu"]["session"]
        # switch to multipart (drop content-type)
        headers = {"Authorization": s.headers["Authorization"]}
        content = b"hello TEST file " + uuid.uuid4().bytes
        r = requests.post(f"{API}/files", headers=headers,
                          files={"file": ("test.txt", io.BytesIO(content), "text/plain")})
        if r.status_code == 502:
            pytest.skip("Object storage unavailable in this env")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        # download using token in query
        tok = sessions["atanu"]["token"]
        r2 = requests.get(f"{API}/files/{fid}/download", params={"token": tok})
        assert r2.status_code == 200
        assert r2.content == content


# ---------- WebSocket ----------
class TestWebSocket:
    def test_ws_connect_and_realtime_message(self, sessions):
        ws_base = BASE.replace("https://", "wss://").replace("http://", "ws://")
        url_r = f"{ws_base}/api/ws?token={sessions['rahul']['token']}"
        received = []
        connected = threading.Event()

        def on_msg(ws, msg):
            try:
                d = json.loads(msg)
                received.append(d)
                if d.get("type") == "presence_snapshot":
                    connected.set()
            except Exception:
                pass

        def on_err(ws, err):
            print("WS ERR:", err)

        ws_r = websocket.WebSocketApp(url_r, on_message=on_msg, on_error=on_err)
        th = threading.Thread(target=ws_r.run_forever, daemon=True)
        th.start()
        assert connected.wait(10), f"WS did not connect. received={received}"

        # Now atanu posts message in #general and rahul should get 'message' event
        s_a = sessions["atanu"]["session"]
        wid = next(w["id"] for w in s_a.get(f"{API}/workspaces").json()["workspaces"] if w["name"] == "Campus Dev Team")
        ch = next(c for c in s_a.get(f"{API}/workspaces/{wid}/channels").json()["channels"] if c["name"] == "general")
        marker = f"WS_TEST_{uuid.uuid4().hex[:6]}"
        s_a.post(f"{API}/channels/{ch['id']}/messages", json={"content": marker, "attachments": []})

        deadline = time.time() + 8
        found = False
        while time.time() < deadline:
            if any(r.get("type") == "message" and r.get("message", {}).get("content") == marker for r in received):
                found = True
                break
            time.sleep(0.3)
        ws_r.close()
        assert found, f"Real-time message NOT received via WS. events={received[-10:]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
