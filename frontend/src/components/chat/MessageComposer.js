import { useRef, useState } from "react";
import { api } from "@/services/api";
import { formatBytes } from "@/utils/format";
import { Paperclip, Send, X, FileText, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessageComposer({ placeholder, onSend, onTyping, disabled }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const typingTimeout = useRef(null);
  const taRef = useRef(null);

  const emitTyping = () => {
    onTyping?.(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping?.(false), 2000);
  };

  const handleChange = (e) => {
    setText(e.target.value);
    emitTyping();
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file);
        const { data } = await api.post("/files", form, { headers: { "Content-Type": "multipart/form-data" } });
        setAttachments((prev) => [...prev, data]);
      } catch (err) {
        /* ignore per-file failure */
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = () => {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    onSend(content, attachments.map((a) => a.id));
    setText("");
    setAttachments([]);
    onTyping?.(false);
    clearTimeout(typingTimeout.current);
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="px-3 md:px-6 pb-4 pt-1 bg-slate-50" data-testid="message-composer">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map((a) => (
              <div key={a.id} data-testid="composer-attachment" className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-1 py-1.5">
                <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white", a.isImage ? "bg-violet-500" : "bg-sky-500")}>
                  {a.isImage ? <ImageIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                </div>
                <div className="text-xs">
                  <div className="font-medium text-slate-700 max-w-[140px] truncate">{a.name}</div>
                  <div className="text-slate-400">{formatBytes(a.size)}</div>
                </div>
                <button onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 p-2.5">
          <button
            onClick={() => fileRef.current?.click()}
            data-testid="composer-attach-button"
            disabled={disabled || uploading}
            title="Attach file"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors shrink-0 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} data-testid="composer-file-input" />
          <textarea
            ref={taRef}
            data-testid="message-input-textarea"
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={placeholder || "Type a message…"}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none py-2 leading-relaxed cs-scroll"
          />
          <button
            onClick={send}
            data-testid="send-message-button"
            disabled={disabled || (!text.trim() && attachments.length === 0)}
            className="w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
