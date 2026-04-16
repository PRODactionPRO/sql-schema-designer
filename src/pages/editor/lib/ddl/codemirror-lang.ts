/**
 * CodeMirror 6 language support for PostgreSQL DDL.
 * Provides syntax highlighting, folding, and autocomplete.
 */

import { StreamLanguage } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete';

// ─── Token sets ─────────────────────────────────────────────

const DDL_KEYWORDS = new Set([
  'create', 'table', 'alter', 'add', 'drop', 'if', 'not', 'exists',
  'constraint', 'primary', 'key', 'foreign', 'references',
  'unique', 'check', 'index', 'on', 'cascade', 'restrict',
  'set', 'null', 'default', 'using', 'with', 'without',
  'time', 'zone', 'varying',
  'insert', 'update', 'delete', 'select', 'from', 'where',
  'and', 'or', 'in', 'as', 'is',
  'grant', 'revoke', 'comment', 'schema',
  'begin', 'commit', 'rollback',
  'enable', 'disable', 'row', 'level', 'security',
  'policy', 'for', 'to', 'all', 'true', 'false',
]);

const SQL_TYPES = new Set([
  'uuid', 'bigint', 'integer', 'int', 'int2', 'int4', 'int8',
  'smallint', 'serial', 'serial4', 'bigserial', 'serial8',
  'varchar', 'character', 'char', 'text', 'citext',
  'boolean', 'bool',
  'timestamp', 'timestamptz', 'date', 'time', 'interval',
  'json', 'jsonb',
  'decimal', 'numeric', 'real', 'float', 'float4', 'float8',
  'double', 'precision',
  'bytea', 'inet', 'cidr', 'macaddr',
  'point', 'line', 'polygon', 'circle',
  'money', 'xml', 'array',
]);

const SQL_FUNCTIONS = new Set([
  'now', 'current_timestamp', 'current_date', 'current_time',
  'gen_random_uuid', 'uuid_generate_v4', 'nextval',
  'coalesce', 'nullif', 'greatest', 'least',
]);

// ─── Stream parser ──────────────────────────────────────────

type State = {
  inCreateTable: boolean;
  afterType: boolean;
};

export const ddlStreamParser = StreamLanguage.define<State>({
  startState(): State {
    return { inCreateTable: false, afterType: false };
  },

  token(stream, state): string | null {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Line comments --
    if (stream.match('--')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // Block comments /* ... */
    if (stream.match('/*')) {
      while (!stream.eol()) {
        if (stream.match('*/')) break;
        stream.next();
      }
      return 'blockComment';
    }

    // String literals 'text'
    if (stream.eat("'")) {
      while (!stream.eol()) {
        if (stream.eat("'")) {
          // Check for escaped quote ''
          if (!stream.eat("'")) break;
        } else {
          stream.next();
        }
      }
      return 'string';
    }

    // Parentheses
    if (stream.eat('(')) return 'paren';
    if (stream.eat(')')) return 'paren';

    // Semicolons
    if (stream.eat(';')) {
      state.inCreateTable = false;
      return 'punctuation';
    }

    // Commas
    if (stream.eat(',')) return 'separator';

    // Operators
    if (stream.match('::')) return 'operator'; // type cast
    if (stream.eat('=') || stream.eat('<') || stream.eat('>') || stream.eat('!')) {
      stream.eat('=');
      return 'operator';
    }

    // Dot (schema.table or table.column)
    if (stream.eat('.')) return 'punctuation';

    // Numbers
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';

    // Read a word
    const wordMatch = stream.match(/^[a-zA-Z_]\w*/);
    if (wordMatch) {
      const word = typeof wordMatch === 'string' ? wordMatch : (wordMatch as RegExpMatchArray)[0];
      const lower = word.toLowerCase();

      // Track CREATE TABLE context
      if (lower === 'create') {
        return 'keyword';
      }
      if (lower === 'table' && state.inCreateTable === false) {
        state.inCreateTable = true;
        return 'keyword';
      }

      // SQL functions (before checking types, since some overlap)
      if (SQL_FUNCTIONS.has(lower)) return 'variableName';

      // SQL types
      if (SQL_TYPES.has(lower)) return 'typeName';

      // Keywords
      if (DDL_KEYWORDS.has(lower)) return 'keyword';

      // Inside CREATE TABLE — field names or table names
      if (state.inCreateTable) {
        return 'propertyName';
      }

      return 'variableName';
    }

    // Fallback
    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '--', block: { open: '/*', close: '*/' } },
  },
});

// ─── Dark theme highlight style ─────────────────────────────

export const ddlDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c678dd' },           // purple for SQL keywords
  { tag: t.typeName, color: '#61afef' },           // blue for types
  { tag: t.propertyName, color: '#e5c07b' },       // gold for column/table names
  { tag: t.variableName, color: '#98c379' },       // green for functions & references
  { tag: t.string, color: '#98c379' },             // green for strings
  { tag: t.lineComment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.operator, color: '#56b6c2' },           // cyan for operators
  { tag: t.number, color: '#d19a66' },             // orange for numbers
  { tag: t.paren, color: '#abb2bf' },
  { tag: t.punctuation, color: '#abb2bf' },
  { tag: t.separator, color: '#abb2bf' },
]);

export const ddlDarkHighlighting = syntaxHighlighting(ddlDarkHighlightStyle);

// ─── Autocomplete ───────────────────────────────────────────

const KEYWORD_COMPLETIONS: Completion[] = [
  { label: 'CREATE TABLE', type: 'keyword', detail: 'Create a new table', boost: 2 },
  { label: 'ALTER TABLE', type: 'keyword', detail: 'Modify table', boost: 1 },
  { label: 'ADD CONSTRAINT', type: 'keyword', detail: 'Add constraint' },
  { label: 'PRIMARY KEY', type: 'keyword', detail: 'Primary key constraint' },
  { label: 'FOREIGN KEY', type: 'keyword', detail: 'Foreign key constraint' },
  { label: 'REFERENCES', type: 'keyword', detail: 'FK reference' },
  { label: 'NOT NULL', type: 'keyword', detail: 'Not nullable' },
  { label: 'UNIQUE', type: 'keyword', detail: 'Unique constraint' },
  { label: 'DEFAULT', type: 'keyword', detail: 'Default value' },
  { label: 'IF NOT EXISTS', type: 'keyword', detail: 'Conditional create' },
  { label: 'DROP TABLE', type: 'keyword', detail: 'Drop a table' },
  { label: 'CASCADE', type: 'keyword', detail: 'Cascade action' },
];

const TYPE_COMPLETIONS: Completion[] = [
  { label: 'UUID', type: 'type', detail: 'Universally unique identifier', boost: 2 },
  { label: 'INTEGER', type: 'type', detail: '32-bit integer', boost: 2 },
  { label: 'BIGINT', type: 'type', detail: '64-bit integer' },
  { label: 'SMALLINT', type: 'type', detail: '16-bit integer' },
  { label: 'SERIAL', type: 'type', detail: 'Auto-increment integer', boost: 1 },
  { label: 'BIGSERIAL', type: 'type', detail: 'Auto-increment bigint' },
  { label: 'VARCHAR(255)', type: 'type', detail: 'Variable-length string', boost: 2 },
  { label: 'TEXT', type: 'type', detail: 'Unlimited text', boost: 2 },
  { label: 'BOOLEAN', type: 'type', detail: 'True/false', boost: 1 },
  { label: 'TIMESTAMP', type: 'type', detail: 'Date and time', boost: 1 },
  { label: 'TIMESTAMPTZ', type: 'type', detail: 'Timestamp with timezone', boost: 1 },
  { label: 'DATE', type: 'type', detail: 'Calendar date' },
  { label: 'TIME', type: 'type', detail: 'Time of day' },
  { label: 'JSON', type: 'type', detail: 'JSON data' },
  { label: 'JSONB', type: 'type', detail: 'Binary JSON', boost: 1 },
  { label: 'DECIMAL', type: 'type', detail: 'Exact numeric' },
  { label: 'NUMERIC', type: 'type', detail: 'Exact numeric' },
  { label: 'REAL', type: 'type', detail: '32-bit float' },
  { label: 'DOUBLE PRECISION', type: 'type', detail: '64-bit float' },
  { label: 'BYTEA', type: 'type', detail: 'Binary data' },
  { label: 'INET', type: 'type', detail: 'IPv4/IPv6 address' },
  { label: 'INTERVAL', type: 'type', detail: 'Time interval' },
  { label: 'MONEY', type: 'type', detail: 'Currency amount' },
  { label: 'CITEXT', type: 'type', detail: 'Case-insensitive text' },
  { label: 'XML', type: 'type', detail: 'XML data' },
  { label: 'POINT', type: 'type', detail: 'Geometric point' },
];

const FUNCTION_COMPLETIONS: Completion[] = [
  { label: "gen_random_uuid()", type: 'function', detail: 'Generate UUID v4' },
  { label: 'now()', type: 'function', detail: 'Current timestamp' },
  { label: 'CURRENT_TIMESTAMP', type: 'function', detail: 'Current timestamp' },
  { label: 'CURRENT_DATE', type: 'function', detail: 'Current date' },
  { label: "nextval('sequence')", type: 'function', detail: 'Next sequence value' },
];

function ddlCompletions(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const trimmed = textBefore.trimStart().toUpperCase();

  // Word being typed
  const wordMatch = context.matchBefore(/[a-zA-Z_]\w*/);
  if (!wordMatch && !context.explicit) return null;
  const from = wordMatch ? wordMatch.from : context.pos;

  // After DEFAULT, suggest functions
  if (/DEFAULT\s+$/i.test(textBefore)) {
    return {
      from: context.pos,
      options: FUNCTION_COMPLETIONS,
      validFor: /^[a-zA-Z_]\w*$/,
    };
  }

  // Determine context: inside CREATE TABLE body?
  let insideCreate = false;
  for (let i = line.number - 1; i >= 1; i--) {
    const prevLine = context.state.doc.line(i).text.trim();
    if (prevLine.endsWith(';')) break;
    if (/^CREATE\s+TABLE/i.test(prevLine)) { insideCreate = true; break; }
  }

  if (insideCreate) {
    // After column name (one word then space), suggest types
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 1 && textBefore.endsWith(' ')) {
      return { from: context.pos, options: TYPE_COMPLETIONS, validFor: /^[a-zA-Z_]\w*$/ };
    }
    if (tokens.length >= 2) {
      // After type — suggest constraints
      return { from, options: [...KEYWORD_COMPLETIONS.filter(c => ['PRIMARY KEY', 'NOT NULL', 'UNIQUE', 'DEFAULT', 'REFERENCES'].includes(c.label))], validFor: /^[a-zA-Z_]\w*$/ };
    }
  }

  // Top level — keywords + types
  return {
    from,
    options: [...KEYWORD_COMPLETIONS, ...TYPE_COMPLETIONS],
    validFor: /^[a-zA-Z_]\w*$/,
  };
}

export const ddlAutocomplete = autocompletion({
  override: [ddlCompletions],
  icons: true,
  optionClass: () => 'ddl-autocomplete-option',
});
