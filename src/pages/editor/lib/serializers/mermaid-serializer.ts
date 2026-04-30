import type { SchemaSerializer } from './types';
import type { Schema, Table, Field, FieldType, Relation, RelationType } from '../../model/types';

/**
 * Mermaid erDiagram Serializer
 *
 * Supports import and export of Mermaid erDiagram syntax.
 * Parses table definitions, field types/constraints (PK, FK),
 * and relationship lines with cardinality markers.
 */
export const mermaidSerializer: SchemaSerializer = {
  id: 'mermaid',
  name: 'Mermaid ER',
  description: 'Mermaid erDiagram format with tables and relationships',
  fileExtension: '.md',
  mimeType: 'text/plain',
  canImport: true,
  canExport: true,

  serialize(schema: Schema): string {
    const lines: string[] = [];
    lines.push('erDiagram');

    // Tables
    for (const table of schema.tables) {
      if (table.description) {
        table.description.split('\n').forEach(line => {
          lines.push(`    %% ${line}`);
        });
      }
      lines.push(`    ${table.name.toUpperCase()} {`);
      for (const field of table.fields) {
        const constraints: string[] = [];
        if (field.isPrimaryKey) constraints.push('PK');
        if (field.isForeignKey) constraints.push('FK');
        if (field.isUnique && !field.isPrimaryKey) constraints.push('UK');
        const constraintStr = constraints.length > 0 ? ` ${constraints.join(',')}` : '';
        lines.push(`        ${mapTypeToMermaid(field.type)} ${field.name}${constraintStr}`);
      }
      lines.push('    }');
      lines.push('');
    }

    // Relations
    for (const rel of schema.relations) {
      const fromTable = schema.tables.find(t => t.id === rel.fromTableId);
      const toTable = schema.tables.find(t => t.id === rel.toTableId);
      if (!fromTable || !toTable) continue;

      const { left, right } = relTypeToMermaid(rel.type);
      lines.push(`    ${toTable.name.toUpperCase()} ${left}--${right} ${fromTable.name.toUpperCase()} : has`);
    }

    return lines.join('\n');
  },

  deserialize(content: string): Schema {
    const tables: Table[] = [];
    const relations: Relation[] = [];
    const tableMap = new Map<string, Table>();

    const TABLE_COLORS = [
      '#ef4444', '#6366f1', '#8b5cf6', '#3b82f6', '#10b981',
      '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
      '#84cc16', '#a855f7', '#e11d48', '#0ea5e9', '#22c55e',
    ];

    let idCounter = 1;
    const nextId = (prefix: string) => `${prefix}_${idCounter++}`;

    // ── 1. Parse table definitions ──
    // Match: TABLE_NAME { ... }
    const tableBlockRegex = /(\w+)\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;
    let tableIndex = 0;

    while ((match = tableBlockRegex.exec(content)) !== null) {
      const rawName = match[1];
      const tableName = rawName.toLowerCase();
      const fieldsBlock = match[2];

      // Skip if it's the erDiagram keyword somehow
      if (tableName === 'erdiagram') continue;

      // Extract %% comments before this table block as description
      const beforeBlock = content.substring(0, match.index);
      const commentLines: string[] = [];
      const linesArr = beforeBlock.split('\n');
      for (let i = linesArr.length - 1; i >= 0; i--) {
        const trimmed = linesArr[i].trim();
        if (trimmed.startsWith('%%')) {
          commentLines.unshift(trimmed.replace(/^%%\s?/, ''));
        } else if (trimmed === '') {
          continue;
        } else {
          break;
        }
      }
      const description = commentLines.join('\n').trim();

      const fields: Field[] = [];
      const fieldLines = fieldsBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      for (const line of fieldLines) {
        // Format: type column_name [PK|FK|UK|"comment"] — supports comma-separated like PK,FK
        const fieldMatch = line.match(/^(\S+)\s+(\S+)(?:\s+([A-Z,]+))?/);
        if (!fieldMatch) continue;

        const rawType = fieldMatch[1];
        const colName = fieldMatch[2];
        const constraintStr = fieldMatch[3] || '';
        const constraints = constraintStr.split(',').map(c => c.trim());

        fields.push({
          id: nextId(`${tableName}_${colName}`),
          name: colName,
          type: parseMermaidType(rawType),
          isPrimaryKey: constraints.includes('PK'),
          isNullable: !constraints.includes('PK'),
          isForeignKey: constraints.includes('FK'),
          isUnique: constraints.includes('UK'),
        });
      }

      // Auto-layout in a grid: 4 columns
      const COLS = 4;
      const table: Table = {
        id: nextId(`table_${tableName}`),
        name: tableName,
        description: description || undefined,
        schema: 'public',
        fields,
        position: {
          x: 100 + (tableIndex % COLS) * 350,
          y: 100 + Math.floor(tableIndex / COLS) * 320,
        },
        color: TABLE_COLORS[tableIndex % TABLE_COLORS.length],
      };

      tables.push(table);
      tableMap.set(tableName, table);
      tableIndex++;
    }

    // ── 2. Parse relationship lines ──
    // Format: TABLE1 ||--o{ TABLE2 : label
    // Cardinality markers: ||  o|  |{  o{  }|  }o  (and reversed)
    const relRegex = /(\w+)\s+([|o}]{1,2})--([|o{]{1,2})\s+(\w+)\s*:\s*\S+/g;

    while ((match = relRegex.exec(content)) !== null) {
      const leftName = match[1].toLowerCase();
      const leftMarker = match[2];
      const rightMarker = match[3];
      const rightName = match[4].toLowerCase();

      const leftTable = tableMap.get(leftName);
      const rightTable = tableMap.get(rightName);
      if (!leftTable || !rightTable) continue;

      const relType = mermaidMarkersToRelType(leftMarker, rightMarker);

      // Determine from/to based on FK fields:
      // The table with the FK field pointing to the other is the "from" (child)
      // The table being referenced is the "to" (parent)
      let fromTable: Table;
      let toTable: Table;
      let fromField: Field | undefined;
      let toField: Field | undefined;
      let finalRelType: RelationType;

      // Try to find a FK field in rightTable pointing to leftTable
      const rightFkField = findFkFieldForTable(rightTable, leftName);
      const leftFkField = findFkFieldForTable(leftTable, rightName);

      if (rightFkField) {
        // rightTable has FK → leftTable (rightTable is child)
        fromTable = rightTable;
        toTable = leftTable;
        fromField = rightFkField;
        toField = leftTable.fields.find(f => f.isPrimaryKey) || leftTable.fields.find(f => f.name === 'id');
        finalRelType = relType;

        // Mark the FK field
        rightFkField.isForeignKey = true;
        rightFkField.foreignKeyTable = leftName;
        rightFkField.foreignKeyField = toField?.name || 'id';
      } else if (leftFkField) {
        // leftTable has FK → rightTable (leftTable is child)
        fromTable = leftTable;
        toTable = rightTable;
        fromField = leftFkField;
        toField = rightTable.fields.find(f => f.isPrimaryKey) || rightTable.fields.find(f => f.name === 'id');
        finalRelType = flipRelType(relType);

        leftFkField.isForeignKey = true;
        leftFkField.foreignKeyTable = rightName;
        leftFkField.foreignKeyField = toField?.name || 'id';
      } else {
        // No explicit FK field found. Use cardinality to determine direction.
        // Convention: "many" side is the child (has FK)
        const leftIsMany = isManySide(leftMarker);
        const rightIsMany = isManySide(rightMarker);

        if (rightIsMany && !leftIsMany) {
          // rightTable is the "many" side (child)
          fromTable = rightTable;
          toTable = leftTable;
          finalRelType = relType;
        } else if (leftIsMany && !rightIsMany) {
          fromTable = leftTable;
          toTable = rightTable;
          finalRelType = flipRelType(relType);
        } else {
          // Both same (1:1 or N:M), left is parent
          fromTable = rightTable;
          toTable = leftTable;
          finalRelType = relType;
        }

        // Find or create FK field on fromTable
        fromField = fromTable.fields.find(f => f.isForeignKey && f.foreignKeyTable === toTable.name);
        if (!fromField) {
          // Try to find by naming convention
          const expectedFkName = toTable.name.replace(/s$/, '') + '_id';
          fromField = fromTable.fields.find(f => f.name === expectedFkName);
          if (!fromField) {
            // Use the first FK field of the child that doesn't have a foreignKeyTable set
            fromField = fromTable.fields.find(f => f.isForeignKey && !f.foreignKeyTable);
          }
        }

        toField = toTable.fields.find(f => f.isPrimaryKey) || toTable.fields.find(f => f.name === 'id');

        // Set FK metadata
        if (fromField) {
          fromField.isForeignKey = true;
          fromField.foreignKeyTable = toTable.name;
          fromField.foreignKeyField = toField?.name || 'id';
        }
      }

      if (fromField && toField) {
        relations.push({
          id: nextId('rel'),
          fromTableId: fromTable.id,
          fromFieldId: fromField.id,
          toTableId: toTable.id,
          toFieldId: toField.id,
          type: finalRelType,
        });
      }
    }

    return { tables, relations };
  },
};

// ── Helper: find a FK field in a table that likely references another table ──
function findFkFieldForTable(table: Table, targetTableName: string): Field | undefined {
  // Look for field marked FK whose name matches convention
  const singular = targetTableName.replace(/s$/, '');

  // Direct match: workspace_id for "workspaces"
  const byName = table.fields.find(f =>
    (f.name === `${singular}_id` || f.name === `${targetTableName}_id`) &&
    (f.isForeignKey || f.name.endsWith('_id'))
  );
  if (byName) return byName;

  // Compound match: owner_user_id for "users"
  const byPartial = table.fields.find(f => {
    if (!f.name.endsWith('_id')) return false;
    const base = f.name.replace(/_id$/, '');
    return base.endsWith(`_${singular}`) || base.endsWith(`_${targetTableName}`);
  });
  if (byPartial) return byPartial;

  return undefined;
}

// ── Mermaid cardinality markers to RelationType ──
function mermaidMarkersToRelType(left: string, right: string): RelationType {
  const leftMany = isManySide(left);
  const rightMany = isManySide(right);

  if (!leftMany && !rightMany) return '1:1';
  if (!leftMany && rightMany) return '1:N';
  if (leftMany && !rightMany) return 'N:1';
  return 'N:M';
}

function isManySide(marker: string): boolean {
  return marker.includes('{') || marker.includes('}');
}

function flipRelType(type: RelationType): RelationType {
  if (type === '1:N') return 'N:1';
  if (type === 'N:1') return '1:N';
  return type;
}

function relTypeToMermaid(type: RelationType): { left: string; right: string } {
  switch (type) {
    case '1:1': return { left: '||', right: '||' };
    case '1:N': return { left: '||', right: 'o{' };
    case 'N:1': return { left: '}o', right: '||' };
    case 'N:M': return { left: '}o', right: 'o{' };
  }
}

function mapTypeToMermaid(type: FieldType): string {
  return type;
}

function parseMermaidType(raw: string): FieldType {
  const normalized = raw.toLowerCase();
  const map: Record<string, FieldType> = {
    'uuid': 'uuid',
    'bigint': 'bigint',
    'int': 'integer',
    'integer': 'integer',
    'smallint': 'smallint',
    'serial': 'serial',
    'bigserial': 'bigserial',
    'varchar': 'varchar',
    'text': 'text',
    'citext': 'citext',
    'boolean': 'boolean',
    'bool': 'boolean',
    'timestamp': 'timestamp',
    'timestamptz': 'timestamptz',
    'date': 'date',
    'time': 'time',
    'json': 'json',
    'jsonb': 'jsonb',
    'decimal': 'decimal',
    'numeric': 'numeric',
    'real': 'real',
    'float': 'real',
    'bytea': 'bytea',
    'inet': 'inet',
    'interval': 'interval',
    'money': 'money',
    'xml': 'xml',
    'vector': 'vector',
    'string': 'text',
    'number': 'integer',
  };
  return map[normalized] || 'text';
}
