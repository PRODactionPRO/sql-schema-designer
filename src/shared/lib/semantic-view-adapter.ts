import type {
  ClassDiagramModel,
  ClassEntity,
  ClassEntityKind,
  ClassRelation,
  ClassRelationType,
  ProjectData,
  ProjectSemanticObjectBinding,
  ProjectSemanticViewBinding,
  ProjectSchemaModel,
} from '@/shared/types/project';
import type { Domain, EnumType, JsonSchemaDocument, Relation, Table } from '@/shared/types/schema';
import { DOMAIN_COLORS } from '@/shared/types/schema';
import type {
  SemanticErdViewPayload,
  SemanticClassDiagramViewPayload,
  SemanticModelObject,
  SemanticViewPayload,
  SemanticViewEdge,
  SemanticViewNode,
} from '@/shared/types/semantic-model';
import { normalizeClassDiagram, normalizeProjectSchema } from './schema-normalizer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getObjectMetadata(object: SemanticModelObject): Record<string, unknown> {
  return isRecord(object.metadata) ? object.metadata : {};
}

function getLegacyObjectId(object: SemanticModelObject): string {
  const metadata = getObjectMetadata(object);
  return asString(metadata.id, object.id);
}

function getLegacyRelationId(edge: SemanticViewEdge): string | undefined {
  const relation = edge.relation;
  if (!relation) return undefined;

  const metadata = isRecord(relation.metadata) ? relation.metadata : {};
  return asString(metadata.id, relation.id);
}

function buildViewBinding(
  payload: SemanticViewPayload,
  objectTypes: string | string[],
): ProjectSemanticViewBinding | undefined {
  if (!payload.view) return undefined;

  const allowedObjectTypes = new Set(Array.isArray(objectTypes) ? objectTypes : [objectTypes]);
  const objectsByLegacyId: ProjectSemanticViewBinding['objectsByLegacyId'] = {};
  const relationsByLegacyId: NonNullable<ProjectSemanticViewBinding['relationsByLegacyId']> = {};
  for (const node of payload.view.nodes) {
    if (!allowedObjectTypes.has(node.object.type)) continue;

    objectsByLegacyId[getLegacyObjectId(node.object)] = {
      objectId: node.object.id,
      viewNodeId: node.id,
      metadata: node.object.metadata,
    };
  }

  for (const edge of payload.view.edges) {
    const relationId = getLegacyRelationId(edge);
    if (!relationId || !edge.relation) continue;

    relationsByLegacyId[relationId] = {
      relationId: edge.relation.id,
      viewEdgeId: edge.id,
      metadata: edge.relation.metadata,
    };
  }

  return {
    viewId: payload.view.id,
    objectsByLegacyId,
    ...(Object.keys(relationsByLegacyId).length > 0 ? { relationsByLegacyId } : {}),
  };
}

function buildObjectBindings(payload: SemanticViewPayload): Record<string, ProjectSemanticObjectBinding> {
  const objectsByLegacyId: Record<string, ProjectSemanticObjectBinding> = {};

  for (const object of payload.context.objects) {
    objectsByLegacyId[getLegacyObjectId(object)] = {
      objectId: object.id,
      metadata: object.metadata,
    };
  }

  for (const node of payload.view?.nodes ?? []) {
    objectsByLegacyId[getLegacyObjectId(node.object)] = {
      objectId: node.object.id,
      viewNodeId: node.id,
      metadata: node.object.metadata,
    };
  }

  return objectsByLegacyId;
}

function getDomainColor(object: SemanticModelObject, index: number): string {
  const metadata = getObjectMetadata(object);
  return asString(metadata.color, DOMAIN_COLORS[index % DOMAIN_COLORS.length] ?? '#6366f1');
}

function mapDomainObject(object: SemanticModelObject, index: number): Domain {
  const metadata = getObjectMetadata(object);
  return {
    id: getLegacyObjectId(object),
    name: asString(metadata.name, object.name),
    color: getDomainColor(object, index),
  };
}

function mapEnumObject(object: SemanticModelObject): EnumType {
  const metadata = getObjectMetadata(object);
  return {
    ...(metadata as Partial<EnumType>),
    id: getLegacyObjectId(object),
    name: asString(metadata.name, object.name),
    values: Array.isArray(metadata.values) ? metadata.values.filter((value): value is string => typeof value === 'string') : [],
    description: asOptionalString(metadata.description) ?? object.description ?? undefined,
  };
}

function mapEnumNode(node: SemanticViewNode): EnumType | null {
  if (node.object.type !== 'enum') return null;

  return {
    ...mapEnumObject(node.object),
    position: { x: node.x, y: node.y },
  };
}

function mapJsonSchemaObject(object: SemanticModelObject): JsonSchemaDocument {
  const metadata = getObjectMetadata(object);
  return {
    ...(metadata as Partial<JsonSchemaDocument>),
    id: getLegacyObjectId(object),
    name: asString(metadata.name, object.name),
    description: asOptionalString(metadata.description) ?? object.description ?? undefined,
    nodes: Array.isArray(metadata.nodes) ? metadata.nodes as JsonSchemaDocument['nodes'] : [],
  };
}

function mapJsonSchemaNode(node: SemanticViewNode): JsonSchemaDocument | null {
  if (node.object.type !== 'json_schema') return null;

  return {
    ...mapJsonSchemaObject(node.object),
    position: { x: node.x, y: node.y },
  };
}

function mapTableNode(node: SemanticViewNode): Table | null {
  if (node.object.type !== 'table') return null;

  const metadata = getObjectMetadata(node.object);
  return {
    ...(metadata as Partial<Table>),
    id: getLegacyObjectId(node.object),
    name: asString(metadata.name, node.object.name),
    description: asOptionalString(metadata.description) ?? node.object.description ?? undefined,
    fields: Array.isArray(metadata.fields) ? metadata.fields as Table['fields'] : [],
    constraints: Array.isArray(metadata.constraints) ? metadata.constraints as Table['constraints'] : undefined,
    indexes: Array.isArray(metadata.indexes) ? metadata.indexes as Table['indexes'] : undefined,
    position: {
      x: asNumber(node.x, isRecord(metadata.position) ? asNumber(metadata.position.x, 0) : 0),
      y: asNumber(node.y, isRecord(metadata.position) ? asNumber(metadata.position.y, 0) : 0),
    },
    color: asOptionalString(metadata.color),
    schema: asOptionalString(metadata.schema),
    domainId: asOptionalString(metadata.domainId),
    sidebarOrder: typeof metadata.sidebarOrder === 'number' ? metadata.sidebarOrder : undefined,
  };
}

function getEdgeObjectId(edge: SemanticViewEdge, side: 'source' | 'target'): string | undefined {
  const node = side === 'source' ? edge.sourceViewNode : edge.targetViewNode;
  return node ? getLegacyObjectId(node.object) : undefined;
}

function mapRelationEdge(edge: SemanticViewEdge): Relation | null {
  const relation = edge.relation;
  if (!relation) return null;

  const metadata = isRecord(relation.metadata) ? relation.metadata : {};
  const fromTableId = asString(metadata.fromTableId, getEdgeObjectId(edge, 'source') ?? relation.sourceObjectId);
  const toTableId = asString(metadata.toTableId, getEdgeObjectId(edge, 'target') ?? relation.targetObjectId);
  const fromFieldId = asString(metadata.fromFieldId);
  const toFieldId = asString(metadata.toFieldId);

  if (!fromTableId || !toTableId || !fromFieldId || !toFieldId) {
    return null;
  }

  return {
    id: asString(metadata.id, relation.id),
    fromTableId,
    fromFieldId,
    toTableId,
    toFieldId,
    type: asRelationType(metadata.type),
  };
}

function asRelationType(value: unknown): Relation['type'] {
  return value === '1:1' || value === '1:N' || value === 'N:1' || value === 'N:M' ? value : '1:N';
}

function asClassEntityKind(value: unknown): ClassEntityKind {
  return value === 'abstract-class' || value === 'interface' || value === 'enum' || value === 'datatype'
    ? value
    : 'class';
}

function asClassRelationType(value: unknown): ClassRelationType {
  return value === 'inheritance' || value === 'composition' || value === 'aggregation' || value === 'dependency'
    ? value
    : 'association';
}

function mapContextObjects(payload: SemanticViewPayload) {
  const objects = payload.context.objects;
  return {
    domains: objects.filter((object) => object.type === 'domain').map(mapDomainObject),
    enums: objects.filter((object) => object.type === 'enum').map(mapEnumObject),
    jsonSchemas: objects.filter((object) => object.type === 'json_schema').map(mapJsonSchemaObject),
  };
}

export function semanticErdViewToProjectSchema(
  payload: SemanticErdViewPayload,
  fallbackSchema: ProjectSchemaModel,
): ProjectSchemaModel {
  const view = payload.view;
  if (!view) return fallbackSchema;

  const context = mapContextObjects(payload);
  const tables = view.nodes.flatMap((node) => {
    const table = mapTableNode(node);
    return table ? [table] : [];
  });
  const nodeEnums = view.nodes.flatMap((node) => {
    const enumType = mapEnumNode(node);
    return enumType ? [enumType] : [];
  });
  const nodeJsonSchemas = view.nodes.flatMap((node) => {
    const jsonSchema = mapJsonSchemaNode(node);
    return jsonSchema ? [jsonSchema] : [];
  });
  const relations = view.edges.flatMap((edge) => {
    const relation = mapRelationEdge(edge);
    return relation ? [relation] : [];
  });

  return normalizeProjectSchema({
    ...fallbackSchema,
    tables,
    relations,
    domains: context.domains.length > 0 ? context.domains : fallbackSchema.domains,
    enums: nodeEnums.length > 0 ? nodeEnums : context.enums,
    jsonSchemas: nodeJsonSchemas.length > 0 ? nodeJsonSchemas : context.jsonSchemas,
  });
}

export function applySemanticErdViewToProject(
  project: ProjectData | undefined,
  payload: SemanticErdViewPayload | null | undefined,
): ProjectData | undefined {
  if (!project || !payload?.view) return project;

  const schema = semanticErdViewToProjectSchema(payload, project.schema);
  return {
    ...project,
    schema,
    domains: schema.domains,
    semantic: {
      ...project.semantic,
      erd: buildViewBinding(payload, ['table', 'enum', 'json_schema']),
      objectsByLegacyId: {
        ...project.semantic?.objectsByLegacyId,
        ...buildObjectBindings(payload),
      },
    },
    documents: project.documents.map((document) => (
      document.type === 'erd'
        ? { ...document, erd: schema, updatedAt: payload.view?.updatedAt ?? document.updatedAt }
        : document
    )),
  };
}

function mapClassNode(node: SemanticViewNode): ClassEntity | null {
  if (node.object.type !== 'entity') return null;

  const metadata = getObjectMetadata(node.object);
  return {
    ...(metadata as Partial<ClassEntity>),
    id: getLegacyObjectId(node.object),
    name: asString(metadata.name, node.object.name),
    kind: asClassEntityKind(metadata.kind),
    description: asOptionalString(metadata.description) ?? node.object.description ?? undefined,
    attributes: Array.isArray(metadata.attributes) ? metadata.attributes as ClassEntity['attributes'] : [],
    methods: Array.isArray(metadata.methods) ? metadata.methods as ClassEntity['methods'] : [],
    position: {
      x: asNumber(node.x, isRecord(metadata.position) ? asNumber(metadata.position.x, 0) : 0),
      y: asNumber(node.y, isRecord(metadata.position) ? asNumber(metadata.position.y, 0) : 0),
    },
    color: asOptionalString(metadata.color),
    domainId: asOptionalString(metadata.domainId),
    mappedTableId: asOptionalString(metadata.mappedTableId),
    sidebarOrder: typeof metadata.sidebarOrder === 'number' ? metadata.sidebarOrder : undefined,
  };
}

function mapClassRelationEdge(edge: SemanticViewEdge): ClassRelation | null {
  const relation = edge.relation;
  if (!relation) return null;

  const metadata = isRecord(relation.metadata) ? relation.metadata : {};
  const fromClassId = asString(metadata.fromClassId, getEdgeObjectId(edge, 'source') ?? relation.sourceObjectId);
  const toClassId = asString(metadata.toClassId, getEdgeObjectId(edge, 'target') ?? relation.targetObjectId);

  if (!fromClassId || !toClassId) return null;

  return {
    id: asString(metadata.id, relation.id),
    fromClassId,
    toClassId,
    type: asClassRelationType(metadata.type ?? relation.type),
    label: asOptionalString(metadata.label),
    description: asOptionalString(metadata.description),
    fromRole: asOptionalString(metadata.fromRole),
    toRole: asOptionalString(metadata.toRole),
    fromMultiplicity: asOptionalString(metadata.fromMultiplicity),
    toMultiplicity: asOptionalString(metadata.toMultiplicity),
  };
}

export function semanticClassViewToClassDiagram(
  payload: SemanticClassDiagramViewPayload,
  fallbackDiagram: ClassDiagramModel,
): ClassDiagramModel {
  const view = payload.view;
  if (!view) return fallbackDiagram;

  const context = mapContextObjects(payload);
  const diagram = {
    ...fallbackDiagram,
    classes: view.nodes.flatMap((node) => {
      const entity = mapClassNode(node);
      return entity ? [entity] : [];
    }),
    relations: view.edges.flatMap((edge) => {
      const relation = mapClassRelationEdge(edge);
      return relation ? [relation] : [];
    }),
    domains: context.domains.length > 0 ? context.domains : fallbackDiagram.domains,
  };

  return normalizeClassDiagram(diagram, diagram.domains);
}

export function applySemanticClassViewToProject(
  project: ProjectData | undefined,
  payload: SemanticClassDiagramViewPayload | null | undefined,
): ProjectData | undefined {
  if (!project || !payload?.view) return project;

  let updatedExistingDocument = false;
  const documents = project.documents.map((document) => {
    if (document.type !== 'class-diagram' || updatedExistingDocument) return document;
    updatedExistingDocument = true;
    return {
      ...document,
      classDiagram: semanticClassViewToClassDiagram(payload, document.classDiagram),
      updatedAt: payload.view?.updatedAt ?? document.updatedAt,
    };
  });

  return {
    ...project,
    semantic: {
      ...project.semantic,
      classDiagram: buildViewBinding(payload, 'entity'),
      objectsByLegacyId: {
        ...project.semantic?.objectsByLegacyId,
        ...buildObjectBindings(payload),
      },
    },
    documents,
  };
}

export function applySemanticViewsToProject(
  project: ProjectData | undefined,
  views: {
    erd?: SemanticErdViewPayload | null;
    classDiagram?: SemanticClassDiagramViewPayload | null;
  },
): ProjectData | undefined {
  return applySemanticClassViewToProject(
    applySemanticErdViewToProject(project, views.erd),
    views.classDiagram,
  );
}
