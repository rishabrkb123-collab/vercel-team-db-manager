"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface ForeignKey {
  table_schema: string;
  table_name: string;
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
  inferred?: boolean;
}

interface SchemaTable {
  table_schema: string;
  table_name: string;
  display_name: string;
  columns: Column[];
  foreignKeys: ForeignKey[];
}

const TABLE_WIDTH = 230;
const HEADER_HEIGHT = 34;
const COLUMN_HEIGHT = 24;
const H_GAP = 50;
const V_GAP = 50;
const PADDING = 40;

interface LayoutRect {
  table: SchemaTable;
  x: number;
  y: number;
  w: number;
  h: number;
}

function layout(tables: SchemaTable[]): LayoutRect[] {
  if (!tables.length) return [];
  const n = tables.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)));
  const rows = Math.ceil(n / cols);
  const colHeights = new Array(cols).fill(0);

  return tables.map((t, i) => {
    const col = i % cols;
    const h = HEADER_HEIGHT + t.columns.length * COLUMN_HEIGHT;
    const x2 = col * (TABLE_WIDTH + H_GAP);
    const y2 = colHeights[col];
    colHeights[col] = y2 + h + V_GAP;
    return { table: t, x: x2, y: y2, w: TABLE_WIDTH, h };
  });
}

function getConnectionPoints(layouts: LayoutRect[], fk: ForeignKey) {
  const sourceLayout = layouts.find(
    (l) => l.table.display_name === getTableKey(fk.table_schema, fk.table_name)
  );
  const targetLayout = layouts.find(
    (l) =>
      l.table.display_name ===
      getTableKey(fk.foreign_table_schema, fk.foreign_table_name)
  );
  if (!sourceLayout || !targetLayout) return null;

  const srcColIdx = sourceLayout.table.columns.findIndex(
    (c) => c.column_name === fk.column_name
  );
  const tgtColIdx = targetLayout.table.columns.findIndex(
    (c) => c.column_name === fk.foreign_column_name
  );
  if (srcColIdx === -1 || tgtColIdx === -1) return null;

  const srcY = sourceLayout.y + HEADER_HEIGHT + srcColIdx * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;
  const tgtY = targetLayout.y + HEADER_HEIGHT + tgtColIdx * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;

  if (sourceLayout.x < targetLayout.x) {
    return {
      x1: sourceLayout.x + sourceLayout.w,
      y1: srcY,
      x2: targetLayout.x,
      y2: tgtY,
      inferred: fk.inferred,
    };
  } else {
    return {
      x1: sourceLayout.x,
      y1: srcY,
      x2: targetLayout.x + targetLayout.w,
      y2: tgtY,
      inferred: fk.inferred,
    };
  }
}

function getTableKey(schema: string, name: string) {
  return schema === "public" ? name : `${schema}.${name}`;
}

interface SchemaViewerProps {
  onTableClick: (table: string) => void;
  refreshTrigger: number;
}

export default function SchemaViewer({ onTableClick, refreshTrigger }: SchemaViewerProps) {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState({ x: PADDING, y: PADDING, scale: 1 });
  const [panning, setPanning] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, viewX: 0, viewY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/schema/full")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else if (data.tables) setTables(data.tables);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const layouts = layout(tables);

  const findTableNode = (el: EventTarget | null): string | null => {
    let target = el as Element | null;
    while (target) {
      if (target.hasAttribute && target.hasAttribute("data-table-name")) {
        return target.getAttribute("data-table-name");
      }
      target = target.parentElement;
    }
    return null;
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (findTableNode(e.target)) return;
      if (e.button !== 0) return;
      setPanning(true);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        viewX: view.x,
        viewY: view.y,
      };
    },
    [view.x, view.y]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!panning) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setView((v) => ({
        ...v,
        x: dragRef.current.viewX + dx,
        y: dragRef.current.viewY + dy,
      }));
    },
    [panning]
  );

  const handleMouseUp = useCallback(() => {
    setPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setView((v) => ({
      ...v,
      scale: Math.max(0.1, Math.min(4, v.scale * factor)),
    }));
  }, []);

  const handleTableClick = useCallback(
    (e: React.MouseEvent) => {
      const name = findTableNode(e.target);
      if (name) onTableClick(name);
    },
    [onTableClick]
  );

  const connections = layouts.flatMap((l) =>
    l.table.foreignKeys
      .map((fk) => getConnectionPoints(layouts, fk))
      .filter(Boolean)
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Loading schema...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        No tables found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <svg
        ref={svgRef}
        className={`w-full h-full ${panning ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleTableClick}
      >
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
          {connections.map((conn, i) => (
            <g key={i}>
              <line
                x1={conn!.x1}
                y1={conn!.y1}
                x2={conn!.x2}
                y2={conn!.y2}
                stroke={conn!.inferred ? "#555" : "#6a9fb5"}
                strokeWidth={1.5}
                strokeDasharray={conn!.inferred ? "4 4" : "none"}
              />
              <circle
                cx={conn!.x2}
                cy={conn!.y2}
                r={3}
                fill={conn!.inferred ? "#555" : "#6a9fb5"}
              />
            </g>
          ))}

          {layouts.map((l) => (
            <g key={l.table.display_name} data-table-name={l.table.display_name}>
              <rect
                x={l.x}
                y={l.y}
                width={l.w}
                height={l.h}
                rx={5}
                fill="#161616"
                stroke="#333"
                strokeWidth={1}
              />
              <rect
                x={l.x}
                y={l.y}
                width={l.w}
                height={HEADER_HEIGHT}
                rx={5}
                fill="#1e1e1e"
              />
              <rect
                x={l.x}
                y={l.y + HEADER_HEIGHT - 5}
                width={l.w}
                height={5}
                fill="#1e1e1e"
              />
              <text
                x={l.x + l.w / 2}
                y={l.y + HEADER_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={12}
                fontWeight={600}
                fontFamily="monospace"
                pointerEvents="none"
              >
                {l.table.display_name}
              </text>

              {l.table.columns.map((col, ci) => (
                <g key={col.column_name}>
                  <rect
                    x={l.x}
                    y={l.y + HEADER_HEIGHT + ci * COLUMN_HEIGHT}
                    width={l.w}
                    height={COLUMN_HEIGHT}
                    fill={ci % 2 === 0 ? "#161616" : "#1a1a1a"}
                  />
                  <text
                    x={l.x + 10}
                    y={l.y + HEADER_HEIGHT + ci * COLUMN_HEIGHT + COLUMN_HEIGHT / 2}
                    dominantBaseline="central"
                    fill="#ccc"
                    fontSize={10.5}
                    fontFamily="monospace"
                    pointerEvents="none"
                  >
                    {col.column_name}
                  </text>
                  <text
                    x={l.x + l.w - 8}
                    y={l.y + HEADER_HEIGHT + ci * COLUMN_HEIGHT + COLUMN_HEIGHT / 2}
                    textAnchor="end"
                    dominantBaseline="central"
                    fill="#555"
                    fontSize={8.5}
                    fontFamily="monospace"
                    pointerEvents="none"
                  >
                    {col.data_type}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex items-center gap-px bg-[#1a1a1a] border border-border rounded text-xs">
        <button
          onClick={() => setView((v) => ({ ...v, scale: Math.max(0.1, v.scale / 1.25) }))}
          className="px-2.5 py-1.5 text-muted hover:text-white transition-colors"
        >
          −
        </button>
        <span className="px-1.5 py-1.5 text-muted min-w-[36px] text-center select-none">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          onClick={() => setView((v) => ({ ...v, scale: Math.min(4, v.scale * 1.25) }))}
          className="px-2.5 py-1.5 text-muted hover:text-white transition-colors"
        >
          +
        </button>
        <span className="w-px h-4 bg-border" />
        <button
          onClick={() => setView({ x: PADDING, y: PADDING, scale: 1 })}
          className="px-2.5 py-1.5 text-muted hover:text-white transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="absolute top-3 right-3 text-xs text-muted bg-[#1a1a1a] px-2.5 py-1 rounded border border-border">
        {tables.length} table{tables.length !== 1 ? "s" : ""}
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-muted">
        <span>{panning ? "Dragging..." : "Scroll to zoom · Drag to pan · Click a table to open"}</span>
        <span className="w-px h-3 bg-border" />
        <span className="flex items-center gap-1.5">
          <svg width="20" height="2" viewBox="0 0 20 2">
            <line x1="0" y1="1" x2="20" y2="1" stroke="#6a9fb5" strokeWidth="1.5" />
          </svg>
          FK
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="2" viewBox="0 0 20 2">
            <line x1="0" y1="1" x2="20" y2="1" stroke="#555" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>
          Inferred
        </span>
      </div>
    </div>
  );
}
