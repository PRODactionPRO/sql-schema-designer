/**
 * DBML Parser -- converts DBML text into schema objects.
 *
 * Supported syntax:
 *   Table <name> {
 *     <field> <type> [pk, unique, not null, default: '<val>']
 *   }
 *
 *   Ref: <table>.<field> > <table>.<field>
 *   Ref: <table>.<field> - <table>.<field>
 *   Ref: <table>.<field> < <table>.<field>
 *   Ref: <table>.<field> <> <table>.<field>
 *
 *   TableGroup <name> { <table_names...> }
 *   // Domain: <name> (<#color>)
 */

import type { Table, Field, Relation, Domain, EnumType, FieldType, RelationType } from '../../model/types';
import { ALL_FIELD_TYPES } from '../../model/types';

export interface ParseResult {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
  errors: ParseError[];
}

export interface ParseError {
  line: number;
  message: string;
}

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

// ─── Type normalisation ───
const TYPE_ALIASES: Record<string, FieldType> = {
  'int': 'integer',
  'int4': 'integer',
  'int8': 'bigint',
  'int2': 'smallint',
  'float': 'real',
  'float4': 'real',
  'float8': 'double precision',
  'double': 'double precision',
  'bool': 'boolean',
  'ts': 'timestamp',
  'tstz': 'timestamptz',
  'char': 'varchar',
  'string': 'varchar',
  'str': 'text',
};

function normaliseType(raw: string): FieldType | null {
  const lower = raw.toLowerCase().trim();
  if ((ALL_FIELD_TYPES as string[]).includes(lower)) return lower as FieldType;
  if (TYPE_ALIASES[lower]) return TYPE_ALIASES[lower];
  return null;
}

// ─── Main parser ───
export function parseDBML(source: string): ParseResult {
  const lines = source.split('\n');
  const tables: Table[] = [];
  const relations: Relation[] = [];
  const domains: Domain[] = [];
  const enums: EnumType[] = [];
  const errors: ParseError[] = [];

  const tableMap = new Map<string, Table>();
  // Deferred refs
  const deferredRefs: { line: number; fromTable: string; fromField: string; toTable: string; toField: string; type: RelationType }[] = [];
  // Domain metadata from comments
  const domainMeta: { name: string; color: string }[] = [];
  // TableGroup content
  const tableGroups: { name: string; tableNames: string[]; domainIdx: number }[] = [];

  let i = 0;
  let tableX = 50;
  let tableY = 50;

  while (i < lines.length) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip empty lines
    if (!line) { i++; continue; }

    // Domain comment: // Domain: Name (#color)
    const domainComment = line.match(/^\/\/\s*Domain:\s*(.+?)\s*\((#[0-9a-fA-F]{6})\)\s*$/i);
    if (domainComment) {
      domainMeta.push({ name: domainComment[1], color: domainComment[2] });
      i++;
      continue;
    }

    // Regular comments
    if (line.startsWith('//') || line.startsWith('#')) { i++; continue; }

    // ─── Enum definition ───
    const enumMatch = line.match(/^Enum\s+(\w+)\s*\{?\s*$/i);
    if (enumMatch) {
      const enumName = enumMatch[1];
      const values: string[] = [];
      i++;
      while (i < lines.length) {
        const vline = lines[i].trim();
        i++;
        if (vline === '}' || vline === '};') break;
        if (!vline || vline.startsWith('//')) continue;
        const sanitized = vline.replace(/,$/, '').trim();
        if (sanitized) values.push(sanitized);
      }
      enums.push({ id: genId('enum'), name: enumName, values: Array.from(new Set(values)) });
      continue;
    }

    // ─── Table definition ───
    const tableMatch = line.match(/^Table\s+(\w+)\s*(?:\[.*?\])?\s*\{?\s*$/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const fields: Field[] = [];
      i++;

      while (i < lines.length) {
        const fline = lines[i].trim();
        const flineNum = i + 1;
        i++;

        if (fline === '}' || fline === '};') break;
        if (!fline || fline.startsWith('//')) continue;

        // ─── Indexes block (skip) ───
        if (/^indexes\s*\{/i.test(fline)) {
          // Parse indexed field names and mark them
          while (i < lines.length) {
            const idxLine = lines[i].trim();
            i++;
            if (idxLine === '}') break;
            if (!idxLine || idxLine.startsWith('//')) continue;
            // Index line can be just field name, or (field_name) [unique], etc.
            const idxFieldName = idxLine.replace(/[\(\)\[\],]/g, ' ').split(/\s+/)[0];
            if (idxFieldName) {
              const f = fields.find(ff => ff.name.toLowerCase() === idxFieldName.toLowerCase());
              if (f) f.isIndexed = true;
            }
          }
          continue;
        }

        const parsed = parseDBMLFieldLine(fline, flineNum, enums);
        if (parsed.error) {
          errors.push(parsed.error);
          continue;
        }
        if (parsed.field) {
          fields.push(parsed.field);
          // Inline ref
          if (parsed.ref) {
            deferredRefs.push({
              line: flineNum,
              fromTable: tableName,
              fromField: parsed.field.name,
              toTable: parsed.ref.table,
              toField: parsed.ref.field,
              type: parsed.ref.type,
            });
          }
        }
      }

      const table: Table = {
        id: genId('tbl'),
        name: tableName,
        fields,
        position: { x: tableX, y: tableY },
      };
      tables.push(table);
      tableMap.set(tableName.toLowerCase(), table);

      tableX += 300;
      if (tableX > 1200) { tableX = 50; tableY += 350; }
      continue;
    }

    // ─── Ref: statement ───
    const refMatch = line.match(/^Ref\s*:\s*(\w+)\.(\w+)\s*(<>|>|<|-)\s*(\w+)\.(\w+)\s*$/i);
    if (refMatch) {
      const relType = parseRefSymbol(refMatch[3]);
      deferredRefs.push({
        line: lineNum,
        fromTable: refMatch[1],
        fromField: refMatch[2],
        toTable: refMatch[4],
        toField: refMatch[5],
        type: relType,
      });
      i++;
      continue;
    }

    // ─── TableGroup ───
    const groupMatch = line.match(/^TableGroup\s+(\w+)\s*\{?\s*$/i);
    if (groupMatch) {
      const groupName = groupMatch[1];
      const groupTables: string[] = [];
      const domainIdx = domainMeta.length > 0 ? domainMeta.length - 1 : -1;
      i++;

      while (i < lines.length) {
        const gline = lines[i].trim();
        i++;
        if (gline === '}' || gline === '};') break;
        if (!gline || gline.startsWith('//')) continue;
        groupTables.push(gline.replace(/,/g, '').trim());
      }

      tableGroups.push({ name: groupName, tableNames: groupTables, domainIdx });
      continue;
    }

    // Unrecognised
    if (line !== '}') {
      errors.push({ line: lineNum, message: `Unexpected: "${line}"` });
    }
    i++;
  }

  // ─── Resolve refs ───
  for (const ref of deferredRefs) {
    const fromTable = tableMap.get(ref.fromTable.toLowerCase());
    const toTable = tableMap.get(ref.toTable.toLowerCase());
    if (!fromTable) {
      errors.push({ line: ref.line, message: `Ref source table "${ref.fromTable}" not found` });
      continue;
    }
    if (!toTable) {
      errors.push({ line: ref.line, message: `Ref target table "${ref.toTable}" not found` });
      continue;
    }
    const fromField = fromTable.fields.find(f => f.name.toLowerCase() === ref.fromField.toLowerCase());
    const toField = toTable.fields.find(f => f.name.toLowerCase() === ref.toField.toLowerCase());
    if (!fromField) {
      errors.push({ line: ref.line, message: `Ref source field "${ref.fromTable}.${ref.fromField}" not found` });
      continue;
    }
    if (!toField) {
      errors.push({ line: ref.line, message: `Ref target field "${ref.toTable}.${ref.toField}" not found` });
      continue;
    }

    fromField.isForeignKey = true;
    fromField.foreignKeyTable = toTable.name;
    fromField.foreignKeyField = toField.name;

    relations.push({
      id: genId('rel'),
      fromTableId: fromTable.id,
      fromFieldId: fromField.id,
      toTableId: toTable.id,
      toFieldId: toField.id,
      type: ref.type,
    });
  }

  // ─── Build domains from TableGroup + domain comments ───
  for (const group of tableGroups) {
    const meta = group.domainIdx >= 0 ? domainMeta[group.domainIdx] : null;
    const domain: Domain = {
      id: genId('dom'),
      name: meta?.name || group.name.replace(/_/g, ' '),
      color: meta?.color || '#3b82f6',
    };
    domains.push(domain);

    for (const tName of group.tableNames) {
      const t = tableMap.get(tName.toLowerCase());
      if (t) {
        t.domainId = domain.id;
      } else {
        // Not an error — table might just not exist
      }
    }
  }

  return { tables, relations, domains, enums, errors };
}

// ─── Field line parser ───

interface FieldParseResult {
  field: Field | null;
  ref: { table: string; field: string; type: RelationType } | null;
  error: ParseError | null;
}

function parseDBMLFieldLine(line: string, lineNum: number, enums: EnumType[]): FieldParseResult {
  // Format: field_name type [attrs...]
  // Extract attrs block
  const attrMatch = line.match(/^(\S+)\s+(\S+(?:\s+\S+)?)\s*(?:\[(.*)\])?\s*$/);
  if (!attrMatch) {
    return { field: null, ref: null, error: { line: lineNum, message: `Invalid field syntax: "${line}"` } };
  }

  const fieldName = attrMatch[1];
  const rawType = attrMatch[2];
  const attrStr = attrMatch[3] || '';

  // Handle "double precision"
  let typeStr = rawType;
  if (rawType.toLowerCase() === 'double' && line.toLowerCase().includes('double precision')) {
    typeStr = 'double precision';
  }

  const fieldType = normaliseType(typeStr);
  const enumType = enums.find(e => e.name.toLowerCase() === typeStr.toLowerCase());
  if (!fieldType && !enumType) {
    return { field: null, ref: null, error: { line: lineNum, message: `Unknown type "${typeStr}"` } };
  }

  let isPrimaryKey = false;
  let isNullable = true;
  let isUnique = false;
  let defaultValue: string | undefined;
  let comment: string | undefined;
  let ref: { table: string; field: string; type: RelationType } | null = null;

  if (attrStr) {
    const attrs = parseAttrList(attrStr);
    for (const attr of attrs) {
      const lower = attr.toLowerCase().trim();
      if (lower === 'pk' || lower === 'primary key') {
        isPrimaryKey = true;
        isNullable = false;
      } else if (lower === 'unique') {
        isUnique = true;
      } else if (lower === 'not null') {
        isNullable = false;
      } else if (lower === 'null') {
        isNullable = true;
      } else if (lower.startsWith('default:')) {
        defaultValue = attr.slice(8).trim().replace(/^['"`]|['"`]$/g, '');
      } else if (lower.startsWith('note:')) {
        comment = attr.slice(5).trim().replace(/^['"`]|['"`]$/g, '');
      } else if (lower.startsWith('ref:')) {
        // ref: > table.field or ref: - table.field
        const refStr = attr.slice(4).trim();
        const refMatch = refStr.match(/^\s*(<>|>|<|-)\s*(\w+)\.(\w+)\s*$/);
        if (refMatch) {
          ref = {
            table: refMatch[2],
            field: refMatch[3],
            type: parseRefSymbol(refMatch[1]),
          };
        }
      }
    }
  }

  const field: Field = {
    id: genId('fld'),
    name: fieldName,
    type: enumType ? 'enum' : fieldType!,
    enumId: enumType?.id,
    enumName: enumType?.name,
    isPrimaryKey,
    isNullable,
    isForeignKey: false,
    isUnique,
    defaultValue,
    comment,
  };

  return { field, ref, error: null };
}

/** Parse comma-separated attr list, respecting nested quotes and colons */
function parseAttrList(str: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote = false;

  for (const ch of str) {
    if ((ch === "'" || ch === '"' || ch === '`') && depth === 0) {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === ',' && !inQuote && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseRefSymbol(sym: string): RelationType {
  switch (sym) {
    case '>': return '1:N';
    case '<': return 'N:1';
    case '-': return '1:1';
    case '<>': return 'N:M';
    default: return '1:N';
  }
}
