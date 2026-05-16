import { apiRequest } from './http';

export interface WorkspaceLayoutPreferencePayload {
  projectId: string;
  userId: string;
  state: unknown;
  updatedAt: string | null;
}

export function getWorkspaceLayoutPreference(projectId: string) {
  return apiRequest<WorkspaceLayoutPreferencePayload>(`/projects/${projectId}/workspace-layout`);
}

export function updateWorkspaceLayoutPreference(projectId: string, state: Record<string, unknown>) {
  return apiRequest<WorkspaceLayoutPreferencePayload>(`/projects/${projectId}/workspace-layout`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
  });
}
