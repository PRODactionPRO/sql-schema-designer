import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Canvas } from '@/pages/editor/ui/Canvas';
import {
  createObjectInViewCommand,
  deleteObjectFromViewCommand,
  moveViewNodeCommand,
} from '@/shared/api/semantic-model';
import type { CanvasViewport } from '@/shared/ui/useCanvasNavigation';
import type { Field, JsonSchemaDocument, JsonSchemaFieldType, Relation, Table } from '@/shared/types/schema';
import type { ProjectData } from '@/shared/types/project';
import type { WorkspaceSelection } from '../model/types';
import { useWorkspaceErdCanvas } from '../model/useWorkspaceErdCanvas';
import {
  ENUM_HEADER_FIELD_ID,
  JSON_SCHEMA_HEADER_FIELD_ID,
  enumToTable,
  getEnumIdFromTableId,
  getEnumValueIndex,
  getJsonSchemaFieldMeta,
  getJsonSchemaIdFromTableId,
  isEnumTableId,
  isJsonSchemaTableId,
  jsonSchemaToTable,
  nextWorkspaceId,
  getObjectBinding,
  saveObjectMetadata,
  updateProjectBinding,
  withSchema,
} from '../model/workspace-project-utils';
import { WorkspaceFloatingCanvasToolbar } from './WorkspaceFloatingCanvasToolbar';

function getUniqueName(existingNames: string[], baseName: string): string {
  const used = new Set(existingNames.map((name) => name.toLowerCase()));
  if (!used.has(baseName.toLowerCase())) return baseName;

  let index = 2;
  while (used.has(`${baseName}${index}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName}${index}`;
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return items;
  next.splice(toIndex, 0, item);
  return next;
}

export function ProjectErDiagramCanvas({
  project,
  initialViewport,
  viewportRestoreKey,
  onProjectChange,
  onSelectionChange,
  onViewportChange,
}: {
  project: ProjectData;
  initialViewport?: CanvasViewport;
  viewportRestoreKey?: string | number;
  onProjectChange?: (project: ProjectData) => void;
  onSelectionChange?: (selection: WorkspaceSelection | null) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
}) {
  const canvas = useWorkspaceErdCanvas(project);
  const viewportRef = useRef<{ pan: { x: number; y: number }; zoom: number; width: number; height: number } | null>(null);
  const projectedObjectCreatesRef = useRef(new Set<string>());
  const jsonSchemas = useMemo(() => project.schema.jsonSchemas ?? [], [project.schema.jsonSchemas]);
  const projectedEnumTables = useMemo(() => (
    project.schema.enums.map((enumType, index) => enumToTable(enumType, canvas.domains, index))
  ), [canvas.domains, project.schema.enums]);
  const projectedJsonSchemaTables = useMemo(() => (
    jsonSchemas.map((doc, index) => jsonSchemaToTable(doc, index))
  ), [jsonSchemas]);
  const jsonSchemaFieldMetaByTableId = useMemo(() => (
    new Map(jsonSchemas.map((doc) => [`jsonschema::${doc.id}`, getJsonSchemaFieldMeta(doc)]))
  ), [jsonSchemas]);
  const projectedEnumRelations = useMemo<Relation[]>(() => (
    canvas.tables.flatMap((table) => (
      table.fields
        .filter((field) => field.type === 'enum' && field.enumId)
        .map((field) => ({
          id: `enumrel::${table.id}::${field.id}::${field.enumId}`,
          fromTableId: table.id,
          fromFieldId: field.id,
          toTableId: `enum::${field.enumId}`,
          toFieldId: ENUM_HEADER_FIELD_ID,
          type: '1:N' as const,
        }))
    ))
  ), [canvas.tables]);
  const projectedJsonSchemaRelations = useMemo<Relation[]>(() => (
    canvas.tables.flatMap((table) => (
      table.fields
        .filter((field) => Boolean(field.jsonSchemaId))
        .map((field) => ({
          id: `jsonrel::${table.id}::${field.id}::${field.jsonSchemaId}`,
          fromTableId: table.id,
          fromFieldId: field.id,
          toTableId: `jsonschema::${field.jsonSchemaId}`,
          toFieldId: JSON_SCHEMA_HEADER_FIELD_ID,
          type: '1:N' as const,
        }))
    ))
  ), [canvas.tables]);
  const canvasTables = useMemo(() => (
    [...canvas.tables, ...projectedEnumTables, ...projectedJsonSchemaTables]
      .sort((a, b) => (a.sidebarOrder ?? Number.MAX_SAFE_INTEGER) - (b.sidebarOrder ?? Number.MAX_SAFE_INTEGER))
  ), [canvas.tables, projectedEnumTables, projectedJsonSchemaTables]);
  const canvasRelations = useMemo(() => (
    [...canvas.relations, ...projectedEnumRelations, ...projectedJsonSchemaRelations]
  ), [canvas.relations, projectedEnumRelations, projectedJsonSchemaRelations]);

  const commitCanvasSnapshot = useCallback(() => {
    if (!onProjectChange) return;
    const snapshot = canvas.getSnapshot();
    onProjectChange(withSchema(project, {
      ...project.schema,
      tables: snapshot.tables,
      relations: snapshot.relations,
    }));
  }, [canvas, onProjectChange, project]);

  const commitSchema = useCallback((schema: ProjectData['schema']) => {
    onProjectChange?.(withSchema(project, schema));
  }, [onProjectChange, project]);

  const createObjectTableInView = useCallback((
    legacyId: string,
    type: 'enum' | 'json_schema',
    name: string,
    metadata: Record<string, unknown>,
    position: { x: number; y: number },
    nextProject: ProjectData,
  ) => {
    const viewId = project.semantic?.erd?.viewId;
    if (!viewId) return;

    void createObjectInViewCommand(project.id, {
      viewId,
      type,
      name,
      metadata,
      position,
    }).then(({ object, node }) => {
      onProjectChange?.(updateProjectBinding(nextProject, legacyId, object.id, metadata, node.id));
    }).catch((error) => {
      console.error('[workspace] Failed to create semantic table object', error);
    });
  }, [onProjectChange, project.id, project.semantic?.erd?.viewId]);

  const saveProjectedObject = useCallback((legacyId: string, metadata: unknown) => {
    const binding = getObjectBinding(project, legacyId);
    if (binding) {
      saveObjectMetadata(project, legacyId, metadata);
      return;
    }

    const viewId = project.semantic?.erd?.viewId;
    if (!viewId || projectedObjectCreatesRef.current.has(legacyId)) return;

    const enumType = project.schema.enums.find((item) => item.id === legacyId);
    const jsonSchema = (project.schema.jsonSchemas ?? []).find((item) => item.id === legacyId);
    const source = enumType ?? jsonSchema;
    if (!source) return;

    const objectType = enumType ? 'enum' : 'json_schema';
    const position = source.position ?? (
      enumType
        ? { x: 260 + project.schema.enums.findIndex((item) => item.id === legacyId) * 40, y: 140 + project.schema.enums.findIndex((item) => item.id === legacyId) * 40 }
        : { x: 320 + (project.schema.jsonSchemas ?? []).findIndex((item) => item.id === legacyId) * 40, y: 220 + (project.schema.jsonSchemas ?? []).findIndex((item) => item.id === legacyId) * 40 }
    );

    projectedObjectCreatesRef.current.add(legacyId);
    void createObjectInViewCommand(project.id, {
      viewId,
      type: objectType,
      name: source.name,
      metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata as Record<string, unknown>
        : { ...source },
      position,
    }).then(({ object, node }) => {
      onProjectChange?.(updateProjectBinding(project, legacyId, object.id, object.metadata, node.id));
    }).catch((error) => {
      console.error('[workspace] Failed to create projected semantic object', error);
    }).finally(() => {
      projectedObjectCreatesRef.current.delete(legacyId);
    });
  }, [onProjectChange, project]);

  const saveProjectedObjectPosition = useCallback((legacyId: string, position: { x: number; y: number }) => {
    const binding = getObjectBinding(project, legacyId);
    const viewId = project.semantic?.erd?.viewId;
    if (!binding?.viewNodeId || !viewId) {
      const enumType = project.schema.enums.find((item) => item.id === legacyId);
      const jsonSchema = (project.schema.jsonSchemas ?? []).find((item) => item.id === legacyId);
      const source = enumType ?? jsonSchema;
      if (source) saveProjectedObject(legacyId, { ...source, position });
      return;
    }

    void moveViewNodeCommand(project.id, {
      viewId,
      nodeId: binding.viewNodeId,
      ...position,
    }).catch((error) => {
      console.error('[workspace] Failed to save semantic table position', error);
    });
  }, [project, saveProjectedObject]);

  const deleteProjectedObject = useCallback((legacyId: string) => {
    const binding = getObjectBinding(project, legacyId);
    if (!binding) return;

    void deleteObjectFromViewCommand(project.id, {
      objectId: binding.objectId,
      viewId: project.semantic?.erd?.viewId,
    }).catch((error) => {
      console.error('[workspace] Failed to delete semantic table object', error);
    });
  }, [project]);

  const createRegularTableInView = useCallback((table: Table, nextProject: ProjectData) => {
    const viewId = project.semantic?.erd?.viewId;
    if (!viewId) return;

    void createObjectInViewCommand(project.id, {
      viewId,
      type: 'table',
      name: table.name,
      description: table.description,
      domainId: table.domainId,
      metadata: { ...table },
      position: table.position,
    }).then(({ object, node }) => {
      onProjectChange?.(updateProjectBinding(nextProject, table.id, object.id, object.metadata, node.id));
    }).catch((error) => {
      console.error('[workspace] Failed to create semantic table object', error);
    });
  }, [onProjectChange, project.id, project.semantic?.erd?.viewId]);

  const deleteRegularTableObject = useCallback((tableId: string) => {
    const binding = getObjectBinding(project, tableId);
    if (!binding) return;

    void deleteObjectFromViewCommand(project.id, {
      objectId: binding.objectId,
      viewId: project.semantic?.erd?.viewId,
    }).catch((error) => {
      console.error('[workspace] Failed to delete semantic table object', error);
    });
  }, [project]);

  const commitSchemaWithCanvasSnapshot = useCallback((schemaUpdates: Partial<ProjectData['schema']> = {}) => {
    if (!onProjectChange) return;
    const snapshot = canvas.getSnapshot();
    onProjectChange(withSchema(project, {
      ...project.schema,
      tables: snapshot.tables,
      relations: snapshot.relations,
      ...schemaUpdates,
    }));
  }, [canvas, onProjectChange, project]);

  const createEnumTable = useCallback((position?: { x: number; y: number }) => {
    const name = getUniqueName(project.schema.enums.map((item) => item.name), 'NewEnum');
    const enumType = {
      id: nextWorkspaceId('enum'),
      name,
      values: ['value_1', 'value_2'],
      storageStrategy: 'postgres_enum' as const,
      position,
    };
    const nextProject = withSchema(project, {
      ...project.schema,
      enums: [
        ...project.schema.enums,
        enumType,
      ],
    });
    onProjectChange?.(nextProject);
    createObjectTableInView(
      enumType.id,
      'enum',
      enumType.name,
      { ...enumType },
      enumType.position ?? { x: 260 + project.schema.enums.length * 40, y: 140 + project.schema.enums.length * 40 },
      nextProject,
    );
    toast.success(`Created ENAM "${name}"`);
  }, [createObjectTableInView, onProjectChange, project]);

  const createJsonSchemaTable = useCallback((position?: { x: number; y: number }) => {
    const name = getUniqueName(jsonSchemas.map((item) => item.name), 'NewJsonSchema');
    const doc: JsonSchemaDocument = {
      id: nextWorkspaceId('json_schema'),
      name,
      rootType: 'object',
      nodes: [
        {
          id: nextWorkspaceId('json_node'),
          name: 'root',
          type: 'object',
          order: 0,
        },
      ],
      position,
    };
    const nextProject = withSchema(project, {
      ...project.schema,
      jsonSchemas: [...jsonSchemas, doc],
    });
    onProjectChange?.(nextProject);
    createObjectTableInView(
      doc.id,
      'json_schema',
      doc.name,
      { ...doc },
      doc.position ?? { x: 320 + jsonSchemas.length * 40, y: 220 + jsonSchemas.length * 40 },
      nextProject,
    );
    toast.success(`Created JSON Schema "${name}"`);
  }, [createObjectTableInView, jsonSchemas, onProjectChange, project]);

  const updateProjectedTablePosition = useCallback((tableId: string, position: { x: number; y: number }) => {
    if (isEnumTableId(tableId)) {
      const enumId = getEnumIdFromTableId(tableId);
      let updatedEnum = project.schema.enums.find((enumType) => enumType.id === enumId);
      commitSchema({
        ...project.schema,
        enums: project.schema.enums.map((enumType) => {
          if (enumType.id !== enumId) return enumType;
          updatedEnum = { ...enumType, position };
          return updatedEnum;
        }),
      });
      if (updatedEnum) {
        saveProjectedObject(enumId, updatedEnum);
        saveProjectedObjectPosition(enumId, position);
      }
      return true;
    }
    if (isJsonSchemaTableId(tableId)) {
      const jsonSchemaId = getJsonSchemaIdFromTableId(tableId);
      let updatedDocument = jsonSchemas.find((doc) => doc.id === jsonSchemaId);
      commitSchema({
        ...project.schema,
        jsonSchemas: jsonSchemas.map((doc) => {
          if (doc.id !== jsonSchemaId) return doc;
          updatedDocument = { ...doc, position };
          return updatedDocument;
        }),
      });
      if (updatedDocument) {
        saveProjectedObject(jsonSchemaId, updatedDocument);
        saveProjectedObjectPosition(jsonSchemaId, position);
      }
      return true;
    }
    return false;
  }, [commitSchema, jsonSchemas, project.schema, saveProjectedObject, saveProjectedObjectPosition]);

  const handleTablePositionChange = useCallback((tableId: string, position: { x: number; y: number }) => {
    if (updateProjectedTablePosition(tableId, position)) return;
    canvas.updateTablePosition(tableId, position);
  }, [canvas, updateProjectedTablePosition]);

  const handleTableSelect = useCallback((tableId: string) => {
    canvas.selectTable(tableId);
    if (isEnumTableId(tableId)) {
      onSelectionChange?.({ kind: 'enum', id: getEnumIdFromTableId(tableId), sourceView: 'erd' });
      return;
    }
    if (isJsonSchemaTableId(tableId)) {
      onSelectionChange?.({ kind: 'jsonSchema', id: getJsonSchemaIdFromTableId(tableId), sourceView: 'erd' });
      return;
    }
    onSelectionChange?.({ kind: 'table', id: tableId, sourceView: 'erd' });
  }, [canvas, onSelectionChange]);

  const handleFieldSelect = useCallback((tableId: string, fieldId: string) => {
    canvas.selectFieldTable(tableId);
    if (isEnumTableId(tableId)) {
      onSelectionChange?.({ kind: 'enum', id: getEnumIdFromTableId(tableId), sourceView: 'erd' });
      return;
    }
    if (isJsonSchemaTableId(tableId)) {
      onSelectionChange?.({ kind: 'jsonSchema', id: getJsonSchemaIdFromTableId(tableId), sourceView: 'erd' });
      return;
    }
    onSelectionChange?.({ kind: 'field', id: fieldId, parentId: tableId, sourceView: 'erd' });
  }, [canvas, onSelectionChange]);

  const handleSelectTablesInRect = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    const selectedIds = canvasTables
      .filter((table) => {
        const right = table.position.x + 280;
        const bottom = table.position.y + 40 + table.fields.length * 36;
        return table.position.x <= rect.x + rect.w
          && right >= rect.x
          && table.position.y <= rect.y + rect.h
          && bottom >= rect.y;
      })
      .map((table) => table.id);
    canvas.selectTableIds(selectedIds);
  }, [canvas, canvasTables]);

  const handleMoveSelectedTables = useCallback((dx: number, dy: number) => {
    const selectedIds = Array.from(canvas.selectedTableIds);
    const regularSelectedIds = selectedIds.filter((id) => !isEnumTableId(id) && !isJsonSchemaTableId(id));
    const hasProjectedSelection = selectedIds.some((id) => isEnumTableId(id) || isJsonSchemaTableId(id));
    if (regularSelectedIds.length > 0) {
      canvas.moveSelectedTables(dx, dy);
    }
    if (!hasProjectedSelection) return;

    const nextEnums = project.schema.enums.map((enumType) => (
      canvas.selectedTableIds.has(`enum::${enumType.id}`)
        ? {
            ...enumType,
            position: {
              x: (enumType.position?.x ?? 260) + dx,
              y: (enumType.position?.y ?? 140) + dy,
            },
          }
        : enumType
    ));
    const nextJsonSchemas = jsonSchemas.map((doc) => (
      canvas.selectedTableIds.has(`jsonschema::${doc.id}`)
        ? {
            ...doc,
            position: {
              x: (doc.position?.x ?? 320) + dx,
              y: (doc.position?.y ?? 220) + dy,
            },
          }
        : doc
    ));

    commitSchemaWithCanvasSnapshot({
      enums: nextEnums,
      jsonSchemas: nextJsonSchemas,
    });
    nextEnums
      .filter((enumType) => canvas.selectedTableIds.has(`enum::${enumType.id}`))
      .forEach((enumType) => {
        saveProjectedObject(enumType.id, enumType);
        if (enumType.position) saveProjectedObjectPosition(enumType.id, enumType.position);
      });
    nextJsonSchemas
      .filter((doc) => canvas.selectedTableIds.has(`jsonschema::${doc.id}`))
      .forEach((doc) => {
        saveProjectedObject(doc.id, doc);
        if (doc.position) saveProjectedObjectPosition(doc.id, doc.position);
      });
  }, [canvas, commitSchemaWithCanvasSnapshot, jsonSchemas, project.schema.enums, saveProjectedObject, saveProjectedObjectPosition]);

  const handleDeleteTables = useCallback((tableIds: string[]) => {
    const enumIds = tableIds.filter(isEnumTableId).map(getEnumIdFromTableId);
    const jsonSchemaIds = tableIds.filter(isJsonSchemaTableId).map(getJsonSchemaIdFromTableId);
    const regularTableIds = tableIds.filter((id) => !isEnumTableId(id) && !isJsonSchemaTableId(id));

    if (regularTableIds.length > 0) {
      canvas.deleteTables(regularTableIds);
      regularTableIds.forEach(deleteRegularTableObject);
    }
    enumIds.forEach(deleteProjectedObject);
    jsonSchemaIds.forEach(deleteProjectedObject);

    commitSchemaWithCanvasSnapshot({
      enums: enumIds.length > 0
        ? project.schema.enums.filter((enumType) => !enumIds.includes(enumType.id))
        : project.schema.enums,
      jsonSchemas: jsonSchemaIds.length > 0
        ? jsonSchemas.filter((doc) => !jsonSchemaIds.includes(doc.id))
        : jsonSchemas,
    });
  }, [canvas, commitSchemaWithCanvasSnapshot, deleteProjectedObject, deleteRegularTableObject, jsonSchemas, project.schema.enums]);

  const handleAssignDomain = useCallback((domainId: string, tableIds: string[]) => {
    const enumIds = tableIds.filter(isEnumTableId).map(getEnumIdFromTableId);
    const jsonSchemaIds = tableIds.filter(isJsonSchemaTableId).map(getJsonSchemaIdFromTableId);
    const regularTableIds = tableIds.filter((id) => !isEnumTableId(id) && !isJsonSchemaTableId(id));

    if (regularTableIds.length > 0) {
      canvas.assignDomain(domainId, regularTableIds);
    }

    const nextEnums = project.schema.enums.map((enumType) => (
        enumIds.includes(enumType.id) ? { ...enumType, domainId } : enumType
      ));
    const nextJsonSchemas = jsonSchemas.map((doc) => (
        jsonSchemaIds.includes(doc.id) ? { ...doc, domainId } : doc
      ));

    commitSchemaWithCanvasSnapshot({
      enums: nextEnums,
      jsonSchemas: nextJsonSchemas,
    });
    nextEnums.filter((enumType) => enumIds.includes(enumType.id)).forEach((enumType) => saveProjectedObject(enumType.id, enumType));
    nextJsonSchemas.filter((doc) => jsonSchemaIds.includes(doc.id)).forEach((doc) => saveProjectedObject(doc.id, doc));
  }, [canvas, commitSchemaWithCanvasSnapshot, jsonSchemas, project.schema.enums, saveProjectedObject]);

  const handleReorderEnumValue = useCallback((enumTableId: string, fromIndex: number, toIndex: number) => {
    const enumId = getEnumIdFromTableId(enumTableId);
    let updatedEnum = project.schema.enums.find((enumType) => enumType.id === enumId);
    commitSchema({
      ...project.schema,
      enums: project.schema.enums.map((enumType) => {
        if (enumType.id !== enumId) return enumType;
        updatedEnum = {
          ...enumType,
          values: moveArrayItem(enumType.values, fromIndex, toIndex),
          valueComments: enumType.valueComments ? moveArrayItem(enumType.valueComments, fromIndex, toIndex) : enumType.valueComments,
          valueMetadata: enumType.valueMetadata ? moveArrayItem(enumType.valueMetadata, fromIndex, toIndex) : enumType.valueMetadata,
        };
        return updatedEnum;
      }),
    });
    if (updatedEnum) saveProjectedObject(enumId, updatedEnum);
  }, [commitSchema, project.schema, saveProjectedObject]);

  const handleJsonSchemaToggleCollapse = useCallback((tableId: string, fieldId: string) => {
    if (!isJsonSchemaTableId(tableId)) return;
    const jsonSchemaId = getJsonSchemaIdFromTableId(tableId);
    const nodeId = fieldId.split('::node::')[1];
    if (!nodeId) return;
    let updatedDocument = jsonSchemas.find((doc) => doc.id === jsonSchemaId);
    commitSchema({
      ...project.schema,
      jsonSchemas: jsonSchemas.map((doc) => {
        if (doc.id !== jsonSchemaId) return doc;
        updatedDocument = {
              ...doc,
              nodes: doc.nodes.map((node) => (
                node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node
              )),
            };
        return updatedDocument;
      }),
    });
    if (updatedDocument) saveProjectedObject(jsonSchemaId, updatedDocument);
  }, [commitSchema, jsonSchemas, project.schema, saveProjectedObject]);

  const handleJsonSchemaFieldTypeChange = useCallback((tableId: string, fieldId: string, schemaType: string) => {
    if (!isJsonSchemaTableId(tableId)) return;
    const jsonSchemaId = getJsonSchemaIdFromTableId(tableId);
    const nodeId = fieldId.split('::node::')[1];
    if (!nodeId) return;
    let updatedDocument = jsonSchemas.find((doc) => doc.id === jsonSchemaId);
    commitSchema({
      ...project.schema,
      jsonSchemas: jsonSchemas.map((doc) => {
        if (doc.id !== jsonSchemaId) return doc;
        updatedDocument = {
              ...doc,
              nodes: doc.nodes.map((node) => (
                node.id === nodeId ? { ...node, type: schemaType as JsonSchemaFieldType } : node
              )),
            };
        return updatedDocument;
      }),
    });
    if (updatedDocument) saveProjectedObject(jsonSchemaId, updatedDocument);
  }, [commitSchema, jsonSchemas, project.schema, saveProjectedObject]);

  const handleCopySelection = useCallback(async () => {
    const payload = canvas.exportSelectionForClipboard();
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Copied selected tables');
    } catch {
      toast.error('Cannot access clipboard in this browser context');
    }
  }, [canvas]);

  const handlePasteSelection = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error('Cannot read clipboard in this browser context');
      return;
    }

    let pasteOffset: { x: number; y: number } | undefined;
    try {
      const parsed = JSON.parse(text) as { tables?: Array<{ position?: { x: number; y: number } }> };
      const positions = (parsed.tables ?? [])
        .map((item) => item.position)
        .filter((position): position is { x: number; y: number } => Boolean(position));
      const viewport = viewportRef.current;
      if (positions.length > 0 && viewport) {
        const minX = Math.min(...positions.map((position) => position.x));
        const maxX = Math.max(...positions.map((position) => position.x));
        const minY = Math.min(...positions.map((position) => position.y));
        const maxY = Math.max(...positions.map((position) => position.y));
        const sourceCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const viewportCenter = {
          x: (-viewport.pan.x + viewport.width / 2) / viewport.zoom,
          y: (-viewport.pan.y + viewport.height / 2) / viewport.zoom,
        };
        pasteOffset = {
          x: viewportCenter.x - sourceCenter.x,
          y: viewportCenter.y - sourceCenter.y,
        };
      }
    } catch {
      // Clipboard shape is validated by the canvas model.
    }

    const result = canvas.importSelectionFromClipboard(text, pasteOffset);
    if (!result) {
      toast.error('Clipboard does not contain copied canvas tables');
      return;
    }
    commitCanvasSnapshot();
    toast.success(`Pasted ${result.tables} table${result.tables === 1 ? '' : 's'} and ${result.relations} relation${result.relations === 1 ? '' : 's'}`);
  }, [canvas, commitCanvasSnapshot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable
        || Boolean(target?.closest('.cm-editor'));
      if (isTyping) return;

      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.shiftKey) return;
      if (event.code === 'KeyC') {
        event.preventDefault();
        void handleCopySelection();
      }
      if (event.code === 'KeyV') {
        event.preventDefault();
        void handlePasteSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCopySelection, handlePasteSelection]);

  const handleFieldUpdate = useCallback((tableId: string, fieldId: string, updates: Partial<Field>) => {
    if (isEnumTableId(tableId)) {
      const enumId = getEnumIdFromTableId(tableId);
      const valueIndex = getEnumValueIndex(fieldId);
      if (valueIndex < 0) return;
      let updatedEnum = project.schema.enums.find((enumType) => enumType.id === enumId);
      commitSchema({
        ...project.schema,
        enums: project.schema.enums.map((enumType) => {
          if (enumType.id !== enumId || valueIndex >= enumType.values.length) return enumType;
          const nextValues = [...enumType.values];
          const nextComments = [...(enumType.valueComments ?? enumType.values.map(() => undefined))];
          if (typeof updates.name === 'string') nextValues[valueIndex] = updates.name;
          if (Object.prototype.hasOwnProperty.call(updates, 'comment')) {
            nextComments[valueIndex] = updates.comment?.trim() || undefined;
          }
          updatedEnum = {
            ...enumType,
            values: nextValues,
            valueComments: nextComments,
          };
          return updatedEnum;
        }),
      });
      if (updatedEnum) saveProjectedObject(enumId, updatedEnum);
      return;
    }

    if (isJsonSchemaTableId(tableId)) {
      const jsonSchemaId = getJsonSchemaIdFromTableId(tableId);
      const nodeId = fieldId.split('::node::')[1];
      if (!nodeId) return;
      let updatedDocument = jsonSchemas.find((doc) => doc.id === jsonSchemaId);
      commitSchema({
        ...project.schema,
        jsonSchemas: jsonSchemas.map((doc) => {
          if (doc.id !== jsonSchemaId) return doc;
          updatedDocument = {
                ...doc,
                nodes: doc.nodes.map((node) => (
                  node.id === nodeId
                    ? {
                        ...node,
                        name: typeof updates.name === 'string' ? updates.name : node.name,
                        description: Object.prototype.hasOwnProperty.call(updates, 'comment')
                          ? updates.comment?.trim() || undefined
                          : node.description,
                      }
                    : node
                )),
              };
          return updatedDocument;
        }),
      });
      if (updatedDocument) saveProjectedObject(jsonSchemaId, updatedDocument);
      return;
    }

    canvas.updateField(tableId, fieldId, updates);
    commitCanvasSnapshot();
  }, [canvas, commitCanvasSnapshot, commitSchema, jsonSchemas, project.schema, saveProjectedObject]);

  const handleFieldTypeChange = useCallback((tableId: string, fieldId: string, type: Field['type']) => {
    if (isJsonSchemaTableId(tableId)) {
      handleJsonSchemaFieldTypeChange(tableId, fieldId, type);
      return;
    }
    if (isEnumTableId(tableId)) return;
    canvas.updateFieldType(tableId, fieldId, type);
    commitCanvasSnapshot();
  }, [canvas, commitCanvasSnapshot, handleJsonSchemaFieldTypeChange]);

  const handleDeleteField = useCallback((tableId: string, fieldId: string) => {
    if (isEnumTableId(tableId)) {
      const enumId = getEnumIdFromTableId(tableId);
      const valueIndex = getEnumValueIndex(fieldId);
      if (valueIndex < 0) return;
      let updatedEnum = project.schema.enums.find((enumType) => enumType.id === enumId);
      commitSchema({
        ...project.schema,
        enums: project.schema.enums.map((enumType) => {
          if (enumType.id !== enumId || valueIndex >= enumType.values.length) return enumType;
          updatedEnum = {
            ...enumType,
            values: enumType.values.filter((_, index) => index !== valueIndex),
            valueComments: enumType.valueComments?.filter((_, index) => index !== valueIndex),
            valueMetadata: enumType.valueMetadata?.filter((_, index) => index !== valueIndex),
          };
          return updatedEnum;
        }),
      });
      if (updatedEnum) saveProjectedObject(enumId, updatedEnum);
      return;
    }
    if (isJsonSchemaTableId(tableId)) {
      const jsonSchemaId = getJsonSchemaIdFromTableId(tableId);
      const nodeId = fieldId.split('::node::')[1];
      if (!nodeId) return;
      let updatedDocument = jsonSchemas.find((doc) => doc.id === jsonSchemaId);
      commitSchema({
        ...project.schema,
        jsonSchemas: jsonSchemas.map((doc) => {
          if (doc.id !== jsonSchemaId) return doc;
          updatedDocument = {
                ...doc,
                nodes: doc.nodes
                  .filter((node) => node.id !== nodeId && node.parentId !== nodeId)
                  .map((node, index) => ({ ...node, order: index })),
              };
          return updatedDocument;
        }),
      });
      if (updatedDocument) saveProjectedObject(jsonSchemaId, updatedDocument);
      return;
    }
    canvas.deleteField(tableId, fieldId);
    commitCanvasSnapshot();
  }, [canvas, commitCanvasSnapshot, commitSchema, jsonSchemas, project.schema, saveProjectedObject]);

  const handleAddFieldToTable = useCallback((tableId: string) => {
    if (isEnumTableId(tableId)) {
      const enumId = getEnumIdFromTableId(tableId);
      let updatedEnum = project.schema.enums.find((enumType) => enumType.id === enumId);
      commitSchema({
        ...project.schema,
        enums: project.schema.enums.map((enumType) => {
          if (enumType.id !== enumId) return enumType;
          updatedEnum = { ...enumType, values: [...enumType.values, `value_${enumType.values.length + 1}`] };
          return updatedEnum;
        }),
      });
      if (updatedEnum) saveProjectedObject(enumId, updatedEnum);
      return;
    }
    if (isJsonSchemaTableId(tableId)) {
      const jsonSchemaId = getJsonSchemaIdFromTableId(tableId);
      let updatedDocument = jsonSchemas.find((doc) => doc.id === jsonSchemaId);
      commitSchema({
        ...project.schema,
        jsonSchemas: jsonSchemas.map((doc) => {
          if (doc.id !== jsonSchemaId) return doc;
          updatedDocument = {
                ...doc,
                nodes: [
                  ...doc.nodes,
                  {
                    id: nextWorkspaceId('json_node'),
                    name: `field_${doc.nodes.length + 1}`,
                    type: 'json',
                    order: doc.nodes.length,
                  },
                ],
              };
          return updatedDocument;
        }),
      });
      if (updatedDocument) saveProjectedObject(jsonSchemaId, updatedDocument);
      return;
    }
    canvas.addFieldToTable(tableId);
    commitCanvasSnapshot();
  }, [canvas, commitCanvasSnapshot, commitSchema, jsonSchemas, project.schema, saveProjectedObject]);

  const handleCreateRelation = useCallback((fromTableId: string, fromFieldId: string, toTableId: string, toFieldId: string | null) => {
    if (isEnumTableId(fromTableId) || isJsonSchemaTableId(fromTableId)) return;

    if (isEnumTableId(toTableId)) {
      const enumId = getEnumIdFromTableId(toTableId);
      const enumType = project.schema.enums.find((item) => item.id === enumId);
      const sourceTable = canvas.tables.find((table) => table.id === fromTableId);
      const sourceField = sourceTable?.fields.find((field) => field.id === fromFieldId);
      if (!enumType || !sourceField) return;
      canvas.updateField(fromTableId, fromFieldId, {
        type: 'enum',
        enumId,
        enumName: enumType.name,
        jsonSchemaId: undefined,
        jsonSchemaName: undefined,
      });
      commitCanvasSnapshot();
      toast.success(`Field "${sourceField.name}" linked to ENAM "${enumType.name}"`);
      return;
    }

    if (isJsonSchemaTableId(toTableId)) {
      const jsonSchemaId = getJsonSchemaIdFromTableId(toTableId);
      const jsonSchemaDoc = jsonSchemas.find((doc) => doc.id === jsonSchemaId);
      const sourceTable = canvas.tables.find((table) => table.id === fromTableId);
      const sourceField = sourceTable?.fields.find((field) => field.id === fromFieldId);
      if (!jsonSchemaDoc || !sourceField) return;
      canvas.updateField(fromTableId, fromFieldId, {
        type: 'jsonb',
        jsonSchemaId,
        jsonSchemaName: jsonSchemaDoc.name,
        enumId: undefined,
        enumName: undefined,
      });
      commitCanvasSnapshot();
      toast.success(`Field "${sourceField.name}" linked to JSON Schema "${jsonSchemaDoc.name}"`);
      return;
    }

    if (canvas.createRelation(fromTableId, fromFieldId, toTableId, toFieldId)) {
      commitCanvasSnapshot();
    }
  }, [canvas, commitCanvasSnapshot, jsonSchemas, project.schema.enums]);

  return (
    <div className="canvas-surface relative size-full overflow-hidden">
      <Canvas
        tables={canvasTables}
        relations={canvasRelations}
        domains={canvas.domains}
        selectedTableId={canvas.selectedTableId}
        selectedTableIds={canvas.selectedTableIds}
        selectedRelation={canvas.selectedRelation}
        onTableSelect={handleTableSelect}
        onTablePositionChange={handleTablePositionChange}
        onTableDelete={(tableId) => {
          handleDeleteTables([tableId]);
        }}
        onFieldClick={handleFieldSelect}
        onRelationSelect={(relation) => {
          if (relation.id.startsWith('enumrel::') || relation.id.startsWith('jsonrel::')) return;
          canvas.selectRelation(relation);
          onSelectionChange?.({ kind: 'relation', id: relation.id, sourceView: 'erd' });
        }}
        onAutoLayout={() => {
          canvas.autoLayout();
          commitCanvasSnapshot();
        }}
        onToggleTableSelection={canvas.toggleTableSelection}
        onSelectTablesInRect={handleSelectTablesInRect}
        onClearMultiSelection={canvas.clearMultiSelection}
        onMoveSelectedTables={handleMoveSelectedTables}
        onDeleteTables={handleDeleteTables}
        onTableDragStop={(tableId) => {
          if (isEnumTableId(tableId) || isJsonSchemaTableId(tableId)) return;
          canvas.saveTablePosition(tableId);
          commitCanvasSnapshot();
        }}
        onTablesDragStop={(tableIds) => {
          const regularTableIds = tableIds.filter((tableId) => !isEnumTableId(tableId) && !isJsonSchemaTableId(tableId));
          if (regularTableIds.length === 0) return;
          canvas.saveTablePositions(regularTableIds);
          commitCanvasSnapshot();
        }}
        getTableColor={canvas.getTableColor}
        lineType={canvas.settings.lineType}
        enabledFieldTypes={canvas.enabledFieldTypes}
        viewportRef={viewportRef}
        zoomToFitRef={canvas.zoomToFitRef}
        highlightRelations={canvas.highlightRelations}
        onPushHistory={canvas.pushHistory}
        initialViewport={initialViewport}
        viewportRestoreKey={viewportRestoreKey}
        onViewportChange={onViewportChange}
        onReorderField={(tableId, fromIndex, toIndex) => {
          if (isEnumTableId(tableId)) {
            handleReorderEnumValue(tableId, fromIndex, toIndex);
            return;
          }
          if (isJsonSchemaTableId(tableId)) return;
          canvas.reorderField(tableId, fromIndex, toIndex);
          commitCanvasSnapshot();
        }}
        onFieldTypeChange={handleFieldTypeChange}
        onUpdateField={handleFieldUpdate}
        onDeleteField={handleDeleteField}
        onCreateRelation={handleCreateRelation}
        onAddTable={(position) => {
          const tableId = canvas.addTable(position);
          const snapshot = canvas.getSnapshot();
          const table = snapshot.tables.find((item) => item.id === tableId);
          const nextProject = withSchema(project, {
            ...project.schema,
            tables: snapshot.tables,
            relations: snapshot.relations,
          });
          onProjectChange?.(nextProject);
          if (table) createRegularTableInView(table, nextProject);
        }}
        isEnumTableId={isEnumTableId}
        isJsonSchemaTableId={isJsonSchemaTableId}
        getJsonSchemaFieldMeta={(tableId) => jsonSchemaFieldMetaByTableId.get(tableId) ?? {}}
        onJsonSchemaToggleCollapse={handleJsonSchemaToggleCollapse}
        onJsonSchemaFieldTypeChange={handleJsonSchemaFieldTypeChange}
        onAddEnumTable={createEnumTable}
        onAddJsonSchemaTable={createJsonSchemaTable}
        onReorderEnumValue={handleReorderEnumValue}
        onAddFieldToTable={handleAddFieldToTable}
        onAssignDomain={handleAssignDomain}
      />
      <WorkspaceFloatingCanvasToolbar
        canUndo={canvas.canUndo}
        canRedo={canvas.canRedo}
        highlightRelations={canvas.highlightRelations}
        onUndo={canvas.undo}
        onRedo={canvas.redo}
        onAutoLayout={() => {
          canvas.autoLayout();
          commitCanvasSnapshot();
        }}
        onZoomToFit={() => canvas.zoomToFitRef.current?.()}
        onToggleHighlightRelations={() => canvas.setHighlightRelations((current) => !current)}
      />
    </div>
  );
}
