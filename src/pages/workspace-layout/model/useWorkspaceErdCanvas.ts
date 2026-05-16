import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRelationInViewCommand } from '@/shared/api/semantic-model';
import type { ProjectData } from '@/shared/types/project';
import type { Field, FieldType, Relation, Table } from '@/shared/types/schema';
import { ALL_FIELD_TYPES, DOMAIN_COLORS, DEFAULT_PROJECT_SETTINGS, getTypeCompatibility } from '@/shared/types/schema';
import { useWorkspaceCanvasHistory } from './useWorkspaceCanvasHistory';
import { useWorkspaceErdPersistence } from './useWorkspaceErdPersistence';
import {
  cloneErdSnapshot,
  cloneRelations,
  cloneTables,
  createTablePositionMap,
  ERD_TABLE_WIDTH,
  estimateErdTableHeight,
  getProjectDomains,
} from './workspace-erd-canvas-utils';
import { reorderTableFields } from './workspace-canvas-utils';
import { nextWorkspaceId } from './workspace-project-utils';

const WORKSPACE_ERD_CLIPBOARD_TYPE = 'archon/workspace-erd-selection';
const WORKSPACE_ERD_CLIPBOARD_VERSION = 1;

interface ErdClipboardPayload {
  type: typeof WORKSPACE_ERD_CLIPBOARD_TYPE;
  version: typeof WORKSPACE_ERD_CLIPBOARD_VERSION;
  tables: Table[];
  relations: Relation[];
}

function getUniqueTableName(tables: Table[], baseName: string): string {
  const used = new Set(tables.map((table) => table.name.toLowerCase()));
  if (!used.has(baseName.toLowerCase())) return baseName;

  let index = 2;
  while (used.has(`${baseName}${index}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName}${index}`;
}

function createDefaultField(name = 'id', type: FieldType = 'bigint'): Field {
  return {
    id: nextWorkspaceId('field'),
    name,
    type,
    isPrimaryKey: name === 'id',
    isNullable: false,
    isForeignKey: false,
  };
}

export function useWorkspaceErdCanvas(project: ProjectData) {
  const [tables, setTables] = useState<Table[]>(() => cloneTables(project.schema.tables));
  const [relations, setRelations] = useState<Relation[]>(() => cloneRelations(project.schema.relations));
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(() => new Set());
  const [selectedRelation, setSelectedRelation] = useState<Relation | null>(null);
  const [highlightRelations, setHighlightRelations] = useState(true);
  const zoomToFitRef = useRef<(() => void) | null>(null);
  const tablesRef = useRef(tables);
  const relationsRef = useRef(relations);
  const tablePositionsRef = useRef(createTablePositionMap(tables));

  const domains = useMemo(() => getProjectDomains(project), [project]);
  const domainColorById = useMemo(() => new Map(domains.map((domain) => [domain.id, domain.color])), [domains]);
  const settings = project.settings ?? DEFAULT_PROJECT_SETTINGS;
  const semanticBinding = project.semantic?.erd;

  const getSnapshot = useCallback(() => ({
    tables: cloneTables(tablesRef.current),
    relations: cloneRelations(relationsRef.current),
  }), []);
  const {
    persistSnapshot,
    saveTableMetadata,
    saveTablePosition,
    saveTablePositions,
  } = useWorkspaceErdPersistence({
    projectId: project.id,
    semanticBinding,
    tablesRef,
    tablePositionsRef,
  });
  const saveRelation = useCallback((relation: Relation) => {
    const sourceBinding = semanticBinding?.objectsByLegacyId[relation.fromTableId];
    const targetBinding = semanticBinding?.objectsByLegacyId[relation.toTableId];
    if (!project.id || !semanticBinding?.viewId || !sourceBinding?.viewNodeId || !targetBinding?.viewNodeId) return;

    void createRelationInViewCommand(project.id, {
      viewId: semanticBinding.viewId,
      sourceViewNodeId: sourceBinding.viewNodeId,
      targetViewNodeId: targetBinding.viewNodeId,
      type: 'references',
      direction: 'directed',
      cardinalitySource: relation.type === '1:1' ? 'one' : 'many',
      cardinalityTarget: 'one',
      required: false,
      metadata: { ...relation },
    }).catch((error) => {
      console.error('[workspace] Failed to create relation', error);
    });
  }, [project.id, semanticBinding]);

  const applySnapshot = useCallback((snapshot: ReturnType<typeof getSnapshot>) => {
    const nextSnapshot = cloneErdSnapshot(snapshot);
    tablesRef.current = nextSnapshot.tables;
    relationsRef.current = nextSnapshot.relations;
    tablePositionsRef.current = createTablePositionMap(nextSnapshot.tables);
    setTables(nextSnapshot.tables);
    setRelations(nextSnapshot.relations);
    setSelectedTableId(null);
    setSelectedTableIds(new Set());
    setSelectedRelation(null);
    persistSnapshot(nextSnapshot);
  }, [persistSnapshot]);
  const {
    canUndo,
    canRedo,
    pushHistory,
    resetHistory,
    undo,
    redo,
  } = useWorkspaceCanvasHistory({
    getSnapshot,
    applySnapshot,
  });

  useEffect(() => {
    const nextTables = cloneTables(project.schema.tables);
    tablesRef.current = nextTables;
    tablePositionsRef.current = createTablePositionMap(nextTables);
    setTables(nextTables);
    const nextRelations = cloneRelations(project.schema.relations);
    relationsRef.current = nextRelations;
    setRelations(nextRelations);
    resetHistory();
    setSelectedTableId(null);
    setSelectedTableIds(new Set());
    setSelectedRelation(null);
  }, [project.id, project.schema.relations, project.schema.tables, resetHistory]);

  useEffect(() => {
    tablesRef.current = tables;
    tablePositionsRef.current = createTablePositionMap(tables);
  }, [tables]);

  useEffect(() => {
    relationsRef.current = relations;
  }, [relations]);

  const getTableColor = useCallback((table: Table) => {
    if (table.domainId && domainColorById.has(table.domainId)) {
      return domainColorById.get(table.domainId)!;
    }

    if (table.color) return table.color;

    const fallbackIndex = Math.abs(table.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % DOMAIN_COLORS.length;
    return DOMAIN_COLORS[fallbackIndex] ?? '#6366f1';
  }, [domainColorById]);

  const applyErdState = useCallback((nextTables: Table[], nextRelations = relationsRef.current) => {
    const clonedTables = cloneTables(nextTables);
    const clonedRelations = cloneRelations(nextRelations);
    tablesRef.current = clonedTables;
    relationsRef.current = clonedRelations;
    tablePositionsRef.current = createTablePositionMap(clonedTables);
    setTables(clonedTables);
    setRelations(clonedRelations);
    persistSnapshot({
      tables: clonedTables,
      relations: clonedRelations,
    });
  }, [persistSnapshot]);

  const updateTablePosition = useCallback((tableId: string, position: { x: number; y: number }) => {
    tablePositionsRef.current.set(tableId, position);
    setTables((current) => {
      const next = current.map((table) => table.id === tableId ? { ...table, position } : table);
      tablesRef.current = next;
      return next;
    });
  }, []);

  const reorderField = useCallback((tableId: string, fromIndex: number, toIndex: number) => {
    pushHistory();
    const nextTables = reorderTableFields(tablesRef.current, tableId, fromIndex, toIndex);
    const updatedTable = nextTables.find((table) => table.id === tableId);
    applyErdState(nextTables);
    if (updatedTable) saveTableMetadata(updatedTable);
  }, [applyErdState, pushHistory, saveTableMetadata]);

  const deleteTables = useCallback((ids: string[]) => {
    pushHistory();
    const idsSet = new Set(ids);
    const nextTables = tablesRef.current.filter((table) => !idsSet.has(table.id));
    const nextRelations = relationsRef.current.filter((relation) => !idsSet.has(relation.fromTableId) && !idsSet.has(relation.toTableId));
    applyErdState(nextTables, nextRelations);
    setSelectedTableId((current) => current && idsSet.has(current) ? null : current);
    setSelectedTableIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, [applyErdState, pushHistory]);

  const updateField = useCallback((tableId: string, fieldId: string, updates: Partial<Field>) => {
    pushHistory();
    const nextTables = tablesRef.current.map((table) => (
      table.id === tableId
        ? {
            ...table,
            fields: table.fields.map((field) => field.id === fieldId ? { ...field, ...updates } : field),
          }
        : table
    ));
    applyErdState(nextTables);
  }, [applyErdState, pushHistory]);

  const updateFieldType = useCallback((tableId: string, fieldId: string, type: FieldType) => {
    updateField(tableId, fieldId, {
      type,
      enumId: type === 'enum' ? tablesRef.current.find((table) => table.id === tableId)?.fields.find((field) => field.id === fieldId)?.enumId : undefined,
      enumName: type === 'enum' ? tablesRef.current.find((table) => table.id === tableId)?.fields.find((field) => field.id === fieldId)?.enumName : undefined,
    });
  }, [updateField]);

  const addFieldToTable = useCallback((tableId: string) => {
    pushHistory();
    const nextTables = tablesRef.current.map((table) => (
      table.id === tableId
        ? {
            ...table,
            fields: [
              ...table.fields,
              createDefaultField(`field_${table.fields.length + 1}`, 'varchar'),
            ],
          }
        : table
    ));
    applyErdState(nextTables);
  }, [applyErdState, pushHistory]);

  const deleteField = useCallback((tableId: string, fieldId: string) => {
    pushHistory();
    const nextTables = tablesRef.current.map((table) => (
      table.id === tableId
        ? { ...table, fields: table.fields.filter((field) => field.id !== fieldId) }
        : table
    ));
    const nextRelations = relationsRef.current.filter((relation) => relation.fromFieldId !== fieldId && relation.toFieldId !== fieldId);
    applyErdState(nextTables, nextRelations);
  }, [applyErdState, pushHistory]);

  const addTable = useCallback((position = { x: 160, y: 140 }) => {
    pushHistory();
    const table: Table = {
      id: nextWorkspaceId('table'),
      name: getUniqueTableName(tablesRef.current, 'NewTable'),
      fields: [createDefaultField('id', 'bigint')],
      position,
      schema: 'public',
    };
    applyErdState([...tablesRef.current, table]);
    setSelectedTableId(table.id);
    setSelectedTableIds(new Set());
    setSelectedRelation(null);
    return table.id;
  }, [applyErdState, pushHistory]);

  const assignDomain = useCallback((domainId: string, tableIds: string[]) => {
    pushHistory();
    const ids = new Set(tableIds);
    const nextTables = tablesRef.current.map((table) => (
      ids.has(table.id) ? { ...table, domainId } : table
    ));
    applyErdState(nextTables);
  }, [applyErdState, pushHistory]);

  const createRelation = useCallback((
    fromTableId: string,
    fromFieldId: string,
    toTableId: string,
    toFieldId: string | null,
  ) => {
    const fromTable = tablesRef.current.find((table) => table.id === fromTableId);
    const toTable = tablesRef.current.find((table) => table.id === toTableId);
    const sourceField = fromTable?.fields.find((field) => field.id === fromFieldId);
    if (!fromTable || !toTable || !sourceField) return false;

    const fkFieldId = sourceField.isPrimaryKey ? toFieldId : fromFieldId;
    if (fkFieldId && relationsRef.current.some((relation) => relation.fromFieldId === fkFieldId)) {
      return false;
    }

    const alreadyHasRelation = relationsRef.current.some((relation) => (
      (relation.fromTableId === fromTableId && relation.fromFieldId === fromFieldId && relation.toTableId === toTableId)
      || (relation.toTableId === fromTableId && relation.toFieldId === fromFieldId && relation.fromTableId === toTableId)
    ));
    if (alreadyHasRelation) return false;

    if (toFieldId) {
      const targetField = toTable.fields.find((field) => field.id === toFieldId);
      if (!targetField) return false;
      const compatibility = getTypeCompatibility(sourceField, targetField);
      if (compatibility === 'forbidden') return false;

      pushHistory();

      if (sourceField.isPrimaryKey) {
        const newRelation: Relation = {
          id: nextWorkspaceId('relation'),
          fromTableId: toTableId,
          fromFieldId: toFieldId,
          toTableId: fromTableId,
          toFieldId: fromFieldId,
          type: '1:N',
        };
        const nextTables = tablesRef.current.map((table) => (
          table.id === toTableId
            ? {
                ...table,
                fields: table.fields.map((field) => (
                  field.id === toFieldId
                    ? { ...field, isForeignKey: true, foreignKeyTable: fromTable.name, foreignKeyField: sourceField.name }
                    : field
                )),
              }
            : table
        ));
        const nextRelations = [
          ...relationsRef.current,
          newRelation,
        ];
        applyErdState(nextTables, nextRelations);
        saveRelation(newRelation);
        return true;
      }

      const newRelation: Relation = {
        id: nextWorkspaceId('relation'),
        fromTableId,
        fromFieldId,
        toTableId,
        toFieldId,
        type: '1:N',
      };
      const nextTables = tablesRef.current.map((table) => (
        table.id === fromTableId
          ? {
              ...table,
              fields: table.fields.map((field) => (
                field.id === fromFieldId
                  ? { ...field, isForeignKey: true, foreignKeyTable: toTable.name, foreignKeyField: targetField.name }
                  : field
              )),
            }
          : table
      ));
      const nextRelations = [
        ...relationsRef.current,
        newRelation,
      ];
      applyErdState(nextTables, nextRelations);
      saveRelation(newRelation);
      return true;
    }

    pushHistory();

    const newFieldId = nextWorkspaceId('field');
    const newFieldName = `${fromTable.name}_${sourceField.name}`;
    const newRelation: Relation = {
      id: nextWorkspaceId('relation'),
      fromTableId: toTableId,
      fromFieldId: newFieldId,
      toTableId: fromTableId,
      toFieldId: fromFieldId,
      type: '1:N',
    };
    const nextTables = tablesRef.current.map((table) => (
      table.id === toTableId
        ? {
            ...table,
            fields: [
              ...table.fields,
              {
                id: newFieldId,
                name: newFieldName,
                type: sourceField.type,
                enumId: sourceField.enumId,
                enumName: sourceField.enumName,
                isPrimaryKey: false,
                isNullable: true,
                isForeignKey: true,
                foreignKeyTable: fromTable.name,
                foreignKeyField: sourceField.name,
              },
            ],
          }
        : table
    ));
    const nextRelations = [
      ...relationsRef.current,
      newRelation,
    ];
    applyErdState(nextTables, nextRelations);
    saveRelation(newRelation);
    return true;
  }, [applyErdState, pushHistory, saveRelation]);

  const toggleTableSelection = useCallback((id: string, additive: boolean) => {
    setSelectedRelation(null);
    setSelectedTableIds((current) => {
      const next = additive ? new Set(current) : new Set<string>();
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedTableId(id);
  }, []);

  const clearMultiSelection = useCallback(() => {
    setSelectedTableIds(new Set());
  }, []);

  const selectTablesInRect = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    const selectedIds = tables
      .filter((table) => {
        const tableRight = table.position.x + ERD_TABLE_WIDTH;
        const tableBottom = table.position.y + estimateErdTableHeight(table);
        return table.position.x <= rect.x + rect.w
          && tableRight >= rect.x
          && table.position.y <= rect.y + rect.h
          && tableBottom >= rect.y;
      })
      .map((table) => table.id);

    setSelectedTableIds(new Set(selectedIds));
    setSelectedTableId(selectedIds[0] ?? null);
    setSelectedRelation(null);
  }, [tables]);

  const selectTableIds = useCallback((tableIds: string[]) => {
    setSelectedTableIds(new Set(tableIds));
    setSelectedTableId(tableIds[0] ?? null);
    setSelectedRelation(null);
  }, []);

  const moveSelectedTables = useCallback((dx: number, dy: number) => {
    setTables((current) => {
      const next = current.map((table) => (
        selectedTableIds.has(table.id)
          ? { ...table, position: { x: table.position.x + dx, y: table.position.y + dy } }
          : table
      ));
      tablesRef.current = next;
      tablePositionsRef.current = createTablePositionMap(next);
      return next;
    });
  }, [selectedTableIds]);

  const autoLayout = useCallback(() => {
    pushHistory();
    const nextTables = tablesRef.current.map((table, index) => ({
      ...table,
      position: {
        x: 120 + (index % 4) * 360,
        y: 120 + Math.floor(index / 4) * 260,
      },
    }));
    tablesRef.current = nextTables;
    tablePositionsRef.current = createTablePositionMap(nextTables);
    setTables(nextTables);
    saveTablePositions(nextTables.map((table) => table.id));
  }, [pushHistory, saveTablePositions]);

  const selectTable = useCallback((tableId: string) => {
    setSelectedTableId(tableId);
    setSelectedTableIds(new Set());
    setSelectedRelation(null);
  }, []);

  const selectFieldTable = useCallback((tableId: string) => {
    setSelectedTableId(tableId);
    setSelectedRelation(null);
  }, []);

  const selectRelation = useCallback((relation: Relation) => {
    setSelectedRelation(relation);
    setSelectedTableId(null);
    setSelectedTableIds(new Set());
  }, []);

  const exportSelectionForClipboard = useCallback(() => {
    const ids = new Set(selectedTableIds);
    if (selectedTableId) ids.add(selectedTableId);
    if (ids.size === 0) return null;

    const selectedTables = tablesRef.current.filter((table) => ids.has(table.id));
    if (selectedTables.length === 0) return null;

    const selectedRelations = relationsRef.current.filter((relation) => (
      ids.has(relation.fromTableId) && ids.has(relation.toTableId)
    ));
    const payload: ErdClipboardPayload = {
      type: WORKSPACE_ERD_CLIPBOARD_TYPE,
      version: WORKSPACE_ERD_CLIPBOARD_VERSION,
      tables: cloneTables(selectedTables),
      relations: cloneRelations(selectedRelations),
    };
    return JSON.stringify(payload);
  }, [selectedTableId, selectedTableIds]);

  const importSelectionFromClipboard = useCallback((content: string, offset = { x: 64, y: 64 }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    const payload = parsed as Partial<ErdClipboardPayload>;
    if (payload.type !== WORKSPACE_ERD_CLIPBOARD_TYPE || payload.version !== WORKSPACE_ERD_CLIPBOARD_VERSION) return null;
    if (!Array.isArray(payload.tables) || !Array.isArray(payload.relations)) return null;
    if (payload.tables.length === 0) return null;

    pushHistory();

    const tableIdMap = new Map<string, string>();
    const fieldIdMap = new Map<string, string>();
    const usedNames = new Set(tablesRef.current.map((table) => table.name.toLowerCase()));
    const pastedTables = cloneTables(payload.tables).map((sourceTable) => {
      const nextTableId = nextWorkspaceId('table');
      tableIdMap.set(sourceTable.id, nextTableId);
      let nextName = sourceTable.name;
      if (usedNames.has(nextName.toLowerCase())) {
        let index = 2;
        while (usedNames.has(`${sourceTable.name}${index}`.toLowerCase())) {
          index += 1;
        }
        nextName = `${sourceTable.name}${index}`;
      }
      usedNames.add(nextName.toLowerCase());
      const nextFields = sourceTable.fields.map((field) => {
        const nextFieldId = nextWorkspaceId('field');
        fieldIdMap.set(field.id, nextFieldId);
        return {
          ...field,
          id: nextFieldId,
        };
      });
      return {
        ...sourceTable,
        id: nextTableId,
        name: nextName,
        position: {
          x: sourceTable.position.x + offset.x,
          y: sourceTable.position.y + offset.y,
        },
        fields: nextFields,
      };
    });

    const pastedRelations = cloneRelations(payload.relations)
      .map((relation) => {
        const fromTableId = tableIdMap.get(relation.fromTableId);
        const toTableId = tableIdMap.get(relation.toTableId);
        const fromFieldId = fieldIdMap.get(relation.fromFieldId);
        const toFieldId = fieldIdMap.get(relation.toFieldId);
        if (!fromTableId || !toTableId || !fromFieldId || !toFieldId) return null;
        return {
          ...relation,
          id: nextWorkspaceId('relation'),
          fromTableId,
          fromFieldId,
          toTableId,
          toFieldId,
        };
      })
      .filter((relation): relation is Relation => Boolean(relation));

    const nextTables = [...tablesRef.current, ...pastedTables];
    const nextRelations = [...relationsRef.current, ...pastedRelations];
    applyErdState(nextTables, nextRelations);
    setSelectedTableId(pastedTables[0]?.id ?? null);
    setSelectedTableIds(new Set(pastedTables.map((table) => table.id)));
    setSelectedRelation(null);

    return {
      tables: pastedTables.length,
      relations: pastedRelations.length,
    };
  }, [applyErdState, pushHistory]);

  return {
    tables,
    relations,
    domains,
    selectedTableId,
    selectedTableIds,
    selectedRelation,
    settings,
    zoomToFitRef,
    highlightRelations,
    setHighlightRelations,
    canUndo,
    canRedo,
    undo,
    redo,
    getTableColor,
    updateTablePosition,
    pushHistory,
    saveTablePosition,
    saveTablePositions,
    reorderField,
    deleteTables,
    updateField,
    updateFieldType,
    addFieldToTable,
    deleteField,
    addTable,
    assignDomain,
    createRelation,
    toggleTableSelection,
    clearMultiSelection,
    selectTablesInRect,
    selectTableIds,
    moveSelectedTables,
    autoLayout,
    selectTable,
    selectFieldTable,
    selectRelation,
    exportSelectionForClipboard,
    importSelectionFromClipboard,
    enabledFieldTypes: settings.enabledFieldTypes ?? ALL_FIELD_TYPES,
    getSnapshot,
  };
}
