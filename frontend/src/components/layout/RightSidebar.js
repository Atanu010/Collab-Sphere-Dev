import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fileDownloadUrl } from "@/services/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useRealtime } from "@/context/RealtimeContext";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/common/Avatar";
import { formatBytes } from "@/utils/format";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Download, X, Shield, Star } from "lucide-react";

const ROLE_BADGE = {
  admin: "bg-indigo-100 text-indigo-700",
  moderator: "bg-amber-100 text-amber-700",
  user: "bg-slate-100 text-slate-500",
};

export default function RightSidebar({ onClose }) {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useWorkspace();
  const { onlineIds } = useRealtime();
  const [tab, setTab] = useState("members");
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (tab === "files" && workspaceId) {
      api.get(`/workspaces/${workspaceId}/files`).then(({ data }) => setFiles(data.files)).catch(() => {});
    }
  }, [tab, workspaceId]);

  const onlineMembers = members.filter((m) => onlineIds.has(m.id));
  const offlineMembers = members.filter((m) => !onlineIds.has(m.id));

  const startDm = async (memberId) => {
    if (memberId === user?.id) return;
    const { data } = await api.post("/conversations", { userId: memberId });
    navigate(`/workspace/${workspaceId}/dm/${data.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-white" data-testid="right-sidebar">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setTab("members")} data-testid="right-tab-members" className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-colors", tab === "members" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}>
            Members
          </button>
          <button onClick={() => setTab("files")} data-testid="right-tab-files" className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-colors", tab === "files" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}>
            Files
          </button>
        </div>
        {onClose && (
          <button onClick={onClose} data-testid="right-sidebar-close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto cs-scroll p-3">
        {tab === "members" && (
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                Online — {onlineMembers.length}
              </div>
              {onlineMembers.map((m) => (
                <MemberRow key={m.id} m={m} online startDm={startDm} isSelf={m.id === user?.id} />
              ))}
              {onlineMembers.length === 0 && <div className="px-1 text-xs text-slate-400">Nobody online</div>}
            </div>
            {offlineMembers.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                  Offline — {offlineMembers.length}
                </div>
                {offlineMembers.map((m) => (
                  <MemberRow key={m.id} m={m} startDm={startDm} isSelf={m.id === user?.id} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "files" && (
          <div className="space-y-1.5">
            {files.length === 0 && <div className="text-center py-10 text-sm text-slate-400">No shared files yet</div>}
            {files.map((f) => (
              <a
                key={f.id}
                href={fileDownloadUrl(f.id)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="shared-file-item"
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", f.isImage ? "bg-violet-100 text-violet-600" : "bg-sky-100 text-sky-600")}>
                  {f.isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{f.name}</div>
                  <div className="text-xs text-slate-400">{formatBytes(f.size)}</div>
                </div>
                <Download className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({ m, online, startDm, isSelf }) {
  return (
    <button
      onClick={() => startDm(m.id)}
      data-testid={`member-item-${m.id}`}
      className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
    >
      <Avatar user={m} size="sm" showPresence online={online} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800 truncate flex items-center gap-1.5">
          {m.name} {isSelf && <span className="text-[10px] text-slate-400">(you)</span>}
        </div>
        <div className="text-xs text-slate-400 truncate">{m.title || m.email}</div>
      </div>
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5", ROLE_BADGE[m.role])}>
        {m.role === "admin" && <Shield className="w-2.5 h-2.5" />}
        {m.role === "moderator" && <Star className="w-2.5 h-2.5" />}
        {m.role}
      </span>
    </button>
  );
}
