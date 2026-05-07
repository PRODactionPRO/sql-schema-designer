import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useSchemaStore } from '../model/useSchemaStore';
import type { SchemaStoreInitialData } from '../model/useSchemaStore';
import type { ProjectSettings } from '../model/types';
import { DEFAULT_PROJECT_SETTINGS, getTypeCompatibility } from '../model/types';
import type { ProjectData } from '@/shared/types/project';
import { getProjectById, updateProject } from '@/shared/api/projects';
import { createProjectRevision, deleteProjectRevision, getProjectRevisions, restoreProjectRevision, type ProjectRevision } from '@/shared/api/revisions';
import { normalizeSchema } from '@/shared/lib/schema-normalizer';
import { useEditorStoreSelectors } from '../model/useEditorStoreSelectors';
import { useRequireAuth } from '@/shared/auth/guard';

// ── Extracted hooks ──
import { useEditorKeyboardShortcuts } from '../model/useEditorKeyboardShortcuts';
import { useAutoSave } from '../model/useAutoSave';
import { useSnapshotCapture } from '../model/useSnapshotCapture';
import { useCodeMode } from '../model/useCodeMode';

// ── UI components ──
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { Canvas } from './Canvas';
import { TableDetailsPanel } from './TableDetailsPanel';
import { CanvasToolbar } from './CanvasToolbar';
import { ExportModal } from './ExportModal';
import { ImportModal } from './ImportModal';
import { SettingsModal } from './SettingsModal';
import { RelationToolbar } from './RelationToolbar';
import { CodeEditorPanel } from './CodeEditorPanel';
import { SnapshotOverlay } from './SnapshotOverlay';
import { ValidationModal } from './ValidationModal';
import { DiffModal } from './DiffModal';
import { downloadFile } from '@/shared/lib/download';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { AlertTriangle, Code, PanelLeft } from 'lucide-react';
import type { FieldType } from '../model/types';

const ENUM_TABLE_PREFIX = 'enum::';
const ENUM_HEADER_FIELD_ID = '__enum_header__';

function isEnumTableId(id: string): boolean {
  return id.startsWith(ENUM_TABLE_PREFIX);
}

function getEnumIdFromTableId(id: string): string {
  return id.slice(ENUM_TABLE_PREFIX.length);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function EditorPage() {
  const { isAuthenticated } = useRequireAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return getProjectById(projectId);
    },
    enabled: Boolean(projectId) && isAuthenticated,
  });

  const projectData = (projectQuery.data as ProjectData | null | undefined) ?? null;

  useEffect(() => {
    if (projectQuery.isError) {
      toast.error('Project not found');
      navigate('/');
    }
  }, [navigate, projectQuery.isError]);

  if (!isAuthenticated || projectQuery.isLoading) {
    return (
      <div className="size-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  const initialData: SchemaStoreInitialData | undefined = projectData
    ? { tables: projectData.schema.tables, relations: projectData.schema.relations, domains: projectData.schema.domains, enums: projectData.schema.enums ?? [] }
    : undefined;

  const initialSettings = projectData?.settings ?? DEFAULT_PROJECT_SETTINGS;

  return (
    <EditorPageInner
      key={projectId || '__standalone__'}
      projectId={projectId || null}
      projectData={projectData}
      initialData={initialData}
      initialSettings={initialSettings}
    />
  );
}

// ── EditorPageInner ──

interface EditorPageInnerProps {
  projectId: string | null;
  projectData: ProjectData | null;
  initialData?: SchemaStoreInitialData;
  initialSettings: ProjectSettings;
}

function EditorPageInner({ projectId, projectData, initialData, initialSettings }: EditorPageInnerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateProjectMutation = useMutation({
    mutationFn: async (project: ProjectData) => updateProject(project),
    onSuccess: async (updated) => {
      await queryClient.setQueryData(['project', updated.id], updated);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Initialize store synchronously
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    useSchemaStore.getState().initialize(initialData);
  }

  // ── Store selectors ──
  const {
    tables,
    relations,
    domains,
    enums,
    selectedTableId,
    selectedTableIds,
    selectedRelation,
    setSelectedTableId,
    setSelectedRelation,
    setSelectedTableIds,
    addTable,
    updateTablePosition,
    updateTableName,
    updateTableDescription,
    updateTableDomain,
    deleteTable,
    deleteTables,
    addField,
    updateField,
    deleteField,
    reorderField,
    addRelation,
    updateRelation,
    deleteRelation,
    addDomain,
    updateDomain,
    deleteDomain,
    toggleTableSelection,
    selectTablesInRect,
    clearMultiSelection,
    moveSelectedTables,
    autoLayout,
    exportToFormat,
    importFromFormat,
    exportSelectionForClipboard,
    importSelectionFromClipboard,
    getTableColor,
    assignDomainToTables,
    addEnum,
    updateEnum,
    deleteEnum,
    updateEnumPosition,
    reorderEnumValues,
    reorderTables,
    undo,
    redo,
    pushHistory,
    pastLength,
    futureLength,
  } = useEditorStoreSelectors();

  const enumCanvasTables = enums.map((enumType, index) => ({
    id: `${ENUM_TABLE_PREFIX}${enumType.id}`,
    name: enumType.name,
    description: enumType.description,
    fields: enumType.values.map((value, valueIndex) => ({
      id: `${enumType.id}::value::${valueIndex}`,
      name: value,
      comment: enumType.valueComments?.[valueIndex],
      type: 'enum' as FieldType,
      enumId: enumType.id,
      enumName: enumType.name,
      isPrimaryKey: false,
      isNullable: false,
      isForeignKey: false,
    })),
    position: enumType.position ?? { x: 260 + index * 40, y: 140 + index * 40 },
    color: enumType.domainId
      ? (domains.find((d) => d.id === enumType.domainId)?.color || '#0f766e')
      : '#0f766e',
    domainId: enumType.domainId,
  }));

  const enumCanvasRelations = tables.flatMap((table) => (
    table.fields
      .filter((field) => field.type === 'enum' && field.enumId)
      .map((field) => ({
        id: `enumrel::${table.id}::${field.id}::${field.enumId}`,
        fromTableId: table.id,
        fromFieldId: field.id,
        toTableId: `${ENUM_TABLE_PREFIX}${field.enumId}`,
        toFieldId: ENUM_HEADER_FIELD_ID,
        type: '1:N' as const,
      }))
  ));

  const canvasTables = [...tables, ...enumCanvasTables];
  const canvasRelations = [...relations, ...enumCanvasRelations];

  // ── Local UI state ──
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(288);
  const [leftCodeWidth, setLeftCodeWidth] = useState(420);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [resizingSide, setResizingSide] = useState<'left' | 'right' | null>(null);
  const [settings, setSettings] = useState<ProjectSettings>(initialSettings);
  const [projectName, setProjectName] = useState(projectData?.name || '');
  const [projectDescription, setProjectDescription] = useState(projectData?.description || '');
  const [highlightRelations, setHighlightRelations] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'properties' | 'history'>('properties');
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [isRevisionPreview, setIsRevisionPreview] = useState(false);
  const [previewRevisionNumber, setPreviewRevisionNumber] = useState<number | null>(null);
  const [fkTypeChangeDialog, setFkTypeChangeDialog] = useState<{
    tableId: string;
    fieldId: string;
    newType: FieldType;
    oldType: FieldType;
    affectedRelations: { relationId: string; fkTableId: string; fkFieldId: string; fkTableName: string; fkFieldName: string }[];
  } | null>(null);

  const canvasViewportRef = useRef<{ pan: { x: number; y: number }; zoom: number; width: number; height: number } | null>(null);
  const centerOnTableRef = useRef<((tableId: string) => void) | null>(null);
  const zoomToFitRef = useRef<(() => void) | null>(null);
  const lastAutoRevisionRef = useRef<number>(Date.now());
  const draftBeforePreviewRef = useRef<{
    tables: typeof tables;
    relations: typeof relations;
    domains: typeof domains;
    enums: typeof enums;
    settings: ProjectSettings;
  } | null>(null);

  const isMaximized = leftCollapsed && rightCollapsed;
  const handleToggleMaximize = useCallback(() => {
    if (isMaximized) { setLeftCollapsed(false); setRightCollapsed(false); }
    else { setLeftCollapsed(true); setRightCollapsed(true); }
  }, [isMaximized]);

  // ── Snapshot capture ──
  const {
    snapshotCaptureMode, isCapturing, currentSnapshot, canvasContainerRef,
    startCapture, saveSnapshot, cancelCapture,
  } = useSnapshotCapture({
    initialSnapshot: projectData?.snapshot,
    leftCollapsed,
    rightCollapsed,
    setLeftCollapsed,
    setRightCollapsed,
    onDone: () => setTimeout(() => setIsSettingsOpen(true), 200),
  });

  // ── Auto-save ──
  const { persistToStorage } = useAutoSave({
    projectId,
    projectData,
    tables,
    relations,
    domains,
    settings,
    projectName,
    projectDescription,
    enums,
    currentSnapshot,
    persistProject: async (project) => {
      await updateProjectMutation.mutateAsync(project);
    },
  });

  const revisionsQuery = useQuery({
    queryKey: ['project-revisions', projectId],
    queryFn: async () => {
      if (!projectId) return [] as ProjectRevision[];
      return getProjectRevisions(projectId);
    },
    enabled: Boolean(projectId),
  });

  // ── Code mode ──
  const {
    codeMode, codeModeAnimating, codeValue, codeErrors,
    activeCodeTab, setActiveCodeTab, editorViewRef,
    toggleCodeMode, handleCodeChange, handleCodeSync,
    handleTableDoubleClick, handleOpenInCodeEditor,
  } = useCodeMode({
    tables, relations, domains, enums, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, importFromFormat, pushHistory,
  });

  useEffect(() => {
    if (!resizingSide || snapshotCaptureMode) return;

    const handleMouseMove = (event: MouseEvent) => {
      const viewportWidth = window.innerWidth;
      if (resizingSide === 'left') {
        const width = Math.max(120, Math.min(event.clientX, viewportWidth - 120));
        if (codeMode) setLeftCodeWidth(width);
        else setLeftSidebarWidth(width);
      } else {
        const width = Math.max(120, Math.min(viewportWidth - event.clientX, viewportWidth - 120));
        setRightPanelWidth(width);
      }
    };

    const handleMouseUp = () => {
      setResizingSide(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [codeMode, resizingSide, snapshotCaptureMode]);

  const buildSchemaJson = useCallback(() => ({
    tables,
    relations,
    domains,
    enums,
    settings,
    snapshot: currentSnapshot,
  }), [tables, relations, domains, enums, settings, currentSnapshot]);

  // ── Save handler (defined before keyboard shortcuts) ──
  const handleSave = useCallback(async () => {
    if (isRevisionPreview) {
      toast.info('Exit revision preview mode first');
      return;
    }
    if (projectId) {
      await persistToStorage();
      await createProjectRevision(projectId, {
        schemaJson: buildSchemaJson(),
        comment: 'Manual save',
      });
      await revisionsQuery.refetch();
      toast.success('Project saved');
      return;
    }

    toast.success('Schema saved');
  }, [buildSchemaJson, isRevisionPreview, projectId, persistToStorage, revisionsQuery]);

  const handleBack = useCallback(async () => {
    console.info('[editor:back:click]', {
      projectId,
      timestamp: new Date().toISOString(),
    });
    // Navigate immediately to keep UI responsive.
    navigate('/');

    if (!projectId) return;
    // Persist in background; do not block route transition.
    void (async () => {
      try {
        const started = performance.now();
        await persistToStorage();
        await createProjectRevision(projectId, {
          schemaJson: buildSchemaJson(),
          comment: 'Exit autosave',
        });
        console.info('[editor:back:background-save:done]', {
          durationMs: Math.round(performance.now() - started),
        });
      } catch (error) {
        console.error('Background save on back failed', error);
      }
    })();
  }, [buildSchemaJson, navigate, persistToStorage, projectId]);

  const handleOpenVersions = useCallback(async () => {
    clearMultiSelection();
    setSelectedTableId(null);
    setSelectedRelation(null);
    setPanelMode('history');
    if (projectId) {
      await revisionsQuery.refetch();
    }
  }, [clearMultiSelection, projectId, revisionsQuery, setSelectedRelation, setSelectedTableId]);

  const applyRevisionSchema = useCallback((revision: ProjectRevision) => {
    const schemaJson = toRecord(revision.schemaJson);
    const schemaSource = toRecord(schemaJson.schema ?? schemaJson);
    const schema = normalizeSchema(schemaSource);
    useSchemaStore.getState().initialize({
      tables: schema.tables,
      relations: schema.relations,
      domains: schema.domains,
      enums: schema.enums,
    });

    const settingsRaw = toRecord(schemaJson.settings);
    const autoSaveIntervalSecRaw = Number(settingsRaw.autoSaveIntervalSec ?? DEFAULT_PROJECT_SETTINGS.autoSaveIntervalSec);
    setSettings({
      ...DEFAULT_PROJECT_SETTINGS,
      ...settingsRaw,
      autoSaveIntervalSec: Number.isFinite(autoSaveIntervalSecRaw)
        ? Math.max(15, Math.min(autoSaveIntervalSecRaw, 3600))
        : DEFAULT_PROJECT_SETTINGS.autoSaveIntervalSec,
    });
  }, []);

  const handleSelectRevision = useCallback((revisionId: string) => {
    const revision = revisionsQuery.data?.find((item) => item.id === revisionId);
    if (!revision) return;
    if (!draftBeforePreviewRef.current) {
      draftBeforePreviewRef.current = {
        tables,
        relations,
        domains,
        enums,
        settings,
      };
    }
    setSelectedRevisionId(revision.id);
    setPreviewRevisionNumber(revision.revision);
    setIsRevisionPreview(true);
    applyRevisionSchema(revision);
    toast.success(`Revision r${revision.revision} preview enabled`);
  }, [applyRevisionSchema, revisionsQuery.data, tables, relations, domains, enums, settings]);

  const handleCancelRevisionPreview = useCallback(() => {
    if (!draftBeforePreviewRef.current) return;
    useSchemaStore.getState().initialize({
      tables: draftBeforePreviewRef.current.tables,
      relations: draftBeforePreviewRef.current.relations,
      domains: draftBeforePreviewRef.current.domains,
      enums: draftBeforePreviewRef.current.enums,
    });
    setSettings(draftBeforePreviewRef.current.settings);
    draftBeforePreviewRef.current = null;
    setIsRevisionPreview(false);
    setPreviewRevisionNumber(null);
    setSelectedRevisionId(null);
    toast.success('Returned to current working state');
  }, []);

  const handleApplyRevisionPreview = useCallback(async () => {
    if (!projectId || previewRevisionNumber === null) return;
    await restoreProjectRevision(projectId, previewRevisionNumber);
    await persistToStorage();
    await revisionsQuery.refetch();
    draftBeforePreviewRef.current = null;
    setIsRevisionPreview(false);
    setPreviewRevisionNumber(null);
    setSelectedRevisionId(null);
    toast.success(`Revision r${previewRevisionNumber} was applied as current`);
  }, [persistToStorage, previewRevisionNumber, projectId, revisionsQuery]);

  const handleDeleteRevision = useCallback(async (revisionId: string) => {
    if (!projectId) return;
    await deleteProjectRevision(projectId, revisionId);
    if (selectedRevisionId === revisionId) {
      setSelectedRevisionId(null);
    }
    await revisionsQuery.refetch();
    toast.success('Version deleted');
  }, [projectId, revisionsQuery, selectedRevisionId]);

  // ── Keyboard shortcuts ──
  const handleCopySelection = useCallback(async () => {
    const selectedIds = new Set<string>(selectedTableIds);
    if (selectedTableId) selectedIds.add(selectedTableId);
    if (selectedIds.size === 0) return;

    const tableIds: string[] = [];
    const enumIds: string[] = [];
    for (const id of selectedIds) {
      if (isEnumTableId(id)) enumIds.push(getEnumIdFromTableId(id));
      else tableIds.push(id);
    }

    const payload = exportSelectionForClipboard(tableIds, enumIds);
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      toast.success(`Copied ${selectedIds.size} object${selectedIds.size > 1 ? 's' : ''}`);
    } catch {
      toast.error('Cannot access clipboard in this browser context');
    }
  }, [exportSelectionForClipboard, selectedTableId, selectedTableIds]);

  const handlePasteSelection = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error('Cannot read clipboard in this browser context');
      return;
    }

    const result = importSelectionFromClipboard(text);
    if (!result) {
      toast.error('Clipboard does not contain copied canvas tables');
      return;
    }
    toast.success(`Pasted ${result.tables} table${result.tables > 1 ? 's' : ''}, ${result.enums} enum${result.enums === 1 ? '' : 's'} and ${result.relations} relation${result.relations === 1 ? '' : 's'}`);
  }, [importSelectionFromClipboard]);

  useEditorKeyboardShortcuts({
    undo, redo, codeMode, onToggleMaximize: handleToggleMaximize,
    onSave: () => { void handleSave(); },
    onExport: () => setIsExportModalOpen(true),
    onImport: () => setIsImportModalOpen(true),
    onZoomToFit: () => zoomToFitRef.current?.(),
    onSelectAll: () => {
      const allIds = new Set(tables.map(t => t.id));
      useSchemaStore.getState().setSelectedTableIds(allIds);
    },
    onOpenValidation: () => setIsValidationOpen(true),
    onOpenDiff: () => setIsDiffOpen(true),
    onCopy: () => { void handleCopySelection(); },
    onPaste: () => { void handlePasteSelection(); },
  });

  const darkMode = codeMode;
  const activeTableId = selectedTableId
    ?? (selectedTableIds.size === 1 ? Array.from(selectedTableIds)[0] : null);

  const selectedEnumType = activeTableId && isEnumTableId(activeTableId)
    ? enums.find((e) => e.id === getEnumIdFromTableId(activeTableId)) || null
    : null;

  const selectedTable = panelMode === 'history'
    ? null
    : (selectedTableIds.size > 1
      ? null
      : (selectedEnumType
        ? {
            id: `${ENUM_TABLE_PREFIX}${selectedEnumType.id}`,
            name: selectedEnumType.name,
            description: selectedEnumType.description,
            domainId: selectedEnumType.domainId,
            fields: selectedEnumType.values.map((value, index) => ({
              id: `${selectedEnumType.id}::value::${index}`,
              name: value,
              comment: selectedEnumType.valueComments?.[index],
              type: 'varchar' as FieldType,
              isPrimaryKey: false,
              isNullable: false,
              isForeignKey: false,
            })),
            position: selectedEnumType.position ?? { x: 240, y: 140 },
          }
        : (tables.find(t => t.id === activeTableId) || null)));

  // ── Export handlers ──
  const handleExportJSON = () => { downloadFile(exportToFormat('json'), 'schema.json', 'application/json'); toast.success('Schema exported to JSON'); };
  const handleExportPostgreSQL = () => { downloadFile(exportToFormat('postgresql'), 'schema.sql', 'text/plain'); toast.success('Schema exported to PostgreSQL DDL'); };
  const handleExportSupabaseRLS = () => { downloadFile(exportToFormat('supabase-rls'), 'supabase-rls-policies.sql', 'text/plain'); toast.success('Schema exported to Supabase RLS policies'); };
  const handleExportMermaid = () => { downloadFile(exportToFormat('mermaid'), 'schema.mmd', 'text/plain'); toast.success('Schema exported to Mermaid ER diagram'); };
  const handleGetPreview = (formatId: string): string => { try { return exportToFormat(formatId); } catch { return '// Error generating preview'; } };

  const handleImport = (formatId: string, content: string) => {
    try { importFromFormat(formatId, content); toast.success(`Schema imported from ${formatId.toUpperCase()}`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to import schema'); throw err; }
  };

  // ── Relation toolbar position ──
  const getRelationMidpoint = () => {
    if (!selectedRelation) return null;
    const from = tables.find(t => t.id === selectedRelation.fromTableId);
    const to = tables.find(t => t.id === selectedRelation.toTableId);
    if (!from || !to) return null;
    return { x: (from.position.x + to.position.x) / 2 + 120, y: (from.position.y + to.position.y) / 2 };
  };

  const handleCreateRelation = useCallback((fromTableId: string, fromFieldId: string, toTableId: string, toFieldId: string | null) => {
    if (isEnumTableId(fromTableId)) return;
    if (isEnumTableId(toTableId)) {
      const enumId = getEnumIdFromTableId(toTableId);
      const sourceTable = tables.find(t => t.id === fromTableId);
      const sourceField = sourceTable?.fields.find(f => f.id === fromFieldId);
      const enumType = enums.find(e => e.id === enumId);
      if (!sourceField || !enumType) return;
      updateField(fromTableId, fromFieldId, {
        type: 'enum',
        enumId,
        enumName: enumType.name,
      });
      toast.success(`Field "${sourceField.name}" linked to ENAM "${enumType.name}"`);
      return;
    }
    const fromTable = tables.find(t => t.id === fromTableId);
    const toTable = tables.find(t => t.id === toTableId);
    if (!fromTable || !toTable) return;
    const sourceField = fromTable.fields.find(f => f.id === fromFieldId);
    if (!sourceField) return;

    const fkFieldId = sourceField.isPrimaryKey ? toFieldId : fromFieldId;
    if (fkFieldId) {
      const alreadyHasFK = relations.some(r => r.fromFieldId === fkFieldId);
      if (alreadyHasFK) {
        toast.error('This field already has a foreign key reference. Remove the existing relation first.', { duration: 5000 });
        return;
      }
    }

    const exists = relations.some(r =>
      (r.fromTableId === fromTableId && r.fromFieldId === fromFieldId && r.toTableId === toTableId) ||
      (r.toTableId === fromTableId && r.toFieldId === fromFieldId && r.fromTableId === toTableId)
    );

    if (toFieldId) {
      if (exists) { toast.info('Relation already exists'); return; }
      const targetField = toTable.fields.find(f => f.id === toFieldId);
      if (targetField) {
        const compat = getTypeCompatibility(sourceField, targetField);
        if (compat === 'forbidden') {
          const sourceTypeLabel = sourceField.type === 'enum' ? sourceField.enumName || 'enum' : sourceField.type;
          const targetTypeLabel = targetField.type === 'enum' ? targetField.enumName || 'enum' : targetField.type;
          toast.error(`Incompatible types: ${sourceTypeLabel} and ${targetTypeLabel} cannot be linked.`, { duration: 5000 });
          return;
        }
        if (compat === 'warning') {
          toast.warning(`Type cast required: ${sourceField.type} \u2192 ${targetField.type}. This may cause issues at runtime.`, { duration: 5000 });
        }
      }
      if (sourceField.isPrimaryKey) {
        updateField(toTableId, toFieldId, { isForeignKey: true, foreignKeyTable: fromTable.name, foreignKeyField: sourceField.name });
        addRelation({ fromTableId: toTableId, fromFieldId: toFieldId, toTableId: fromTableId, toFieldId: fromFieldId, type: '1:N' });
      } else {
        updateField(fromTableId, fromFieldId, { isForeignKey: true, foreignKeyTable: toTable.name, foreignKeyField: targetField?.name || 'id' });
        addRelation({ fromTableId, fromFieldId, toTableId, toFieldId, type: '1:N' });
      }
      toast.success('Relation created');
    } else {
      const newFieldName = `${fromTable.name}_${sourceField.name}`;
      const newFieldId = addField(toTableId, {
        name: newFieldName,
        type: sourceField.type,
        enumId: sourceField.enumId,
        enumName: sourceField.enumName,
        isPrimaryKey: false,
        isNullable: true,
        isForeignKey: true,
        foreignKeyTable: fromTable.name,
        foreignKeyField: sourceField.name,
      });
      addRelation({ fromTableId: toTableId, fromFieldId: newFieldId, toTableId: fromTableId, toFieldId: fromFieldId, type: '1:N' });
      toast.success(`Created field "${newFieldName}" with FK relation`);
    }
  }, [tables, relations, enums, updateField, addField, addRelation]);

  const handleAssignDomain = useCallback((domainId: string, tableIds: string[]) => {
    const enumTableIds = tableIds.filter(isEnumTableId);
    const regularTableIds = tableIds.filter((id) => !isEnumTableId(id));

    if (regularTableIds.length > 0) {
      assignDomainToTables(domainId, regularTableIds);
    }

    for (const enumTableId of enumTableIds) {
      updateEnum(getEnumIdFromTableId(enumTableId), { domainId });
    }

    const domain = domains.find(d => d.id === domainId);
    const total = regularTableIds.length + enumTableIds.length;
    toast.success(`Assigned ${total} table${total > 1 ? 's' : ''} to ${domain?.name || 'domain'}`);
  }, [assignDomainToTables, domains, updateEnum]);

  const handleDeleteTables = useCallback((ids: string[]) => {
    deleteTables(ids);
    toast.success(`Deleted ${ids.length} table${ids.length > 1 ? 's' : ''}`);
  }, [deleteTables]);

  const handleSelectEntitiesInRect = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    const selected = new Set<string>();
    for (const table of canvasTables) {
      const tx = table.position.x;
      const ty = table.position.y;
      const tw = 280;
      const th = 40 + table.fields.length * 36;
      if (tx < rect.x + rect.w && tx + tw > rect.x && ty < rect.y + rect.h && ty + th > rect.y) {
        selected.add(table.id);
      }
    }
    setSelectedTableIds(selected);
  }, [canvasTables, setSelectedTableIds]);

  const handleMoveSelectedEntities = useCallback((dx: number, dy: number) => {
    for (const id of selectedTableIds) {
      if (isEnumTableId(id)) {
        const enumId = getEnumIdFromTableId(id);
        const enumType = enums.find((e) => e.id === enumId);
        if (!enumType) continue;
        const pos = enumType.position ?? { x: 260, y: 140 };
        updateEnumPosition(enumId, { x: pos.x + dx, y: pos.y + dy });
        continue;
      }
      const table = tables.find((t) => t.id === id);
      if (!table) continue;
      updateTablePosition(id, { x: table.position.x + dx, y: table.position.y + dy });
    }
  }, [selectedTableIds, enums, tables, updateEnumPosition, updateTablePosition]);

  // ── FK-aware field type change ──
  const handleFieldTypeChange = useCallback((tableId: string, fieldId: string, newType: FieldType, enumInfo?: { enumId?: string; enumName?: string }) => {
    const table = tables.find(t => t.id === tableId);
    const field = table?.fields.find(f => f.id === fieldId);

    // Find relations where this field is the REFERENCED (target) field
    const affected = relations
      .filter(r => r.toTableId === tableId && r.toFieldId === fieldId)
      .map(r => {
        const fkTable = tables.find(t => t.id === r.fromTableId);
        const fkField = fkTable?.fields.find(f => f.id === r.fromFieldId);
        return { relationId: r.id, fkTableId: r.fromTableId, fkFieldId: r.fromFieldId, fkTableName: fkTable?.name || '?', fkFieldName: fkField?.name || '?' };
      });

    if (affected.length === 0) {
      // No FK references — just change
      const isCanvasTypeSwitchToEnum = newType === 'enum' && !enumInfo;
      updateField(tableId, fieldId, {
        type: newType,
        enumId: newType === 'enum'
          ? (isCanvasTypeSwitchToEnum ? field?.enumId : (enumInfo?.enumId || field?.enumId))
          : undefined,
        enumName: newType === 'enum'
          ? (isCanvasTypeSwitchToEnum ? field?.enumName : (enumInfo?.enumName || field?.enumName))
          : undefined,
      });
      return;
    }

    // Find the current type
    if (!field) { updateField(tableId, fieldId, { type: newType }); return; }

    setFkTypeChangeDialog({ tableId, fieldId, newType, oldType: field.type, affectedRelations: affected });
  }, [tables, relations, updateField, enums]);

  const handleFkTypeChangeConfirm = useCallback((cascade: boolean) => {
    if (!fkTypeChangeDialog) return;
    const { tableId, fieldId, newType, affectedRelations } = fkTypeChangeDialog;
    if (cascade) {
      // Update this field + all FK fields
      pushHistory();
      updateField(tableId, fieldId, { type: newType });
      for (const a of affectedRelations) {
        updateField(a.fkTableId, a.fkFieldId, { type: newType });
      }
      toast.success(`Type changed to ${newType} in ${affectedRelations.length + 1} field(s)`);
    }
    // If not cascade — do nothing (keep old type)
    setFkTypeChangeDialog(null);
  }, [fkTypeChangeDialog, updateField, pushHistory]);

  const relationToolbarPosition = getRelationMidpoint();

  useEffect(() => {
    if (!projectId || isRevisionPreview) return;

    const intervalMs = Math.max(15, settings.autoSaveIntervalSec) * 1000;
    const timer = window.setInterval(async () => {
      if (Date.now() - lastAutoRevisionRef.current < intervalMs - 250) return;
      await persistToStorage();
      await createProjectRevision(projectId, {
        schemaJson: buildSchemaJson(),
        comment: 'Periodic autosave',
      });
      lastAutoRevisionRef.current = Date.now();
      await revisionsQuery.refetch();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [buildSchemaJson, isRevisionPreview, persistToStorage, projectId, revisionsQuery, settings.autoSaveIntervalSec]);

  return (
    <div className={`size-full flex flex-col transition-colors duration-300 ${darkMode ? 'bg-[#11111b]' : 'bg-gray-100'}`}>
      {/* Toolbar */}
      {!snapshotCaptureMode && (
        <Toolbar
          onExport={() => setIsExportModalOpen(true)}
          onImport={() => setIsImportModalOpen(true)}
          onSave={() => { void handleSave(); }}
          onSettings={() => setIsSettingsOpen(true)}
          onVersions={() => { void handleOpenVersions(); }}
          onBack={projectId ? (() => { void handleBack(); }) : undefined}
          projectName={projectName || undefined}
          onRename={projectId ? setProjectName : undefined}
          darkMode={darkMode}
        />
      )}

      <div className="flex-1 overflow-hidden relative">
        {/* Canvas */}
        <div ref={canvasContainerRef} className="absolute inset-0 z-0">
          <Canvas
            tables={canvasTables}
            relations={canvasRelations}
            domains={domains}
            selectedTableId={snapshotCaptureMode ? null : selectedTableId}
            selectedTableIds={snapshotCaptureMode ? new Set() : selectedTableIds}
            selectedRelation={snapshotCaptureMode ? null : selectedRelation}
            onTableSelect={(tableId) => {
              setPanelMode('properties');
              setSelectedTableId(tableId);
            }}
            onTablePositionChange={isRevisionPreview ? (() => {}) : ((tableId, position) => {
              if (isEnumTableId(tableId)) {
                updateEnumPosition(getEnumIdFromTableId(tableId), position);
                return;
              }
              updateTablePosition(tableId, position);
            })}
            onTableDelete={isRevisionPreview ? (() => {}) : ((tableId) => {
              if (isEnumTableId(tableId)) {
                deleteEnum(getEnumIdFromTableId(tableId));
                return;
              }
              deleteTable(tableId);
            })}
            onFieldClick={(tableId) => {
              setPanelMode('properties');
              setSelectedTableId(tableId);
            }}
            onRelationSelect={(relation) => {
              if (relation.id.startsWith('enumrel::')) {
                setSelectedRelation(null);
                return;
              }
              setSelectedRelation(relation);
            }}
            onFieldTypeChange={isRevisionPreview ? (() => {}) : handleFieldTypeChange}
            onCreateRelation={isRevisionPreview ? (() => {}) : handleCreateRelation}
            onAutoLayout={isRevisionPreview ? (() => {}) : autoLayout}
            onToggleTableSelection={toggleTableSelection}
            onSelectTablesInRect={handleSelectEntitiesInRect}
            onClearMultiSelection={clearMultiSelection}
            onMoveSelectedTables={isRevisionPreview ? (() => {}) : handleMoveSelectedEntities}
            onDeleteTables={isRevisionPreview ? (() => {}) : ((ids) => {
              const enumIds = ids.filter(isEnumTableId).map(getEnumIdFromTableId);
              const tableIds = ids.filter((id) => !isEnumTableId(id));
              for (const enumId of enumIds) deleteEnum(enumId);
              if (tableIds.length > 0) handleDeleteTables(tableIds);
            })}
            getTableColor={getTableColor}
            lineType={settings.lineType}
            enabledFieldTypes={settings.enabledFieldTypes}
            viewportRef={canvasViewportRef}
            centerOnTableRef={centerOnTableRef}
            zoomToFitRef={zoomToFitRef}
            darkMode={darkMode}
            onTableDoubleClick={handleTableDoubleClick}
            onAddTable={isRevisionPreview ? (() => {}) : ((pos) => addTable('new_table', pos))}
            isEnumTableId={isEnumTableId}
            onAddEnumTable={isRevisionPreview ? (() => {}) : ((pos) => {
              addEnum('new_enum', ['value_1', 'value_2'], pos);
            })}
            onReorderEnumValue={isRevisionPreview ? (() => {}) : ((enumTableId, fromIndex, toIndex) => {
              reorderEnumValues(getEnumIdFromTableId(enumTableId), fromIndex, toIndex);
            })}
            onReorderField={isRevisionPreview ? (() => {}) : ((tableId, fromIndex, toIndex) => {
              if (isEnumTableId(tableId)) return;
              reorderField(tableId, fromIndex, toIndex);
            })}
            onConvertTableToEnum={isRevisionPreview ? (() => {}) : ((tableId) => {
              const table = tables.find((t) => t.id === tableId);
              if (!table) return;
              const values = table.fields
                .filter((f) => !f.isPrimaryKey)
                .map((f) => f.name.trim())
                .filter(Boolean);
              const enumType = addEnum(table.name, values.length > 0 ? values : ['value_1'], table.position);
              if (table.domainId) {
                updateEnum(enumType.id, { domainId: table.domainId });
              }
              deleteTable(tableId);
              toast.success(`Table "${table.name}" converted to ENAM "${enumType.name}"`);
            })}
            onAddFieldToTable={isRevisionPreview ? (() => {}) : ((tableId) => {
              if (isEnumTableId(tableId)) {
                const enumId = getEnumIdFromTableId(tableId);
                const enumType = enums.find((e) => e.id === enumId);
                if (!enumType) return;
                updateEnum(enumId, { values: [...enumType.values, `value_${enumType.values.length + 1}`] });
                return;
              }
              addField(tableId, {
                name: 'new_field',
                type: 'varchar',
                isPrimaryKey: false,
                isNullable: true,
                isForeignKey: false,
              });
            })}
            onValidateTable={() => setIsValidationOpen(true)}
            onToggleMaximize={handleToggleMaximize}
            onUpdateField={isRevisionPreview ? (() => {}) : ((tableId, fieldId, updates) => updateField(tableId, fieldId, updates))}
            onDeleteField={isRevisionPreview ? (() => {}) : ((tableId, fieldId) => deleteField(tableId, fieldId))}
            onAssignDomain={isRevisionPreview ? (() => {}) : handleAssignDomain}
            highlightRelations={highlightRelations}
            onOpenInCodeEditor={handleOpenInCodeEditor}
            onPushHistory={isRevisionPreview ? (() => {}) : pushHistory}
          />
        </div>

        {/* Left panel — slides via translateX, content stays pinned to left edge */}
        <div
          className="absolute left-0 top-0 h-full z-20 overflow-hidden transition-[width] duration-[280ms] ease-in-out"
          style={{
            width: codeMode
              ? (leftCollapsed ? '40px' : `${leftCodeWidth}px`)
              : (leftCollapsed ? '40px' : `${leftSidebarWidth}px`),
            transform: snapshotCaptureMode ? 'translateX(-100%)' : 'translateX(0)',
            pointerEvents: snapshotCaptureMode ? 'none' : 'auto',
          }}
        >
          {/* Sliding inner — translateX for smooth slide */}
          <div
            className="h-full transition-transform duration-[280ms] ease-in-out"
            style={{
              width: `${codeMode ? leftCodeWidth : leftSidebarWidth}px`,
              transform: leftCollapsed ? 'translateX(-100%)' : 'translateX(0)',
            }}
          >
            {codeMode ? (
              <CodeEditorPanel
                value={codeValue}
                onChange={handleCodeChange}
                errors={codeErrors}
                onSync={handleCodeSync}
                activeTab={activeCodeTab}
                onTabChange={setActiveCodeTab}
                editorViewRef={editorViewRef}
                onClose={() => setLeftCollapsed(true)}
              />
            ) : (
              <Sidebar
                tables={tables}
                domains={domains}
                selectedTableId={selectedTableId && isEnumTableId(selectedTableId) ? null : selectedTableId}
                selectedTableIds={selectedTableIds}
                collapsed={false}
                onToggleCollapse={() => setLeftCollapsed(true)}
                onTableSelect={(tableId) => {
                  setPanelMode('properties');
                  setSelectedTableId(tableId);
                }}
                onTableDelete={isRevisionPreview ? (() => {}) : deleteTable}
                onAddTable={isRevisionPreview ? (() => {}) : addTable}
                onAddDomain={isRevisionPreview ? (() => {}) : ((name) => addDomain(name))}
                onUpdateDomain={isRevisionPreview ? (() => {}) : updateDomain}
                onDeleteDomain={isRevisionPreview ? (() => {}) : deleteDomain}
                onAssignDomain={isRevisionPreview ? (() => {}) : handleAssignDomain}
                onRemoveFromDomain={isRevisionPreview ? (() => {}) : ((tableId: string) => updateTableDomain(tableId, undefined))}
                getTableColor={getTableColor}
                onToggleTableSelection={toggleTableSelection}
                onReorderTables={isRevisionPreview ? (() => {}) : reorderTables}
                onCenterOnTable={(tableId) => centerOnTableRef.current?.(tableId)}
                onClearMultiSelection={clearMultiSelection}
              />
            )}
          </div>
          {/* Collapsed toggle — rendered on top, visible when panel is slid out */}
          {leftCollapsed && !snapshotCaptureMode && (
            <div className="absolute inset-0 flex flex-col items-center pt-2" style={{
              background: codeMode ? 'rgba(30,30,46,0.95)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              borderTopRightRadius: '0.5rem',
              borderBottomRightRadius: '0.5rem',
            }}>
              <button
                onClick={() => setLeftCollapsed(false)}
                className={`p-1.5 rounded ${codeMode ? 'hover:bg-[#313244] text-[#a6adc8]' : 'hover:bg-gray-100 text-gray-500'}`}
                title="Expand panel (F)"
              >
                {codeMode ? <Code className="size-4" /> : <PanelLeft className="size-4" />}
              </button>
            </div>
          )}
          {/* Shadow overlay */}
          {!snapshotCaptureMode && !leftCollapsed && (
            <div className="absolute inset-y-0 right-0 w-px pointer-events-none" style={{
              boxShadow: codeMode ? '4px 0 24px rgba(0,0,0,0.3)' : '4px 0 16px rgba(0,0,0,0.08)',
            }} />
          )}
          {!snapshotCaptureMode && !leftCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize left panel"
              onMouseDown={(e) => { e.preventDefault(); setResizingSide('left'); }}
              className={`absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors ${resizingSide === 'left' ? 'bg-blue-500/50' : 'hover:bg-blue-500/35'}`}
            />
          )}
        </div>

        {/* Right panel — translateX keeps content pinned to right edge */}
        <div
          className="absolute right-0 top-0 h-full z-20 overflow-hidden transition-[width] duration-[280ms] ease-in-out"
          style={{
            width: rightCollapsed ? '40px' : `${rightPanelWidth}px`,
            transform: snapshotCaptureMode ? 'translateX(100%)' : 'translateX(0)',
            pointerEvents: snapshotCaptureMode ? 'none' : 'auto',
          }}
        >
          {/* Sliding inner — always right-aligned */}
          <div
            className="absolute right-0 top-0 h-full transition-transform duration-[280ms] ease-in-out"
            style={{
              width: `${rightPanelWidth}px`,
              transform: rightCollapsed ? 'translateX(calc(100% - 40px))' : 'translateX(0)',
            }}
          >
            <TableDetailsPanel
              mode={panelMode}
              table={selectedTable}
              tables={tables}
              domains={domains}
              enums={enums}
              relations={relations}
              collapsed={rightCollapsed}
              selectedTableIds={selectedTableIds}
              onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
              darkMode={codeMode}
              onUpdateTableName={(name) => {
                if (isRevisionPreview || !activeTableId) return;
                if (isEnumTableId(activeTableId)) {
                  updateEnum(getEnumIdFromTableId(activeTableId), { name });
                  return;
                }
                updateTableName(activeTableId, name);
              }}
              onUpdateTableDescription={(desc) => {
                if (isRevisionPreview || !activeTableId) return;
                if (isEnumTableId(activeTableId)) {
                  updateEnum(getEnumIdFromTableId(activeTableId), { description: desc });
                  return;
                }
                updateTableDescription(activeTableId, desc);
              }}
              onUpdateTableDomain={(domainId) => {
                if (isRevisionPreview || !activeTableId) return;
                if (isEnumTableId(activeTableId)) {
                  updateEnum(getEnumIdFromTableId(activeTableId), { domainId });
                  return;
                }
                updateTableDomain(activeTableId, domainId);
              }}
              onAddField={(field) => {
                if (isRevisionPreview || !activeTableId) return;
                if (isEnumTableId(activeTableId)) {
                  const enumId = getEnumIdFromTableId(activeTableId);
                  const enumType = enums.find((e) => e.id === enumId);
                  if (!enumType) return;
                  updateEnum(enumId, {
                    values: [...enumType.values, field.name],
                    valueComments: [...(enumType.valueComments ?? enumType.values.map(() => undefined)), field.comment?.trim() || undefined],
                  });
                  return;
                }
                addField(activeTableId, field);
              }}
              onUpdateField={(fieldId, updates) => {
                if (isRevisionPreview) return;
                if (!activeTableId) return;
                if (isEnumTableId(activeTableId)) {
                  const enumId = getEnumIdFromTableId(activeTableId);
                  const enumType = enums.find((e) => e.id === enumId);
                  if (!enumType) return;
                  const index = Number(fieldId.split('::value::')[1] ?? -1);
                  if (index < 0 || index >= enumType.values.length) return;
                  const nextValues = [...enumType.values];
                  const nextComments = [...(enumType.valueComments ?? enumType.values.map(() => undefined))];
                  if (typeof updates.name === 'string') {
                    nextValues[index] = updates.name;
                  }
                  if (Object.prototype.hasOwnProperty.call(updates, 'comment')) {
                    const nextComment = typeof updates.comment === 'string' && updates.comment.trim().length > 0
                      ? updates.comment.trim()
                      : undefined;
                    nextComments[index] = nextComment;
                  }
                  updateEnum(enumId, { values: nextValues, valueComments: nextComments });
                  return;
                }
                if (updates.type) {
                  handleFieldTypeChange(activeTableId, fieldId, updates.type, { enumId: updates.enumId, enumName: updates.enumName });
                } else {
                  updateField(activeTableId, fieldId, updates);
                }
              }}
              onDeleteField={(fieldId) => {
                if (isRevisionPreview || !activeTableId) return;
                if (isEnumTableId(activeTableId)) {
                  const enumId = getEnumIdFromTableId(activeTableId);
                  const enumType = enums.find((e) => e.id === enumId);
                  if (!enumType) return;
                  const index = Number(fieldId.split('::value::')[1] ?? -1);
                  if (index < 0 || index >= enumType.values.length) return;
                  const nextValues = enumType.values.filter((_, i) => i !== index);
                  const nextComments = (enumType.valueComments ?? enumType.values.map(() => undefined))
                    .filter((_, i) => i !== index);
                  updateEnum(enumId, { values: nextValues, valueComments: nextComments });
                  return;
                }
                deleteField(activeTableId, fieldId);
              }}
              onAddRelation={(relation) => { if (!isRevisionPreview) addRelation(relation); }}
              onDeleteRelation={(relationId) => { if (!isRevisionPreview) deleteRelation(relationId); }}
              enabledFieldTypes={settings.enabledFieldTypes}
              onBulkAssignDomain={isRevisionPreview ? undefined : handleAssignDomain}
              onBulkDelete={isRevisionPreview ? undefined : handleDeleteTables}
              revisions={(revisionsQuery.data ?? []).map((item) => ({
                id: item.id,
                revision: item.revision,
                comment: item.comment,
                createdAt: item.createdAt,
              }))}
              selectedRevisionId={selectedRevisionId}
              isRevisionsLoading={revisionsQuery.isLoading || revisionsQuery.isFetching}
              onSelectRevision={handleSelectRevision}
              onDeleteRevision={(revisionId) => { void handleDeleteRevision(revisionId); }}
              isEnumTable={!!selectedEnumType}
            />
          </div>
          {!snapshotCaptureMode && !rightCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize right panel"
              onMouseDown={(e) => { e.preventDefault(); setResizingSide('right'); }}
              className={`absolute top-0 left-0 h-full w-1 cursor-col-resize transition-colors ${resizingSide === 'right' ? 'bg-blue-500/50' : 'hover:bg-blue-500/35'}`}
            />
          )}
        </div>

        {/* Canvas toolbar */}
        {!snapshotCaptureMode && !isRevisionPreview && (
          <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
            <div className="pointer-events-auto inline-block relative left-1/2 -translate-x-1/2 bottom-4">
              <CanvasToolbar
                isMaximized={isMaximized}
                onToggleMaximize={handleToggleMaximize}
                codeMode={codeMode}
                onToggleCodeMode={toggleCodeMode}
                onUndo={undo}
                onRedo={redo}
                canUndo={pastLength > 0}
                canRedo={futureLength > 0}
                onAutoLayout={autoLayout}
                highlightRelations={highlightRelations}
                onToggleHighlightRelations={() => setHighlightRelations(prev => !prev)}
                onZoomToFit={() => zoomToFitRef.current?.()}
                onOpenValidation={() => setIsValidationOpen(true)}
                onOpenDiff={() => setIsDiffOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Revision preview bar */}
        {!snapshotCaptureMode && isRevisionPreview && (
          <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
            <div className="pointer-events-auto inline-flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 shadow-md relative left-1/2 -translate-x-1/2 bottom-4">
              <AlertTriangle className="size-4 text-amber-700" />
              <span className="text-sm text-amber-900">
                Revision preview {previewRevisionNumber ? `r${previewRevisionNumber}` : ''}. Editing is disabled.
              </span>
              <Button size="sm" variant="outline" onClick={() => { void handleCancelRevisionPreview(); }}>
                Return to current
              </Button>
              <Button size="sm" onClick={() => { void handleApplyRevisionPreview(); }}>
                Apply
              </Button>
            </div>
          </div>
        )}

        {/* Relation toolbar */}
        {selectedRelation && relationToolbarPosition && !snapshotCaptureMode && !isRevisionPreview && (
          <RelationToolbar
            relation={selectedRelation}
            position={relationToolbarPosition}
            onUpdateType={(type) => updateRelation(selectedRelation.id, type)}
            onDelete={() => { deleteRelation(selectedRelation.id); setSelectedRelation(null); }}
          />
        )}

        {/* Snapshot overlay */}
        {snapshotCaptureMode && (
          <SnapshotOverlay onSave={saveSnapshot} onCancel={cancelCapture} isCapturing={isCapturing} />
        )}
      </div>

      {/* Modals */}
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExportJSON={handleExportJSON} onExportPostgreSQL={handleExportPostgreSQL} onExportSupabaseRLS={handleExportSupabaseRLS} onExportMermaid={handleExportMermaid} getPreview={handleGetPreview} />
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImport} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        projectName={projectId ? projectName : undefined}
        projectDescription={projectId ? projectDescription : undefined}
        projectSnapshot={projectId ? currentSnapshot : undefined}
        onRenameProject={projectId ? setProjectName : undefined}
        onUpdateProjectDescription={projectId ? setProjectDescription : undefined}
        onCaptureSnapshot={projectId ? startCapture : undefined}
      />
      <ValidationModal isOpen={isValidationOpen} onClose={() => setIsValidationOpen(false)} tables={tables} relations={relations} onSelectTable={(id) => { setSelectedTableId(id); centerOnTableRef.current?.(id); }} />
      <DiffModal isOpen={isDiffOpen} onClose={() => setIsDiffOpen(false)} tables={tables} relations={relations} />
      {/* FK type change dialog */}
      {fkTypeChangeDialog && (() => {
        const srcTable = tables.find(t => t.id === fkTypeChangeDialog.tableId);
        const srcField = srcTable?.fields.find(f => f.id === fkTypeChangeDialog.fieldId);
        return (
          <Dialog open onOpenChange={() => setFkTypeChangeDialog(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Referenced field type change</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-gray-600">
                  <span style={{ fontWeight: 600 }}>{srcTable?.name}.{srcField?.name}</span> is referenced by {fkTypeChangeDialog.affectedRelations.length} FK field{fkTypeChangeDialog.affectedRelations.length > 1 ? 's' : ''}:
                </p>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                  {fkTypeChangeDialog.affectedRelations.map(a => (
                    <div key={a.relationId} className="flex items-center gap-2 text-sm">
                      <span className="text-blue-600" style={{ fontWeight: 500 }}>{a.fkTableName}</span>
                      <span className="text-gray-400">.</span>
                      <span className="text-gray-700">{a.fkFieldName}</span>
                      <span className="ml-auto text-gray-400">{fkTypeChangeDialog.oldType}</span>
                    </div>
                  ))}
                </div>
                <p className="text-gray-500">
                  Type: <span style={{ fontWeight: 600 }}>{fkTypeChangeDialog.oldType}</span> → <span style={{ fontWeight: 600 }}>{fkTypeChangeDialog.newType}</span>
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => handleFkTypeChangeConfirm(false)}
                >
                  Keep {fkTypeChangeDialog.oldType}
                </Button>
                <Button
                  onClick={() => handleFkTypeChangeConfirm(true)}
                >
                  Update all to {fkTypeChangeDialog.newType}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
