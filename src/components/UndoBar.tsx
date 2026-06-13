"use client";

import { useHistory } from "@/lib/history";

export default function UndoBar() {
  const { past, future } = useHistory();

  const allActions = [...past, ...future];
  const lastFive = allActions.slice(-5);

  return (
    <div className="h-8 bg-surface border-t border-border flex items-center px-3 gap-2 overflow-x-auto shrink-0">
      <span className="text-xs text-muted mr-1 whitespace-nowrap">History:</span>
      {lastFive.length === 0 && (
        <span className="text-xs text-muted">No actions yet</span>
      )}
      {lastFive.map((entry) => {
        const isUndone = future.includes(entry);
        return (
          <span
            key={entry.id}
            className={`text-xs px-2 py-0.5 whitespace-nowrap ${
              isUndone
                ? "text-[#555] border border-[#222]"
                : "text-white/70 border border-[#333]"
            }`}
          >
            {entry.description}
          </span>
        );
      })}
    </div>
  );
}
