import type {
  ClassDiagramProjectDocument,
  ClassEntity,
  ProjectData,
  ProjectSemanticObjectBinding,
  ProjectSemanticRelationBinding,
} from '@/shared/types/project';
import type { Domain, EnumType, FieldType, JsonSchemaDocument, Table } from '@/shared/types/schema';
import type { WorkspaceSelection } from './types';
import {
  objectMetadata,
  updateSemanticObjectProjection,
} from './semantic-object-commands';

export const ENUM_TABLE_PREFIX = 'enum::';
export const JSON_SCHEMA_TABLE_PREFIX = 'jsonschema::';
export const ENUM_HEADER_FIELD_ID = '__enum_header__';
export const JSON_SCHEMA_HEADER_FIELD_ID = '__json_schema_header__';

export function getProjectDomains(project: ProjectData): Domain[] {
  return project.domains.length > 0 ? project.domains : project.schema.domains;
}

export function nextWorkspaceId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getObjectBinding(project: ProjectData, legacyId: string): ProjectSemanticObjectBinding | undefined {
  return project.semantic?.objectsByLegacyId?.[legacyId]
    ?? project.semantic?.erd?.objectsByLegacyId[legacyId]
    ?? project.semantic?.classDiagram?.objectsByLegacyId[legacyId];
}

export function getRelationBinding(
  project: ProjectData,
  legacyId: string,
  sourceView?: 'erd' | 'classDiagram',
): ProjectSemanticRelationBinding | undefined {
  if (sourceView === 'erd') return project.semantic?.erd?.relationsByLegacyId?.[legacyId];
  if (sourceView === 'classDiagram') return project.semantic?.classDiagram?.relationsByLegacyId?.[legacyId];

  return project.semantic?.erd?.relationsByLegacyId?.[legacyId]
    ?? project.semantic?.classDiagram?.relationsByLegacyId?.[legacyId];
}

export function saveObjectMetadata(project: ProjectData, legacyId: string, metadata: unknown): void {
  const binding = getObjectBinding(project, legacyId);
  if (!binding) return;

  const baseMetadata = objectMetadata(binding.metadata);
  const nextMetadata = objectMetadata(metadata);
  const mergedMetadata = {
    ...baseMetadata,
    ...nextMetadata,
  };

  updateSemanticObjectProjection({
    projectId: project.id,
    binding,
    metadata: mergedMetadata,
  });
}

export function withSchema(project: ProjectData, schema: ProjectData['schema']): ProjectData {
  return {
    ...project,
    domains: schema.domains,
    schema,
    documents: project.documents.map((document) => (
      document.type === 'erd'
        ? { ...document, erd: schema, updatedAt: new Date().toISOString() }
        : document
    )),
  };
}

export function withClassDiagram(project: ProjectData, diagram: ClassDiagramProjectDocument['classDiagram']): ProjectData {
  return {
    ...project,
    documents: project.documents.map((document) => (
      document.type === 'class-diagram'
        ? { ...document, classDiagram: diagram, updatedAt: new Date().toISOString() }
        : document
    )),
  };
}

export function updateProjectBinding(
  project: ProjectData,
  legacyId: string,
  objectId: string,
  metadata: unknown,
  viewNodeId?: string,
): ProjectData {
  return {
    ...project,
    semantic: {
      ...project.semantic,
      objectsByLegacyId: {
        ...project.semantic?.objectsByLegacyId,
        [legacyId]: { objectId, metadata, viewNodeId },
      },
    },
  };
}

export function getClassDiagramDocument(project?: ProjectData): ClassDiagramProjectDocument | undefined {
  return project?.documents.find((document): document is ClassDiagramProjectDocument => document.type === 'class-diagram');
}

export function getClassDiagram(project?: ProjectData): ClassDiagramProjectDocument['classDiagram'] | undefined {
  return getClassDiagramDocument(project)?.classDiagram;
}

export function updateClassInProject(project: ProjectData, classId: string, updates: Partial<ClassEntity>): {
  project: ProjectData;
  entity: ClassEntity | null;
} {
  const classDiagram = getClassDiagram(project);
  if (!classDiagram) return { project, entity: null };

  let updatedEntity: ClassEntity | null = null;
  const nextDiagram = {
    ...classDiagram,
    classes: classDiagram.classes.map((entity) => {
      if (entity.id !== classId) return entity;
      updatedEntity = { ...entity, ...updates };
      return updatedEntity;
    }),
  };

  return {
    project: withClassDiagram(project, nextDiagram),
    entity: updatedEntity,
  };
}

export function enumToTable(enumType: EnumType, domains: Domain[], index = 0): Table {
  return {
    id: `${ENUM_TABLE_PREFIX}${enumType.id}`,
    name: enumType.name,
    description: enumType.description,
    notes: enumType.notes,
    fields: enumType.values.map((value, valueIndex) => ({
      id: `${enumType.id}::value::${valueIndex}`,
      name: value,
      comment: enumType.valueMetadata?.[valueIndex]?.description ?? enumType.valueComments?.[valueIndex],
      type: 'enum' as FieldType,
      enumId: enumType.id,
      enumName: enumType.name,
      isPrimaryKey: false,
      isNullable: false,
      isForeignKey: false,
    })),
    position: enumType.position ?? { x: 260 + index * 40, y: 140 + index * 40 },
    color: enumType.domainId
      ? domains.find((domain) => domain.id === enumType.domainId)?.color ?? '#0f766e'
      : '#0f766e',
    domainId: enumType.domainId,
    sidebarOrder: enumType.sidebarOrder,
  };
}

export function isEnumTableId(id: string): boolean {
  return id.startsWith(ENUM_TABLE_PREFIX);
}

export function getEnumIdFromTableId(id: string): string {
  return id.slice(ENUM_TABLE_PREFIX.length);
}

export function isJsonSchemaTableId(id: string): boolean {
  return id.startsWith(JSON_SCHEMA_TABLE_PREFIX);
}

export function getJsonSchemaIdFromTableId(id: string): string {
  return id.slice(JSON_SCHEMA_TABLE_PREFIX.length);
}

export function getEnumValueIndex(fieldId: string): number {
  const rawIndex = Number(fieldId.split('::value::')[1]);
  return Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : -1;
}

interface FlattenedJsonSchemaNode {
  node: JsonSchemaDocument['nodes'][number];
  depth: number;
  hasChildren: boolean;
}

export function flattenJsonSchemaNodes(nodes: JsonSchemaDocument['nodes']): FlattenedJsonSchemaNode[] {
  const childrenByParent = new Map<string | undefined, JsonSchemaDocument['nodes']>();
  for (const node of nodes) {
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node);
    childrenByParent.set(node.parentId, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const flattened: FlattenedJsonSchemaNode[] = [];
  const walk = (parentId: string | undefined, depth: number) => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      const hasChildren = (childrenByParent.get(child.id) ?? []).length > 0;
      flattened.push({ node: child, depth, hasChildren });
      if (hasChildren && !child.collapsed) walk(child.id, depth + 1);
    }
  };

  walk(undefined, 0);
  return flattened;
}

export function jsonSchemaToTable(doc: JsonSchemaDocument, index = 0): Table {
  const flattened = flattenJsonSchemaNodes(doc.nodes);
  return {
    id: `${JSON_SCHEMA_TABLE_PREFIX}${doc.id}`,
    name: doc.name,
    description: doc.description,
    notes: doc.notes,
    fields: flattened.map(({ node }) => ({
      id: `${doc.id}::node::${node.id}`,
      name: node.name,
      type: 'jsonb' as FieldType,
      comment: `${node.type}${node.nullable ? ' | null' : ''}`,
      isPrimaryKey: false,
      isNullable: true,
      isForeignKey: false,
    })),
    position: doc.position ?? { x: 320 + index * 40, y: 220 + index * 40 },
    color: '#7c3aed',
    domainId: doc.domainId,
    sidebarOrder: doc.sidebarOrder,
  };
}

export function getJsonSchemaFieldMeta(doc: JsonSchemaDocument): Record<string, { depth: number; hasChildren: boolean; collapsed: boolean; schemaType: string }> {
  const meta: Record<string, { depth: number; hasChildren: boolean; collapsed: boolean; schemaType: string }> = {};
  for (const row of flattenJsonSchemaNodes(doc.nodes)) {
    meta[`${doc.id}::node::${row.node.id}`] = {
      depth: row.depth,
      hasChildren: row.hasChildren,
      collapsed: !!row.node.collapsed,
      schemaType: row.node.type,
    };
  }
  return meta;
}

export function selectionMatches(selection: WorkspaceSelection | null, candidate: WorkspaceSelection): boolean {
  return selection?.kind === candidate.kind
    && selection.id === candidate.id
    && selection.parentId === candidate.parentId
    && selection.sourceView === candidate.sourceView;
}

export function asPropertyValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'not set';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  return String(value);
}
