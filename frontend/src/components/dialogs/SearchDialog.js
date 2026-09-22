import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import Modal, { modalInput } from "@/components/common/Modal";
import Avatar from "@/components/common/Avatar";
import { Search, Hash, MessageSquare } from "lucide-react";
import { formatRelative } from "@/utils/format";

export default function SearchDialog({ open, onClose, workspaceId }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async (val) => {
    setQ(val);
    if (val.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/messages/search", { params: { q: val, workspaceId } });
      setResults(data.results);
      setSearched(true);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const openResult = (r) => {
    if (r.channelId) navigate(`/workspace/${r.workspaceId || workspaceId}/channel/${r.channelId}`);
    else if (r.conversationId) navigate(`/messages/${r.conversationId}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Search messages" testid="search-modal" size="lg">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            data-testid="search-input"
            className={modalInput + " pl-9"}
            placeholder="Search messages you have access to…"
            value={q}
            onChange={(e) => run(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-96 overflow-y-auto cs-scroll -mx-1">
          {loading && <div className="text-center py-8 text-sm text-slate-400">Searching…</div>}
          {!loading && searched && results.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">No messages found for “{q}”.</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => openResult(r)}
              data-testid="search-result-item"
              className="w-full text-left flex gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Avatar user={r.sender} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{r.sender?.name}</span>
                  <span className="flex items-center gap-0.5">
                    {r.channelId ? <Hash className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                    {r.context}
                  </span>
                  <span>· {formatRelative(r.createdAt)}</span>
                </div>
                <div className="text-sm text-slate-800 truncate">{r.content}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
