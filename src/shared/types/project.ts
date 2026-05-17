// ── Shared project types ──
// Used across pages/editor (persistence) and pages/projects (listing)

import type { Table, Relation, Domain, EnumType, JsonSchemaDocument, ProjectSettings } from './schema';
import { DEFAULT_PROJECT_SETTINGS } from './schema';
import type { Idef0DiagramModel } from './idef0';
import { createEmptyIdef0Diagram } from './idef0';

export type ProjectDocumentType =
  | 'erd'
  | 'class-diagram'
  | 'idef0'
  | 'bpmn'
  | 'openapi'
  | 'sequence';

export type ClassMemberVisibility = 'public' | 'protected' | 'private';
export type ClassAttributeMultiplicity = 'one' | 'optional' | 'many';
export type ClassEntityKind = 'class' | 'abstract-class' | 'interface' | 'enum' | 'datatype';

export interface ProjectSchemaModel {
  schemaVersion?: number;
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
  jsonSchemas?: JsonSchemaDocument[];
}

export interface ClassAttribute {
  id: string;
  name: string;
  type: string;
  visibility: ClassMemberVisibility;
  multiplicity?: ClassAttributeMultiplicity;
  description?: string;
  required?: boolean;
}

export interface ClassMethod {
  id: string;
  name: string;
  returnType?: string;
  visibility: ClassMemberVisibility;
  parameters?: string;
  description?: string;
}

export interface ClassEntity {
  id: string;
  name: string;
  kind?: ClassEntityKind;
  description?: string;
  attributes: ClassAttribute[];
  methods: ClassMethod[];
  position: { x: number; y: number };
  color?: string;
  domainId?: string;
  mappedTableId?: string;
  sidebarOrder?: number;
}

export type ClassRelationType =
  | 'association'
  | 'inheritance'
  | 'composition'
  | 'aggregation'
  | 'dependency';

export interface ClassRelation {
  id: string;
  fromClassId: string;
  toClassId: string;
  type: ClassRelationType;
  label?: string;
  description?: string;
  fromRole?: string;
  toRole?: string;
  fromMultiplicity?: string;
  toMultiplicity?: string;
}

export interface ClassDiagramModel {
  classes: ClassEntity[];
  relations: ClassRelation[];
  domains: Domain[];
}

export interface ProjectSemanticObjectBinding {
  objectId: string;
  viewNodeId?: string;
  metadata?: unknown;
}

export interface ProjectSemanticRelationBinding {
  relationId: string;
  viewEdgeId?: string;
  metadata?: unknown;
}

export interface ProjectSemanticViewBinding {
  viewId: string;
  objectsByLegacyId: Record<string, ProjectSemanticObjectBinding>;
  relationsByLegacyId?: Record<string, ProjectSemanticRelationBinding>;
}

export interface ProjectSemanticBindings {
  erd?: ProjectSemanticViewBinding;
  classDiagram?: ProjectSemanticViewBinding;
  objectsByLegacyId?: Record<string, ProjectSemanticObjectBinding>;
}

interface ProjectDocumentBase {
  id: string;
  name: string;
  type: ProjectDocumentType;
  description?: string;
  createdAt: string;
  updatedAt: string;
  snapshot?: string;
}

export interface ErdProjectDocument extends ProjectDocumentBase {
  type: 'erd';
  erd: ProjectSchemaModel;
}

export interface ClassDiagramProjectDocument extends ProjectDocumentBase {
  type: 'class-diagram';
  classDiagram: ClassDiagramModel;
}

export interface Idef0ProjectDocument extends ProjectDocumentBase {
  type: 'idef0';
  idef0: Idef0DiagramModel;
}

export interface PlaceholderProjectDocument extends ProjectDocumentBase {
  type: 'bpmn' | 'openapi' | 'sequence';
}

export type ProjectDocument =
  | ErdProjectDocument
  | ClassDiagramProjectDocument
  | Idef0ProjectDocument
  | PlaceholderProjectDocument;

/**
 * Full project data stored in localStorage.
 * Universal JSON format — stores everything needed to
 * fully restore a project including canvas positions.
 */
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  snapshot?: string;    // base64 PNG data URL of the canvas preview
  pinned?: boolean;
  domains: Domain[];
  schema: ProjectSchemaModel;
  documents: ProjectDocument[];
  settings: ProjectSettings;
  semantic?: ProjectSemanticBindings;
}

/** Lightweight metadata shown on the project card (derived, not stored separately) */
export interface ProjectMeta {
  id: string;
  name: string;
  tableCount: number;
  updatedAt: string;
}

export function createEmptyProject(name: string): ProjectData {
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    domains: [],
    schema: {
      schemaVersion: 2,
      tables: [],
      relations: [],
      domains: [],
      enums: [],
      jsonSchemas: [],
    },
    documents: [],
    settings: { ...DEFAULT_PROJECT_SETTINGS },
  };
}

function nextProjectObjectId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyProjectSchema(): ProjectSchemaModel {
  return {
    schemaVersion: 2,
    tables: [],
    relations: [],
    domains: [],
    enums: [],
    jsonSchemas: [],
  };
}

export function createEmptyClassDiagram(): ClassDiagramModel {
  return {
    classes: [],
    relations: [],
    domains: [],
  };
}

export function createErdProjectDocument(name = 'ERD Diagram', schema: ProjectSchemaModel = createEmptyProjectSchema()): ErdProjectDocument {
  const now = new Date().toISOString();
  return {
    id: nextProjectObjectId('doc_erd'),
    name,
    type: 'erd',
    createdAt: now,
    updatedAt: now,
    erd: schema,
  };
}

export function createClassDiagramProjectDocument(name = 'Class Diagram', domains: Domain[] = []): ClassDiagramProjectDocument {
  const now = new Date().toISOString();
  return {
    id: nextProjectObjectId('doc_class'),
    name,
    type: 'class-diagram',
    createdAt: now,
    updatedAt: now,
    classDiagram: {
      ...createEmptyClassDiagram(),
      domains,
    },
  };
}

export function createIdef0ProjectDocument(name = 'IDEF0 Functional Model', domains: Domain[] = []): Idef0ProjectDocument {
  const now = new Date().toISOString();
  return {
    id: nextProjectObjectId('doc_idef0'),
    name,
    type: 'idef0',
    createdAt: now,
    updatedAt: now,
    idef0: {
      ...createEmptyIdef0Diagram(),
      domains,
    },
  };
}

export function getDocumentBadge(type: ProjectDocumentType): string {
  switch (type) {
    case 'erd':
      return 'ERD';
    case 'class-diagram':
      return 'CLASS';
    case 'idef0':
      return 'IDEF0';
    case 'bpmn':
      return 'BPMN';
    case 'openapi':
      return 'API';
    case 'sequence':
      return 'SEQ';
    default:
      return 'DOC';
  }
}

export function getDocumentTypeLabel(type: ProjectDocumentType): string {
  switch (type) {
    case 'erd':
      return 'ERD diagram';
    case 'class-diagram':
      return 'Class diagram';
    case 'idef0':
      return 'IDEF0 functional model';
    case 'bpmn':
      return 'BPMN process';
    case 'openapi':
      return 'OpenAPI contract';
    case 'sequence':
      return 'Sequence diagram';
    default:
      return 'Document';
  }
}
