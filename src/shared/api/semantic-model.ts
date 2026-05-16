import type {
  SemanticClassDiagramViewPayload,
  SemanticErdViewPayload,
  SemanticModelObject,
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
