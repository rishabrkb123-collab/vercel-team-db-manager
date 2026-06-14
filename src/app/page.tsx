"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import TableBrowser from "@/components/TableBrowser";
import SqlEditor from "@/components/SqlEditor";
import SchemaViewer from "@/components/SchemaViewer";
import UndoBar from "@/components/UndoBar";
import { useHistory } from "@/lib/history";

export default function Home() {
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"browser" | "sql" | "schema">("browser");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { past, future, dispatchUndo, dispatchRedo } = useHistory();

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  const executeUndo = useCallback(async () => {
    if (past.length === 0) return;
    const entry = past[past.length - 1];
    try {
      switch (entry.type) {
        case "editCell": {
          await fetch("/api/rows", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: entry.table,
              idColumn: entry.idColumn,
              id: entry.rowId,
              column: entry.column,
              value: entry.oldValue,
            }),
          });
          break;
        }
        case "deleteRow": {
          await fetch("/api/rows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: entry.table,
              data: entry.deletedRowData,
            }),
          });
          break;
        }
        case "addRow": {
          await fetch(
            `/api/rows?table=${encodeURIComponent(entry.table)}&idColumn=${encodeURIComponent(entry.idColumn!)}&id=${encodeURIComponent(entry.addedRowId!)}`,
            { method: "DELETE" }
          );
          break;
        }
        case "createTable": {
          await fetch(`/api/tables?table=${encodeURIComponent(entry.table)}`, { method: "DELETE" });
          break;
        }
        case "dropTable": {
          if (entry.tableSchema && entry.tableSchema.length > 0) {

            await fetch("/api/tables", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: entry.table,
                columns: entry.tableSchema.map((c: any) => ({
                  name: c.column_name,
                  type: c.data_type,
                })),
              }),
            });
            if (entry.allTableData && entry.allTableData.length > 0) {
              for (const row of entry.allTableData) {
                await fetch("/api/rows", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ table: entry.table, data: row }),
                });
              }
            }
          }
          break;
        }
      }
      dispatchUndo();
      setActiveTable(entry.table);
      triggerRefresh();
    } catch (e) {
      console.error("Undo failed:", e);
    }
  }, [past, dispatchUndo, triggerRefresh]);

  const executeRedo = useCallback(async () => {
    if (future.length === 0) return;
    const entry = future[0];
    try {
      switch (entry.type) {
        case "editCell": {
          await fetch("/api/rows", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: entry.table,
              idColumn: entry.idColumn,
              id: entry.rowId,
              column: entry.column,
              value: entry.newValue,
            }),
          });
          break;
        }
        case "deleteRow": {
          await fetch(
            `/api/rows?table=${encodeURIComponent(entry.table)}&idColumn=${encodeURIComponent(entry.idColumn!)}&id=${encodeURIComponent(entry.rowId!)}`,
            { method: "DELETE" }
          );
          break;
        }
        case "addRow": {
          await fetch("/api/rows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: entry.table, data: entry.addedRowData }),
          });
          break;
        }
        case "createTable": {
          await fetch("/api/tables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: entry.table, columns: entry.columns }),
          });
          break;
        }
        case "dropTable": {
          if (entry.tableSchema && entry.tableSchema.length > 0) {

            await fetch("/api/tables", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: entry.table,
                columns: entry.tableSchema.map((c: any) => ({
                  name: c.column_name,
                  type: c.data_type,
                })),
              }),
            });
            if (entry.allTableData && entry.allTableData.length > 0) {
              for (const row of entry.allTableData) {
                await fetch("/api/rows", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ table: entry.table, data: row }),
                });
              }
            }
          }
          break;
        }
      }
      dispatchRedo();
      setActiveTable(entry.table);
      triggerRefresh();
    } catch (e) {
      console.error("Redo failed:", e);
    }
  }, [future, dispatchRedo, triggerRefresh]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        executeUndo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        executeRedo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [executeUndo, executeRedo]);

  return (
    <div className="h-screen flex flex-col bg-bg text-white">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTable={activeTable}
          onSelectTable={setActiveTable}
          refreshTrigger={refreshTrigger}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setActiveTab("browser")}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                activeTab === "browser"
                  ? "text-white border-b border-white"
                  : "text-muted hover:text-white"
              }`}
            >
              Table Browser
            </button>
            <button
              onClick={() => setActiveTab("sql")}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                activeTab === "sql"
                  ? "text-white border-b border-white"
                  : "text-muted hover:text-white"
              }`}
            >
              SQL Editor
            </button>
            <button
              onClick={() => setActiveTab("schema")}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                activeTab === "schema"
                  ? "text-white border-b border-white"
                  : "text-muted hover:text-white"
              }`}
            >
              Schema
            </button>
          </div>

          {/* Content */}
          {activeTab === "browser" ? (
            <TableBrowser
              table={activeTable}
              onRefreshTables={triggerRefresh}
              onTableCreated={(name) => setActiveTable(name)}
              onTableDropped={() => setActiveTable(null)}
              refreshTrigger={refreshTrigger}
            />
          ) : activeTab === "sql" ? (
            <SqlEditor />
          ) : (
            <SchemaViewer
              onTableClick={(name) => {
                setActiveTable(name);
                setActiveTab("browser");
              }}
              refreshTrigger={refreshTrigger}
            />
          )}
        </div>
      </div>

      {/* Undo/Redo bar at the bottom */}
      <UndoBar />
    </div>
  );
}
