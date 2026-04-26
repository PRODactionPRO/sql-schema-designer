/**
 * DDL (PostgreSQL) Parser — converts PostgreSQL CREATE TABLE statements into schema objects.
 *
 * Supported syntax:
 *   CREATE TABLE [IF NOT EXISTS] [schema.]name (
 *     column_name TYPE [PRIMARY KEY] [NOT NULL] [UNIQUE] [DEFAULT value]
 *       [REFERENCES other_table(column)],
 *     ...
 *     [CONSTRAINT name PRIMARY KEY (col, ...)]
 *     [CONSTRAINT name FOREIGN KEY (col) REFERENCES other_table(col)]
 *     [CONSTRAINT name UNIQUE (col, ...)]
 *   );
 *
 *   ALTER TABLE name ADD CONSTRAINT name FOREIGN KEY (col) REFERENCES other(col);
 *
 *   -- line comments
 */

import type { Table, Field, Relation, Domain, FieldType, RelationType } from '../../model/types';

export interface ParseResult {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
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

const IDENT = `(?:"(?:[^"]|"")+"|[A-Za-z_][\\w$]*)`;

function unquoteIdent(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

// ─── Type mapping ───────────────────────────────────────────

const TYPE_MAP: Record<string, FieldType> = {
  'uuid': 'uuid',
  'bigint': 'bigint',
  'int8': 'bigint',
  'integer': 'integer',
  'int': 'integer',
  'int4': 'integer',
  'smallint': 'smallint',
  'int2': 'smallint',
  'serial': 'serial',
  'serial4': 'serial',
  'bigserial': 'bigserial',
  'serial8': 'bigserial',
  'varchar': 'varchar',
  'character varying': 'varchar',
  'character': 'varchar',
  'char': 'varchar',
  'text': 'text',
  'citext': 'citext',
  'boolean': 'boolean',
  'bool': 'boolean',
  'timestamp': 'timestamp',
  'timestamp without time zone': 'timestamp',
  'timestamptz': 'timestamptz',
  'timestamp with time zone': 'timestamptz',
  'date': 'date',
  'time': 'time',
  'time without time zone': 'time',
  'json': 'json',
  'jsonb': 'jsonb',
  'decimal': 'decimal',
  'numeric': 'numeric',
  'real': 'real',
  'float': 'real',
  'float4': 'real',
  'double precision': 'double precision',
  'float8': 'double precision',
  'bytea': 'bytea',
  'inet': 'inet',
  'cidr': 'cidr',
  'macaddr': 'macaddr',
  'interval': 'interval',
  'point': 'point',
  'line': 'line',
  'polygon': 'polygon',
  'circle': 'circle',
  'money': 'money',
  'xml': 'xml',
};

function parseFieldType(sqlType: string): FieldType {
  // Remove parenthesized arguments like (255) or (10,2)
  const normalized = sqlType.toLowerCase().replace(/\s*\([^)]*\)/, '').trim();
  return TYPE_MAP[normalized] || 'text';
}

// ─── Main parser ────────────────────────────────────────────

export function parseDDL(source: string): ParseResult {
  const tables: Table[] = [];
  const relations: Relation[] = [];
  const domains: Domain[] = [];
  const errors: ParseError[] = [];
  const tableMap = new Map<string, Table>();

  // Track deferred FK constraints (from ALTER TABLE or table-level CONSTRAINT)
  const deferredFKs: {
    line: number;
    fromTableName: string;
    fromFieldName: string;
    toTableName: string;
    toFieldName: string;
  }[] = [];

  // Normalize source: collapse multi-line statements
  const lines = source.split('\n');
  let tableX = 50;
  let tableY = 50;

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('--')) {
      i++;
      continue;
    }

    // ─── CREATE TABLE ───
    const createMatch = trimmed.match(
      new RegExp(`^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:(${IDENT})\\.)?(${IDENT})\\s*\\(`, 'i')
    );
    if (createMatch) {
      const tableName = unquoteIdent(createMatch[2]);

      // Collect the entire CREATE TABLE body until we hit ");"
      let bodyStr = '';
      let startLine = i;
      let bodyStarted = false;
      let parenDepth = 0;
      let foundEnd = false;

      for (let j = i; j < lines.length; j++) {
        const ln = lines[j];
        for (let ci = 0; ci < ln.length; ci++) {
          const ch = ln[ci];
          if (ch === '(') {
            parenDepth++;
            if (parenDepth === 1) {
              bodyStarted = true;
            } else {
              // Nested parens — keep them in body (e.g. VARCHAR(255), REFERENCES t(col))
              bodyStr += ch;
            }
          } else if (ch === ')') {
            parenDepth--;
            if (parenDepth === 0 && bodyStarted) {
              foundEnd = true;
              i = j + 1;
              break;
            } else {
              // Closing nested paren — keep in body
              bodyStr += ch;
            }
          } else if (bodyStarted && parenDepth >= 1) {
            bodyStr += ch;
          }
        }
        if (foundEnd) break;
        if (bodyStarted) bodyStr += '\n';
      }

      if (!foundEnd) {
        errors.push({ line: lineNum, message: `Unclosed CREATE TABLE "${tableName}"` });
        i++;
        continue;
      }

      // Split body by commas at top-level (depth 0 within the body)
      const columnDefs = splitByTopLevelComma(bodyStr);
      const fields: Field[] = [];
      const tableInlineFKs: { fieldName: string; refTable: string; refField: string; defLine: number }[] = [];

      for (const colDef of columnDefs) {
        const col = colDef.text.trim();
        if (!col) continue;
        // Approximate line number within the body
        const colLine = startLine + colDef.approxLine + 1;

        // Skip table-level constraints (but extract FKs from them)
        if (/^\s*(CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(/i.test(col)) {
          // Extract PK columns and mark them
          const pkMatch = col.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
          if (pkMatch) {
            const pkCols = pkMatch[1].split(',').map(c => unquoteIdent(c).toLowerCase());
            for (const f of fields) {
              if (pkCols.includes(f.name.toLowerCase())) {
                f.isPrimaryKey = true;
                f.isNullable = false;
              }
            }
          }
          continue;
        }

        if (/^\s*(CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(/i.test(col)) {
          const fkMatch = col.match(
            new RegExp(`FOREIGN\\s+KEY\\s*\\(\\s*(${IDENT})\\s*\\)\\s*REFERENCES\\s+(?:(${IDENT})\\.)?(${IDENT})\\s*\\(\\s*(${IDENT})\\s*\\)`, 'i')
          );
          if (fkMatch) {
            deferredFKs.push({
              line: colLine,
              fromTableName: tableName,
              fromFieldName: unquoteIdent(fkMatch[1]),
              toTableName: unquoteIdent(fkMatch[3]),
              toFieldName: unquoteIdent(fkMatch[4]),
            });
          }
          continue;
        }

        if (/^\s*(CONSTRAINT\s+\w+\s+)?UNIQUE\s*\(/i.test(col)) {
          const uqMatch = col.match(/UNIQUE\s*\(([^)]+)\)/i);
          if (uqMatch) {
            const uqCols = uqMatch[1].split(',').map(c => unquoteIdent(c).toLowerCase());
            for (const f of fields) {
              if (uqCols.includes(f.name.toLowerCase())) {
                f.isUnique = true;
              }
            }
          }
          continue;
        }

        if (/^\s*(CONSTRAINT|CHECK|EXCLUDE|INDEX)\b/i.test(col)) continue;

        // ─── Parse column definition ───
        // Pattern: column_name TYPE_EXPRESSION [modifiers...]
        const colHeadMatch = col.match(new RegExp(`^\\s*(${IDENT})\\s+(.+)$`, 'i'));
        if (!colHeadMatch) {
          // Don't report errors for empty/whitespace-only
          if (col.trim()) {
            errors.push({ line: colLine, message: `Cannot parse column: "${col.trim()}"` });
          }
          continue;
        }

        const colName = unquoteIdent(colHeadMatch[1]);
        // Skip if column name looks like a keyword
        if (/^(constraint|primary|foreign|unique|check|index|exclude)$/i.test(colName)) continue;

        const columnTail = colHeadMatch[2];
        const typeAndRestMatch = columnTail.match(
          /^(.*?)(?=\s+(?:PRIMARY\s+KEY|NOT\s+NULL|NULL|UNIQUE|DEFAULT|REFERENCES|CHECK|CONSTRAINT)\b|$)\s*(.*)$/i
        );
        if (!typeAndRestMatch || !typeAndRestMatch[1].trim()) {
          errors.push({ line: colLine, message: `Cannot parse column type for "${colName}"` });
          continue;
        }

        const rawType = typeAndRestMatch[1].trim();
        const rest = typeAndRestMatch[2] || '';
        const restUpper = rest.toUpperCase();

        const fieldType = parseFieldType(rawType);
        const isPK = restUpper.includes('PRIMARY KEY');
        const isNotNull = restUpper.includes('NOT NULL') || isPK;
        const isUnique = restUpper.includes('UNIQUE');

        // Extract DEFAULT value
        let defaultValue: string | undefined;
        const defMatch = rest.match(/DEFAULT\s+('(?:[^']*)'|\S+)/i);
        if (defMatch) {
          defaultValue = defMatch[1].replace(/^'|'$/g, '');
        }

        // Check for inline REFERENCES
        const refMatch = rest.match(
          new RegExp(`REFERENCES\\s+(?:(${IDENT})\\.)?(${IDENT})\\s*\\(\\s*(${IDENT})\\s*\\)`, 'i')
        );
        const isForeignKey = !!refMatch;

        const field: Field = {
          id: genId('fld'),
          name: colName,
          type: fieldType,
          isPrimaryKey: isPK,
          isNullable: !isNotNull,
          isForeignKey,
          isUnique,
          defaultValue,
        };
        fields.push(field);

        if (refMatch) {
          tableInlineFKs.push({
            fieldName: colName,
            refTable: unquoteIdent(refMatch[2]),
            refField: unquoteIdent(refMatch[3]),
            defLine: colLine,
          });
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

      // Store inline FKs as deferred
      for (const ifk of tableInlineFKs) {
        deferredFKs.push({
          line: ifk.defLine,
          fromTableName: tableName,
          fromFieldName: ifk.fieldName,
          toTableName: ifk.refTable,
          toFieldName: ifk.refField,
        });
      }

      // Grid layout
      tableX += 300;
      if (tableX > 1200) { tableX = 50; tableY += 350; }
      continue;
    }

    // ─── ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ───
    const alterMatch = trimmed.match(
      new RegExp(`^ALTER\\s+TABLE\\s+(?:(${IDENT})\\.)?(${IDENT})\\s+ADD\\s+(?:CONSTRAINT\\s+${IDENT}\\s+)?FOREIGN\\s+KEY\\s*\\(\\s*(${IDENT})\\s*\\)\\s*REFERENCES\\s+(?:(${IDENT})\\.)?(${IDENT})\\s*\\(\\s*(${IDENT})\\s*\\)`, 'i')
    );
    if (alterMatch) {
      deferredFKs.push({
        line: lineNum,
        fromTableName: unquoteIdent(alterMatch[2]),
        fromFieldName: unquoteIdent(alterMatch[3]),
        toTableName: unquoteIdent(alterMatch[5]),
        toFieldName: unquoteIdent(alterMatch[6]),
      });
      i++;
      continue;
    }

    // ─── CREATE INDEX ───
    const indexMatch = trimmed.match(
      new RegExp(`^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:${IDENT})\\s+ON\\s+(?:(${IDENT})\\.)?(${IDENT})\\s*\\(\\s*(${IDENT})`, 'i')
    );
    if (indexMatch) {
      const idxTableName = unquoteIdent(indexMatch[2]);
      const idxFieldName = unquoteIdent(indexMatch[3]);
      const idxTable = tableMap.get(idxTableName.toLowerCase());
      if (idxTable) {
        const idxField = idxTable.fields.find(f => f.name.toLowerCase() === idxFieldName.toLowerCase());
        if (idxField) idxField.isIndexed = true;
      }
      i++;
      continue;
    }

    // Skip other statements (DROP, COMMENT, etc.)
    i++;
  }

  // ─── Resolve deferred FKs ───
  for (const fk of deferredFKs) {
    const fromTable = tableMap.get(fk.fromTableName.toLowerCase());
    const toTable = tableMap.get(fk.toTableName.toLowerCase());

    if (!fromTable) {
      errors.push({ line: fk.line, message: `FK source table "${fk.fromTableName}" not found` });
      continue;
    }
    if (!toTable) {
      errors.push({ line: fk.line, message: `FK target table "${fk.toTableName}" not found` });
      continue;
    }

    const fromField = fromTable.fields.find(f => f.name.toLowerCase() === fk.fromFieldName.toLowerCase());
    const toField = toTable.fields.find(f => f.name.toLowerCase() === fk.toFieldName.toLowerCase());

    if (!fromField) {
      errors.push({ line: fk.line, message: `FK source field "${fk.fromTableName}.${fk.fromFieldName}" not found` });
      continue;
    }
    if (!toField) {
      errors.push({ line: fk.line, message: `FK target field "${fk.toTableName}.${fk.toFieldName}" not found` });
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
      type: '1:N' as RelationType,
    });
  }

  return { tables, relations, domains, errors };
}

// ─── Helper: split string by commas at top-level (respecting parentheses) ───

interface SplitResult {
  text: string;
  approxLine: number;
}

function splitByTopLevelComma(body: string): SplitResult[] {
  const results: SplitResult[] = [];
  let depth = 0;
  let current = '';
  let lineCount = 0;
  let startLine = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\n') lineCount++;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      results.push({ text: current.trim(), approxLine: startLine });
      current = '';
      startLine = lineCount;
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    results.push({ text: current.trim(), approxLine: startLine });
  }
  return results;
}
