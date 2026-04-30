/**
 * CodeMirror 6 language support for our DSL.
 * Provides syntax highlighting via a StreamLanguage-style approach.
 */

import { StreamLanguage } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete';
import { ALL_FIELD_TYPES } from '../../model/types';
import type { FieldType } from '../../model/types';

// ─── Stream parser ──────────────────────────────────────────

type State = {
  context: 'top' | 'table' | 'domain';
  afterArrow: boolean;
};

const KEYWORDS = new Set(['table', 'domain']);
const MODIFIERS = new Set(['pk', 'primary', 'primarykey', 'unique', 'not', 'null', 'nullable']);
const TYPES_SET = new Set([
  ...ALL_FIELD_TYPES,
  // aliases
  'int', 'int2', 'int4', 'int8', 'float', 'float4', 'float8',
  'double', 'bool', 'ts', 'tstz', 'char', 'string', 'str',
]);

export const dslStreamParser = StreamLanguage.define<State>({
  startState(): State {
    return { context: 'top', afterArrow: false };
  },

  token(stream, state): string | null {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Comments
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // Opening / closing braces
    if (stream.eat('{')) {
      return 'brace';
    }
    if (stream.eat('}')) {
      state.context = 'top';
      return 'brace';
    }

    // Arrow ->  =>
    if (stream.match('->') || stream.match('=>')) {
      state.afterArrow = true;
      return 'operator';
    }

    // Comma (in domains)
    if (stream.eat(',')) return 'separator';

    // String literals (domain names)
    if (stream.eat('"')) {
      while (!stream.eol()) {
        if (stream.eat('"')) break;
        stream.next();
      }
      return 'string';
    }

    // Hex color
    if (stream.match(/#[0-9a-fA-F]{6}/)) {
      return 'color';
    }

    // default=value
    if (stream.match(/default[=:]/)) {
      // Read the value
      while (!stream.eol() && !stream.peek()?.match(/\s/)) {
        stream.next();
      }
      return 'string';
    }

    // Read a word
    const wordMatch = stream.match(/[a-zA-Z_][\w.]*/);
    if (wordMatch) {
      const word = typeof wordMatch === 'string' ? wordMatch : (wordMatch as RegExpMatchArray)[0];
      const lower = word.toLowerCase();

      // After arrow -> treat as reference (table.field)
      if (state.afterArrow) {
        state.afterArrow = false;
        return 'variableName';
      }

      // Keywords
      if (KEYWORDS.has(lower)) {
        if (lower === 'table') state.context = 'table';
        if (lower === 'domain') state.context = 'domain';
        return 'keyword';
      }

      // If we're at top-level right after keyword, it's the name
      if (state.context === 'top') {
        // This should be a table/domain name following the keyword
        return 'typeName';
      }

      // Inside table body
      if (state.context === 'table') {
        // Types
        if (TYPES_SET.has(lower)) return 'typeName';
        // Modifiers
        if (MODIFIERS.has(lower)) return 'modifier';
        // First word on line = field name
        return 'propertyName';
      }

      // Inside domain body — table references
      if (state.context === 'domain') {
        return 'variableName';
      }

      return null;
    }

    // Numbers
    if (stream.match(/\d+/)) return 'number';

    // Fallback
    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '//' },
  },
});

// ─── Dark theme highlight style ─────────────────────────────

export const dslDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c678dd' },           // purple for table/domain
  { tag: t.typeName, color: '#61afef' },           // blue for types & table names
  { tag: t.propertyName, color: '#e5c07b' },       // gold for field names
  { tag: t.variableName, color: '#98c379' },       // green for references
  { tag: t.string, color: '#98c379' },             // green for strings/defaults
  { tag: t.lineComment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.operator, color: '#56b6c2' },           // cyan for arrows
  { tag: t.number, color: '#d19a66' },             // orange for numbers
  { tag: t.modifier, color: '#e06c75' },           // red for pk/unique/not null
  { tag: t.brace, color: '#abb2bf' },              // dim white for braces
  { tag: t.separator, color: '#abb2bf' },
  { tag: t.color, color: '#d19a66' },              // orange for hex colors
]);

export const dslDarkHighlighting = syntaxHighlighting(dslDarkHighlightStyle);

// ─── Type icons for autocomplete ────────────────────────────

const TYPE_CATEGORY: Record<string, { icon: string; category: string }> = {
  'uuid': { icon: '🔑', category: 'Identifier' },
  'bigint': { icon: '🔢', category: 'Numeric' },
  'integer': { icon: '🔢', category: 'Numeric' },
  'smallint': { icon: '🔢', category: 'Numeric' },
  'serial': { icon: '🔄', category: 'Auto-increment' },
  'bigserial': { icon: '🔄', category: 'Auto-increment' },
  'varchar': { icon: '📝', category: 'Text' },
  'text': { icon: '📝', category: 'Text' },
  'citext': { icon: '📝', category: 'Text' },
  'boolean': { icon: '✅', category: 'Boolean' },
  'timestamp': { icon: '🕐', category: 'Date/Time' },
  'timestamptz': { icon: '🕐', category: 'Date/Time' },
  'date': { icon: '📅', category: 'Date/Time' },
  'time': { icon: '⏰', category: 'Date/Time' },
  'interval': { icon: '⏱️', category: 'Date/Time' },
  'json': { icon: '{}', category: 'JSON' },
  'jsonb': { icon: '{}', category: 'JSON' },
  'decimal': { icon: '💲', category: 'Numeric' },
  'numeric': { icon: '💲', category: 'Numeric' },
  'real': { icon: '🔢', category: 'Numeric' },
  'double precision': { icon: '🔢', category: 'Numeric' },
  'money': { icon: '💰', category: 'Numeric' },
  'bytea': { icon: '📦', category: 'Binary' },
  'inet': { icon: '🌐', category: 'Network' },
  'cidr': { icon: '🌐', category: 'Network' },
  'macaddr': { icon: '🌐', category: 'Network' },
  'point': { icon: '📍', category: 'Geometric' },
  'line': { icon: '📏', category: 'Geometric' },
  'polygon': { icon: '🔷', category: 'Geometric' },
  'circle': { icon: '⭕', category: 'Geometric' },
  'xml': { icon: '📄', category: 'Markup' },
  'array': { icon: '📋', category: 'Collection' },
  'vector': { icon: '🧠', category: 'AI/Embeddings' },
  'enum': { icon: '📑', category: 'Enum' },
};

// Build completions list with type aliases
const TYPE_COMPLETIONS: Completion[] = ALL_FIELD_TYPES.map((ft: FieldType) => {
  const info = TYPE_CATEGORY[ft] || { icon: '•', category: 'Other' };
  return {
    label: ft,
    type: 'type',
    detail: info.category,
    info: `PostgreSQL ${ft} type`,
    boost: ft === 'uuid' || ft === 'integer' || ft === 'varchar' || ft === 'text' || ft === 'boolean' || ft === 'timestamp' ? 2 : 0,
  };
});

// Also add common aliases
const ALIAS_COMPLETIONS: Completion[] = [
  { label: 'int', type: 'type', detail: 'Alias → integer', boost: -1 },
  { label: 'bool', type: 'type', detail: 'Alias → boolean', boost: -1 },
  { label: 'string', type: 'type', detail: 'Alias → varchar', boost: -1 },
  { label: 'str', type: 'type', detail: 'Alias → text', boost: -1 },
  { label: 'float', type: 'type', detail: 'Alias → real', boost: -1 },
  { label: 'double', type: 'type', detail: 'Alias → double precision', boost: -1 },
  { label: 'ts', type: 'type', detail: 'Alias → timestamp', boost: -1 },
  { label: 'tstz', type: 'type', detail: 'Alias → timestamptz', boost: -1 },
];

const ALL_TYPE_COMPLETIONS = [...TYPE_COMPLETIONS, ...ALIAS_COMPLETIONS];

// Modifier completions
const MODIFIER_COMPLETIONS: Completion[] = [
  { label: 'pk', type: 'keyword', detail: 'Primary Key', boost: 2 },
  { label: 'unique', type: 'keyword', detail: 'Unique constraint' },
  { label: 'not null', type: 'keyword', detail: 'Not nullable' },
  { label: 'nullable', type: 'keyword', detail: 'Allow NULL' },
  { label: 'default=', type: 'keyword', detail: 'Default value' },
];

// Keyword completions at top level
const KEYWORD_COMPLETIONS: Completion[] = [
  { label: 'table', type: 'keyword', detail: 'Define a table', boost: 2 },
  { label: 'domain', type: 'keyword', detail: 'Define a domain group' },
];

function dslCompletions(context: CompletionContext) {
  // Get the current line text up to the cursor
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const trimmed = textBefore.trimStart();

  // Determine if we're inside a table block by scanning backwards for "table ... {"
  let insideTable = false;
  let insideDomain = false;
  for (let i = line.number - 1; i >= 1; i--) {
    const prevLine = context.state.doc.line(i).text.trim();
    if (prevLine === '}' || prevLine === '};') break;
    if (/^table\s+\w+\s*\{?\s*$/i.test(prevLine)) { insideTable = true; break; }
    if (/^domain\s+"[^"]*"/i.test(prevLine)) { insideDomain = true; break; }
  }

  // Also check current line for table/domain start
  if (/^table\s+\w+\s*\{?\s*$/i.test(trimmed)) insideTable = true;
  if (/^domain\s+"[^"]*"/i.test(trimmed)) insideDomain = true;

  // Match the word being typed
  const wordMatch = context.matchBefore(/[a-zA-Z_][\w]*/);
  if (!wordMatch && !context.explicit) return null;

  const from = wordMatch ? wordMatch.from : context.pos;

  if (insideTable) {
    // Count tokens on the line to determine position
    const tokens = trimmed.split(/\s+/).filter(Boolean);

    if (tokens.length <= 1 && !trimmed.includes(' ')) {
      // First token = field name, no completion
      return null;
    }

    if (tokens.length === 1 && trimmed.endsWith(' ')) {
      // After field name + space = type position, show all types
      return {
        from: context.pos,
        options: ALL_TYPE_COMPLETIONS,
        validFor: /^[a-zA-Z_][\w]*$/,
      };
    }

    if (tokens.length === 2 && !trimmed.endsWith(' ')) {
      // Typing second token = type
      return {
        from,
        options: ALL_TYPE_COMPLETIONS,
        validFor: /^[a-zA-Z_][\w]*$/,
      };
    }

    if (tokens.length >= 2) {
      // After type = modifiers
      return {
        from,
        options: MODIFIER_COMPLETIONS,
        validFor: /^[a-zA-Z_][\w]*$/,
      };
    }
  }

  if (insideDomain) {
    // Inside domain — no autocomplete needed (table names are free-form)
    return null;
  }

  // Top level — keywords
  if (!insideTable && !insideDomain) {
    return {
      from,
      options: KEYWORD_COMPLETIONS,
      validFor: /^[a-zA-Z_][\w]*$/,
    };
  }

  return null;
}

// ─── Autocomplete extension with dark theme ─────────────────

export const dslAutocomplete = autocompletion({
  override: [dslCompletions],
  icons: true,
  optionClass: () => 'dsl-autocomplete-option',
});
