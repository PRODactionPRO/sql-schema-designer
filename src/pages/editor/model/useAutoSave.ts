import { useEffect, useRef, useCallback } from 'react';
import type { Table, Relation, Domain, ProjectSettings } from './types';
import type { ProjectData } from '@/shared/types/project';
import { saveProject } from '@/shared/lib/project-storage';

interface UseAutoSaveOptions {
  projectId: string | null;
  projectData: ProjectData | null;
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  settings: ProjectSettings;
  projectName: string;
  projectDescription: string;
  currentSnapshot?: string;
}

/**
 * Auto-saves project to localStorage on state changes (debounced 800ms).
 * Returns `persistToStorage` for manual saves and `projectDataRef` for latest state.
 */
export function useAutoSave({
  projectId,
  projectData,
  tables,
  relations,
  domains,
  settings,
  projectName,
  projectDescription,
  currentSnapshot,
}: UseAutoSaveOptions) {
  const tablesRef = useRef(tables);
  const relationsRef = useRef(relations);
  const domainsRef = useRef(domains);
  const settingsRef = useRef(settings);
  const projectNameRef = useRef(projectName);
  const projectDescriptionRef = useRef(projectDescription);
  const projectDataRef = useRef(projectData);
  const currentSnapshotRef = useRef(currentSnapshot);

  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { relationsRef.current = relations; }, [relations]);
  useEffect(() => { domainsRef.current = domains; }, [domains]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { projectNameRef.current = projectName; }, [projectName]);
  useEffect(() => { projectDescriptionRef.current = projectDescription; }, [projectDescription]);
  useEffect(() => { projectDataRef.current = projectData; }, [projectData]);
  useEffect(() => { currentSnapshotRef.current = currentSnapshot; }, [currentSnapshot]);

  const persistToStorage = useCallback(() => {
    if (!projectId) return;
    const current = projectDataRef.current;
    if (!current) return;
    const snapshot = currentSnapshotRef.current || current.snapshot;
    const updated: ProjectData = {
      ...current,
      name: projectNameRef.current || current.name,
      description: projectDescriptionRef.current,
      schema: { tables: tablesRef.current, relations: relationsRef.current, domains: domainsRef.current },
      settings: settingsRef.current,
      snapshot,
      updatedAt: new Date().toISOString(),
    };
    saveProject(updated);
    projectDataRef.current = updated;
  }, [projectId]);

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistToStorage();
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tables, relations, domains, settings, projectName, projectDescription, persistToStorage, projectId]);

  return { persistToStorage, projectDataRef };
}
