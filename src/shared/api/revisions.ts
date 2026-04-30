import { apiRequest } from './http';

export interface ProjectRevision {
  id: string;
  projectId: string;
  revision: number;
  schemaJson: unknown;
  comment: string | null;
  authorId: string;
  createdAt: string;
}

export async function getProjectRevisions(projectId: string): Promise<ProjectRevision[]> {
  return apiRequest<ProjectRevision[]>(`/projects/${projectId}/revisions`);
}

export async function createProjectRevision(
  projectId: string,
  payload: { schemaJson: Record<string, unknown>; comment?: string },
): Promise<ProjectRevision> {
  return apiRequest<ProjectRevision>(`/projects/${projectId}/revisions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function restoreProjectRevision(
  projectId: string,
  revision: number,
): Promise<ProjectRevision> {
  return apiRequest<ProjectRevision>(`/projects/${projectId}/revisions/${revision}/restore`, {
    method: 'POST',
  });
}

export async function deleteProjectRevision(
  projectId: string,
  revisionId: string,
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/projects/${projectId}/revisions/${revisionId}`, {
    method: 'DELETE',
  });
}
