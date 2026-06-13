import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const table = req.nextUrl.searchParams.get("table");
    if (!table) {
      return NextResponse.json({ error: "table required" }, { status: 400 });
    }
    const result = await query(`SELECT * FROM "${table}"`);
    return NextResponse.json({ rows: result.rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { table, data } = await req.json();
    if (!table || !data) {
      return NextResponse.json({ error: "table and data required" }, { status: 400 });
    }
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const result = await query(
      `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    return NextResponse.json({ row: result.rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { table, idColumn, id, column, value } = await req.json();
    if (!table || !idColumn || id === undefined || !column || value === undefined) {
      return NextResponse.json({ error: "table, idColumn, id, column, value required" }, { status: 400 });
    }
    await query(`UPDATE "${table}" SET "${column}" = $1 WHERE "${idColumn}" = $2`, [value, id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const table = req.nextUrl.searchParams.get("table");
    const idColumn = req.nextUrl.searchParams.get("idColumn");
    const id = req.nextUrl.searchParams.get("id");
    if (!table || !idColumn || !id) {
      return NextResponse.json({ error: "table, idColumn, id required" }, { status: 400 });
    }
    await query(`DELETE FROM "${table}" WHERE "${idColumn}" = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
