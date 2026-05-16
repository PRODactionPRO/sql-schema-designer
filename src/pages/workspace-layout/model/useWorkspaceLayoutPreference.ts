import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getWorkspaceLayoutPreference, updateWorkspaceLayoutPreference } from '@/shared/api/workspace-layout';
import type { WorkspaceLayoutSnapshot } from './types';
import { normalizeWorkspaceLayoutSnapshot } from './workspace-layout-preferences';

export function useWorkspaceLayoutPreference({
  projectId,
  enabled,
}: {
  projectId?: string;
  enabled: boolean;
}) {
  const workspaceLayoutPreferenceQuery = useQuery({
    queryKey: ['project', projectId, 'workspace-layout'],
    queryFn: () => getWorkspaceLayoutPreference(projectId!),
    enabled: enabled && Boolean(projectId),
    staleTime: 30_000,
  });
  const initialWorkspaceLayout = useMemo(() => (
    workspaceLayoutPreferenceQuery.isSuccess
      ? normalizeWorkspaceLayoutSnapshot(workspaceLayoutPreferenceQuery.data?.state)
      : null
  ), [workspaceLayoutPreferenceQuery.data?.state, workspaceLayoutPreferenceQuery.isSuccess]);

  return {
    initialWorkspaceLayout,
    preferenceLoaded: workspaceLayoutPreferenceQuery.isSuccess,
  };
}

export function useWorkspaceLayoutPersistence({
  projectId,
  enabled,
  layoutState,
}: {
  projectId?: string;
  enabled: boolean;
  layoutState: WorkspaceLayoutSnapshot;
}) {
  const { mutate: saveWorkspaceLayout } = useMutation({
    mutationFn: (state: Record<string, unknown>) => updateWorkspaceLayoutPreference(projectId!, state),
  });
  const latestWorkspaceLayoutStateRef = useRef(layoutState);

  useEffect(() => {
    latestWorkspaceLayoutStateRef.current = layoutState;
  }, [layoutState]);

  useEffect(() => {
    if (!enabled || !projectId) return undefined;

    const timeout = window.setTimeout(() => {
      const latest = latestWorkspaceLayoutStateRef.current;
      saveWorkspaceLayout(latest as unknown as Record<string, unknown>);
    }, 700);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    enabled,
    projectId,
    layoutState,
    saveWorkspaceLayout,
  ]);
}
