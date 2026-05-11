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

import type { Table, Relation, Domain, EnumType, FieldType, TableConstraint, TableIndex } from '../../model/types';

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
    if (enumType.storageStrategy && enumType.storageStrategy !== 'postgres_enum') continue;
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
      fkMap.set(rel.fromFieldId, { toTableName: formatTableName(toTable), toFieldName: toField.name });
    }
  }

  // ─── CREATE TABLE statements with inline REFERENCES ───
  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const constraints = table.constraints ?? [];
    const indexes = table.indexes ?? [];
    if (ti > 0) lines.push('');

    // Table description as comment
    if (table.description) {
      for (const descLine of table.description.split('\n')) {
        lines.push(`-- ${descLine}`);
      }
    }

    lines.push(`CREATE TABLE ${formatTableName(table)} (`);

    const fieldDefs: string[] = [];
    const hasTablePrimaryKey = constraints.some((constraint) => constraint.type === 'primary_key');
    const tableUniqueFieldIds = new Set(
      constraints.flatMap((constraint) => (
        constraint.type === 'unique' && constraint.columnIds.length === 1 ? constraint.columnIds : []
      )),
    );
    const tableForeignKeyFieldIds = new Set(
      constraints.flatMap((constraint) => (
        constraint.type === 'foreign_key' ? constraint.columnIds : []
      )),
    );

    for (const field of table.fields) {
      const enumType = getEnumForField(field, enums);
      let def = `  ${field.name} ${mapTypeToSQL(field.type, field.enumName, enumType)}`;
      if (field.isPrimaryKey && !hasTablePrimaryKey) def += ' PRIMARY KEY';
      if (!field.isNullable && !field.isPrimaryKey) def += ' NOT NULL';
      if (field.isNotNull && !field.isPrimaryKey && field.isNullable) def += ' NOT NULL';
      if (field.isUnique && !field.isPrimaryKey && !tableUniqueFieldIds.has(field.id)) def += ' UNIQUE';
      if (field.defaultValue) def += ` DEFAULT ${formatDefault(field.defaultValue)}`;
      if (field.type === 'enum' && enumType?.storageStrategy === 'check_constraint' && enumType.values.length > 0) {
        const quotedValues = enumType.values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');
        def += ` CHECK (${field.name} IN (${quotedValues}))`;
      }

      // Inline FK reference
      const fk = fkMap.get(field.id);
      if (fk && !tableForeignKeyFieldIds.has(field.id)) {
        def += ` REFERENCES ${fk.toTableName}(${fk.toFieldName})`;
      }

      if (field.comment?.trim()) {
        def += ` /* ${field.comment.trim().replace(/\*\//g, '* /').replace(/\n+/g, ' | ')} */`;
      }

      fieldDefs.push(def);
    }

    const constraintDefs = constraints
      .map((constraint) => formatTableConstraint(constraint, table, tables))
      .filter((definition): definition is string => Boolean(definition));

    lines.push([...fieldDefs, ...constraintDefs].join(',\n'));
    lines.push(');');

    const emittedIndexIds = new Set<string>();
    for (const index of indexes) {
      const definition = formatTableIndex(index, table);
      if (!definition) continue;
      emittedIndexIds.add(index.id);
      lines.push(definition);
    }

    // CREATE INDEX statements for legacy indexed fields when no table index exists.
    for (const field of table.fields) {
      const hasExplicitFieldIndex = indexes.some((index) => (
        emittedIndexIds.has(index.id) &&
        index.columns.length === 1 &&
        index.columns[0].fieldId === field.id
      ));
      if (field.isIndexed && !hasExplicitFieldIndex) {
        lines.push(`CREATE INDEX idx_${table.name}_${field.name} ON ${table.name} (${field.name});`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

function formatTableConstraint(constraint: TableConstraint, table: Table, tables: Table[]): string | null {
  const constraintName = constraint.name?.trim();
  const prefix = constraintName ? `  CONSTRAINT ${constraintName} ` : '  ';

  if (constraint.type === 'check') {
    const expression = constraint.expression.trim();
    return expression ? `${prefix}CHECK (${expression})` : null;
  }

  const localColumns = resolveColumnNames(table, constraint.columnIds);
  if (localColumns.length === 0) return null;

  if (constraint.type === 'primary_key') {
    return `${prefix}PRIMARY KEY (${localColumns.join(', ')})`;
  }

  if (constraint.type === 'unique') {
    const nulls = constraint.nullsNotDistinct ? ' NULLS NOT DISTINCT' : '';
    return `${prefix}UNIQUE${nulls} (${localColumns.join(', ')})`;
  }

  const referencedTable = tables.find((item) => item.id === constraint.referencedTableId);
  if (!referencedTable) return null;
  const referencedColumns = resolveColumnNames(referencedTable, constraint.referencedColumnIds);
  if (referencedColumns.length === 0) return null;

  const actions = [
    constraint.onDelete && constraint.onDelete !== 'no_action'
      ? `ON DELETE ${formatReferentialAction(constraint.onDelete)}`
      : '',
    constraint.onUpdate && constraint.onUpdate !== 'no_action'
      ? `ON UPDATE ${formatReferentialAction(constraint.onUpdate)}`
      : '',
  ].filter(Boolean).join(' ');

  return `${prefix}FOREIGN KEY (${localColumns.join(', ')}) REFERENCES ${formatTableName(referencedTable)} (${referencedColumns.join(', ')})${actions ? ` ${actions}` : ''}`;
}

function formatTableIndex(index: TableIndex, table: Table): string | null {
  const columns = index.columns
    .map((column) => {
      if (column.expression?.trim()) return column.expression.trim();
      const field = column.fieldId ? table.fields.find((item) => item.id === column.fieldId) : undefined;
      if (!field) return null;
      return [
        field.name,
        column.sort ? column.sort.toUpperCase() : '',
        column.nulls ? `NULLS ${column.nulls.toUpperCase()}` : '',
      ].filter(Boolean).join(' ');
    })
    .filter((column): column is string => Boolean(column));

  if (columns.length === 0) return null;

  const name = index.name?.trim() || `idx_${table.name}_${columns.join('_').replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const unique = index.unique ? 'UNIQUE ' : '';
  const method = index.method ? ` USING ${index.method}` : '';
  const includeFields = (index.includeFieldIds ?? [])
    .map((fieldId) => table.fields.find((field) => field.id === fieldId)?.name)
    .filter((fieldName): fieldName is string => Boolean(fieldName));
  const include = includeFields.length > 0 ? ` INCLUDE (${includeFields.join(', ')})` : '';
  const where = index.where?.trim() ? ` WHERE ${index.where.trim()}` : '';

  return `CREATE ${unique}INDEX ${name} ON ${formatTableName(table)}${method} (${columns.join(', ')})${include}${where};`;
}

function resolveColumnNames(table: Table, columnIds: string[]): string[] {
  return columnIds
    .map((columnId) => table.fields.find((field) => field.id === columnId)?.name)
    .filter((name): name is string => Boolean(name));
}

function formatTableName(table: Table): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name;
}

function formatReferentialAction(action: NonNullable<Extract<TableConstraint, { type: 'foreign_key' }>['onDelete']>): string {
  return action.replace(/_/g, ' ').toUpperCase();
}

// ─── Type mapping ───────────────────────────────────────────

function getEnumForField(field: { enumId?: string; enumName?: string }, enums: EnumType[]): EnumType | undefined {
  return enums.find((enumType) => (
    (field.enumId && enumType.id === field.enumId) ||
    (field.enumName && enumType.name.toLowerCase() === field.enumName.toLowerCase())
  ));
}

function mapTypeToSQL(type: FieldType, enumName?: string, enumType?: EnumType): string {
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
    'enum': enumType?.storageStrategy === 'check_constraint' || enumType?.storageStrategy === 'lookup_table'
      ? 'TEXT'
      : enumName ? `"${enumName}"` : 'TEXT',
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
