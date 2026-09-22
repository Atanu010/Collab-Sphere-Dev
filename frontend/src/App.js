import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RealtimeProvider } from "@/context/RealtimeContext";
import { LoginPage, RegisterPage } from "@/pages/Auth";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import WorkspaceShell from "@/components/layout/WorkspaceShell";
import WorkspaceHome from "@/pages/WorkspaceHome";
import ConversationView from "@/components/chat/ConversationView";
import GlobalDmRedirect from "@/pages/GlobalDmRedirect";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import { Loader2 } from "lucide-react";

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
      </div>
    );
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/messages/:conversationId" element={<GlobalDmRedirect />} />
              <Route path="/workspace/:workspaceId" element={<WorkspaceShell />}>
                <Route index element={<WorkspaceHome />} />
                <Route path="channel/:channelId" element={<ConversationView type="channel" />} />
                <Route path="dm/:conversationId" element={<ConversationView type="dm" />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}

export default App;
