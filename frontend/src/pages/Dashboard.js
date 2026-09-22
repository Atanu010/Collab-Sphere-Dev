import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import Avatar from "@/components/common/Avatar";
import { CreateWorkspaceDialog, StartDmDialog } from "@/components/dialogs/Dialogs";
import { formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  Plus, MessageSquare, Users, ArrowRight, Zap, UserPlus, Hash, Inbox, Loader2,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onlineIds } = useRealtime();
  const [workspaces, setWorkspaces] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDm, setShowDm] = useState(false);

  const load = async () => {
    const [w, c] = await Promise.all([api.get("/workspaces"), api.get("/conversations")]);
    setWorkspaces(w.data.workspaces);
    setConversations(c.data.conversations);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const totalUnread = workspaces.reduce((s, w) => s + w.unread, 0) + conversations.reduce((s, c) => s + c.unread, 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex-1 overflow-y-auto cs-scroll bg-slate-50" data-testid="dashboard-page">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Avatar user={user} size="md" showPresence online />
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900">{greet}, {user?.name?.split(" ")[0]}</h1>
            <p className="text-slate-500 text-sm">
              {totalUnread > 0 ? `You have ${totalUnread} unread ${totalUnread === 1 ? "message" : "messages"}` : "You're all caught up"}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          <QuickAction icon={Plus} label="New workspace" desc="Spin up a team space" onClick={() => setShowCreate(true)} testid="quick-create-workspace" accent="indigo" />
          <QuickAction icon={MessageSquare} label="Start a DM" desc="Message a teammate" onClick={() => setShowDm(true)} testid="quick-start-dm" accent="emerald" />
          <QuickAction icon={Zap} label="Jump back in" desc="Open last workspace" onClick={() => workspaces[0] && navigate(`/workspace/${workspaces[0].id}`)} testid="quick-jump" accent="amber" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Workspaces */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Users className="w-4 h-4" /> Your workspaces</h2>
              </div>
              <div className="space-y-2.5">
                {workspaces.length === 0 && (
                  <EmptyCard icon={Users} title="No workspaces yet" action="Create your first workspace" onClick={() => setShowCreate(true)} />
                )}
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => navigate(`/workspace/${w.id}`)}
                    data-testid={`dashboard-workspace-${w.id}`}
                    className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-indigo-300 hover:shadow-md hover:shadow-slate-200/50 transition-all text-left group"
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white font-display shrink-0" style={{ backgroundColor: "#4F46E5" }}>
                      {w.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{w.name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>{w.memberCount} members</span>
                        <span>· active {formatRelative(w.lastActivity)}</span>
                      </div>
                    </div>
                    {w.unread > 0 ? (
                      <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{w.unread}</span>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Conversations */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Inbox className="w-4 h-4" /> Recent conversations</h2>
              </div>
              <div className="space-y-2.5">
                {conversations.length === 0 && (
                  <EmptyCard icon={MessageSquare} title="No direct messages yet" action="Start a conversation" onClick={() => setShowDm(true)} />
                )}
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/messages/${c.id}`)}
                    data-testid={`dashboard-dm-${c.id}`}
                    className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-indigo-300 hover:shadow-md hover:shadow-slate-200/50 transition-all text-left"
                  >
                    <Avatar user={c.user} size="md" showPresence online={onlineIds.has(c.user.id)} />
                    <div className="min-w-0 flex-1">
                      <div className={cn("font-semibold text-slate-900 truncate", c.unread > 0 && "font-bold")}>{c.user.name}</div>
                      <div className="text-xs text-slate-400 truncate">{c.lastMessage || "Say hello"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-slate-400">{formatRelative(c.lastActivity)}</span>
                      {c.unread > 0 && <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.unread}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <CreateWorkspaceDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={(id) => navigate(`/workspace/${id}`)} />
      <StartDmDialog open={showDm} onClose={() => setShowDm(false)} onStarted={(id) => navigate(`/messages/${id}`)} />
    </div>
  );
}

const ACCENTS = {
  indigo: "bg-indigo-100 text-indigo-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
};

function QuickAction({ icon: Icon, label, desc, onClick, testid, accent }) {
  return (
    <button onClick={onClick} data-testid={testid} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-indigo-300 hover:shadow-md hover:shadow-slate-200/50 transition-all">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-2.5", ACCENTS[accent])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-semibold text-slate-900 text-sm">{label}</div>
      <div className="text-xs text-slate-400">{desc}</div>
    </button>
  );
}

function EmptyCard({ icon: Icon, title, action, onClick }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
      <Icon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
      <div className="text-sm text-slate-500 mb-3">{title}</div>
      <button onClick={onClick} className="text-sm text-indigo-600 font-semibold hover:underline">{action}</button>
    </div>
  );
}
