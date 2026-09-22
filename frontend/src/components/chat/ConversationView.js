import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api, fileDownloadUrl } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import Avatar from "@/components/common/Avatar";
import MessageComposer from "@/components/chat/MessageComposer";
import { formatTime, formatDayLabel, sameMinuteGroup, formatBytes } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  Hash, Lock, Users, Menu, PanelRightClose, PanelRightOpen, Loader2, FileText, ImageIcon,
  Download, Check, CheckCheck, WifiOff,
} from "lucide-react";

export default function ConversationView({ type }) {
  const params = useParams();
  const targetId = type === "channel" ? params.channelId : params.conversationId;
  const { user } = useAuth();
  const { status, onlineIds, send, subscribe } = useRealtime();
  const { setRightOpen, rightOpen, setMobileNavOpen, onlineIds: _o } = useWorkspace();

  const [header, setHeader] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimers = useRef({});

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = (behavior = "auto") => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }));
  };

  const markRead = useCallback(() => {
    if (!send({ type: "read", targetId })) {
      api.post(`/messages/${targetId}/read`).catch(() => {});
    }
  }, [send, targetId]);

  // Load header + initial messages
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);
    setTypingUsers({});
    (async () => {
      try {
        if (type === "channel") {
          const { data } = await api.get(`/channels/${targetId}`);
          if (active) setHeader({ kind: "channel", ...data });
        } else {
          const { data } = await api.get(`/conversations/${targetId}`);
          if (active) setHeader({ kind: "dm", ...data });
        }
        const base = type === "channel" ? `/channels/${targetId}/messages` : `/conversations/${targetId}/messages`;
        const { data } = await api.get(base, { params: { limit: 30 } });
        if (!active) return;
        setMessages(data.messages);
        setHasMore(data.hasMore);
        setLoading(false);
        scrollToBottom();
        markRead();
      } catch (e) {
        if (active) {
          setHeader({ kind: "error" });
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [targetId, type, markRead]);

  // Realtime events
  useEffect(() => {
    return subscribe((evt) => {
      if (evt.type === "message") {
        const m = evt.message;
        const belongs = type === "channel" ? m.channelId === targetId : m.conversationId === targetId;
        if (!belongs) return;
        const stick = isNearBottom() || m.senderId === user?.id;
        setMessages((prev) => {
          if (evt.tempId) {
            const idx = prev.findIndex((x) => x.id === evt.tempId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = m;
              return copy;
            }
          }
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
        if (stick) scrollToBottom("smooth");
        if (m.senderId !== user?.id) markRead();
      } else if (evt.type === "typing" && evt.targetId === targetId && evt.userId !== user?.id) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (evt.isTyping) next[evt.userId] = evt.userName;
          else delete next[evt.userId];
          return next;
        });
        clearTimeout(typingTimers.current[evt.userId]);
        if (evt.isTyping) {
          typingTimers.current[evt.userId] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = { ...prev };
              delete next[evt.userId];
              return next;
            });
          }, 4000);
        }
      } else if (evt.type === "read" && evt.targetId === targetId && evt.userId !== user?.id) {
        setMessages((prev) => prev.map((m) => (m.readBy?.includes(evt.userId) ? m : { ...m, readBy: [...(m.readBy || []), evt.userId] })));
      }
    });
  }, [subscribe, targetId, type, user?.id, markRead]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight || 0;
    try {
      const base = type === "channel" ? `/channels/${targetId}/messages` : `/conversations/${targetId}/messages`;
      const { data } = await api.get(base, { params: { limit: 30, before: messages[0].createdAt } });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  const onScroll = (e) => {
    if (e.target.scrollTop < 60 && hasMore && !loadingMore) loadMore();
  };

  const doSend = (content, attachmentIds) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = { type: "message", content, attachments: attachmentIds, tempId };
    if (type === "channel") payload.channelId = targetId;
    else payload.conversationId = targetId;

    const optimistic = {
      id: tempId, content, senderId: user?.id, sender: user,
      channelId: type === "channel" ? targetId : null,
      conversationId: type === "dm" ? targetId : null,
      attachments: [], mentions: [], createdAt: new Date().toISOString(), readBy: [user?.id], pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom("smooth");

    const sent = send(payload);
    if (!sent) {
      const base = type === "channel" ? `/channels/${targetId}/messages` : `/conversations/${targetId}/messages`;
      api.post(base, { content, attachments: attachmentIds }).then(({ data }) => {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      }).catch(() => {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      });
    }
  };

  const emitTyping = (isTyping) => {
    const payload = { type: "typing", isTyping };
    if (type === "channel") payload.channelId = targetId;
    else payload.conversationId = targetId;
    send(payload);
  };

  if (header?.kind === "error") {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">You don't have access to this conversation.</p>
        </div>
      </div>
    );
  }

  const dmUser = header?.kind === "dm" ? header.user : null;
  const dmOnline = dmUser ? onlineIds.has(dmUser.id) : false;
  const typingNames = Object.values(typingUsers);
  const lastOwn = [...messages].reverse().find((m) => m.senderId === user?.id && !m.pending);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50" data-testid="conversation-view">
      {/* Header */}
      <div className="h-14 px-3 md:px-6 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setMobileNavOpen(true)} data-testid="mobile-nav-toggle" className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
            <Menu className="w-5 h-5" />
          </button>
          {header?.kind === "channel" ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-400">{header.isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-5 h-5" />}</span>
              <div className="min-w-0">
                <div className="font-bold font-display text-slate-900 truncate leading-tight" data-testid="conversation-title">{header.name}</div>
                {header.description && <div className="text-xs text-slate-400 truncate">{header.description}</div>}
              </div>
            </div>
          ) : dmUser ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar user={dmUser} size="sm" showPresence online={dmOnline} />
              <div className="min-w-0">
                <div className="font-bold font-display text-slate-900 truncate leading-tight" data-testid="conversation-title">{dmUser.name}</div>
                <div className={cn("text-xs", dmOnline ? "text-emerald-600" : "text-slate-400")}>{dmOnline ? "Active now" : "Offline"}</div>
              </div>
            </div>
          ) : (
            <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
          )}
        </div>
        <button onClick={() => setRightOpen((v) => !v)} data-testid="member-details-toggle-button" title="Toggle details" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
          {rightOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
        </button>
      </div>

      {status !== "online" && (
        <div data-testid="connection-banner" className="bg-amber-50 border-b border-amber-100 text-amber-700 text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" /> {status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto cs-scroll px-3 md:px-6 py-4" data-testid="message-list">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                {header?.kind === "channel" ? <Hash className="w-7 h-7" /> : <Users className="w-7 h-7" />}
              </div>
              <h3 className="font-semibold font-display text-slate-800 text-lg">
                {header?.kind === "channel" ? `Welcome to #${header.name}` : `Chat with ${dmUser?.name || ""}`}
              </h3>
              <p className="text-sm text-slate-400 mt-1">This is the very beginning. Say hello 👋</p>
            </div>
          </div>
        ) : (
          <>
            {loadingMore && (
              <div className="flex justify-center py-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped = prev && sameMinuteGroup(prev, m) && !prev.pending;
              const showDay = !prev || formatDayLabel(prev.createdAt) !== formatDayLabel(m.createdAt);
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2">{formatDayLabel(m.createdAt)}</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  )}
                  <MessageRow m={m} grouped={grouped} isOwn={m.senderId === user?.id} isLastOwn={m.id === lastOwn?.id} dmUser={dmUser} isDm={type === "dm"} />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Typing */}
      <div className="h-6 px-4 md:px-6 shrink-0">
        {typingNames.length > 0 && (
          <div data-testid="typing-indicator-container" className="flex items-center gap-2 text-xs text-slate-500 italic">
            <span className="text-indigo-500 flex gap-0.5">
              <span className="cs-dot" /><span className="cs-dot" /><span className="cs-dot" />
            </span>
            {typingNames.length === 1 ? `${typingNames[0]} is typing…` : `${typingNames.length} people are typing…`}
          </div>
        )}
      </div>

      <MessageComposer
        placeholder={header?.kind === "channel" ? `Message #${header.name}` : `Message ${dmUser?.name || ""}`}
        onSend={doSend}
        onTyping={emitTyping}
        disabled={loading || header?.kind === "error"}
      />
    </div>
  );
}

function MessageRow({ m, grouped, isOwn, isLastOwn, dmUser, isDm }) {
  const seen = isDm && dmUser && (m.readBy || []).includes(dmUser.id);
  return (
    <div className={cn("group flex gap-3 py-0.5 px-1 -mx-1 rounded-lg hover:bg-slate-100/60 transition-colors", grouped ? "mt-0" : "mt-3")} data-testid="message-item">
      <div className="w-9 shrink-0">
        {!grouped && <Avatar user={m.sender} size="sm" />}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm text-slate-900">{m.sender?.name}</span>
            <span className="text-[11px] text-slate-400">{formatTime(m.createdAt)}</span>
          </div>
        )}
        {m.content && (
          <div className={cn("text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words", m.pending && "opacity-50")}>
            {m.content}
          </div>
        )}
        {m.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {m.attachments.map((a) => (
              <AttachmentCard key={a.id} a={a} />
            ))}
          </div>
        )}
        {isOwn && isLastOwn && isDm && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5" data-testid="read-receipt">
            {seen ? <><CheckCheck className="w-3.5 h-3.5 text-indigo-500" /> Seen</> : <><Check className="w-3.5 h-3.5" /> Sent</>}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentCard({ a }) {
  if (a.isImage) {
    return (
      <a href={fileDownloadUrl(a.id)} target="_blank" rel="noopener noreferrer" data-testid="message-attachment" className="block">
        <img src={fileDownloadUrl(a.id)} alt={a.name} className="max-w-[260px] max-h-[220px] rounded-xl border border-slate-200 object-cover" />
      </a>
    );
  }
  return (
    <a href={fileDownloadUrl(a.id)} target="_blank" rel="noopener noreferrer" data-testid="message-attachment" className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2.5 pr-4 hover:border-indigo-300 transition-colors max-w-[280px]">
      <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800 truncate">{a.name}</div>
        <div className="text-xs text-slate-400">{formatBytes(a.size)}</div>
      </div>
      <Download className="w-4 h-4 text-slate-300" />
    </a>
  );
}
