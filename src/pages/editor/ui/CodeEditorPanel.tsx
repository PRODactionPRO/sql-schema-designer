import { useRef, useEffect, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput, foldKeymap, foldService } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { linter, type Diagnostic } from '@codemirror/lint';
import { dslStreamParser, dslDarkHighlighting, dslAutocomplete } from '../lib/dsl/codemirror-lang';
import { dbmlStreamParser, dbmlDarkHighlighting, dbmlAutocomplete } from '../lib/dbml/codemirror-lang';
import { mermaidERStreamParser, mermaidERDarkHighlighting, mermaidERAutocomplete } from '../lib/mermaid-er/codemirror-lang';
import { ddlStreamParser, ddlDarkHighlighting, ddlAutocomplete } from '../lib/ddl/codemirror-lang';
import { parseDSL } from '../lib/dsl/parser';
import { parseDBML } from '../lib/dbml/parser';
import { parseMermaidER } from '../lib/mermaid-er/parser';
import { parseDDL } from '../lib/ddl/parser';
import { Code, FileCode, GitBranch, Database, AlertTriangle, CheckCircle, PanelLeftClose } from 'lucide-react';
import { ProTooltip } from '@/shared/ui/pro-tooltip';

export type TabId = 'dsl' | 'dbml' | 'mermaid' | 'ddl';

interface CodeEditorPanelProps {
  value: string;
  onChange: (value: string) => void;
  errors: { line: number; message: string }[];
  onSync: () => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  editorViewRef?: React.MutableRefObject<EditorView | null>;
  onClose?: () => void;
}

interface TabInfo {
  id: TabId;
  label: string;
  icon: typeof Code;
  available: boolean;
}

const TABS: TabInfo[] = [
  { id: 'dsl', label: 'DSL', icon: Code, available: true },
  { id: 'dbml', label: 'DBML', icon: FileCode, available: true },
  { id: 'ddl', label: 'DDL', icon: Database, available: true },
  { id: 'mermaid', label: 'Mermaid ER', icon: GitBranch, available: true },
];

const TAB_LABELS: Record<TabId, string> = {
  dsl: 'DSL v1.0',
  dbml: 'DBML',
  mermaid: 'Mermaid ER',
  ddl: 'PostgreSQL DDL',
};

// ─── Dark theme for the editor chrome ───
const darkEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '13px',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#f5e0dc',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#f5e0dc',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#47B5FF59 !important',
  },
  '.cm-line.cm-activeLine .cm-selectionBackground': {
    backgroundColor: '#47B5FF70 !important',
  },
  '.cm-activeLine': {
    backgroundColor: '#31324480',
  },
  '.cm-gutters': {
    backgroundColor: '#181825',
    color: '#6c7086',
    border: 'none',
    borderRight: '1px solid #313244',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#313244',
    color: '#cdd6f4',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 8px',
    minWidth: '40px',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '12px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    color: '#6c7086',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: '#cdd6f4',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: '#313244',
    color: '#89b4fa',
    border: '1px solid #45475a',
    borderRadius: '4px',
    padding: '0 6px',
    margin: '0 4px',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
    cursor: 'pointer',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#585b70',
    outline: '1px solid #a6adc8',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#47B5FF30',
    outline: '1px solid #47B5FF50',
  },
  '.cm-tooltip': {
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    border: '1px solid #45475a',
  },
  '.cm-panels': {
    backgroundColor: '#181825',
    color: '#cdd6f4',
  },
  '.cm-panel.cm-search': {
    backgroundColor: '#181825',
    '& input': {
      backgroundColor: '#313244',
      color: '#cdd6f4',
      border: '1px solid #45475a',
    },
    '& button': {
      color: '#cdd6f4',
    },
  },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarColor: '#45475a transparent',
    scrollbarWidth: 'thin',
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    background: '#45475a',
    borderRadius: '4px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    background: '#585b70',
  },
  // Lint diagnostics
  '.cm-diagnostic-error': {
    borderLeft: '3px solid #f38ba8',
    backgroundColor: '#f38ba820',
    color: '#cdd6f4',
  },
  '.cm-diagnostic-warning': {
    borderLeft: '3px solid #f9e2af',
    backgroundColor: '#f9e2af20',
    color: '#cdd6f4',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #f38ba8',
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #f9e2af',
  },
  // Autocomplete tooltip
  '.cm-tooltip-autocomplete': {
    backgroundColor: '#1e1e2e !important',
    border: '1px solid #45475a !important',
    borderRadius: '8px !important',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5) !important',
    overflow: 'hidden',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '12px',
  },
  '.cm-tooltip-autocomplete > ul': {
    maxHeight: '220px',
    fontFamily: '"JetBrains Mono", monospace',
    scrollbarColor: '#45475a transparent',
    scrollbarWidth: 'thin',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar': {
    width: '6px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb': {
    background: '#45475a',
    borderRadius: '3px',
  },
  '.cm-tooltip-autocomplete > ul::-webkit-scrollbar-thumb:hover': {
    background: '#585b70',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 10px !important',
    color: '#cdd6f4',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '0',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: '#45475a !important',
    color: '#cdd6f4 !important',
  },
  '.cm-tooltip-autocomplete .cm-completionLabel': {
    color: '#89b4fa',
  },
  '.cm-tooltip-autocomplete .cm-completionDetail': {
    color: '#6c7086',
    fontStyle: 'italic',
    marginLeft: 'auto',
    paddingLeft: '12px',
  },
  '.cm-tooltip-autocomplete .cm-completionIcon': {
    fontSize: '13px',
    opacity: 0.9,
    width: '20px',
    textAlign: 'center' as const,
  },
  '.cm-tooltip-autocomplete .cm-completionIcon-type::after': {
    content: '"T"',
    color: '#61afef',
  },
  '.cm-tooltip-autocomplete .cm-completionIcon-keyword::after': {
    content: '"K"',
    color: '#c678dd',
  },
  // Autocomplete info tooltip
  '.cm-completionInfo': {
    backgroundColor: '#181825 !important',
    color: '#a6adc8',
    border: '1px solid #45475a !important',
    borderRadius: '6px !important',
    padding: '6px 10px !important',
    fontSize: '11px',
    fontFamily: '"JetBrains Mono", monospace',
  },
}, { dark: true });

// Fold service: fold blocks from { to matching } or ( to matching )
const blockFoldService = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);
  const text = line.text.trimEnd();

  // Support both { } and ( ) folding
  const lastChar = text[text.length - 1];
  let openChar: string;
  let closeChar: string;
  if (lastChar === '{') {
    openChar = '{'; closeChar = '}';
  } else if (lastChar === '(') {
    openChar = '('; closeChar = ')';
  } else {
    return null;
  }

  let depth = 1;
  for (let i = line.number + 1; i <= state.doc.lines; i++) {
    const nextLine = state.doc.line(i);
    const trimmed = nextLine.text.trim();
    for (const ch of trimmed) {
      if (ch === openChar) depth++;
      if (ch === closeChar) depth--;
      if (depth === 0) {
        const foldFrom = line.to;
        const foldTo = nextLine.from - 1;
        // Only fold if there's actual content between braces
        if (foldTo > foldFrom) {
          return { from: foldFrom, to: foldTo };
        }
        return null;
      }
    }
  }
  return null;
});

// ─── Language-specific linters ───
function createLinter(tab: TabId) {
  return linter((view) => {
    const doc = view.state.doc.toString();
    let parseErrors: { line: number; message: string }[] = [];

    if (tab === 'dsl') {
      parseErrors = parseDSL(doc).errors;
    } else if (tab === 'dbml') {
      parseErrors = parseDBML(doc).errors;
    } else if (tab === 'mermaid') {
      parseErrors = parseMermaidER(doc).errors;
    } else if (tab === 'ddl') {
      parseErrors = parseDDL(doc).errors;
    }

    const diagnostics: Diagnostic[] = [];
    for (const err of parseErrors) {
      const lineNum = Math.min(err.line, view.state.doc.lines);
      const lineInfo = view.state.doc.line(lineNum);
      diagnostics.push({
        from: lineInfo.from,
        to: lineInfo.to,
        severity: 'error',
        message: err.message,
      });
    }
    return diagnostics;
  }, { delay: 500 });
}

// ─── Language extensions per tab ───
function getLanguageExtensions(tab: TabId): Extension[] {
  switch (tab) {
    case 'dsl':
      return [dslStreamParser, dslDarkHighlighting, dslAutocomplete];
    case 'dbml':
      return [dbmlStreamParser, dbmlDarkHighlighting, dbmlAutocomplete];
    case 'mermaid':
      return [mermaidERStreamParser, mermaidERDarkHighlighting, mermaidERAutocomplete];
    case 'ddl':
      return [ddlStreamParser, ddlDarkHighlighting, ddlAutocomplete];
  }
}

export function CodeEditorPanel({ value, onChange, errors, onSync, activeTab, onTabChange, editorViewRef, onClose }: CodeEditorPanelProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track if we're doing a programmatic update to avoid re-triggering onChange
  const isExternalUpdate = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const createExtensions = useCallback((tab: TabId) => {
    return [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      foldGutter({
        openText: '\u25BC',
        closedText: '\u25B6',
      }),
      blockFoldService,
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      history(),
      ...getLanguageExtensions(tab),
      darkEditorTheme,
      createLinter(tab),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...closeBracketsKeymap,
        ...completionKeymap,
        ...foldKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !isExternalUpdate.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
    ];
  }, []);

  // Initialize / recreate editor when tab changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Destroy previous
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: value,
      extensions: createExtensions(activeTab),
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Expose EditorView to parent
    if (editorViewRef) {
      editorViewRef.current = view;
    }

    return () => {
      view.destroy();
      viewRef.current = null;
      if (editorViewRef) {
        editorViewRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Update editor content from outside (bidirectional sync)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      isExternalUpdate.current = true;
      const cursorPos = Math.min(view.state.selection.main.head, value.length);
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
        selection: { anchor: cursorPos },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  const errorCount = errors.length;

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] text-[#cdd6f4]">
      {/* Tabs header */}
      <div className="flex items-center border-b border-[#313244] px-2 pt-2 gap-1 flex-shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => tab.available && onTabChange(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-lg transition-colors ${
                isActive
                  ? 'bg-[#313244] text-[#cdd6f4]'
                  : tab.available
                    ? 'text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#181825]'
                    : 'text-[#45475a] cursor-not-allowed'
              }`}
              disabled={!tab.available}
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              <Icon className="size-3" />
              {tab.label}
            </button>
          );
        })}
        {onClose && (
          <ProTooltip label="Collapse panel" shortcut="F">
            <button
              onClick={onClose}
              className="ml-auto relative flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-t-lg transition-colors text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#181825]"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </ProTooltip>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div ref={editorRef} className="h-full" />
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-t border-[#313244] text-[10px] flex-shrink-0"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
      >
        <div className="flex items-center gap-3">
          {errorCount > 0 ? (
            <span className="flex items-center gap-1 text-[#f38ba8]">
              <AlertTriangle className="size-3" />
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#a6e3a1]">
              <CheckCircle className="size-3" />
              No errors
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[#6c7086]">
          <span>{TAB_LABELS[activeTab]}</span>
          <button
            onClick={onSync}
            className="text-[#89b4fa] hover:text-[#b4befe] transition-colors"
          >
            Sync
          </button>
        </div>
      </div>
    </div>
  );
}
