import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/common/Avatar";
import NotificationBell from "@/components/common/NotificationBell";
import { CreateWorkspaceDialog } from "@/components/dialogs/Dialogs";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare } from "lucide-react";

export default function WorkspaceRail() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => api.get("/workspaces").then(({ data }) => setWorkspaces(data.workspaces)).catch(() => {});
  useEffect(() => {
    load();
  }, [workspaceId]);

  return (
    <div className="w-16 bg-slate-900 flex flex-col items-center py-3 gap-2 shrink-0" data-testid="workspace-rail">
      <button onClick={() => navigate("/dashboard")} data-testid="rail-home" className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center hover:rounded-2xl transition-all shadow-lg shadow-indigo-900/50">
        <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
      </button>
      <div className="w-8 h-px bg-slate-700 my-1" />

      <div className="flex-1 flex flex-col items-center gap-2 overflow-y-auto cs-scroll w-full">
        {workspaces.map((w) => {
          const active = w.id === workspaceId;
          return (
            <button
              key={w.id}
              onClick={() => navigate(`/workspace/${w.id}`)}
              data-testid="workspace-switcher-item"
              title={w.name}
              className="relative group"
            >
              {active && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white font-display transition-all",
                  active ? "rounded-2xl ring-2 ring-white ring-offset-2 ring-offset-slate-900" : "hover:rounded-2xl"
                )}
                style={{ backgroundColor: stringColor(w.name) }}
              >
                {w.name.slice(0, 2).toUpperCase()}
              </div>
              {w.unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-slate-900">
                  {w.unread > 9 ? "9+" : w.unread}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={() => setShowCreate(true)} data-testid="rail-create-workspace" title="Create workspace" className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 hover:bg-slate-700 hover:rounded-2xl transition-all">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="bg-slate-800 rounded-lg">
          <NotificationBell />
        </div>
        <button onClick={() => navigate("/profile")} data-testid="rail-profile" title="Profile">
          <Avatar user={user} size="sm" showPresence online />
        </button>
      </div>

      <CreateWorkspaceDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={(id) => { load(); navigate(`/workspace/${id}`); }} />
    </div>
  );
}

function stringColor(str) {
  const colors = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#14B8A6"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
