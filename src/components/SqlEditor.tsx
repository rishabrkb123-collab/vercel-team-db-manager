"use client";

import { useState, useRef, useEffect } from "react";

interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
  duration: number;
  fields: { name: string; dataTypeID: number }[];
}

export default function SqlEditor() {
  const [sql, setSql] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const runQueryRef = useRef(runQuery);
  runQueryRef.current = runQuery;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (document.activeElement === textareaRef.current) {
          e.preventDefault();
          runQueryRef.current();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function runQuery() {
    if (!sql.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Query failed");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const columns = result?.fields?.map((f) => f.name) || [];
  const rows = result?.rows || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex gap-2 items-start">
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="Enter SQL query... (Ctrl+Enter to run)"
            className="flex-1 bg-surface text-white border border-border p-3 text-sm font-mono min-h-[100px] resize-y outline-none focus:border-white/30"
            spellCheck={false}
          />
          <button
            onClick={runQuery}
            disabled={running || !sql.trim()}
            className="px-4 py-2 text-sm bg-white text-black font-medium hover:bg-white/90 disabled:opacity-30 shrink-0"
          >
            {running ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {error && (
          <div className="border border-[#ff4444] bg-[#1a0000] p-3 mb-3">
            <div className="text-[#ff4444] text-sm font-mono whitespace-pre-wrap">{error}</div>
          </div>
        )}

        {result && (
          <div>
            <div className="text-xs text-muted mb-2">
              {result.rowCount} row{result.rowCount !== 1 ? "s" : ""} returned in {result.duration}ms
            </div>
            {columns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted font-medium text-xs">#</th>
                      {columns.map((col) => (
                        <th key={col} className="text-left py-2 px-3 text-muted font-medium text-xs whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-border hover:bg-[#1a1a1a]">
                        <td className="py-1.5 px-3 text-muted text-xs">{i + 1}</td>
                        {columns.map((col) => (
                          <td key={col} className="py-1.5 px-3 text-white/90 whitespace-nowrap">
                            {formatValue(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-muted">Query executed successfully (no result set)</div>
            )}
          </div>
        )}

        {!result && !error && (
          <div className="text-xs text-muted pt-4 text-center">
            Run a query to see results
          </div>
        )}
      </div>
    </div>
  );
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}
