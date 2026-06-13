import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    const tables = result.rows.map((r) => r.table_name);
    return NextResponse.json({ tables });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, columns } = await req.json();
    if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: "name and columns required" }, { status: 400 });
    }
    const colDefs = columns.map((c: any) => `"${c.name}" ${c.type}`);
    await query(`CREATE TABLE "${name}" (${colDefs.join(", ")})`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const table = req.nextUrl.searchParams.get("table");
    if (!table) {
      return NextResponse.json({ error: "table required" }, { status: 400 });
    }
    await query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
