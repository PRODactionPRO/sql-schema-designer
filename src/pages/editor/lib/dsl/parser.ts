/**
 * DSL Parser — converts our custom DSL text into schema objects.
 *
 * Syntax:
 *   table <name> {
 *     <field_name> <type> [pk] [unique] [indexed] [not null] [nullable] [default=<value>]
 *     <field_name> <type> -> <table>.<field>   // FK shorthand
 *   }
 *
 *   domain "<name>" <#color> {
 *     <table1>, <table2>
 *   }
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

// Normalise a type string to our FieldType union (case-insensitive, allow aliases)
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
  // Handle "double precision" written as two tokens — caller handles this
  return null;
}

// ─── Main parser ────────────────────────────────────────────

export function parseDSL(source: string): ParseResult {
  const lines = source.split('\n');
  const tables: Table[] = [];
  const relations: Relation[] = [];
  const domains: Domain[] = [];
  const enums: EnumType[] = [];
  const errors: ParseError[] = [];

  // Map table-name → Table for FK resolution
  const tableMap = new Map<string, Table>();
  // Deferred FK relations (resolved after all tables parsed)
  const deferredFKs: { line: number; fromTableName: string; fromFieldId: string; toTableName: string; toFieldName: string }[] = [];
  // Deferred domain table assignments
  const deferredDomainAssigns: { domainId: string; tableNames: string[]; line: number }[] = [];

  let i = 0;
  let tableX = 50;
  let tableY = 50;

  while (i < lines.length) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!line || line.startsWith('//') || line.startsWith('#') && !line.match(/^#[0-9a-fA-F]{6}/)) {
      i++;
      continue;
    }

    // ─── Enum definition ───
    const enumMatch = line.match(/^enum\s+(\w+)\s*\{?\s*$/i);
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
    const tableMatch = line.match(/^table\s+(\w+)\s*\{?\s*$/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const fields: Field[] = [];
      i++;

      // Parse fields until closing brace
      while (i < lines.length) {
        const fline = lines[i].trim();
        const flineNum = i + 1;
        i++;

        if (fline === '}' || fline === '};') break;
        if (!fline || fline.startsWith('//')) continue;

        const parsed = parseFieldLine(fline, flineNum, enums);
        if (parsed.error) {
          errors.push(parsed.error);
          continue;
        }
        if (parsed.field) {
          fields.push(parsed.field);
          if (parsed.fk) {
            deferredFKs.push({
              line: flineNum,
              fromTableName: tableName,
              fromFieldId: parsed.field.id,
              toTableName: parsed.fk.table,
              toFieldName: parsed.fk.field,
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

      // Grid layout for auto-positioning
      tableX += 300;
      if (tableX > 1200) { tableX = 50; tableY += 350; }
      continue;
    }

    // ─── Domain definition ───
    const domainMatch = line.match(/^domain\s+"([^"]+)"\s*(#[0-9a-fA-F]{6})?\s*\{?\s*$/i);
    if (domainMatch) {
      const domainName = domainMatch[1];
      const domainColor = domainMatch[2] || '#3b82f6';
      const domainTableNames: string[] = [];
      i++;

      while (i < lines.length) {
        const dline = lines[i].trim();
        i++;
        if (dline === '}' || dline === '};') break;
        if (!dline || dline.startsWith('//')) continue;
        // Parse comma-separated table names
        dline.split(',').forEach(t => {
          const name = t.trim();
          if (name) domainTableNames.push(name);
        });
      }

      const domain: Domain = {
        id: genId('dom'),
        name: domainName,
        color: domainColor,
      };
      domains.push(domain);
      deferredDomainAssigns.push({ domainId: domain.id, tableNames: domainTableNames, line: lineNum });
      continue;
    }

    // Unrecognised line
    if (line !== '}') {
      errors.push({ line: lineNum, message: `Unexpected: "${line}"` });
    }
    i++;
  }

  // ─── Resolve FKs ───
  for (const fk of deferredFKs) {
    const toTable = tableMap.get(fk.toTableName.toLowerCase());
    if (!toTable) {
      errors.push({ line: fk.line, message: `FK target table "${fk.toTableName}" not found` });
      continue;
    }
    const toField = toTable.fields.find(f => f.name.toLowerCase() === fk.toFieldName.toLowerCase());
    if (!toField) {
      errors.push({ line: fk.line, message: `FK target field "${fk.toTableName}.${fk.toFieldName}" not found` });
      continue;
    }
    const fromTable = tables.find(t => t.name.toLowerCase() === fk.fromTableName.toLowerCase());
    if (!fromTable) continue;

    // Update the source field with FK info
    const srcField = fromTable.fields.find(f => f.id === fk.fromFieldId);
    if (srcField) {
      srcField.isForeignKey = true;
      srcField.foreignKeyTable = toTable.name;
      srcField.foreignKeyField = toField.name;
    }

    relations.push({
      id: genId('rel'),
      fromTableId: fromTable.id,
      fromFieldId: fk.fromFieldId,
      toTableId: toTable.id,
      toFieldId: toField.id,
      type: '1:N' as RelationType,
    });
  }

  // ─── Resolve domain assignments ───
  for (const da of deferredDomainAssigns) {
    for (const tName of da.tableNames) {
      const t = tableMap.get(tName.toLowerCase());
      if (t) {
        t.domainId = da.domainId;
      } else {
        errors.push({ line: da.line, message: `Domain table "${tName}" not found` });
      }
    }
  }

  return { tables, relations, domains, enums, errors };
}

// ─── Field line parser ──────────────────────────────────────

interface FieldParseResult {
  field: Field | null;
  fk: { table: string; field: string } | null;
  error: ParseError | null;
}

function parseFieldLine(line: string, lineNum: number, enums: EnumType[]): FieldParseResult {
  const { code, comment } = splitInlineComment(line);
  const parsedLine = code.trim();
  if (!parsedLine) {
    return { field: null, fk: null, error: { line: lineNum, message: `Field needs at least name and type: "${line}"` } };
  }

  // Tokenise — respect quoted default values
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  for (const ch of parsedLine) {
    if (ch === '"' || ch === "'") {
      inQuote = !inQuote;
      current += ch;
    } else if ((ch === ' ' || ch === '\t') && !inQuote) {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  if (tokens.length < 2) {
    return { field: null, fk: null, error: { line: lineNum, message: `Field needs at least name and type: "${line}"` } };
  }

  const fieldName = tokens[0];
  
  // Handle "double precision" as two-token type
  let typeStr: string;
  let restStart: number;
  if (tokens[1].toLowerCase() === 'double' && tokens.length > 2 && tokens[2].toLowerCase() === 'precision') {
    typeStr = 'double precision';
    restStart = 3;
  } else {
    typeStr = tokens[1];
    restStart = 2;
  }

  const fieldType = normaliseType(typeStr);
  const enumType = enums.find(e => e.name.toLowerCase() === typeStr.toLowerCase());
  if (!fieldType && !enumType) {
    return { field: null, fk: null, error: { line: lineNum, message: `Unknown type "${typeStr}"` } };
  }

  let isPrimaryKey = false;
  let isNullable = true;
  let isUnique = false;
  let isIndexed = false;
  let defaultValue: string | undefined;
  let fk: { table: string; field: string } | null = null;

  for (let j = restStart; j < tokens.length; j++) {
    const tok = tokens[j].toLowerCase();

    if (tok === 'pk' || tok === 'primary' || tok === 'primarykey') {
      isPrimaryKey = true;
      isNullable = false;
      continue;
    }
    if (tok === 'unique') { isUnique = true; continue; }
    if (tok === 'indexed' || tok === 'index') { isIndexed = true; continue; }
    if (tok === 'not' && j + 1 < tokens.length && tokens[j + 1].toLowerCase() === 'null') {
      isNullable = false;
      j++;
      continue;
    }
    if (tok === 'nullable') { isNullable = true; continue; }
    if (tok.startsWith('default=') || tok.startsWith('default:')) {
      defaultValue = tokens[j].slice(8);
      continue;
    }

    // FK reference:  -> table.field
    if (tok === '->' || tok === '=>') {
      if (j + 1 < tokens.length) {
        const ref = tokens[j + 1];
        const dotIdx = ref.indexOf('.');
        if (dotIdx > 0) {
          fk = { table: ref.slice(0, dotIdx), field: ref.slice(dotIdx + 1) };
        } else {
          fk = { table: ref, field: 'id' };
        }
        j++;
      }
      continue;
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
    isIndexed,
    defaultValue,
    comment: comment || undefined,
  };

  return { field, fk, error: null };
}

function splitInlineComment(line: string): { code: string; comment: string } {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (!inSingle && !inDouble && ch === '/' && next === '/') {
      return {
        code: line.slice(0, i),
        comment: line.slice(i + 2).trim(),
      };
    }
  }

  return { code: line, comment: '' };
}
