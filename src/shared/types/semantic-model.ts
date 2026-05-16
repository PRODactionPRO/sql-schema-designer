export interface SemanticModelObject {
  id: string;
  projectId: string;
  type: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  domainId?: string | null;
  parentId?: string | null;
  status: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SemanticModelRelation {
  id: string;
  projectId: string;
  sourceObjectId: string;
  targetObjectId: string;
  type: string;
  direction: string;
  cardinalitySource?: string | null;
  cardinalityTarget?: string | null;
  required: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SemanticViewNode {
  id: string;
  viewId: string;
  objectId: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  collapsed: boolean;
  visible: boolean;
  style: unknown;
  settings: unknown;
  object: SemanticModelObject;
}

export interface SemanticViewEdge {
  id: string;
  viewId: string;
  relationId?: string | null;
  sourceViewNodeId: string;
  targetViewNodeId: string;
  isModelRelation: boolean;
  routing?: unknown;
  visible: boolean;
  style: unknown;
  relation?: SemanticModelRelation | null;
  sourceViewNode?: SemanticViewNode;
  targetViewNode?: SemanticViewNode;
}

export interface SemanticModelView {
  id: string;
  projectId: string;
  type: string;
  name: string;
  description?: string | null;
  scope: unknown;
  filters: unknown;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  nodes: SemanticViewNode[];
  edges: SemanticViewEdge[];
}

export interface SemanticViewPayload {
  view: SemanticModelView | null;
  context: {
    objects: SemanticModelObject[];
  };
}

export type SemanticErdViewPayload = SemanticViewPayload;
export type SemanticClassDiagramViewPayload = SemanticViewPayload;
