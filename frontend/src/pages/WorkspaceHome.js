import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Hash } from "lucide-react";

export default function WorkspaceHome() {
  const { channels, loading } = useWorkspace();
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && channels.length > 0) {
      navigate(`/workspace/${workspaceId}/channel/${channels[0].id}`, { replace: true });
    }
  }, [loading, channels, workspaceId, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50" data-testid="workspace-home">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
          <Hash className="w-7 h-7" />
        </div>
        <p className="text-slate-500">{loading ? "Loading workspace…" : "Select a channel to start chatting"}</p>
      </div>
    </div>
  );
}
