import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import Avatar from "@/components/common/Avatar";
import { ArrowLeft, LogOut, Wifi, Shield, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { user, logout } = useAuth();
  const { status } = useRealtime();
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto cs-scroll bg-slate-50" data-testid="settings-page">
      <div className="max-w-lg mx-auto px-5 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold font-display text-slate-900 mb-6">Settings</h1>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4">
            <Avatar user={user} size="lg" showPresence online />
            <div className="min-w-0">
              <div className="font-semibold text-slate-900">{user?.name}</div>
              <div className="text-sm text-slate-400 truncate">{user?.email}</div>
            </div>
            <button onClick={() => navigate("/profile")} className="ml-auto text-sm text-indigo-600 font-semibold hover:underline">Edit</button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          <Row icon={Wifi} label="Realtime connection" value={status} valueClass={status === "online" ? "text-emerald-600" : "text-amber-600"} />
          <Row icon={Bell} label="Notifications" value="Enabled" />
          <Row icon={Shield} label="Account security" value="JWT protected" />
        </div>

        <button onClick={logout} data-testid="settings-logout-button" className="mt-6 w-full h-11 rounded-xl border border-rose-200 text-rose-600 font-semibold hover:bg-rose-50 transition-colors flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Sign out
        </button>

        <p className="text-center text-xs text-slate-400 mt-6">CollabSphere · Real-time collaboration platform</p>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, valueClass }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
      <span className={cn("text-sm font-semibold capitalize", valueClass || "text-slate-400")}>{value}</span>
    </div>
  );
}
