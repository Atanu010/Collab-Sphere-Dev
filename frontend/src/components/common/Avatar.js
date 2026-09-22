import { initials } from "@/utils/format";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

const DOT_SIZES = {
  xs: "w-2 h-2",
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-3.5 h-3.5",
  xl: "w-4 h-4",
};

export default function Avatar({ user, size = "md", online, showPresence = false, className }) {
  const color = user?.avatarColor || "#4F46E5";
  return (
    <div className={cn("relative inline-flex shrink-0", className)} data-testid="user-avatar">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-semibold text-white select-none font-display",
          SIZES[size]
        )}
        style={{ backgroundColor: color }}
      >
        {initials(user?.name)}
      </div>
      {showPresence && (
        <span
          data-testid={online ? "presence-badge-online" : "presence-badge-offline"}
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-white",
            DOT_SIZES[size],
            online ? "bg-emerald-500" : "bg-slate-300"
          )}
        />
      )}
    </div>
  );
}
