import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("table");
    if (!raw) {
      return NextResponse.json({ error: "table required" }, { status: 400 });
    }
    const parts = raw.includes(".") ? raw.split(".", 2) : ["public", raw];
    const [schema, table] = parts;
    const result = await query(
      `SELECT column_name, data_type, is_nullable, column_default, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    );
    return NextResponse.json({ columns: result.rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
