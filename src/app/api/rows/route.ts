import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function splitTable(raw: string): [string, string] {
  return raw.includes(".") ? [raw.split(".", 2)[0], raw.split(".", 2)[1]] : ["public", raw];
}

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("table");
    if (!raw) {
      return NextResponse.json({ error: "table required" }, { status: 400 });
    }
    const [schema, table] = splitTable(raw);
    const result = await query(`SELECT * FROM "${schema}"."${table}"`);
    return NextResponse.json({ rows: result.rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { table: raw, data } = await req.json();
    if (!raw || !data) {
      return NextResponse.json({ error: "table and data required" }, { status: 400 });
    }
    const [schema, table] = splitTable(raw);
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const result = await query(
      `INSERT INTO "${schema}"."${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    return NextResponse.json({ row: result.rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { table: raw, idColumn, id, column, value } = await req.json();
    if (!raw || !idColumn || id === undefined || !column || value === undefined) {
      return NextResponse.json({ error: "table, idColumn, id, column, value required" }, { status: 400 });
    }
    const [schema, table] = splitTable(raw);
    await query(`UPDATE "${schema}"."${table}" SET "${column}" = $1 WHERE "${idColumn}" = $2`, [value, id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("table");
    const idColumn = req.nextUrl.searchParams.get("idColumn");
    const id = req.nextUrl.searchParams.get("id");
    if (!raw || !idColumn || !id) {
      return NextResponse.json({ error: "table, idColumn, id required" }, { status: 400 });
    }
    const [schema, table] = splitTable(raw);
    await query(`DELETE FROM "${schema}"."${table}" WHERE "${idColumn}" = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
