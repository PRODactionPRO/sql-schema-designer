import { useState, useRef, useCallback, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import type { Table, Relation, Domain } from './types';
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
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
  importFromFormat: (format: string, content: string) => void;
}

export function useCodeMode({
  tables,
  relations,
  domains,
  leftCollapsed,
  setLeftCollapsed,
  rightCollapsed,
  setRightCollapsed,
  importFromFormat,
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
  const serializeForTab = useCallback((tab: TabId, t: Table[], r: Relation[], d: Domain[]) => {
    switch (tab) {
      case 'dbml': return serializeToDBML(t, r, d);
      case 'mermaid': return serializeToMermaidER(t, r, d);
      case 'ddl': return serializeToDDL(t, r, d);
      default: return serializeToDSL(t, r, d);
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
      const dsl = serializeForTab(activeCodeTab, tables, relations, domains);
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
  }, [codeMode, leftCollapsed, rightCollapsed, tables, relations, domains, activeCodeTab, serializeForTab, setLeftCollapsed, setRightCollapsed]);

  // ── Canvas → Code sync ──
  useEffect(() => {
    if (!codeMode) return;
    if (codeSyncDirection.current === 'from-code') {
      codeSyncDirection.current = null;
      return;
    }
    codeSyncDirection.current = 'from-canvas';
    const dsl = serializeForTab(activeCodeTab, tables, relations, domains);
    setCodeValue(dsl);
  }, [tables, relations, domains, codeMode, activeCodeTab, serializeForTab]);

  // ── Code → Canvas sync ──
  const handleCodeChange = useCallback((newValue: string) => {
    setCodeValue(newValue);
    if (codeParseTimerRef.current) clearTimeout(codeParseTimerRef.current);
    codeParseTimerRef.current = setTimeout(() => {
      const result = parseForTab(activeCodeTab, newValue);
      setCodeErrors(result.errors);
      if (result.errors.length === 0 && result.tables.length > 0) {
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
        }

        try {
          const schemaJson = JSON.stringify({ tables: patchedTables, relations: patchedRelations, domains: patchedDomains });
          importFromFormat('json', schemaJson);
        } catch {
          // Ignore import errors
        }
      }
    }, 500);
  }, [importFromFormat, tables, domains, activeCodeTab, parseForTab]);

  const handleCodeSync = useCallback(() => {
    codeSyncDirection.current = 'from-canvas';
    const dsl = serializeForTab(activeCodeTab, tables, relations, domains);
    setCodeValue(dsl);
    setCodeErrors([]);
    toast.success('Code synced from canvas');
  }, [tables, relations, domains, activeCodeTab, serializeForTab]);

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
      const dsl = serializeForTab(activeCodeTab, tables, relations, domains);
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
  }, [codeMode, tables, relations, domains, leftCollapsed, rightCollapsed, activeCodeTab, serializeForTab, scrollToTable, setLeftCollapsed, setRightCollapsed, SLIDE_MS]);

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