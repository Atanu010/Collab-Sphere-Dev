import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/services/api";
import { useRealtime } from "@/context/RealtimeContext";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { workspaceId } = useParams();
  const { subscribe } = useRealtime();
  const [workspace, setWorkspace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const debounceRef = useRef(null);

  const refreshChannels = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}/channels`);
      setChannels(data.channels);
    } catch {
      /* ignore */
    }
  }, [workspaceId]);

  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await api.get(`/conversations`);
      setConversations(data.conversations);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshMembers = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}/members`);
      setMembers(data.members);
    } catch {
      /* ignore */
    }
  }, [workspaceId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/workspaces/${workspaceId}`);
        if (active) setWorkspace(data);
      } catch {
        if (active) setWorkspace(null);
      }
      await Promise.all([refreshChannels(), refreshConversations(), refreshMembers()]);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [workspaceId, refreshChannels, refreshConversations, refreshMembers]);

  // refresh counts on realtime activity (debounced)
  useEffect(() => {
    return subscribe((evt) => {
      if (evt.type === "message" || evt.type === "read") {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          refreshChannels();
          refreshConversations();
        }, 400);
      }
    });
  }, [subscribe, refreshChannels, refreshConversations]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        workspace,
        channels,
        conversations,
        members,
        loading,
        rightOpen,
        setRightOpen,
        mobileNavOpen,
        setMobileNavOpen,
        refreshChannels,
        refreshConversations,
        refreshMembers,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
