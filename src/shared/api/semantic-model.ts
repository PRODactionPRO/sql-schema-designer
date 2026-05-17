import type {
  SemanticClassDiagramViewPayload,
  SemanticErdViewPayload,
  SemanticModelObject,
  SemanticModelRelation,
  SemanticModelView,
  SemanticViewEdge,
  SemanticViewNode,
} from '@/shared/types/semantic-model';
import { apiRequest } from './http';

export interface CreateSemanticModelObjectPayload {
  type: string;
  name: string;
  slug?: string;
  description?: string;
  domainId?: string;
  parentId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSemanticViewCommandPayload {
  type: string;
  name: string;
  description?: string;
  scope?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface CreateObjectInViewCommandPayload extends CreateSemanticModelObjectPayload {
  viewId: string;
  position: { x: number; y: number };
  node?: {
    width?: number;
    height?: number;
    collapsed?: boolean;
    visible?: boolean;
    style?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
}

export interface UpdateObjectCommandPayload {
  objectId: string;
  name?: string;
  slug?: string;
  description?: string;
  domainId?: string;
  parentId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface MoveViewNodeCommandPayload {
  viewId: string;
  nodeId: string;
  x: number;
  y: number;
}

export interface DeleteObjectFromViewCommandPayload {
  objectId: string;
  viewId?: string;
  deleteObject?: boolean;
}

export interface CreateRelationInViewCommandPayload {
  viewId: string;
  sourceViewNodeId: string;
  targetViewNodeId: string;
  type: string;
  direction?: string;
  cardinalitySource?: string;
  cardinalityTarget?: string;
  required?: boolean;
  metadata?: Record<string, unknown>;
  edge?: {
    visible?: boolean;
    routing?: Record<string, unknown>;
    style?: Record<string, unknown>;
  };
}

export interface UpdateRelationCommandPayload {
  relationId?: string;
  legacyRelationId?: string;
  type?: string;
  direction?: string;
  cardinalitySource?: string;
  cardinalityTarget?: string;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DeleteRelationFromViewCommandPayload {
  relationId?: string;
  legacyRelationId?: string;
  viewId?: string;
  deleteRelation?: boolean;
}

export function getPrimaryErdSemanticView(projectId: string): Promise<SemanticErdViewPayload> {
  return apiRequest<SemanticErdViewPayload>(`/projects/${projectId}/semantic/views/primary-erd`);
}

export function getPrimaryClassDiagramSemanticView(projectId: string): Promise<SemanticClassDiagramViewPayload> {
  return apiRequest<SemanticClassDiagramViewPayload>(`/projects/${projectId}/semantic/views/primary-class-diagram`);
}

export function updateSemanticViewNodePosition(
  projectId: string,
  viewId: string,
  nodeId: string,
  position: { x: number; y: number },
): Promise<SemanticViewNode> {
  return apiRequest<SemanticViewNode>(
    `/projects/${projectId}/semantic/views/${encodeURIComponent(viewId)}/nodes/${encodeURIComponent(nodeId)}/position`,
    {
      method: 'PATCH',
      body: JSON.stringify(position),
    },
  );
}

export function updateSemanticObjectMetadata(
  projectId: string,
  objectId: string,
  metadata: Record<string, unknown>,
): Promise<SemanticModelObject> {
  return apiRequest<SemanticModelObject>(
    `/projects/${projectId}/semantic/objects/${encodeURIComponent(objectId)}/metadata`,
    {
      method: 'PATCH',
      body: JSON.stringify({ metadata }),
    },
  );
}

export function createSemanticModelObject(
  projectId: string,
  payload: CreateSemanticModelObjectPayload,
): Promise<SemanticModelObject> {
  return apiRequest<SemanticModelObject>(
    `/projects/${projectId}/semantic/objects`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function deleteSemanticModelObject(
  projectId: string,
  objectId: string,
): Promise<SemanticModelObject> {
  return apiRequest<SemanticModelObject>(
    `/projects/${projectId}/semantic/objects/${encodeURIComponent(objectId)}`,
    {
      method: 'DELETE',
    },
  );
}

export function createSemanticViewCommand(
  projectId: string,
  payload: CreateSemanticViewCommandPayload,
): Promise<SemanticModelView> {
  return apiRequest<SemanticModelView>(
    `/projects/${projectId}/semantic/commands/create-view`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function createObjectInViewCommand(
  projectId: string,
  payload: CreateObjectInViewCommandPayload,
): Promise<{ object: SemanticModelObject; node: SemanticViewNode }> {
  return apiRequest<{ object: SemanticModelObject; node: SemanticViewNode }>(
    `/projects/${projectId}/semantic/commands/create-object-in-view`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function updateObjectCommand(
  projectId: string,
  payload: UpdateObjectCommandPayload,
): Promise<SemanticModelObject> {
  return apiRequest<SemanticModelObject>(
    `/projects/${projectId}/semantic/commands/update-object`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function moveViewNodeCommand(
  projectId: string,
  payload: MoveViewNodeCommandPayload,
): Promise<SemanticViewNode> {
  return apiRequest<SemanticViewNode>(
    `/projects/${projectId}/semantic/commands/move-view-node`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function deleteObjectFromViewCommand(
  projectId: string,
  payload: DeleteObjectFromViewCommandPayload,
): Promise<{ object: SemanticModelObject | null; hiddenNodeIds: string[] }> {
  return apiRequest<{ object: SemanticModelObject | null; hiddenNodeIds: string[] }>(
    `/projects/${projectId}/semantic/commands/delete-object-from-view`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function createRelationInViewCommand(
  projectId: string,
  payload: CreateRelationInViewCommandPayload,
): Promise<{ relation: SemanticModelRelation; edge: SemanticViewEdge }> {
  return apiRequest<{ relation: SemanticModelRelation; edge: SemanticViewEdge }>(
    `/projects/${projectId}/semantic/commands/create-relation-in-view`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function updateRelationCommand(
  projectId: string,
  payload: UpdateRelationCommandPayload,
): Promise<SemanticModelRelation> {
  return apiRequest<SemanticModelRelation>(
    `/projects/${projectId}/semantic/commands/update-relation`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function deleteRelationFromViewCommand(
  projectId: string,
  payload: DeleteRelationFromViewCommandPayload,
): Promise<{ relation: SemanticModelRelation | null; hiddenEdgeIds: string[] }> {
  return apiRequest<{ relation: SemanticModelRelation | null; hiddenEdgeIds: string[] }>(
    `/projects/${projectId}/semantic/commands/delete-relation-from-view`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
