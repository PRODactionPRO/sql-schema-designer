import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjectById } from '@/shared/api/projects';
import { getPrimaryClassDiagramSemanticView, getPrimaryErdSemanticView } from '@/shared/api/semantic-model';
import { applySemanticViewsToProject } from '@/shared/lib/semantic-view-adapter';
import type { ProjectData } from '@/shared/types/project';
import { useWorkspaceCommandHistory } from './useWorkspaceCommandHistory';

export function useWorkspaceProjectData({
  projectId,
  enabled,
}: {
  projectId?: string;
  enabled: boolean;
}) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId!),
    enabled: enabled && Boolean(projectId),
  });
  const semanticErdQuery = useQuery({
    queryKey: ['project', projectId, 'semantic', 'primary-erd'],
    queryFn: () => getPrimaryErdSemanticView(projectId!),
    enabled: enabled && Boolean(projectId),
    staleTime: 30_000,
  });
  const semanticClassDiagramQuery = useQuery({
    queryKey: ['project', projectId, 'semantic', 'primary-class-diagram'],
    queryFn: () => getPrimaryClassDiagramSemanticView(projectId!),
    enabled: enabled && Boolean(projectId),
    staleTime: 30_000,
  });

  const workspaceProject = useMemo(() => (
    applySemanticViewsToProject(projectQuery.data, {
      erd: semanticErdQuery.data,
      classDiagram: semanticClassDiagramQuery.data,
    })
  ), [projectQuery.data, semanticClassDiagramQuery.data, semanticErdQuery.data]);

  const {
    value: projectDraft,
    commit: commitProject,
    undo: undoProject,
    redo: redoProject,
    canUndo: canUndoProject,
    canRedo: canRedoProject,
  } = useWorkspaceCommandHistory<ProjectData>(workspaceProject);
  const activeProject = projectDraft ?? workspaceProject;
  const handleProjectChange = useCallback((nextProject: ProjectData) => {
    commitProject(nextProject);
  }, [commitProject]);

  return {
    activeProject,
    projectLoading: projectQuery.isLoading,
    projectError: projectQuery.error instanceof Error ? projectQuery.error.message : null,
    handleProjectChange,
    undoProject,
    redoProject,
    canUndoProject,
    canRedoProject,
  };
}
