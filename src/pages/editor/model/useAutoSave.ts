import { useEffect, useRef, useCallback } from 'react';
import type { Table, Relation, Domain, EnumType, JsonSchemaDocument, ProjectSettings } from './types';
import type { ProjectData } from '@/shared/types/project';
import { saveProject } from '@/shared/lib/project-storage';

interface UseAutoSaveOptions {
  projectId: string | null;
  projectData: ProjectData | null;
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  enums: EnumType[];
  jsonSchemas: JsonSchemaDocument[];
  settings: ProjectSettings;
  projectName: string;
  projectDescription: string;
  currentSnapshot?: string;
  persistProject?: (project: ProjectData) => Promise<void>;
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
  enums,
  jsonSchemas,
  settings,
  projectName,
  projectDescription,
  currentSnapshot,
  persistProject,
}: UseAutoSaveOptions) {
  const tablesRef = useRef(tables);
  const relationsRef = useRef(relations);
  const domainsRef = useRef(domains);
  const settingsRef = useRef(settings);
  const enumsRef = useRef(enums);
  const jsonSchemasRef = useRef(jsonSchemas);
  const projectNameRef = useRef(projectName);
  const projectDescriptionRef = useRef(projectDescription);
  const projectDataRef = useRef(projectData);
  const currentSnapshotRef = useRef(currentSnapshot);

  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { relationsRef.current = relations; }, [relations]);
  useEffect(() => { domainsRef.current = domains; }, [domains]);
  useEffect(() => { enumsRef.current = enums; }, [enums]);
  useEffect(() => { jsonSchemasRef.current = jsonSchemas; }, [jsonSchemas]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { projectNameRef.current = projectName; }, [projectName]);
  useEffect(() => { projectDescriptionRef.current = projectDescription; }, [projectDescription]);
  useEffect(() => { projectDataRef.current = projectData; }, [projectData]);
  useEffect(() => { currentSnapshotRef.current = currentSnapshot; }, [currentSnapshot]);

  const persistToStorage = useCallback(async () => {
    if (!projectId) return;
    const current = projectDataRef.current;
    if (!current) return;
    const snapshot = currentSnapshotRef.current || current.snapshot;
    const updated: ProjectData = {
      ...current,
      name: projectNameRef.current || current.name,
      description: projectDescriptionRef.current,
      schema: {
        tables: tablesRef.current,
        relations: relationsRef.current,
        domains: domainsRef.current,
        enums: enumsRef.current,
        jsonSchemas: jsonSchemasRef.current,
      },
      settings: settingsRef.current,
      snapshot,
      updatedAt: new Date().toISOString(),
    };
    // Always keep local recovery copy even when backend persistence is enabled.
    saveProject(updated);
    if (persistProject) {
      await persistProject(updated);
    }
    projectDataRef.current = updated;
  }, [projectId, persistProject]);

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistToStorage();
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tables, relations, domains, enums, jsonSchemas, settings, projectName, projectDescription, currentSnapshot, persistToStorage, projectId]);

  return { persistToStorage, projectDataRef };
}
