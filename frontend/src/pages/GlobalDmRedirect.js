import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { Loader2 } from "lucide-react";

export default function GlobalDmRedirect() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/workspaces");
        if (data.workspaces.length > 0) {
          navigate(`/workspace/${data.workspaces[0].id}/dm/${conversationId}`, { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        navigate("/dashboard", { replace: true });
      }
    })();
  }, [conversationId, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  );
}
