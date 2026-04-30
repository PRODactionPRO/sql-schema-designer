/**
 * Mermaid ER Parser -- converts Mermaid ER diagram text into schema objects.
 *
 * Supported syntax:
 *   erDiagram
 *     <table_name> {
 *       <type> <field_name> [PK|FK|UK] ["comment"]
 *     }
 *     <table> ||--o{ <table> : "label"
 *
 *   %% Domain: <name> (<#color>): table1, table2
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
  'double_precision': 'double precision',
  'bool': 'boolean',
  'ts': 'timestamp',
  'tstz': 'timestamptz',
  'char': 'varchar',
  'string': 'varchar',
  'str': 'text',
};

function normaliseType(raw: string): FieldType | null {
  const lower = raw.toLowerCase().trim().replace(/_/g, ' ');
  if ((ALL_FIELD_TYPES as string[]).includes(lower)) return lower as FieldType;
  const aliasKey = raw.toLowerCase().trim();
  if (TYPE_ALIASES[aliasKey]) return TYPE_ALIASES[aliasKey];
  return null;
}

// ─── Relation symbol parsing ───
const RELATION_PATTERNS: { pattern: RegExp; type: RelationType }[] = [
  { pattern: /\|\|--\|\|/, type: '1:1' },
  { pattern: /\|\|--o\{/, type: '1:N' },
  { pattern: /\}o--\|\|/, type: 'N:1' },
  { pattern: /\}o--o\{/, type: 'N:M' },
  { pattern: /\|\|--\{/, type: '1:N' },
  { pattern: /\}--\|\|/, type: 'N:1' },
  { pattern: /\}--\{/, type: 'N:M' },
];

function parseRelationLine(line: string): { from: string; to: string; type: RelationType; label: string } | null {
  for (const { pattern, type } of RELATION_PATTERNS) {
    const match = line.match(new RegExp(`^\\s*(\\w+)\\s+${pattern.source}\\s+(\\w+)\\s*:\\s*"([^"]*)"\\s*$`));
    if (match) {
      return { from: match[1], to: match[2], type, label: match[3] };
    }
  }
  return null;
}

// ─── Main parser ───
export function parseMermaidER(source: string): ParseResult {
  const lines = source.split('\n');
  const tables: Table[] = [];
  const relations: Relation[] = [];
  const domains: Domain[] = [];
  const enums: EnumType[] = [];
  const errors: ParseError[] = [];

  const tableMap = new Map<string, Table>();
  const domainDefs: { name: string; color: string; tableNames: string[] }[] = [];
  const deferredRels: { from: string; to: string; type: RelationType; label: string; line: number }[] = [];

  let i = 0;
  let tableX = 50;
  let tableY = 50;

  while (i < lines.length) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line) { i++; continue; }

    // erDiagram header
    if (/^erDiagram$/i.test(line)) { i++; continue; }

    // Domain comment: %% Domain: Name (#color): table1, table2
    const domainComment = line.match(/^%%\s*Domain:\s*(.+?)\s*\((#[0-9a-fA-F]{6})\):\s*(.+)$/i);
    if (domainComment) {
      const tableNames = domainComment[3].split(',').map(s => s.trim()).filter(Boolean);
      domainDefs.push({ name: domainComment[1], color: domainComment[2], tableNames });
      i++;
      continue;
    }

    // Enum comment: %% Enum: ChatRole: system, user, assistant
    const enumComment = line.match(/^%%\s*Enum:\s*(\w+)\s*:\s*(.+)$/i);
    if (enumComment) {
      const values = enumComment[2].split(',').map(s => s.trim()).filter(Boolean);
      enums.push({ id: genId('enum'), name: enumComment[1], values: Array.from(new Set(values)) });
      i++;
      continue;
    }

    // Regular comments
    if (line.startsWith('%%')) { i++; continue; }

    // ─── Relation line ───
    const rel = parseRelationLine(line);
    if (rel) {
      deferredRels.push({ ...rel, line: lineNum });
      i++;
      continue;
    }

    // ─── Table definition ───
    const tableMatch = line.match(/^(\w+)\s*\{\s*$/);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const fields: Field[] = [];
      i++;

      while (i < lines.length) {
        const fline = lines[i].trim();
        const flineNum = i + 1;
        i++;

        if (fline === '}') break;
        if (!fline || fline.startsWith('%%')) continue;

        const parsed = parseMermaidFieldLine(fline, flineNum, enums);
        if (parsed.error) {
          errors.push(parsed.error);
          continue;
        }
        if (parsed.field) fields.push(parsed.field);
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

    // Unrecognised
    if (line !== '}') {
      // Could be a relation with flexible syntax
      const flexRel = line.match(/^\s*(\w+)\s+\S+\s+(\w+)\s*:\s*"([^"]*)"\s*$/);
      if (flexRel) {
        deferredRels.push({ from: flexRel[1], to: flexRel[2], type: '1:N' as RelationType, label: flexRel[3], line: lineNum });
      } else {
        errors.push({ line: lineNum, message: `Unexpected: "${line}"` });
      }
    }
    i++;
  }

  // ─── Resolve deferred relations ───
  for (const ref of deferredRels) {
    const fromTable = tableMap.get(ref.from.toLowerCase());
    const toTable = tableMap.get(ref.to.toLowerCase());
    if (!fromTable) {
      errors.push({ line: ref.line, message: `Relation source "${ref.from}" not found` });
      continue;
    }
    if (!toTable) {
      errors.push({ line: ref.line, message: `Relation target "${ref.to}" not found` });
      continue;
    }

    // Try to find the FK field by label (field name) in the source table
    let fromField = fromTable.fields.find(f => f.name.toLowerCase() === ref.label.toLowerCase());
    let toField = toTable.fields.find(f => f.isPrimaryKey);

    if (!fromField) {
      fromField = fromTable.fields.find(f => f.isForeignKey);
    }
    if (!fromField) {
      fromField = fromTable.fields[0];
    }
    if (!toField) {
      toField = toTable.fields[0];
    }

    if (!fromField || !toField) continue;

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

  // ─── Build domains ───
  for (const dd of domainDefs) {
    const domain: Domain = {
      id: genId('dom'),
      name: dd.name,
      color: dd.color,
    };
    domains.push(domain);
    for (const tName of dd.tableNames) {
      const t = tableMap.get(tName.toLowerCase());
      if (t) t.domainId = domain.id;
    }
  }

  return { tables, relations, domains, enums, errors };
}

// ─── Field line parser ───

interface FieldParseResult {
  field: Field | null;
  error: ParseError | null;
}

function parseMermaidFieldLine(line: string, lineNum: number, enums: EnumType[]): FieldParseResult {
  // Mermaid format: type fieldName [PK|FK|UK] ["comment"]
  let comment = '';
  let rest = line;
  const commentMatch = line.match(/^(.*?)\s+"([^"]*)"$/);
  if (commentMatch) {
    rest = commentMatch[1];
    comment = commentMatch[2];
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { field: null, error: { line: lineNum, message: `Field needs type and name: "${line}"` } };
  }

  const rawType = tokens[0];
  const fieldName = tokens[1];

  const fieldType = normaliseType(rawType);
  const enumType = enums.find(e => e.name.toLowerCase() === rawType.toLowerCase());
  if (!fieldType && !enumType) {
    return { field: null, error: { line: lineNum, message: `Unknown type "${rawType}"` } };
  }

  let isPrimaryKey = false;
  let isNullable = true;
  let isUnique = false;
  let isForeignKey = false;
  let defaultValue: string | undefined;
  let fieldComment: string | undefined;

  for (let j = 2; j < tokens.length; j++) {
    const upper = tokens[j].toUpperCase();
    if (upper === 'PK') { isPrimaryKey = true; isNullable = false; }
    else if (upper === 'FK') { isForeignKey = true; }
    else if (upper === 'UK') { isUnique = true; }
  }

  if (comment) {
    // Parse comma-separated comment tokens
    const commentTokens = comment.split(',').map(s => s.trim());
    for (const rawTok of commentTokens) {
      const tok = rawTok.toUpperCase();
      if (tok === 'NOT NULL') {
        isNullable = false;
      } else if (tok === 'INDEXED') {
        // Will be set on field below
      } else if (tok.startsWith('COMMENT=')) {
        fieldComment = rawTok.slice(8).trim();
      } else if (tok) {
        // Treat unknown token as a default literal and continue
        defaultValue = rawTok;
      }
    }
  }

  const isIndexedFlag = comment ? comment.toUpperCase().includes('INDEXED') : false;

  const field: Field = {
    id: genId('fld'),
    name: fieldName,
    type: enumType ? 'enum' : fieldType!,
    enumId: enumType?.id,
    enumName: enumType?.name,
    isPrimaryKey,
    isNullable,
    isForeignKey,
    isUnique,
    isIndexed: isIndexedFlag,
    defaultValue,
    comment: fieldComment,
  };

  return { field, error: null };
}
