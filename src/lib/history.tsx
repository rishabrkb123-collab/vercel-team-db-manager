"use client";

import { createContext, useContext, useCallback, useReducer, type ReactNode } from "react";

export interface HistoryEntry {
  id: number;
  type: "editCell" | "deleteRow" | "addRow" | "createTable" | "dropTable";
  table: string;
  description: string;
  idColumn?: string;
  rowId?: string | number;
  column?: string;
  oldValue?: any;
  newValue?: any;
  deletedRowData?: Record<string, any>;
  addedRowData?: Record<string, any>;
  addedRowId?: string | number;
  columns?: { name: string; type: string }[];
  tableSchema?: { column_name: string; data_type: string }[];
  allTableData?: Record<string, any>[];
}

interface State {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

type Action =
  | { type: "PUSH"; entry: HistoryEntry }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PUSH":
      return { past: [...state.past, action.entry], future: [] };
    case "UNDO": {
      if (state.past.length === 0) return state;
      const entry = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        future: [entry, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const entry = state.future[0];
      return {
        past: [...state.past, entry],
        future: state.future.slice(1),
      };
    }
    case "CLEAR":
      return { past: [], future: [] };
    default:
      return state;
  }
}

interface HistoryContextType {
  past: HistoryEntry[];
  future: HistoryEntry[];
  push: (entry: HistoryEntry) => void;
  dispatchUndo: () => HistoryEntry | undefined;
  dispatchRedo: () => HistoryEntry | undefined;
  canUndo: boolean;
  canRedo: boolean;
}

const HistoryContext = createContext<HistoryContextType | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { past: [], future: [] });

  const push = useCallback((entry: HistoryEntry) => {
    dispatch({ type: "PUSH", entry });
  }, []);

  const dispatchUndo = useCallback(() => {
    if (state.past.length === 0) return undefined;
    const entry = state.past[state.past.length - 1];
    dispatch({ type: "UNDO" });
    return entry;
  }, [state.past]);

  const dispatchRedo = useCallback(() => {
    if (state.future.length === 0) return undefined;
    const entry = state.future[0];
    dispatch({ type: "REDO" });
    return entry;
  }, [state.future]);

  return (
    <HistoryContext.Provider
      value={{
        past: state.past,
        future: state.future,
        push,
        dispatchUndo,
        dispatchRedo,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider");
  return ctx;
}
