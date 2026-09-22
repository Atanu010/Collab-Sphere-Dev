import { useState } from "react";
import { api, formatApiError } from "@/services/api";
import Modal, { modalInput, PrimaryButton, GhostButton } from "@/components/common/Modal";
import Avatar from "@/components/common/Avatar";
import { Hash, Lock, Loader2, Search } from "lucide-react";

export function CreateWorkspaceDialog({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/workspaces", { name, description: desc });
      setName("");
      setDesc("");
      onCreated?.(data.id);
      onClose();
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a workspace"
      testid="create-workspace-modal"
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={loading} data-testid="create-workspace-submit">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Workspace name</label>
          <input data-testid="create-workspace-name" className={modalInput} placeholder="Campus Dev Team" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Description</label>
          <input data-testid="create-workspace-desc" className={modalInput} placeholder="What's this workspace for?" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>
    </Modal>
  );
}

export function CreateChannelDialog({ open, onClose, workspaceId, onCreated }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post(`/workspaces/${workspaceId}/channels`, { name, description: desc, isPrivate });
      setName("");
      setDesc("");
      setIsPrivate(false);
      onCreated?.(data.id);
      onClose();
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a channel"
      testid="create-channel-modal"
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={submit} disabled={loading} data-testid="create-channel-submit">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create channel
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Name</label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input data-testid="create-channel-name" className={modalInput + " pl-9"} placeholder="marketing" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Description</label>
          <input data-testid="create-channel-desc" className={modalInput} placeholder="Optional" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
          <input type="checkbox" data-testid="create-channel-private" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          <Lock className="w-4 h-4 text-slate-500" />
          <div>
            <div className="text-sm font-medium text-slate-800">Private channel</div>
            <div className="text-xs text-slate-500">Only invited members can view</div>
          </div>
        </label>
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>
    </Modal>
  );
}

export function InviteDialog({ open, onClose, workspaceId, onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post(`/workspaces/${workspaceId}/invite`, { email, role });
      setSuccess(`${email} was added.`);
      setEmail("");
      onInvited?.();
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a member"
      testid="invite-modal"
      footer={
        <>
          <GhostButton onClick={onClose}>Close</GhostButton>
          <PrimaryButton onClick={submit} disabled={loading} data-testid="invite-submit">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Add member
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Add an existing CollabSphere user to this workspace by email.</p>
        <input data-testid="invite-email" className={modalInput} placeholder="teammate@collabsphere.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Role</label>
          <select data-testid="invite-role" className={modalInput} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {success && <div className="text-sm text-emerald-600">{success}</div>}
      </div>
    </Modal>
  );
}

export function StartDmDialog({ open, onClose, onStarted }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (val) => {
    setQ(val);
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search`, { params: { q: val } });
      setUsers(data.users);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const start = async (userId) => {
    const { data } = await api.post("/conversations", { userId });
    onStarted?.(data.id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New direct message" testid="start-dm-modal">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input data-testid="start-dm-search" className={modalInput + " pl-9"} placeholder="Search people by name or email" value={q} onChange={(e) => searchUsers(e.target.value)} autoFocus />
        </div>
        <div className="max-h-72 overflow-y-auto cs-scroll -mx-1">
          {loading && <div className="text-center py-6 text-sm text-slate-400">Searching…</div>}
          {!loading && users.length === 0 && <div className="text-center py-6 text-sm text-slate-400">Type to find teammates</div>}
          {users.map((u) => (
            <button key={u.id} onClick={() => start(u.id)} data-testid="start-dm-user" className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left">
              <Avatar user={u} size="sm" showPresence online={u.online} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{u.name}</div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
