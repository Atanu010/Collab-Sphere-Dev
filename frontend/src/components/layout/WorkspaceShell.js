import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import ChannelSidebar from "@/components/layout/ChannelSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function ShellInner() {
  const { rightOpen, mobileNavOpen, setMobileNavOpen, loading, workspace } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !workspace) navigate("/dashboard");
  }, [loading, workspace, navigate]);

  return (
    <div className="flex flex-1 min-w-0 h-full">
      {/* Desktop channel sidebar */}
      <div className="hidden md:flex w-64 border-r border-slate-200 shrink-0">
        <ChannelSidebar />
      </div>

      {/* Middle */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <Outlet />
      )}

      {/* Desktop right sidebar */}
      <div className={cn("hidden lg:flex border-l border-slate-200 shrink-0 transition-all duration-200 overflow-hidden", rightOpen ? "w-72" : "w-0")}>
        {rightOpen && <RightSidebar />}
      </div>

      {/* Mobile channel drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-white shadow-2xl cs-fade-up">
            <ChannelSidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <ShellInner />
    </WorkspaceProvider>
  );
}
