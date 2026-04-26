import { useState, useCallback, useEffect } from 'react';
import type { ProjectData } from './types';
import { createEmptyProject } from './types';
import { deepClone, safeJsonParse } from '@/shared/lib/json';
import { normalizeProjectData, normalizeSchema } from '@/shared/lib/schema-normalizer';
import {
  loadProjectById,
  loadProjectIndex,
  removeProject,
  saveProject,
  saveProjectIndex,
} from '@/shared/lib/project-storage';

export function useProjectsStore() {
  const [projects, setProjects] = useState<ProjectData[]>([]);

  // Reload projects from localStorage
  const reloadProjects = useCallback(() => {
    const ids = loadProjectIndex();
    const loaded: ProjectData[] = [];
    for (const id of ids) {
      const p = loadProjectById(id);
      if (p) loaded.push(p);
    }
    loaded.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setProjects(loaded);
  }, []);

  useEffect(() => {
    reloadProjects();
  }, [reloadProjects]);

  const createProject = useCallback((name: string): ProjectData => {
    const project = createEmptyProject(name);
    saveProject(project);
    const ids = loadProjectIndex();
    ids.unshift(project.id);
    saveProjectIndex(ids);
    setProjects(prev => [project, ...prev]);
    return project;
  }, []);

  const deleteProject = useCallback((id: string) => {
    removeProject(id);
    const ids = loadProjectIndex().filter(i => i !== id);
    saveProjectIndex(ids);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const duplicateProject = useCallback((id: string): ProjectData | null => {
    const source = projects.find(p => p.id === id);
    if (!source) return null;
    const copy = createEmptyProject(`${source.name} (copy)`);
    copy.schema = deepClone(source.schema);
    copy.settings = { ...source.settings };
    copy.snapshot = source.snapshot;
    copy.description = source.description;
    saveProject(copy);
    const ids = loadProjectIndex();
    ids.unshift(copy.id);
    saveProjectIndex(ids);
    setProjects(prev => [copy, ...prev]);
    return copy;
  }, [projects]);

  const renameProject = useCallback((id: string, name: string) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== id) return p;
        const u = { ...p, name, updatedAt: new Date().toISOString() };
        saveProject(u);
        return u;
      });
      return updated;
    });
  }, []);

  /** Export a project as a .drawsql JSON string */
  const exportProjectFile = useCallback((id: string): { content: string; filename: string } | null => {
    const project = loadProjectById(id);
    if (!project) return null;
    // Strip snapshot from export to keep file small
    const exportData = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description,
        schema: project.schema,
        settings: project.settings,
      },
    };
    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `${safeName}.drawsql`,
    };
  }, []);

  /** Import a .drawsql JSON file and create a new project */
  const importProjectFile = useCallback((jsonString: string): ProjectData => {
    const parsed = safeJsonParse<unknown>(jsonString, null);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid .drawsql file format');
    }

    // Support both wrapped format { formatVersion, project: {...} } and raw ProjectData
    let name: string;
    let description: string | undefined;
    let schema: ProjectData['schema'];
    let settings: ProjectData['settings'];

    const data = parsed as Record<string, unknown>;
    const wrappedProject = data.project as Record<string, unknown> | undefined;

    if (data.formatVersion && wrappedProject) {
      name = typeof wrappedProject.name === 'string' ? wrappedProject.name : 'Imported Schema';
      description = typeof wrappedProject.description === 'string' ? wrappedProject.description : undefined;
      schema = normalizeSchema(wrappedProject.schema);
      settings = wrappedProject.settings as ProjectData['settings'];
    } else if (data.schema && data.name) {
      name = typeof data.name === 'string' ? data.name : 'Imported Schema';
      description = typeof data.description === 'string' ? data.description : undefined;
      schema = normalizeSchema(data.schema);
      settings = data.settings as ProjectData['settings'];
    } else {
      const normalizedRaw = normalizeProjectData(parsed);
      if (!normalizedRaw) {
        throw new Error('Invalid .drawsql file format');
      }
      name = normalizedRaw.name;
      description = normalizedRaw.description;
      schema = normalizedRaw.schema;
      settings = normalizedRaw.settings;
    }

    const project = createEmptyProject(name);
    project.description = description;
    project.schema = schema;
    if (settings) project.settings = settings;
    saveProject(project);
    const ids = loadProjectIndex();
    ids.unshift(project.id);
    saveProjectIndex(ids);
    setProjects(prev => [project, ...prev]);
    return project;
  }, []);

  return {
    projects,
    reloadProjects,
    createProject,
    deleteProject,
    duplicateProject,
    renameProject,
    exportProjectFile,
    importProjectFile,
  };
}
