/**
 * CodeMirror 6 language support for Mermaid ER diagrams.
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
  context: 'top' | 'entity';
};

const KEYWORDS_SET = new Set(['erdiagram']);
const CONSTRAINTS = new Set(['pk', 'fk', 'uk']);
const TYPES_SET = new Set([
  ...ALL_FIELD_TYPES.map(t => t.replace(/\s+/g, '_')),
  ...ALL_FIELD_TYPES,
  'int', 'int2', 'int4', 'int8', 'float', 'float4', 'float8',
  'double', 'double_precision', 'bool', 'ts', 'tstz', 'char', 'string', 'str',
]);

export const mermaidERStreamParser = StreamLanguage.define<State>({
  startState(): State {
    return { context: 'top' };
  },

  token(stream, state): string | null {
    if (stream.eatSpace()) return null;

    // Comments (%%)
    if (stream.match('%%')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // Braces
    if (stream.eat('{')) {
      state.context = 'entity';
      return 'brace';
    }
    if (stream.eat('}')) {
      state.context = 'top';
      return 'brace';
    }

    // Colon
    if (stream.eat(':')) return 'punctuation';

    // String in quotes (relation labels)
    if (stream.eat('"')) {
      while (!stream.eol()) {
        if (stream.eat('"')) break;
        stream.next();
      }
      return 'string';
    }

    // Relation symbols: ||--o{ }o--|| etc.
    if (stream.match(/[|}{][\w|{}-]*[|}{]/)) {
      return 'operator';
    }
    // Partial relation symbols
    if (stream.match(/\|\|/) || stream.match(/o\{/) || stream.match(/\}o/)) {
      return 'operator';
    }

    // Read word
    const wordMatch = stream.match(/[a-zA-Z_][\w]*/);
    if (wordMatch) {
      const word = typeof wordMatch === 'string' ? wordMatch : (wordMatch as RegExpMatchArray)[0];
      const lower = word.toLowerCase();

      if (KEYWORDS_SET.has(lower)) return 'keyword';

      if (state.context === 'entity') {
        if (CONSTRAINTS.has(lower)) return 'modifier';
        if (TYPES_SET.has(lower)) return 'typeName';
        // After type comes field name
        return 'propertyName';
      }

      // Top level — entity names or relation parts
      return 'typeName';
    }

    // Numbers
    if (stream.match(/\d+/)) return 'number';

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '%%' },
  },
});

// ─── Dark highlight style ───

export const mermaidERDarkHighlightStyle = HighlightStyle.define([
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
  { tag: t.punctuation, color: '#abb2bf' },
]);

export const mermaidERDarkHighlighting = syntaxHighlighting(mermaidERDarkHighlightStyle);

// ─── Autocomplete ───

const TYPE_COMPLETIONS: Completion[] = ALL_FIELD_TYPES.map((ft: FieldType) => ({
  label: ft.replace(/\s+/g, '_'),
  type: 'type',
  detail: `PostgreSQL ${ft}`,
  boost: ft === 'uuid' || ft === 'integer' || ft === 'varchar' || ft === 'text' || ft === 'boolean' ? 2 : 0,
}));

const CONSTRAINT_COMPLETIONS: Completion[] = [
  { label: 'PK', type: 'keyword', detail: 'Primary Key', boost: 2 },
  { label: 'FK', type: 'keyword', detail: 'Foreign Key' },
  { label: 'UK', type: 'keyword', detail: 'Unique Key' },
];

const KEYWORD_COMPLETIONS: Completion[] = [
  { label: 'erDiagram', type: 'keyword', detail: 'Mermaid ER diagram', boost: 2 },
];

function mermaidERCompletions(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const trimmed = textBefore.trimStart();

  let insideEntity = false;
  for (let i = line.number - 1; i >= 1; i--) {
    const prevLine = context.state.doc.line(i).text.trim();
    if (prevLine === '}') break;
    if (/^\w+\s*\{/.test(prevLine)) { insideEntity = true; break; }
  }

  const wordMatch = context.matchBefore(/[a-zA-Z_][\w]*/);
  if (!wordMatch && !context.explicit) return null;
  const from = wordMatch ? wordMatch.from : context.pos;

  if (insideEntity) {
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    // First token = type, second = field name
    if (tokens.length === 0 || (tokens.length === 1 && !trimmed.endsWith(' '))) {
      return { from, options: TYPE_COMPLETIONS, validFor: /^[a-zA-Z_][\w]*$/ };
    }
    if (tokens.length >= 2) {
      return { from, options: CONSTRAINT_COMPLETIONS, validFor: /^[a-zA-Z_][\w]*$/ };
    }
    return null;
  }

  // Top level
  return { from, options: KEYWORD_COMPLETIONS, validFor: /^[a-zA-Z_][\w]*$/ };
}

export const mermaidERAutocomplete = autocompletion({
  override: [mermaidERCompletions],
  icons: true,
});