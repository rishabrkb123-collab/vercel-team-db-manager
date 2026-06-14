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

const TABLE_WIDTH = 220;
const HEADER_HEIGHT = 32;
const COLUMN_HEIGHT = 22;
const H_GAP = 60;
const V_GAP = 60;
const PADDING = 50;

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
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
  const colHeights = new Array(cols).fill(0);

  return tables.map((t, i) => {
    const col = i % cols;
    const h = HEADER_HEIGHT + t.columns.length * COLUMN_HEIGHT + 4;
    const x2 = col * (TABLE_WIDTH + H_GAP);
    const y2 = colHeights[col];
    colHeights[col] = y2 + h + V_GAP;
    return { table: t, x: x2, y: y2, w: TABLE_WIDTH, h };
  });
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
  const [view, setView] = useState({ x: PADDING, y: PADDING, scale: 0.85 });
  const [panning, setPanning] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, viewX: 0, viewY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/schema/full")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        if (data.tables) {
          setTables(data.tables);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const layouts = layout(tables);

  const debugLines: string[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number; inferred?: boolean; label: string }[] = [];

  for (const l of layouts) {
    for (const fk of l.table.foreignKeys) {
      const srcName = getTableKey(fk.table_schema, fk.table_name);
      const tgtName = getTableKey(fk.foreign_table_schema, fk.foreign_table_name);
      const srcL = layouts.find((x) => x.table.display_name === srcName);
      const tgtL = layouts.find((x) => x.table.display_name === tgtName);
      if (!srcL || !tgtL) {
        debugLines.push(`Missing layout: ${srcName} -> ${tgtName}`);
        continue;
      }

      const srcCol = srcL.table.columns.findIndex((c) => c.column_name === fk.column_name);
      const tgtCol = tgtL.table.columns.findIndex((c) => c.column_name === fk.foreign_column_name);
      if (srcCol === -1 || tgtCol === -1) {
        debugLines.push(`Missing col: ${fk.column_name} in ${srcName} or ${fk.foreign_column_name} in ${tgtName}`);
        continue;
      }

      const srcY = srcL.y + HEADER_HEIGHT + srcCol * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;
      const tgtY = tgtL.y + HEADER_HEIGHT + tgtCol * COLUMN_HEIGHT + COLUMN_HEIGHT / 2;

      let x1: number, y1: number, x2: number, y2: number;
      if (srcL.x < tgtL.x) {
        x1 = srcL.x + srcL.w; y1 = srcY;
        x2 = tgtL.x; y2 = tgtY;
      } else {
        x1 = srcL.x; y1 = srcY;
        x2 = tgtL.x + tgtL.w; y2 = tgtY;
      }

      edges.push({ x1, y1, x2, y2, inferred: fk.inferred, label: `${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}` });
    }
  }

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
      dragRef.current = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
    },
    [view.x, view.y]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!panning) return;
      setView((v) => ({
        ...v,
        x: dragRef.current.viewX + e.clientX - dragRef.current.startX,
        y: dragRef.current.viewY + e.clientY - dragRef.current.startY,
      }));
    },
    [panning]
  );

  const handleMouseUp = useCallback(() => setPanning(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    setView((v) => ({ ...v, scale: Math.max(0.15, Math.min(5, v.scale * factor)) }));
  }, []);

  const handleTableClick = useCallback(
    (e: React.MouseEvent) => {
      const name = findTableNode(e.target);
      if (name) onTableClick(name);
    },
    [onTableClick]
  );

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">Loading schema...</div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-400 text-sm">{error}</div>;
  }

  if (tables.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted text-sm">No tables found</div>;
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
        style={{ background: "#111" }}
      >
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
          {/* Connection lines */}
          {edges.map((e, i) => (
            <g key={i}>
              <line
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke={e.inferred ? "#777" : "#4fc3f7"}
                strokeWidth={2.5}
                strokeDasharray={e.inferred ? "7 4" : "none"}
                opacity={0.85}
              />
              <circle cx={e.x2} cy={e.y2} r={4} fill={e.inferred ? "#777" : "#4fc3f7"} opacity={0.85} />
            </g>
          ))}

          {/* Table cards */}
          {layouts.map((l) => (
            <g key={l.table.display_name} data-table-name={l.table.display_name}>
              <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={5} fill="#1a1a1a" stroke="#333" strokeWidth={1} />
              <rect x={l.x} y={l.y} width={l.w} height={HEADER_HEIGHT} rx={5} fill="#222" />
              <rect x={l.x} y={l.y + HEADER_HEIGHT - 5} width={l.w} height={5} fill="#222" />
              <text
                x={l.x + l.w / 2} y={l.y + HEADER_HEIGHT / 2}
                textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize={12} fontWeight={600} fontFamily="monospace"
                pointerEvents="none"
              >
                {l.table.display_name}
              </text>

              {l.table.columns.map((col, ci) => {
                const isFK = l.table.foreignKeys.some((fk) => fk.column_name === col.column_name);
                return (
                  <g key={col.column_name}>
                    <rect
                      x={l.x}
                      y={l.y + HEADER_HEIGHT + ci * COLUMN_HEIGHT}
                      width={l.w}
                      height={COLUMN_HEIGHT}
                      fill={ci % 2 === 0 ? "#1a1a1a" : "#1d1d1d"}
                    />
                    <text
                      x={l.x + 10} y={l.y + HEADER_HEIGHT + ci * COLUMN_HEIGHT + COLUMN_HEIGHT / 2}
                      dominantBaseline="central"
                      fill={isFK ? "#4fc3f7" : "#ccc"}
                      fontSize={10.5} fontFamily="monospace" pointerEvents="none"
                    >
                      {col.column_name}
                      {isFK ? " ⛓" : ""}
                    </text>
                    <text
                      x={l.x + l.w - 8} y={l.y + HEADER_HEIGHT + ci * COLUMN_HEIGHT + COLUMN_HEIGHT / 2}
                      textAnchor="end" dominantBaseline="central"
                      fill="#555" fontSize={8.5} fontFamily="monospace" pointerEvents="none"
                    >
                      {col.data_type}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </g>
      </svg>

      {/* Info bar */}
      <div className="absolute top-3 right-3 flex items-center gap-2 text-xs bg-[#1a1a1a] px-2.5 py-1.5 rounded border border-border">
        <span className="text-muted">{tables.length} table{tables.length !== 1 ? "s" : ""}</span>
        {edges.length > 0 && (
          <>
            <span className="w-px h-3 bg-border" />
            <span className="text-white/70">{edges.length} edge{edges.length !== 1 ? "s" : ""}</span>
          </>
        )}
        <span className="w-px h-3 bg-border" />
        <span className="text-[#4fc3f7]">
          {edges.filter((e) => !e.inferred).length} FK
        </span>
        <span className="w-px h-3 bg-border" />
        <span className="text-[#777]">
          {edges.filter((e) => e.inferred).length} inferred
        </span>
      </div>

      {/* Debug info */}
      {debugLines.length > 0 && (
        <div className="absolute top-3 left-3 text-[10px] font-mono text-yellow-400 bg-[#1a1a1a] px-2 py-1 rounded border border-border whitespace-pre-wrap max-w-md">
          {debugLines.join("\n")}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-px bg-[#1a1a1a] border border-border rounded text-xs">
        <button onClick={() => setView((v) => ({ ...v, scale: Math.max(0.15, v.scale / 1.25) }))} className="px-2.5 py-1.5 text-muted hover:text-white">−</button>
        <span className="px-1.5 py-1.5 text-muted min-w-[36px] text-center select-none">{Math.round(view.scale * 100)}%</span>
        <button onClick={() => setView((v) => ({ ...v, scale: Math.min(5, v.scale * 1.25) }))} className="px-2.5 py-1.5 text-muted hover:text-white">+</button>
        <span className="w-px h-4 bg-border" />
        <button onClick={() => setView({ x: PADDING, y: PADDING, scale: 0.85 })} className="px-2.5 py-1.5 text-muted hover:text-white">Reset</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[10px] text-muted bg-[#1a1a1a] px-2.5 py-1.5 rounded border border-border">
        <span>Scroll to zoom · Drag to pan · Click table to open</span>
        <span className="w-px h-3 bg-border" />
        <span className="flex items-center gap-1.5">
          <svg width="24" height="3" viewBox="0 0 24 3"><line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#4fc3f7" strokeWidth="2.5" /></svg>
          FK
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="24" height="3" viewBox="0 0 24 3"><line x1="0" y1="1.5" x2="24" y2="1.5" stroke="#777" strokeWidth="2.5" strokeDasharray="7 4" /></svg>
          Inferred
        </span>
      </div>
    </div>
  );
}
