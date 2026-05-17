import type { Domain } from './schema';

export const IDEF0_ARROW_ROLES = ['input', 'control', 'output', 'mechanism'] as const;
export type Idef0ArrowRole = typeof IDEF0_ARROW_ROLES[number];

export const IDEF0_FUNCTION_STATUSES = ['draft', 'active', 'deprecated', 'archived'] as const;
export type Idef0FunctionStatus = typeof IDEF0_FUNCTION_STATUSES[number];

export const IDEF0_CONCEPT_STATUSES = ['draft', 'active', 'external', 'deprecated', 'archived'] as const;
export type Idef0ConceptStatus = typeof IDEF0_CONCEPT_STATUSES[number];

export const IDEF0_ARROW_STATUSES = ['required', 'optional', 'conditional'] as const;
export type Idef0ArrowStatus = typeof IDEF0_ARROW_STATUSES[number];

export const IDEF0_CONCEPT_KINDS = [
  'information_object',
  'document',
  'data_set',
  'material_object',
  'state',
  'business_rule',
  'requirement',
  'standard',
  'decision',
  'condition',
  'schema_or_contract',
  'event',
  'state_change',
  'command_or_task',
  'artifact',
  'role',
  'team',
  'system',
  'component',
  'tool',
  'database_or_storage',
  'model_or_agent',
] as const;

export type Idef0ConceptKind = typeof IDEF0_CONCEPT_KINDS[number];

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
}

export interface Idef0Concept {
  id: string;
  name: string;
  kind: Idef0ConceptKind;
  description?: string;
  status: Idef0ConceptStatus;
  domainId?: string;
  ownerId?: string;
  linkedObjectId?: string;
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
