"use client";

import { useState, useEffect } from "react";

interface SidebarProps {
  activeTable: string | null;
  onSelectTable: (table: string) => void;
  refreshTrigger: number;
}

export default function Sidebar({ activeTable, onSelectTable, refreshTrigger }: SidebarProps) {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/tables")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else if (data.tables) setTables(data.tables);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  return (
    <div className="w-56 shrink-0 bg-surface border-r border-border flex flex-col h-full overflow-hidden">
      <div className="px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">
        Tables
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-3 py-2 text-xs text-muted">Loading...</div>
        )}
        {!loading && error && (
          <div className="px-3 py-2 text-xs text-red-400 break-words">{error}</div>
        )}
        {!loading && !error && tables.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted">No tables found</div>
        )}
        {tables.map((t) => (
          <button
            key={t}
            onClick={() => onSelectTable(t)}
            className={`w-full text-left px-3 py-2 text-sm border-b border-border transition-colors hover:bg-[#1f1f1f] ${
              activeTable === t ? "text-white bg-[#1a1a1a]" : "text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
