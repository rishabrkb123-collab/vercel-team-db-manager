import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { sql } = await req.json();
    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "sql required" }, { status: 400 });
    }
    const start = Date.now();
    const result = await query(sql);
    const duration = Date.now() - start;
    return NextResponse.json({
      rows: result.rows || [],
      rowCount: result.rowCount ?? result.rows?.length ?? 0,
      duration,
      fields: result.fields
        ? result.fields.map((f: any) => ({ name: f.name, dataTypeID: f.dataTypeID }))
        : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
