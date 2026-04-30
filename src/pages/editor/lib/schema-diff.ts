/**
 * Schema Diff Engine
 * Compares two schema states and generates a list of changes.
 * Also generates PostgreSQL migration DDL from the diff.
 */

import type { Table, Field, Relation } from '../model/types';

export type DiffAction = 'added' | 'removed' | 'modified';

export interface TableDiff {
  action: DiffAction;
  tableName: string;
  tableId?: string;
  oldTable?: Table;
  newTable?: Table;
  fieldDiffs?: FieldDiff[];
}

export interface FieldDiff {
  action: DiffAction;
  fieldName: string;
  tableName: string;
  oldField?: Field;
  newField?: Field;
  changes?: string[];
}

export interface RelationDiff {
  action: DiffAction;
  description: string;
  oldRelation?: Relation;
  newRelation?: Relation;
}

export interface SchemaDiff {
  tableDiffs: TableDiff[];
  relationDiffs: RelationDiff[];
  hasChanges: boolean;
  summary: string;
}

export function diffSchemas(
  oldTables: Table[],
  oldRelations: Relation[],
  newTables: Table[],
  newRelations: Relation[],
): SchemaDiff {
  const tableDiffs: TableDiff[] = [];
  const relationDiffs: RelationDiff[] = [];

  const oldTableMap = new Map(oldTables.map(t => [t.name.toLowerCase(), t]));
  const newTableMap = new Map(newTables.map(t => [t.name.toLowerCase(), t]));

  // Find added / modified tables
  for (const newT of newTables) {
    const key = newT.name.toLowerCase();
    const oldT = oldTableMap.get(key);
    if (!oldT) {
      tableDiffs.push({ action: 'added', tableName: newT.name, tableId: newT.id, newTable: newT });
    } else {
      const fieldDiffs = diffFields(oldT, newT);
      if (fieldDiffs.length > 0) {
        tableDiffs.push({ action: 'modified', tableName: newT.name, tableId: newT.id, oldTable: oldT, newTable: newT, fieldDiffs });
      }
    }
  }

  // Find removed tables
  for (const oldT of oldTables) {
    const key = oldT.name.toLowerCase();
    if (!newTableMap.has(key)) {
      tableDiffs.push({ action: 'removed', tableName: oldT.name, tableId: oldT.id, oldTable: oldT });
    }
  }

  // Relations diff (simplified by from/to table+field names)
  const oldRelKeys = new Set(oldRelations.map(r => relKey(r, oldTables)));
  const newRelKeys = new Set(newRelations.map(r => relKey(r, newTables)));

  for (const r of newRelations) {
    const k = relKey(r, newTables);
    if (!oldRelKeys.has(k)) {
      const fromT = newTables.find(t => t.id === r.fromTableId);
      const toT = newTables.find(t => t.id === r.toTableId);
      const fromF = fromT?.fields.find(f => f.id === r.fromFieldId);
      const toF = toT?.fields.find(f => f.id === r.toFieldId);
      relationDiffs.push({
        action: 'added',
        description: `${fromT?.name}.${fromF?.name} -> ${toT?.name}.${toF?.name} (${r.type})`,
        newRelation: r,
      });
    }
  }

  for (const r of oldRelations) {
    const k = relKey(r, oldTables);
    if (!newRelKeys.has(k)) {
      const fromT = oldTables.find(t => t.id === r.fromTableId);
      const toT = oldTables.find(t => t.id === r.toTableId);
      const fromF = fromT?.fields.find(f => f.id === r.fromFieldId);
      const toF = toT?.fields.find(f => f.id === r.toFieldId);
      relationDiffs.push({
        action: 'removed',
        description: `${fromT?.name}.${fromF?.name} -> ${toT?.name}.${toF?.name} (${r.type})`,
        oldRelation: r,
      });
    }
  }

  const hasChanges = tableDiffs.length > 0 || relationDiffs.length > 0;

  const parts: string[] = [];
  const addedT = tableDiffs.filter(d => d.action === 'added').length;
  const removedT = tableDiffs.filter(d => d.action === 'removed').length;
  const modifiedT = tableDiffs.filter(d => d.action === 'modified').length;
  if (addedT) parts.push(`${addedT} table(s) added`);
  if (removedT) parts.push(`${removedT} table(s) removed`);
  if (modifiedT) parts.push(`${modifiedT} table(s) modified`);
  if (relationDiffs.length) parts.push(`${relationDiffs.length} relation change(s)`);
  const summary = hasChanges ? parts.join(', ') : 'No changes detected';

  return { tableDiffs, relationDiffs, hasChanges, summary };
}

function diffFields(oldTable: Table, newTable: Table): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const oldFieldMap = new Map(oldTable.fields.map(f => [f.name.toLowerCase(), f]));
  const newFieldMap = new Map(newTable.fields.map(f => [f.name.toLowerCase(), f]));

  for (const newF of newTable.fields) {
    const key = newF.name.toLowerCase();
    const oldF = oldFieldMap.get(key);
    if (!oldF) {
      diffs.push({ action: 'added', fieldName: newF.name, tableName: newTable.name, newField: newF });
    } else {
      const changes: string[] = [];
      if (oldF.type !== newF.type) changes.push(`type: ${oldF.type} -> ${newF.type}`);
      if (oldF.isPrimaryKey !== newF.isPrimaryKey) changes.push(`PK: ${oldF.isPrimaryKey} -> ${newF.isPrimaryKey}`);
      if (oldF.isNullable !== newF.isNullable) changes.push(`nullable: ${oldF.isNullable} -> ${newF.isNullable}`);
      if (oldF.isUnique !== newF.isUnique) changes.push(`unique: ${oldF.isUnique} -> ${newF.isUnique}`);
      if (oldF.isIndexed !== newF.isIndexed) changes.push(`indexed: ${oldF.isIndexed} -> ${newF.isIndexed}`);
      if (oldF.defaultValue !== newF.defaultValue) changes.push(`default: ${oldF.defaultValue || 'NULL'} -> ${newF.defaultValue || 'NULL'}`);
      if (oldF.isForeignKey !== newF.isForeignKey) changes.push(`FK: ${oldF.isForeignKey} -> ${newF.isForeignKey}`);
      if (changes.length > 0) {
        diffs.push({ action: 'modified', fieldName: newF.name, tableName: newTable.name, oldField: oldF, newField: newF, changes });
      }
    }
  }

  for (const oldF of oldTable.fields) {
    if (!newFieldMap.has(oldF.name.toLowerCase())) {
      diffs.push({ action: 'removed', fieldName: oldF.name, tableName: oldTable.name, oldField: oldF });
    }
  }

  return diffs;
}

function relKey(r: Relation, tables: Table[]): string {
  const fromT = tables.find(t => t.id === r.fromTableId);
  const toT = tables.find(t => t.id === r.toTableId);
  const fromF = fromT?.fields.find(f => f.id === r.fromFieldId);
  const toF = toT?.fields.find(f => f.id === r.toFieldId);
  return `${fromT?.name}.${fromF?.name}->${toT?.name}.${toF?.name}`;
}

// ── Migration Generation ──

const TYPE_SQL: Record<string, string> = {
  'uuid': 'UUID', 'bigint': 'BIGINT', 'integer': 'INTEGER', 'smallint': 'SMALLINT',
  'serial': 'SERIAL', 'bigserial': 'BIGSERIAL', 'varchar': 'VARCHAR(255)', 'text': 'TEXT',
  'citext': 'CITEXT', 'boolean': 'BOOLEAN', 'timestamp': 'TIMESTAMP',
  'timestamptz': 'TIMESTAMPTZ', 'date': 'DATE', 'time': 'TIME', 'json': 'JSON',
  'jsonb': 'JSONB', 'decimal': 'DECIMAL', 'numeric': 'NUMERIC', 'real': 'REAL',
  'double precision': 'DOUBLE PRECISION', 'bytea': 'BYTEA', 'inet': 'INET',
  'cidr': 'CIDR', 'macaddr': 'MACADDR', 'interval': 'INTERVAL', 'point': 'POINT',
  'line': 'LINE', 'polygon': 'POLYGON', 'circle': 'CIRCLE', 'money': 'MONEY',
  'xml': 'XML', 'array': 'TEXT[]', 'vector': 'VECTOR', 'enum': 'TEXT',
};

function sqlType(type: string): string {
  return TYPE_SQL[type] || type.toUpperCase();
}

export function generateMigration(diff: SchemaDiff): string {
  const lines: string[] = [];
  lines.push('-- Auto-generated migration');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('BEGIN;');
  lines.push('');

  // DROP removed tables
  for (const td of diff.tableDiffs.filter(d => d.action === 'removed')) {
    lines.push(`DROP TABLE IF EXISTS ${td.tableName} CASCADE;`);
  }

  // CREATE new tables
  for (const td of diff.tableDiffs.filter(d => d.action === 'added')) {
    if (!td.newTable) continue;
    lines.push('');
    lines.push(`CREATE TABLE ${td.tableName} (`);
    const fieldDefs: string[] = [];
    for (const f of td.newTable.fields) {
      let def = `  ${f.name} ${sqlType(f.type)}`;
      if (f.isPrimaryKey) def += ' PRIMARY KEY';
      if (!f.isNullable && !f.isPrimaryKey) def += ' NOT NULL';
      if (f.isUnique && !f.isPrimaryKey) def += ' UNIQUE';
      if (f.defaultValue) def += ` DEFAULT ${f.defaultValue}`;
      fieldDefs.push(def);
    }
    lines.push(fieldDefs.join(',\n'));
    lines.push(');');

    // Indexes for new tables
    for (const f of td.newTable.fields) {
      if (f.isIndexed) {
        lines.push(`CREATE INDEX idx_${td.tableName}_${f.name} ON ${td.tableName} (${f.name});`);
      }
    }
  }

  // ALTER existing tables
  for (const td of diff.tableDiffs.filter(d => d.action === 'modified')) {
    if (!td.fieldDiffs) continue;
    lines.push('');
    lines.push(`-- Modify table: ${td.tableName}`);

    for (const fd of td.fieldDiffs) {
      if (fd.action === 'added' && fd.newField) {
        let def = `ALTER TABLE ${td.tableName} ADD COLUMN ${fd.fieldName} ${sqlType(fd.newField.type)}`;
        if (!fd.newField.isNullable) def += ' NOT NULL';
        if (fd.newField.isUnique) def += ' UNIQUE';
        if (fd.newField.defaultValue) def += ` DEFAULT ${fd.newField.defaultValue}`;
        lines.push(`${def};`);
        if (fd.newField.isIndexed) {
          lines.push(`CREATE INDEX idx_${td.tableName}_${fd.fieldName} ON ${td.tableName} (${fd.fieldName});`);
        }
      } else if (fd.action === 'removed') {
        lines.push(`ALTER TABLE ${td.tableName} DROP COLUMN IF EXISTS ${fd.fieldName};`);
      } else if (fd.action === 'modified' && fd.newField && fd.oldField) {
        if (fd.oldField.type !== fd.newField.type) {
          lines.push(`ALTER TABLE ${td.tableName} ALTER COLUMN ${fd.fieldName} TYPE ${sqlType(fd.newField.type)} USING ${fd.fieldName}::${sqlType(fd.newField.type)};`);
        }
        if (fd.oldField.isNullable && !fd.newField.isNullable) {
          lines.push(`ALTER TABLE ${td.tableName} ALTER COLUMN ${fd.fieldName} SET NOT NULL;`);
        } else if (!fd.oldField.isNullable && fd.newField.isNullable) {
          lines.push(`ALTER TABLE ${td.tableName} ALTER COLUMN ${fd.fieldName} DROP NOT NULL;`);
        }
        if (fd.oldField.defaultValue !== fd.newField.defaultValue) {
          if (fd.newField.defaultValue) {
            lines.push(`ALTER TABLE ${td.tableName} ALTER COLUMN ${fd.fieldName} SET DEFAULT ${fd.newField.defaultValue};`);
          } else {
            lines.push(`ALTER TABLE ${td.tableName} ALTER COLUMN ${fd.fieldName} DROP DEFAULT;`);
          }
        }
        if (!fd.oldField.isUnique && fd.newField.isUnique) {
          lines.push(`ALTER TABLE ${td.tableName} ADD CONSTRAINT uq_${td.tableName}_${fd.fieldName} UNIQUE (${fd.fieldName});`);
        } else if (fd.oldField.isUnique && !fd.newField.isUnique) {
          lines.push(`ALTER TABLE ${td.tableName} DROP CONSTRAINT IF EXISTS uq_${td.tableName}_${fd.fieldName};`);
        }
        if (!fd.oldField.isIndexed && fd.newField.isIndexed) {
          lines.push(`CREATE INDEX idx_${td.tableName}_${fd.fieldName} ON ${td.tableName} (${fd.fieldName});`);
        } else if (fd.oldField.isIndexed && !fd.newField.isIndexed) {
          lines.push(`DROP INDEX IF EXISTS idx_${td.tableName}_${fd.fieldName};`);
        }
      }
    }
  }

  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  return lines.join('\n');
}
