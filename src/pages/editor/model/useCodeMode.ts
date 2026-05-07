import { useState, useRef, useCallback, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import type { Table, Relation, Domain, EnumType } from './types';
import type { ParseError } from '../lib/dsl/parser';

import { serializeToDSL } from '../lib/dsl/serializer';
import { parseDSL } from '../lib/dsl/parser';
import { serializeToDBML } from '../lib/dbml/serializer';
import { parseDBML } from '../lib/dbml/parser';
import { serializeToMermaidER } from '../lib/mermaid-er/serializer';
import { parseMermaidER } from '../lib/mermaid-er/parser';
import { serializeToDDL } from '../lib/ddl/serializer';
import { parseDDL } from '../lib/ddl/parser';

export type TabId = 'dsl' | 'dbml' | 'mermaid' | 'ddl';

interface UseCodeModeOptions {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
  importFromFormat: (format: string, content: string) => void;
  pushHistory?: () => void;
}

interface SyncPreview {
  parsedTables: number;
  parsedRelations: number;
  parsedDomains: number;
  parsedEnums: number;
  errorCount: number;
}

interface SyncResult {
  applied: boolean;
  hasErrors: boolean;
  preview: SyncPreview;
}

export function useCodeMode({
  tables,
  relations,
  domains,
  enums,
  leftCollapsed,
  setLeftCollapsed,
  rightCollapsed,
  setRightCollapsed,
  importFromFormat,
  pushHistory,
}: UseCodeModeOptions) {
  const [codeMode, setCodeMode] = useState(false);
  const [codeModeAnimating, setCodeModeAnimating] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [codeErrors, setCodeErrors] = useState<ParseError[]>([]);
  const [activeCodeTab, setActiveCodeTab] = useState<TabId>('dsl');

  const codeSyncDirection = useRef<'from-canvas' | 'from-code' | null>(null);
  const codeParseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preCodeModeState = useRef<{ left: boolean; right: boolean } | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const animatingRef = useRef(false);

  const SLIDE_MS = 280;

  // ── Serialize/parse helpers ──
  const serializeForTab = useCallback((tab: TabId, t: Table[], r: Relation[], d: Domain[], e: EnumType[]) => {
    switch (tab) {
      case 'dbml': return serializeToDBML(t, r, d, e);
      case 'mermaid': return serializeToMermaidER(t, r, d, e);
      case 'ddl': return serializeToDDL(t, r, d, e);
      default: return serializeToDSL(t, r, d, e);
    }
  }, []);

  const parseForTab = useCallback((tab: TabId, code: string) => {
    switch (tab) {
      case 'dbml': return parseDBML(code);
      case 'mermaid': return parseMermaidER(code);
      case 'ddl': return parseDDL(code);
      default: return parseDSL(code);
    }
  }, []);

  // ── Toggle code mode ──
  // Phase 1: collapse both panels (slide out)
  // Phase 2: swap mode + theme (instant, panels are hidden)
  // Phase 3: expand panels (slide in with new content)
  const toggleCodeMode = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setCodeModeAnimating(true);

    if (!codeMode) {
      // Entering code mode
      preCodeModeState.current = { left: leftCollapsed, right: rightCollapsed };
      codeSyncDirection.current = 'from-canvas';
      const dsl = serializeForTab(activeCodeTab, tables, relations, domains, enums);
      setCodeValue(dsl);
      setCodeErrors([]);

      // Phase 1: collapse panels
      setLeftCollapsed(true);
      setRightCollapsed(true);

      setTimeout(() => {
        // Phase 2: swap content (panels are offscreen)
        setCodeMode(true);

        // Phase 3: expand panels after a frame so new content renders
        requestAnimationFrame(() => {
          setLeftCollapsed(false);
          setRightCollapsed(preCodeModeState.current?.right ?? false);

          setTimeout(() => {
            setCodeModeAnimating(false);
            animatingRef.current = false;
          }, SLIDE_MS);
        });
      }, SLIDE_MS);
    } else {
      // Leaving code mode
      // Phase 1: collapse panels
      setLeftCollapsed(true);
      setRightCollapsed(true);

      setTimeout(() => {
        // Phase 2: swap content
        setCodeMode(false);

        // Phase 3: restore panels
        requestAnimationFrame(() => {
          if (preCodeModeState.current) {
            setLeftCollapsed(preCodeModeState.current.left);
            setRightCollapsed(preCodeModeState.current.right);
            preCodeModeState.current = null;
          } else {
            setLeftCollapsed(false);
            setRightCollapsed(false);
          }

          setTimeout(() => {
            setCodeModeAnimating(false);
            animatingRef.current = false;
          }, SLIDE_MS);
        });
      }, SLIDE_MS);
    }
  }, [codeMode, leftCollapsed, rightCollapsed, tables, relations, domains, enums, activeCodeTab, serializeForTab, setLeftCollapsed, setRightCollapsed]);

  // ── Canvas → Code sync ──
  useEffect(() => {
    if (!codeMode) return;
    if (codeSyncDirection.current === 'from-code') {
      codeSyncDirection.current = null;
      return;
    }
    codeSyncDirection.current = 'from-canvas';
    const dsl = serializeForTab(activeCodeTab, tables, relations, domains, enums);
    setCodeValue(dsl);
  }, [tables, relations, domains, enums, codeMode, activeCodeTab, serializeForTab]);

  // ── Code → Canvas sync ──
  const applyCodeToCanvas = useCallback((rawCode: string, options?: { allowPartial?: boolean }): SyncResult => {
    const allowPartial = options?.allowPartial ?? false;
    const result = parseForTab(activeCodeTab, rawCode);
    setCodeErrors(result.errors);
    const preview: SyncPreview = {
      parsedTables: result.tables.length,
      parsedRelations: result.relations.length,
      parsedDomains: result.domains.length,
      parsedEnums: result.enums.length,
      errorCount: result.errors.length,
    };

    if (result.errors.length > 0 && !allowPartial) {
      return { applied: false, hasErrors: true, preview };
    }

    if (result.tables.length === 0) {
      return { applied: false, hasErrors: result.errors.length > 0, preview };
    }

    codeSyncDirection.current = 'from-code';

    // Preserve existing positions & IDs
    const positionMap = new Map<string, { x: number; y: number }>();
    const idMap = new Map<string, string>();
    const domainIdMap = new Map<string, string>();
    for (const t of tables) {
      positionMap.set(t.name.toLowerCase(), { ...t.position });
      idMap.set(t.name.toLowerCase(), t.id);
      if (t.domainId) domainIdMap.set(t.name.toLowerCase(), t.domainId);
    }
    const existingDomainIdMap = new Map<string, string>();
    for (const d of domains) {
      existingDomainIdMap.set(d.name.toLowerCase(), d.id);
    }
    const existingEnumIdMap = new Map<string, string>();
    for (const enumType of enums) {
      existingEnumIdMap.set(enumType.name.toLowerCase(), enumType.id);
    }

    const patchedTables = result.tables.map(t => {
      const key = t.name.toLowerCase();
      return {
        ...t,
        id: idMap.get(key) || t.id,
        position: positionMap.get(key) || t.position,
      };
    });

    const patchedDomains = result.domains.map(d => {
      const existingDomId = existingDomainIdMap.get(d.name.toLowerCase());
      return { ...d, id: existingDomId || d.id };
    });
    const patchedEnums = result.enums.map(enumType => {
      const existingEnumId = existingEnumIdMap.get(enumType.name.toLowerCase());
      return { ...enumType, id: existingEnumId || enumType.id };
    });
    const enumIdByOldId = new Map<string, string>();
    for (let i = 0; i < result.enums.length; i++) {
      enumIdByOldId.set(result.enums[i].id, patchedEnums[i].id);
    }

    const newIdByOldId = new Map<string, string>();
    for (let i = 0; i < result.tables.length; i++) {
      newIdByOldId.set(result.tables[i].id, patchedTables[i].id);
    }

    const patchedRelations = result.relations.map(r => ({
      ...r,
      fromTableId: newIdByOldId.get(r.fromTableId) || r.fromTableId,
      toTableId: newIdByOldId.get(r.toTableId) || r.toTableId,
    }));

    for (const pt of patchedTables) {
      if (pt.domainId) {
        const origDomain = result.domains.find(d => d.id === pt.domainId);
        if (origDomain) {
          const patchedDomain = patchedDomains.find(pd => pd.name.toLowerCase() === origDomain.name.toLowerCase());
          if (patchedDomain) pt.domainId = patchedDomain.id;
        }
      }
      for (const field of pt.fields) {
        if (field.type === 'enum' && field.enumId) {
          const nextEnumId = enumIdByOldId.get(field.enumId);
          if (nextEnumId) field.enumId = nextEnumId;
          const enumType = patchedEnums.find(e => e.id === field.enumId);
          field.enumName = enumType?.name || field.enumName;
        }
      }
    }

    try {
      const schemaJson = JSON.stringify({ tables: patchedTables, relations: patchedRelations, domains: patchedDomains, enums: patchedEnums });
      importFromFormat('json', schemaJson);
      return { applied: true, hasErrors: result.errors.length > 0, preview };
    } catch {
      return { applied: false, hasErrors: result.errors.length > 0, preview };
    }
  }, [activeCodeTab, domains, enums, importFromFormat, parseForTab, tables]);

  const handleCodeChange = useCallback((newValue: string) => {
    setCodeValue(newValue);
    if (codeParseTimerRef.current) clearTimeout(codeParseTimerRef.current);
    codeParseTimerRef.current = setTimeout(() => {
      applyCodeToCanvas(newValue);
    }, 500);
  }, [applyCodeToCanvas]);

  const handleCodeSync = useCallback(() => {
    const syncResult = applyCodeToCanvas(codeValue);
    if (syncResult.applied) {
      pushHistory?.();
      toast.success('Canvas synced from code');
      return;
    }
    if (syncResult.hasErrors) {
      const p = syncResult.preview;
      toast.warning(
        `Sync preview: ${p.parsedTables} tables, ${p.parsedRelations} relations, ${p.parsedEnums} enums, ${p.parsedDomains} domains parsed; ${p.errorCount} syntax errors found.`,
        {
          duration: 9000,
          action: {
            label: 'Apply valid only',
            onClick: () => {
              const partialResult = applyCodeToCanvas(codeValue, { allowPartial: true });
              if (partialResult.applied) {
                pushHistory?.();
                toast.success('Applied valid fragments; invalid fragments were skipped');
              } else {
                toast.error('Cannot apply valid fragments: no valid tables were parsed');
              }
            },
          },
          cancel: {
            label: 'Cancel',
            onClick: () => {},
          },
        },
      );
      return;
    }
    toast.error('Cannot sync: no tables were parsed from current code');
  }, [applyCodeToCanvas, codeValue, pushHistory]);

  // ── Scroll code editor to a table ──
  const scrollToTable = useCallback((tableName: string, fieldName?: string) => {
    const view = editorViewRef.current;
    if (!view) return;
    const doc = view.state.doc.toString();
    const lines = doc.split('\n');
    let targetLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      let found = false;

      if (fieldName) {
        if (line.toLowerCase().includes(fieldName.toLowerCase()) && !line.toLowerCase().startsWith('table') && !line.toLowerCase().startsWith('create')) {
          found = true;
        }
      } else {
        if (activeCodeTab === 'dsl') {
          found = /^table\s+/i.test(line) && line.toLowerCase().includes(tableName.toLowerCase());
        } else if (activeCodeTab === 'dbml') {
          found = /^table\s+/i.test(line) && (line.toLowerCase().includes(tableName.toLowerCase()) || line.includes(`"${tableName}"`));
        } else if (activeCodeTab === 'mermaid') {
          found = line.toLowerCase().startsWith(tableName.toLowerCase()) && line.includes('{');
        } else if (activeCodeTab === 'ddl') {
          found = /^CREATE\s+TABLE\s+/i.test(line) && line.toLowerCase().includes(tableName.toLowerCase());
        }
      }
      if (found) { targetLine = i; break; }
    }

    if (targetLine < 0) return;
    const lineInfo = view.state.doc.line(targetLine + 1);
    view.dispatch({
      selection: { anchor: lineInfo.from, head: lineInfo.to },
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
    });
    view.focus();
  }, [activeCodeTab]);

  /** Double-click on table → scroll code editor */
  const handleTableDoubleClick = useCallback((tableId: string) => {
    if (!codeMode) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    scrollToTable(table.name);
  }, [codeMode, tables, scrollToTable]);

  /** Open table in code editor (enter code mode if needed) */
  const handleOpenInCodeEditor = useCallback((tableId: string, fieldId?: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (!codeMode) {
      preCodeModeState.current = { left: leftCollapsed, right: rightCollapsed };
      codeSyncDirection.current = 'from-canvas';
      const dsl = serializeForTab(activeCodeTab, tables, relations, domains, enums);
      setCodeValue(dsl);
      setCodeErrors([]);

      // Phase 1: collapse panels
      setLeftCollapsed(true);
      setRightCollapsed(true);

      const fieldName = fieldId ? table.fields.find(f => f.id === fieldId)?.name : undefined;

      setTimeout(() => {
        // Phase 2: swap content
        setCodeMode(true);

        requestAnimationFrame(() => {
          setLeftCollapsed(false);
          setRightCollapsed(preCodeModeState.current?.right ?? false);

          setTimeout(() => {
            setCodeModeAnimating(false);
            animatingRef.current = false;
            // Scroll after animation completes
            setTimeout(() => scrollToTable(table.name, fieldName), 50);
          }, SLIDE_MS);
        });
      }, SLIDE_MS);
    } else {
      scrollToTable(table.name, fieldId ? table.fields.find(f => f.id === fieldId)?.name : undefined);
    }
  }, [codeMode, tables, relations, domains, enums, leftCollapsed, rightCollapsed, activeCodeTab, serializeForTab, scrollToTable, setLeftCollapsed, setRightCollapsed, SLIDE_MS]);

  return {
    codeMode,
    codeModeAnimating,
    codeValue,
    codeErrors,
    activeCodeTab,
    setActiveCodeTab,
    editorViewRef,
    toggleCodeMode,
    handleCodeChange,
    handleCodeSync,
    handleTableDoubleClick,
    handleOpenInCodeEditor,
  };
}
