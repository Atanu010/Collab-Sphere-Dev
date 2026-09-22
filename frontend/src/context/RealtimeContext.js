import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { wsUrl } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const listeners = useRef(new Set());
  const reconnectRef = useRef(null);
  const shouldConnect = useRef(false);
  const [status, setStatus] = useState("connecting"); // connecting | online | reconnecting
  const [onlineIds, setOnlineIds] = useState(() => new Set());

  const emit = useCallback((evt) => {
    listeners.current.forEach((cb) => {
      try {
        cb(evt);
      } catch (e) {
        /* ignore */
      }
    });
  }, []);

  const connect = useCallback(() => {
    if (!shouldConnect.current) return;
    let ws;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      setStatus("reconnecting");
      reconnectRef.current = setTimeout(connect, 2500);
      return;
    }
    wsRef.current = ws;
    setStatus((s) => (s === "online" ? "reconnecting" : "connecting"));

    ws.onopen = () => setStatus("online");
    ws.onmessage = (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (data.type === "presence_snapshot") {
        setOnlineIds(new Set(data.online));
      } else if (data.type === "presence") {
        setOnlineIds((prev) => {
          const next = new Set(prev);
          if (data.online) next.add(data.userId);
          else next.delete(data.userId);
          return next;
        });
      }
      emit(data);
    };
    ws.onclose = () => {
      if (!shouldConnect.current) return;
      setStatus("reconnecting");
      reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [emit]);

  useEffect(() => {
    if (!user) {
      shouldConnect.current = false;
      if (wsRef.current) wsRef.current.close();
      return;
    }
    shouldConnect.current = true;
    connect();
    const ping = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
    return () => {
      shouldConnect.current = false;
      clearInterval(ping);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [user, connect]);

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((cb) => {
    listeners.current.add(cb);
    return () => listeners.current.delete(cb);
  }, []);

  return (
    <RealtimeContext.Provider value={{ status, onlineIds, send, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
