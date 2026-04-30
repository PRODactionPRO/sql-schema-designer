/**
 * DDL (PostgreSQL) Serializer — converts schema objects into PostgreSQL DDL.
 *
 * Output example:
 *   CREATE TABLE users (
 *     id UUID PRIMARY KEY,
 *     name VARCHAR(255) NOT NULL,
 *     email TEXT UNIQUE NOT NULL DEFAULT 'user@example.com'
 *   );
 *
 *   CREATE TABLE posts (
 *     id UUID PRIMARY KEY,
 *     author_id UUID NOT NULL REFERENCES users(id),
 *     title TEXT NOT NULL
 *   );
 */

import type { Table, Relation, Domain, EnumType, FieldType } from '../../model/types';

export function serializeToDDL(
  tables: Table[],
  relations: Relation[],
  _domains: Domain[],
  enums: EnumType[],
): string {
  const lines: string[] = [];

  lines.push('-- PostgreSQL Schema');
  lines.push('');

  for (const enumType of enums) {
    if (enumType.values.length === 0) continue;
    const quotedValues = enumType.values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
    lines.push(`CREATE TYPE "${enumType.name}" AS ENUM (${quotedValues});`);
  }
  if (enums.length > 0) lines.push('');

  // Build FK lookup: fromFieldId → { toTableName, toFieldName }
  const fkMap = new Map<string, { toTableName: string; toFieldName: string }>();
  for (const rel of relations) {
    const toTable = tables.find(t => t.id === rel.toTableId);
    const toField = toTable?.fields.find(f => f.id === rel.toFieldId);
    if (toTable && toField) {
      fkMap.set(rel.fromFieldId, { toTableName: toTable.name, toFieldName: toField.name });
    }
  }

  // ─── CREATE TABLE statements with inline REFERENCES ───
  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    if (ti > 0) lines.push('');

    // Table description as comment
    if (table.description) {
      for (const descLine of table.description.split('\n')) {
        lines.push(`-- ${descLine}`);
      }
    }

    lines.push(`CREATE TABLE ${table.name} (`);

    const fieldDefs: string[] = [];
    for (const field of table.fields) {
      let def = `  ${field.name} ${mapTypeToSQL(field.type, field.enumName)}`;
      if (field.isPrimaryKey) def += ' PRIMARY KEY';
      if (!field.isNullable && !field.isPrimaryKey) def += ' NOT NULL';
      if (field.isNotNull && !field.isPrimaryKey && field.isNullable) def += ' NOT NULL';
      if (field.isUnique && !field.isPrimaryKey) def += ' UNIQUE';
      if (field.defaultValue) def += ` DEFAULT ${formatDefault(field.defaultValue)}`;

      // Inline FK reference
      const fk = fkMap.get(field.id);
      if (fk) {
        def += ` REFERENCES ${fk.toTableName}(${fk.toFieldName})`;
      }

      if (field.comment?.trim()) {
        def += ` /* ${field.comment.trim().replace(/\*\//g, '* /').replace(/\n+/g, ' | ')} */`;
      }

      fieldDefs.push(def);
    }

    lines.push(fieldDefs.join(',\n'));
    lines.push(');');

    // CREATE INDEX statements for indexed fields
    for (const field of table.fields) {
      if (field.isIndexed) {
        lines.push(`CREATE INDEX idx_${table.name}_${field.name} ON ${table.name} (${field.name});`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

// ─── Type mapping ───────────────────────────────────────────

function mapTypeToSQL(type: FieldType, enumName?: string): string {
  const map: Record<string, string> = {
    'uuid': 'UUID',
    'bigint': 'BIGINT',
    'integer': 'INTEGER',
    'smallint': 'SMALLINT',
    'serial': 'SERIAL',
    'bigserial': 'BIGSERIAL',
    'varchar': 'VARCHAR(255)',
    'text': 'TEXT',
    'citext': 'CITEXT',
    'boolean': 'BOOLEAN',
    'timestamp': 'TIMESTAMP',
    'timestamptz': 'TIMESTAMPTZ',
    'date': 'DATE',
    'time': 'TIME',
    'json': 'JSON',
    'jsonb': 'JSONB',
    'decimal': 'DECIMAL',
    'numeric': 'NUMERIC',
    'real': 'REAL',
    'double precision': 'DOUBLE PRECISION',
    'bytea': 'BYTEA',
    'inet': 'INET',
    'cidr': 'CIDR',
    'macaddr': 'MACADDR',
    'interval': 'INTERVAL',
    'point': 'POINT',
    'line': 'LINE',
    'polygon': 'POLYGON',
    'circle': 'CIRCLE',
    'money': 'MONEY',
    'xml': 'XML',
    'array': 'TEXT[]',
    'vector': 'VECTOR',
    'enum': enumName ? `"${enumName}"` : 'TEXT',
  };
  return map[type] || type.toUpperCase();
}

function formatDefault(value: string): string {
  // If it looks like a number, function call, or SQL keyword — leave as-is
  if (/^\d+(\.\d+)?$/.test(value)) return value;
  if (/^(true|false|null|now\(\)|current_timestamp|current_date|current_time|gen_random_uuid\(\))$/i.test(value)) return value;
  if (/^\w+\(.*\)$/.test(value)) return value;
  // Otherwise quote it
  return `'${value.replace(/'/g, "''")}'`;
}
