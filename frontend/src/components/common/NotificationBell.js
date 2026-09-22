import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, AtSign, UserPlus, MessageSquare, Megaphone } from "lucide-react";
import { api } from "@/services/api";
import { useRealtime } from "@/context/RealtimeContext";
import { formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";

const ICONS = { dm: MessageSquare, mention: AtSign, invite: UserPlus, channel: Megaphone };

export default function NotificationBell() {
  const { subscribe } = useRealtime();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return subscribe((evt) => {
      if (evt.type === "notification") {
        setItems((prev) => [evt.notification, ...prev].slice(0, 50));
        setUnread((u) => u + 1);
      }
    });
  }, [subscribe]);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const clickItem = async (n) => {
    if (!n.read) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.ref?.conversationId) navigate(`/messages/${n.ref.conversationId}`);
    else if (n.ref?.workspaceId) navigate(`/workspace/${n.ref.workspaceId}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="notifications-bell-button"
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span
            data-testid="notifications-unread-count"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          data-testid="notifications-panel"
          className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 cs-fade-up overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-slate-900 font-display">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} data-testid="notifications-mark-all" className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto cs-scroll">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">You're all caught up 🎉</div>
            ) : (
              items.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => clickItem(n)}
                    data-testid="notification-item"
                    className={cn(
                      "w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50",
                      !n.read && "bg-indigo-50/50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{n.title}</div>
                      <div className="text-xs text-slate-500 truncate">{n.body}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatRelative(n.createdAt)}</div>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
