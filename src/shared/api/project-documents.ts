import type { ProjectDocument, ProjectDocumentType } from '@/shared/types/project';
import { apiRequest } from './http';

function getDocumentPayload(document: ProjectDocument): Record<string, unknown> {
  if (document.type === 'erd') {
    return document.erd as unknown as Record<string, unknown>;
  }
  if (document.type === 'class-diagram') {
    return document.classDiagram as unknown as Record<string, unknown>;
  }
  return {};
}

export async function createProjectDocument(
  projectId: string,
  document: ProjectDocument,
): Promise<ProjectDocument> {
  return apiRequest<ProjectDocument>(`/projects/${projectId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      id: document.id,
      type: document.type,
      name: document.name,
      description: document.description,
      payload: getDocumentPayload(document),
      snapshot: document.snapshot,
    }),
  });
}

export async function updateProjectDocument(
  projectId: string,
  documentId: string,
  payload: {
    type?: ProjectDocumentType;
    name?: string;
    description?: string;
    documentPayload?: Record<string, unknown>;
    snapshot?: string;
  },
): Promise<ProjectDocument> {
  return apiRequest<ProjectDocument>(`/projects/${projectId}/documents/${documentId}`, {
    method: 'PUT',
    body: JSON.stringify({
      type: payload.type,
      name: payload.name,
      description: payload.description,
      payload: payload.documentPayload,
      snapshot: payload.snapshot,
    }),
  });
}

export function deleteProjectDocument(projectId: string, documentId: string) {
  return apiRequest<{ success: true }>(`/projects/${projectId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}
