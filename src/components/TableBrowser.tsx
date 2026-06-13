"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "@/lib/history";

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableBrowserProps {
  table: string | null;
  onRefreshTables: () => void;
  onTableCreated?: (name: string) => void;
  onTableDropped?: () => void;
}

export default function TableBrowser({ table, onRefreshTables, onTableCreated, onTableDropped }: TableBrowserProps) {
  const { push } = useHistory();

  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCols, setNewTableCols] = useState<{ name: string; type: string }[]>([
    { name: "id", type: "SERIAL PRIMARY KEY" },
  ]);

  const [showDropConfirm, setShowDropConfirm] = useState(false);

  const idColumn =
    columns.find((c) => c.column_name === "id")?.column_name || columns[0]?.column_name;

  const fetchData = useCallback(async () => {
    if (!table) return;
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, rowsRes] = await Promise.all([
        fetch(`/api/schema?table=${encodeURIComponent(table)}`),
        fetch(`/api/rows?table=${encodeURIComponent(table)}`),
      ]);
      const schemaData = await schemaRes.json();
      const rowsData = await rowsRes.json();
      if (!schemaRes.ok) throw new Error(schemaData.error || "Failed to load schema");
      if (!rowsRes.ok) throw new Error(rowsData.error || "Failed to load rows");
      setColumns(schemaData.columns || []);
      setRows(rowsData.rows || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [table]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setShowAddForm(false);
    setShowCreateForm(false);
    setShowDropConfirm(false);
    setEditingCell(null);
  }, [table]);

  function getIdValue(row: Record<string, any>): string | number {
    return row[idColumn];
  }

  async function handleSaveEdit(rowIdx: number, col: string) {
    const row = rows[rowIdx];
    const idVal = getIdValue(row);
    const oldVal = row[col];
    if (editValue === String(oldVal ?? "")) {
      setEditingCell(null);
      return;
    }
    try {
      const res = await fetch("/api/rows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table,
          idColumn,
          id: idVal,
          column: col,
          value: castValue(editValue, columns.find((c) => c.column_name === col)?.data_type),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      const updated = [...rows];
      updated[rowIdx] = { ...updated[rowIdx], [col]: castValue(editValue, columns.find((c) => c.column_name === col)?.data_type) };
      setRows(updated);
      push({
        id: Date.now(),
        type: "editCell",
        table: table!,
        description: `edited ${table}.${col}`,
        idColumn,
        rowId: idVal,
        column: col,
        oldValue: oldVal,
        newValue: castValue(editValue, columns.find((c) => c.column_name === col)?.data_type),
      });
    } catch (e: any) {
      setError(e.message);
    }
    setEditingCell(null);
  }

  async function handleDeleteRow(rowIdx: number) {
    const row = rows[rowIdx];
    const idVal = getIdValue(row);
    try {
      const res = await fetch(
        `/api/rows?table=${encodeURIComponent(table!)}&idColumn=${encodeURIComponent(idColumn)}&id=${encodeURIComponent(idVal)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setRows(rows.filter((_, i) => i !== rowIdx));
      push({
        id: Date.now(),
        type: "deleteRow",
        table: table!,
        description: `deleted row #${idVal}`,
        idColumn,
        rowId: idVal,
        deletedRowData: row,
      });
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAddRow() {
    const data: Record<string, any> = {};
    for (const col of columns) {
      const val = newRowData[col.column_name];
      if (val !== undefined && val !== "") {
        data[col.column_name] = castValue(val, col.data_type);
      }
    }
    try {
      const res = await fetch("/api/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to add row");
      setRows([...rows, result.row]);
      push({
        id: Date.now(),
        type: "addRow",
        table: table!,
        description: `added row to ${table}`,
        idColumn,
        addedRowId: result.row[idColumn],
        addedRowData: result.row,
      });
      setShowAddForm(false);
      setNewRowData({});
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleCreateTable() {
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTableName, columns: newTableCols }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create table");
      push({
        id: Date.now(),
        type: "createTable",
        table: newTableName,
        description: `created ${newTableName}`,
        columns: newTableCols,
      });
      setShowCreateForm(false);
      setNewTableName("");
      setNewTableCols([{ name: "id", type: "SERIAL PRIMARY KEY" }]);
      onRefreshTables();
      onTableCreated?.(newTableName);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDropTable() {
    if (!table) return;
    try {
      const schemaRes = await fetch(`/api/schema?table=${encodeURIComponent(table)}`);
      const rowsRes = await fetch(`/api/rows?table=${encodeURIComponent(table)}`);
      const schemaData = await schemaRes.json();
      const rowsData = await rowsRes.json();

      const res = await fetch(`/api/tables?table=${encodeURIComponent(table)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to drop table");
      push({
        id: Date.now(),
        type: "dropTable",
        table,
        description: `dropped ${table}`,
        tableSchema: schemaData.columns || [],
        allTableData: rowsData.rows || [],
      });
      setShowDropConfirm(false);
      onRefreshTables();
      onTableDropped?.();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!table) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Select a table from the sidebar
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface shrink-0">
        <span className="text-sm font-medium text-white mr-2">{table}</span>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1 text-xs border border-border text-muted hover:text-white hover:border-white/30 transition-colors"
        >
          + Add Row
        </button>
        <span className="w-px h-4 bg-border" />
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-3 py-1 text-xs border border-border text-muted hover:text-white hover:border-white/30 transition-colors"
        >
          Create Table
        </button>
        <button
          onClick={() => setShowDropConfirm(true)}
          className="px-3 py-1 text-xs border border-[#ff4444]/50 text-[#ff4444] hover:border-[#ff4444] transition-colors"
        >
          Drop Table
        </button>
        <div className="flex-1" />
        <span className="text-xs text-muted">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-[#ff4444] bg-[#1a0000] px-3 py-2">
          <div className="text-[#ff4444] text-xs font-mono">{error}</div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            No rows in this table
          </div>
        ) : (
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border bg-surface sticky top-0">
                <th className="text-left py-2 px-3 text-muted font-medium text-xs w-10">#</th>
                {columns.map((col) => (
                  <th
                    key={col.column_name}
                    className="text-left py-2 px-3 text-muted font-medium text-xs whitespace-nowrap"
                  >
                    {col.column_name}
                    <span className="ml-1.5 text-[10px] text-[#555]">
                      {col.data_type}
                    </span>
                  </th>
                ))}
                <th className="text-left py-2 px-3 text-muted font-medium text-xs w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-b border-border hover:bg-[#1a1a1a]">
                  <td className="py-1 px-3 text-muted text-xs">{rowIdx + 1}</td>
                  {columns.map((col) => (
                    <td
                      key={col.column_name}
                      className="py-1 px-3 whitespace-nowrap cursor-pointer hover:bg-[#1f1f1f] min-w-[80px]"
                      onClick={() => {
                        setEditingCell({ rowIdx, col: col.column_name });
                        const v = row[col.column_name];
                        setEditValue(
                          v !== null && v !== undefined
                            ? typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)
                            : ""
                        );
                      }}
                    >
                      {editingCell?.rowIdx === rowIdx && editingCell?.col === col.column_name ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(rowIdx, col.column_name);
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          onBlur={() => handleSaveEdit(rowIdx, col.column_name)}
                          className="bg-surface-2 text-white border border-white/30 px-1 py-0.5 w-full text-sm font-mono outline-none"
                        />
                      ) : (
                        <span className="text-white/90">{formatCell(row[col.column_name])}</span>
                      )}
                    </td>
                  ))}
                  <td className="py-1 px-3">
                    <button
                      onClick={() => handleDeleteRow(rowIdx)}
                      className="text-xs text-[#ff4444]/70 hover:text-[#ff4444] transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Row Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface border border-border w-[420px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border text-sm font-medium">
              Add Row — {table}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {columns.map((col) => (
                <div key={col.column_name}>
                  <label className="text-xs text-muted block mb-1">
                    {col.column_name}
                    <span className="ml-1.5 text-[10px] text-[#555]">{col.data_type}</span>
                  </label>
                  <input
                    value={newRowData[col.column_name] ?? ""}
                    onChange={(e) =>
                      setNewRowData({ ...newRowData, [col.column_name]: e.target.value })
                    }
                    className="w-full bg-bg text-white border border-border px-2 py-1.5 text-sm font-mono outline-none focus:border-white/30"
                    placeholder={col.is_nullable === "YES" ? "(null)" : ""}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end px-4 py-3 border-t border-border">
              <button
                onClick={() => { setShowAddForm(false); setNewRowData({}); }}
                className="px-3 py-1.5 text-xs text-muted border border-border hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 text-xs bg-white text-black font-medium hover:bg-white/90 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Table Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface border border-border w-[500px] max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border text-sm font-medium">
              Create Table
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Table Name</label>
                <input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-bg text-white border border-border px-2 py-1.5 text-sm font-mono outline-none focus:border-white/30"
                  placeholder="e.g. users"
                />
              </div>
              <div className="text-xs text-muted mb-1">Columns</div>
              {newTableCols.map((col, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={col.name}
                    onChange={(e) => {
                      const updated = [...newTableCols];
                      updated[i] = { ...updated[i], name: e.target.value };
                      setNewTableCols(updated);
                    }}
                    className="flex-1 bg-bg text-white border border-border px-2 py-1.5 text-sm font-mono outline-none focus:border-white/30"
                    placeholder="column name"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => {
                      const updated = [...newTableCols];
                      updated[i] = { ...updated[i], type: e.target.value };
                      setNewTableCols(updated);
                    }}
                    className="flex-[1.5] bg-bg text-white border border-border px-2 py-1.5 text-sm font-mono outline-none focus:border-white/30"
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="BIGINT">BIGINT</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="TIMESTAMP">TIMESTAMP</option>
                    <option value="DATE">DATE</option>
                    <option value="REAL">REAL</option>
                    <option value="DOUBLE PRECISION">DOUBLE PRECISION</option>
                    <option value="JSONB">JSONB</option>
                    <option value="SERIAL PRIMARY KEY">SERIAL PRIMARY KEY</option>
                    <option value="UUID DEFAULT gen_random_uuid() PRIMARY KEY">UUID PRIMARY KEY</option>
                  </select>
                  {newTableCols.length > 1 && (
                    <button
                      onClick={() => setNewTableCols(newTableCols.filter((_, j) => j !== i))}
                      className="text-xs text-[#ff4444]/70 hover:text-[#ff4444]"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setNewTableCols([...newTableCols, { name: "", type: "TEXT" }])}
                className="text-xs text-muted hover:text-white transition-colors"
              >
                + Add Column
              </button>
            </div>
            <div className="flex gap-2 justify-end px-4 py-3 border-t border-border">
              <button
                onClick={() => { setShowCreateForm(false); setNewTableName(""); setNewTableCols([{ name: "id", type: "SERIAL PRIMARY KEY" }]); }}
                className="px-3 py-1.5 text-xs text-muted border border-border hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTable}
                disabled={!newTableName || newTableCols.some((c) => !c.name)}
                className="px-3 py-1.5 text-xs bg-white text-black font-medium hover:bg-white/90 disabled:opacity-30 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Table Confirmation */}
      {showDropConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface border border-[#ff4444]/30 w-[380px]">
            <div className="px-4 py-3 border-b border-border text-sm font-medium text-[#ff4444]">
              Drop Table
            </div>
            <div className="p-4 text-sm text-muted">
              Are you sure you want to drop <span className="text-white font-mono">{table}</span>?
              This cannot be undone (though undo history will save a backup).
            </div>
            <div className="flex gap-2 justify-end px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowDropConfirm(false)}
                className="px-3 py-1.5 text-xs text-muted border border-border hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDropTable}
                className="px-3 py-1.5 text-xs bg-[#ff4444] text-white font-medium hover:bg-[#ff3333] transition-colors"
              >
                Drop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCell(val: any): React.ReactNode {
  if (val === null || val === undefined) return <span className="text-[#555] italic">NULL</span> as any;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function castValue(val: string, type?: string): any {
  if (!type) return val;
  const t = type.toUpperCase();
  if (t.includes("INT") || t === "SERIAL" || t === "BIGINT" || t === "SMALLINT") {
    const n = Number(val);
    return isNaN(n) ? val : n;
  }
  if (t === "REAL" || t === "DOUBLE PRECISION" || t === "NUMERIC" || t === "FLOAT") {
    const n = Number(val);
    return isNaN(n) ? val : n;
  }
  if (t === "BOOLEAN" || t === "BOOL") {
    if (val === "true" || val === "t" || val === "1") return true;
    if (val === "false" || val === "f" || val === "0") return false;
    return val;
  }
  if (val === "" || val === "NULL") return null;
  return val;
}
