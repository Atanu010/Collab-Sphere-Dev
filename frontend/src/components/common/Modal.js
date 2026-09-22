import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export default function Modal({ open, onClose, title, children, footer, size = "md", testid }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid={testid}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cs-fade-up" onClick={onClose} />
      <div className={cn("relative bg-white rounded-2xl shadow-2xl w-full border border-slate-100 cs-fade-up", widths[size])}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold font-display text-slate-900">{title}</h3>
          <button onClick={onClose} data-testid="modal-close-button" className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const modalInput =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm";

export function PrimaryButton({ children, className, ...props }) {
  return (
    <button
      className={cn(
        "h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className, ...props }) {
  return (
    <button
      className={cn(
        "h-10 px-4 rounded-lg text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
