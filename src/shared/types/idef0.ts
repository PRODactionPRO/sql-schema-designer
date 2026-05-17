import type { Domain } from './schema';

export const IDEF0_ARROW_ROLES = ['input', 'control', 'output', 'mechanism'] as const;
export type Idef0ArrowRole = typeof IDEF0_ARROW_ROLES[number];

export const IDEF0_FUNCTION_STATUSES = ['draft', 'active', 'deprecated', 'archived'] as const;
export type Idef0FunctionStatus = typeof IDEF0_FUNCTION_STATUSES[number];

export const IDEF0_CONCEPT_STATUSES = ['draft', 'active', 'external', 'deprecated', 'archived'] as const;
export type Idef0ConceptStatus = typeof IDEF0_CONCEPT_STATUSES[number];

export const IDEF0_ARROW_STATUSES = ['required', 'optional', 'conditional'] as const;
export type Idef0ArrowStatus = typeof IDEF0_ARROW_STATUSES[number];

export const IDEF0_ATTRIBUTE_VALUE_TYPES = ['text', 'number', 'boolean', 'date', 'reference', 'json'] as const;
export type Idef0AttributeValueType = typeof IDEF0_ATTRIBUTE_VALUE_TYPES[number];

export const IDEF0_CONCEPT_KINDS = [
  'dataset',
  'artifact',
  'material_object',
  'state',
  'event',
  'rule',
  'actor',
  'component',
] as const;

export type Idef0ConceptKind = typeof IDEF0_CONCEPT_KINDS[number];

export const IDEF0_CONCEPT_SUBTYPES = [
  'single_field',
  'record',
  'table',
  'payload',
  'data_mart',
  'document',
  'report',
  'file',
  'diagram',
  'migration',
  'business_rule',
  'regulatory_requirement',
  'schema_contract',
  'sla',
  'role',
  'agent',
  'service',
  'database',
  'storage',
  'tool',
  'ui',
  'worker',
  'artifact',
] as const;

export type Idef0ConceptSubtype = typeof IDEF0_CONCEPT_SUBTYPES[number];

export interface Idef0Attribute {
  id: string;
  name: string;
  value?: string;
  valueType?: Idef0AttributeValueType;
  description?: string;
}

export interface Idef0DataReference {
  id: string;
  objectId?: string;
  legacyId?: string;
  classId?: string;
  className?: string;
  attributeId?: string;
  attributeName: string;
  valueType?: string;
  domainId?: string;
  domainName?: string;
}

export interface Idef0Function {
  id: string;
  name: string;
  description?: string;
  status: Idef0FunctionStatus;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  domainId?: string;
  parentFunctionId?: string;
  decompositionDiagramId?: string;
  ownerId?: string;
  sidebarOrder?: number;
  attributes?: Idef0Attribute[];
}

export interface Idef0Concept {
  id: string;
  name: string;
  kind: Idef0ConceptKind;
  subtype?: Idef0ConceptSubtype;
  description?: string;
  status: Idef0ConceptStatus;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  domainId?: string;
  ownerId?: string;
  linkedObjectId?: string;
  dataReferences?: Idef0DataReference[];
  attributes?: Idef0Attribute[];
  metadata?: Record<string, unknown>;
}

export interface Idef0ArrowEndpoint {
  kind: 'function' | 'concept' | 'boundary';
  id?: string;
}

export interface Idef0Arrow {
  id: string;
  role: Idef0ArrowRole;
  source: Idef0ArrowEndpoint;
  target: Idef0ArrowEndpoint;
  conceptId?: string;
  label?: string;
  description?: string;
  status: Idef0ArrowStatus;
  condition?: string;
}

export interface Idef0DiagramModel {
  id?: string;
  processModelId?: string;
  parentFunctionId?: string;
  name?: string;
  functions: Idef0Function[];
  concepts: Idef0Concept[];
  arrows: Idef0Arrow[];
  domains: Domain[];
}

export function createEmptyIdef0Diagram(): Idef0DiagramModel {
  return {
    functions: [],
    concepts: [],
    arrows: [],
    domains: [],
  };
}
