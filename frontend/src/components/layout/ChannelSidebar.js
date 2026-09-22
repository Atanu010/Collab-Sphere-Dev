import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import Avatar from "@/components/common/Avatar";
import { CreateChannelDialog, InviteDialog, StartDmDialog } from "@/components/dialogs/Dialogs";
import SearchDialog from "@/components/dialogs/SearchDialog";
import { cn } from "@/lib/utils";
import {
  Hash, Lock, Plus, Search, ChevronDown, Settings, LogOut, UserPlus, Home, Circle,
} from "lucide-react";

export default function ChannelSidebar({ onNavigate }) {
  const navigate = useNavigate();
  const { channelId, conversationId } = useParams();
  const { user, logout } = useAuth();
  const { onlineIds } = useRealtime();
  const {
    workspaceId, workspace, channels, conversations, refreshChannels, refreshConversations,
  } = useWorkspace();

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showDm, setShowDm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const canManage = workspace?.role === "admin" || workspace?.role === "moderator";
  const isAdmin = workspace?.role === "admin";

  const go = (path) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full bg-white" data-testid="channel-sidebar">
      {/* Workspace header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-bold font-display text-slate-900 truncate text-[15px]" data-testid="sidebar-workspace-name">
            {workspace?.name || "Workspace"}
          </div>
          <div className="text-xs text-slate-400 truncate">{workspace?.description || "Team workspace"}</div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(true)} data-testid="sidebar-invite-button" title="Invite member" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors shrink-0">
            <UserPlus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search + Home */}
      <div className="px-3 pt-3 space-y-1">
        <button onClick={() => setShowSearch(true)} data-testid="sidebar-search-button" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-slate-400 text-sm flex items-center gap-2 hover:border-indigo-300 hover:text-slate-500 transition-colors">
          <Search className="w-4 h-4" /> Search messages
        </button>
        <button onClick={() => go("/dashboard")} data-testid="sidebar-home-button" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
          <Home className="w-4 h-4" /> Home
        </button>
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-5">
        {/* Channels */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ChevronDown className="w-3 h-3" /> Channels
            </span>
            {canManage && (
              <button onClick={() => setShowCreateChannel(true)} data-testid="create-channel-button" title="Create channel" className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {channels.map((c) => {
              const active = c.id === channelId;
              return (
                <button
                  key={c.id}
                  onClick={() => go(`/workspace/${workspaceId}/channel/${c.id}`)}
                  data-testid={`channel-list-item-${c.name}`}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors group",
                    active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    c.unread > 0 && !active && "font-semibold text-slate-900"
                  )}
                >
                  {c.isPrivate ? <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" /> : <Hash className="w-4 h-4 shrink-0 opacity-70" />}
                  <span className="truncate flex-1 text-left">{c.name}</span>
                  {c.unread > 0 && (
                    <span data-testid={`channel-unread-${c.name}`} className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                      {c.unread}
                    </span>
                  )}
                </button>
              );
            })}
            {channels.length === 0 && <div className="px-2 text-xs text-slate-400">No channels yet</div>}
          </div>
        </div>

        {/* Direct messages */}
        <div>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ChevronDown className="w-3 h-3" /> Direct Messages
            </span>
            <button onClick={() => setShowDm(true)} data-testid="start-dm-button" title="New message" className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {conversations.map((c) => {
              const active = c.id === conversationId;
              const online = onlineIds.has(c.user.id);
              return (
                <button
                  key={c.id}
                  onClick={() => go(`/workspace/${workspaceId}/dm/${c.id}`)}
                  data-testid={`dm-list-item-${c.user.id}`}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                    active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Avatar user={c.user} size="xs" showPresence online={online} />
                  <span className={cn("truncate flex-1 text-left", c.unread > 0 && !active && "font-semibold text-slate-900")}>{c.user.name}</span>
                  {c.unread > 0 && (
                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">{c.unread}</span>
                  )}
                </button>
              );
            })}
            {conversations.length === 0 && <div className="px-2 text-xs text-slate-400">Start a conversation</div>}
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="relative border-t border-slate-100 p-2.5">
        {userMenu && (
          <div className="absolute bottom-16 left-2.5 right-2.5 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden cs-fade-up z-20">
            <button onClick={() => go("/profile")} data-testid="menu-profile" className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <Settings className="w-4 h-4" /> Profile & status
            </button>
            <button onClick={() => go("/settings")} data-testid="menu-settings" className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button onClick={logout} data-testid="menu-logout" className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 border-t border-slate-50">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        )}
        <button onClick={() => setUserMenu((v) => !v)} data-testid="sidebar-user-button" className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <Avatar user={user} size="sm" showPresence online />
          <div className="min-w-0 flex-1 text-left">
            <div className="text-sm font-semibold text-slate-800 truncate">{user?.name}</div>
            <div className="text-[11px] text-emerald-600 flex items-center gap-1">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" /> Active
            </div>
          </div>
        </button>
      </div>

      <CreateChannelDialog open={showCreateChannel} onClose={() => setShowCreateChannel(false)} workspaceId={workspaceId} onCreated={(id) => { refreshChannels(); go(`/workspace/${workspaceId}/channel/${id}`); }} />
      <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} workspaceId={workspaceId} />
      <StartDmDialog open={showDm} onClose={() => setShowDm(false)} onStarted={(id) => { refreshConversations(); go(`/workspace/${workspaceId}/dm/${id}`); }} />
      <SearchDialog open={showSearch} onClose={() => setShowSearch(false)} workspaceId={workspaceId} />
    </div>
  );
}
