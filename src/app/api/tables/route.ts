import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY table_schema, table_name
    `);
    const tables = result.rows.map((r) =>
      r.table_schema === "public" ? r.table_name : `${r.table_schema}.${r.table_name}`
    );
    return NextResponse.json({ tables });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name: raw, columns } = await req.json();
    if (!raw || !columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: "name and columns required" }, { status: 400 });
    }
    const [schema, table] = splitTable(raw);
    const colDefs = columns.map((c: any) => `"${c.name}" ${c.type}`);
    await query(`CREATE TABLE "${schema}"."${table}" (${colDefs.join(", ")})`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function splitTable(raw: string): [string, string] {
  return raw.includes(".") ? [raw.split(".", 2)[0], raw.split(".", 2)[1]] : ["public", raw];
}

export async function DELETE(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("table");
    if (!raw) {
      return NextResponse.json({ error: "table required" }, { status: 400 });
    }
    const [schema, table] = splitTable(raw);
    await query(`DROP TABLE IF EXISTS "${schema}"."${table}" CASCADE`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
