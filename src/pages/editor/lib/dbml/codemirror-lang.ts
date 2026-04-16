/**
 * CodeMirror 6 language support for DBML.
 * Provides syntax highlighting and autocomplete.
 */

import { StreamLanguage } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete';
import { ALL_FIELD_TYPES } from '../../model/types';
import type { FieldType } from '../../model/types';

// ─── Stream parser ───

type State = {
  context: 'top' | 'table' | 'group' | 'indexes';
  afterRef: boolean;
};

const KEYWORDS = new Set(['table', 'ref', 'tablegroup', 'enum', 'indexes', 'note']);
const ATTRS = new Set(['pk', 'primary', 'key', 'unique', 'not', 'null', 'default', 'increment', 'ref']);
const TYPES_SET = new Set([
  ...ALL_FIELD_TYPES,
  'int', 'int2', 'int4', 'int8', 'float', 'float4', 'float8',
  'double', 'bool', 'ts', 'tstz', 'char', 'string', 'str',
]);

export const dbmlStreamParser = StreamLanguage.define<State>({
  startState(): State {
    return { context: 'top', afterRef: false };
  },

  token(stream, state): string | null {
    if (stream.eatSpace()) return null;

    // Comments
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // Braces
    if (stream.eat('{')) return 'brace';
    if (stream.eat('}')) {
      if (state.context === 'indexes') {
        state.context = 'table';
      } else {
        state.context = 'top';
      }
      return 'brace';
    }

    // Brackets (attribute delimiters)
    if (stream.eat('[')) return 'squareBracket';
    if (stream.eat(']')) return 'squareBracket';

    // Ref symbols
    if (stream.match('<>') || stream.eat('>') || stream.eat('<') || stream.eat('-')) {
      if (state.context === 'top' || state.afterRef) {
        state.afterRef = true;
        return 'operator';
      }
      return null;
    }

    // Colon
    if (stream.eat(':')) {
      return 'punctuation';
    }

    // Comma
    if (stream.eat(',')) return 'separator';

    // String literals
    if (stream.match(/^['"`]/)) {
      const quote = stream.current();
      while (!stream.eol()) {
        if (stream.next() === quote) break;
      }
      return 'string';
    }

    // Read word
    const wordMatch = stream.match(/[a-zA-Z_][\w.]*/);
    if (wordMatch) {
      const word = typeof wordMatch === 'string' ? wordMatch : (wordMatch as RegExpMatchArray)[0];
      const lower = word.toLowerCase();

      if (state.afterRef && word.includes('.')) {
        state.afterRef = false;
        return 'variableName';
      }

      if (KEYWORDS.has(lower)) {
        if (lower === 'table') state.context = 'table';
        if (lower === 'tablegroup') state.context = 'group';
        if (lower === 'indexes') state.context = 'indexes';
        if (lower === 'ref') state.afterRef = true;
        return 'keyword';
      }

      if (state.context === 'table') {
        if (TYPES_SET.has(lower)) return 'typeName';
        if (ATTRS.has(lower)) return 'modifier';
        return 'propertyName';
      }

      if (state.context === 'group') {
        return 'variableName';
      }

      if (state.context === 'top') {
        return 'typeName'; // table/group names
      }

      return null;
    }

    // Numbers
    if (stream.match(/\d+/)) return 'number';

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '//' },
  },
});

// ─── Dark highlight style ───

export const dbmlDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c678dd' },
  { tag: t.typeName, color: '#61afef' },
  { tag: t.propertyName, color: '#e5c07b' },
  { tag: t.variableName, color: '#98c379' },
  { tag: t.string, color: '#98c379' },
  { tag: t.lineComment, color: '#5c6370', fontStyle: 'italic' },
  { tag: t.operator, color: '#56b6c2' },
  { tag: t.number, color: '#d19a66' },
  { tag: t.modifier, color: '#e06c75' },
  { tag: t.brace, color: '#abb2bf' },
  { tag: t.squareBracket, color: '#abb2bf' },
  { tag: t.separator, color: '#abb2bf' },
  { tag: t.punctuation, color: '#abb2bf' },
]);

export const dbmlDarkHighlighting = syntaxHighlighting(dbmlDarkHighlightStyle);

// ─── Autocomplete ───

const TYPE_COMPLETIONS: Completion[] = ALL_FIELD_TYPES.map((ft: FieldType) => ({
  label: ft,
  type: 'type',
  detail: 'PostgreSQL type',
  boost: ft === 'uuid' || ft === 'integer' || ft === 'varchar' || ft === 'text' || ft === 'boolean' ? 2 : 0,
}));

const ATTR_COMPLETIONS: Completion[] = [
  { label: 'pk', type: 'keyword', detail: 'Primary Key', boost: 2 },
  { label: 'unique', type: 'keyword', detail: 'Unique constraint' },
  { label: 'not null', type: 'keyword', detail: 'Not nullable' },
  { label: 'null', type: 'keyword', detail: 'Allow NULL' },
  { label: 'default:', type: 'keyword', detail: 'Default value' },
  { label: 'increment', type: 'keyword', detail: 'Auto-increment' },
  { label: 'ref:', type: 'keyword', detail: 'Foreign key reference' },
];

const KEYWORD_COMPLETIONS: Completion[] = [
  { label: 'Table', type: 'keyword', detail: 'Define a table', boost: 2 },
  { label: 'Ref:', type: 'keyword', detail: 'Define a reference' },
  { label: 'TableGroup', type: 'keyword', detail: 'Define a table group' },
  { label: 'Enum', type: 'keyword', detail: 'Define an enum' },
];

function dbmlCompletions(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const trimmed = textBefore.trimStart();

  let insideTable = false;
  let insideBrackets = false;
  for (let i = line.number - 1; i >= 1; i--) {
    const prevLine = context.state.doc.line(i).text.trim();
    if (prevLine === '}' || prevLine === '};') break;
    if (/^Table\s+\w+/i.test(prevLine)) { insideTable = true; break; }
  }

  // Check if inside brackets
  const lastOpen = textBefore.lastIndexOf('[');
  const lastClose = textBefore.lastIndexOf(']');
  if (lastOpen > lastClose) insideBrackets = true;

  const wordMatch = context.matchBefore(/[a-zA-Z_][\w]*/);
  if (!wordMatch && !context.explicit) return null;
  const from = wordMatch ? wordMatch.from : context.pos;

  if (insideBrackets) {
    return { from, options: ATTR_COMPLETIONS, validFor: /^[a-zA-Z_][\w]*$/ };
  }

  if (insideTable) {
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length >= 1 && trimmed.endsWith(' ') && tokens.length === 1) {
      return { from: context.pos, options: TYPE_COMPLETIONS, validFor: /^[a-zA-Z_][\w]*$/ };
    }
    if (tokens.length === 2 && !trimmed.endsWith(' ')) {
      return { from, options: TYPE_COMPLETIONS, validFor: /^[a-zA-Z_][\w]*$/ };
    }
    return null;
  }

  return { from, options: KEYWORD_COMPLETIONS, validFor: /^[a-zA-Z_][\w]*$/ };
}

export const dbmlAutocomplete = autocompletion({
  override: [dbmlCompletions],
  icons: true,
});
