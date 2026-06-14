import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Common singular-to-plural and plural-to-single mappings
function guessTableName(columnName: string): string | null {
  if (!columnName.endsWith("_id")) return null;
  const base = columnName.slice(0, -3); // strip "_id"
  const candidates = [base, base + "s", base + "es"];
  if (base.endsWith("y")) {
    candidates.push(base.slice(0, -1) + "ies");
  }
  return null; // will be resolved against actual table names
}

function inferRelations(
  tables: { table_schema: string; table_name: string; columns: any[] }[]
) {
  const tableNames = new Set(
    tables.map((t) =>
      t.table_schema === "public" ? t.table_name : `${t.table_schema}.${t.table_name}`
    )
  );

  const tableNamesPlural = new Set<string>();
  const tableNamesSingular = new Map<string, string>();
  for (const t of tables) {
    const name = t.table_schema === "public" ? t.table_name : `${t.table_schema}.${t.table_name}`;
    tableNames.add(name);
    tableNamesPlural.add(name + "s");
    tableNamesPlural.add(name + "es");
    if (name.endsWith("s")) {
      tableNamesSingular.set(name.slice(0, -1), name);
    }
    // Handle "ies" -> "y"
    if (name.endsWith("ies")) {
      tableNamesSingular.set(name.slice(0, -3) + "y", name);
    }
  }

  const inferred: any[] = [];

  for (const t of tables) {
    const displayName =
      t.table_schema === "public" ? t.table_name : `${t.table_schema}.${t.table_name}`;

    for (const col of t.columns) {
      const colName = col.column_name as string;
      if (!colName.endsWith("_id") || colName === "id") continue;

      const base = colName.slice(0, -3);
      const lookupKey =
        t.table_schema === "public" ? base : `${t.table_schema}.${base}`;

      // Direct match
      if (tableNames.has(lookupKey)) {
        inferred.push({
          table_schema: t.table_schema,
          table_name: t.table_name,
          column_name: colName,
          foreign_table_schema: t.table_schema,
          foreign_table_name: base,
          foreign_column_name: "id",
          inferred: true,
        });
        continue;
      }

      // Try plural
      if (tableNamesPlural.has(lookupKey + "s")) {
        inferred.push({
          table_schema: t.table_schema,
          table_name: t.table_name,
          column_name: colName,
          foreign_table_schema: t.table_schema,
          foreign_table_name: base + "s",
          foreign_column_name: "id",
          inferred: true,
        });
        continue;
      }
      if (tableNamesPlural.has(lookupKey + "es")) {
        inferred.push({
          table_schema: t.table_schema,
          table_name: t.table_name,
          column_name: colName,
          foreign_table_schema: t.table_schema,
          foreign_table_name: base + "es",
          foreign_column_name: "id",
          inferred: true,
        });
        continue;
      }

      // Try singular (for base already in plural form)
      const singular = tableNamesSingular.get(base);
      if (singular) {
        const [fkSchema, fkName] = singular.includes(".")
          ? singular.split(".", 2)
          : [t.table_schema, singular];
        inferred.push({
          table_schema: t.table_schema,
          table_name: t.table_name,
          column_name: colName,
          foreign_table_schema: fkSchema,
          foreign_table_name: fkName,
          foreign_column_name: "id",
          inferred: true,
        });
        continue;
      }
    }
  }

  return inferred;
}

export async function GET() {
  try {
    const tablesRes = await query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY table_schema, table_name
    `);

    const columnsRes = await query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable,
             column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY table_schema, table_name, ordinal_position
    `);

    // Declared foreign keys via pg_catalog (more reliable than information_schema)
    let fkRows: any[] = [];
    try {
      const fkRes = await query(`
        SELECT
          ns1.nspname AS table_schema,
          t1.relname AS table_name,
          a1.attname AS column_name,
          ns2.nspname AS foreign_table_schema,
          t2.relname AS foreign_table_name,
          a2.attname AS foreign_column_name
        FROM pg_constraint c
        JOIN pg_class t1 ON c.conrelid = t1.oid
        JOIN pg_namespace ns1 ON t1.relnamespace = ns1.oid
        JOIN pg_attribute a1 ON a1.attrelid = c.conrelid AND a1.attnum = ANY (c.conkey)
        JOIN pg_class t2 ON c.confrelid = t2.oid
        JOIN pg_namespace ns2 ON t2.relnamespace = ns2.oid
        JOIN pg_attribute a2 ON a2.attrelid = c.confrelid AND a2.attnum = ANY (c.confkey)
        WHERE c.contype = 'f'
          AND ns1.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY ns1.nspname, t1.relname
      `);
      fkRows = fkRes.rows;
    } catch {
      // fallback: ignore FK errors
    }

    const allColumns = columnsRes.rows.map((c: any) => ({
      table_schema: c.table_schema,
      table_name: c.table_name,
      column_name: c.column_name,
      data_type: c.data_type,
      is_nullable: c.is_nullable,
      column_default: c.column_default,
    }));

    const schemaTables = tablesRes.rows.map((t: any) => ({
      table_schema: t.table_schema,
      table_name: t.table_name,
      columns: allColumns.filter(
        (c: any) => c.table_schema === t.table_schema && c.table_name === t.table_name
      ),
    }));

    const inferredRelations = inferRelations(schemaTables);

    const tables = schemaTables.map((t: any) => {
      const displayName =
        t.table_schema === "public" ? t.table_name : `${t.table_schema}.${t.table_name}`;

      const declaredFKs = fkRows
        .filter(
          (fk: any) =>
            fk.table_schema === t.table_schema && fk.table_name === t.table_name
        )
        .map((fk: any) => ({
          column_name: fk.column_name,
          foreign_table_schema: fk.foreign_table_schema,
          foreign_table_name: fk.foreign_table_name,
          foreign_column_name: fk.foreign_column_name,
          inferred: false,
        }));

      const inferredFKs = inferredRelations
        .filter(
          (fk: any) =>
            !declaredFKs.some(
              (dfk: any) =>
                dfk.column_name === fk.column_name &&
                dfk.foreign_table_name === fk.foreign_table_name
            ) &&
            fk.table_schema === t.table_schema &&
            fk.table_name === t.table_name
        )
        .map((fk: any) => ({
          column_name: fk.column_name,
          foreign_table_schema: fk.foreign_table_schema,
          foreign_table_name: fk.foreign_table_name,
          foreign_column_name: fk.foreign_column_name,
          inferred: true,
        }));

      return {
        table_schema: t.table_schema,
        table_name: t.table_name,
        display_name: displayName,
        columns: t.columns,
        foreignKeys: [...declaredFKs, ...inferredFKs],
      };
    });

    return NextResponse.json({ tables });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
