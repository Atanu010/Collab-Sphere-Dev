import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/common/Avatar";
import { modalInput, PrimaryButton } from "@/components/common/Modal";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [title, setTitle] = useState(user?.title || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { data } = await api.patch("/auth/profile", { name, title });
      updateUser(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto cs-scroll bg-slate-50" data-testid="profile-page">
      <div className="max-w-lg mx-auto px-5 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Your profile</h1>

        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar user={{ ...user, name }} size="xl" showPresence online />
            <div>
              <div className="font-semibold text-lg text-slate-900">{name}</div>
              <div className="text-sm text-slate-400">{user?.email}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Display name</label>
              <input data-testid="profile-name-input" className={modalInput} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Title / role</label>
              <input data-testid="profile-title-input" className={modalInput} placeholder="e.g. Frontend Developer" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            <PrimaryButton onClick={save} disabled={saving} data-testid="profile-save-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
              {saved ? "Saved" : "Save changes"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
