import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjectById, updateProject } from '@/shared/api/projects';
import { getPrimaryClassDiagramSemanticView, getPrimaryErdSemanticView } from '@/shared/api/semantic-model';
import { applySemanticViewsToProject } from '@/shared/lib/semantic-view-adapter';
import type { ProjectData } from '@/shared/types/project';
import { useWorkspaceCommandHistory } from './useWorkspaceCommandHistory';

export type WorkspaceSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  const [saveStatus, setSaveStatus] = useState<WorkspaceSaveStatus>('idle');
  const latestSaveRef = useRef<ProjectData | null>(null);
  const currentSaveRef = useRef<ProjectData | null>(null);
  const savingRef = useRef(false);

  const flushSaveQueue = useCallback(async () => {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaveStatus('saving');

    while (latestSaveRef.current) {
      const projectToSave = latestSaveRef.current;
      latestSaveRef.current = null;
      currentSaveRef.current = projectToSave;

      try {
        await updateProject(projectToSave);
      } catch (error) {
        latestSaveRef.current = projectToSave;
        currentSaveRef.current = null;
        setSaveStatus('error');
        console.error('[workspace] Autosave failed', error);
        savingRef.current = false;
        return;
      }
      currentSaveRef.current = null;
    }

    savingRef.current = false;
    setSaveStatus('saved');
  }, []);

  const requestProjectSave = useCallback((nextProject: ProjectData) => {
    latestSaveRef.current = nextProject;
    void flushSaveQueue();
  }, [flushSaveQueue]);

  useEffect(() => {
    setSaveStatus(projectQuery.data ? 'saved' : 'idle');
  }, [projectQuery.data]);

  useEffect(() => {
    const flushBeforeLeaving = () => {
      const pending = latestSaveRef.current ?? currentSaveRef.current;
      if (!pending) return;
      void updateProject(pending, { keepalive: true }).catch((error) => {
        console.error('[workspace] Exit autosave failed', error);
      });
    };

    window.addEventListener('pagehide', flushBeforeLeaving);
    window.addEventListener('beforeunload', flushBeforeLeaving);
    return () => {
      flushBeforeLeaving();
      window.removeEventListener('pagehide', flushBeforeLeaving);
      window.removeEventListener('beforeunload', flushBeforeLeaving);
    };
  }, []);

  const handleProjectChange = useCallback((nextProject: ProjectData) => {
    commitProject(nextProject);
    requestProjectSave(nextProject);
  }, [commitProject, requestProjectSave]);

  const handleUndoProject = useCallback(() => {
    const nextProject = undoProject();
    if (nextProject) requestProjectSave(nextProject);
  }, [requestProjectSave, undoProject]);

  const handleRedoProject = useCallback(() => {
    const nextProject = redoProject();
    if (nextProject) requestProjectSave(nextProject);
  }, [redoProject, requestProjectSave]);

  return {
    activeProject,
    projectLoading: projectQuery.isLoading,
    projectError: projectQuery.error instanceof Error ? projectQuery.error.message : null,
    saveStatus,
    handleProjectChange,
    undoProject: handleUndoProject,
    redoProject: handleRedoProject,
    canUndoProject,
    canRedoProject,
  };
}
