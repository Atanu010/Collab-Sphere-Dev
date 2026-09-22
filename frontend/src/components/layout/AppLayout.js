import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import WorkspaceRail from "@/components/layout/WorkspaceRail";
import { Loader2 } from "lucide-react";

export default function AppLayout() {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (user === null) return <Navigate to="/login" replace />;

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      <WorkspaceRail />
      <div className="flex-1 flex min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
