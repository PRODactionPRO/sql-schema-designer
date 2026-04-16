import { useState, useCallback, useEffect } from 'react';
import type { ProjectData } from './types';
import { createEmptyProject } from './types';
import { STORAGE_PROJECT_PREFIX, STORAGE_INDEX_KEY } from '@/shared/config/storage';

function getProjectKey(id: string) {
  return `${STORAGE_PROJECT_PREFIX}${id}`;
}

function loadIndex(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIndex(ids: string[]) {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(ids));
}

function loadProject(id: string): ProjectData | null {
  try {
    const raw = localStorage.getItem(getProjectKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveProject(project: ProjectData) {
  localStorage.setItem(getProjectKey(project.id), JSON.stringify(project));
}

function removeProject(id: string) {
  localStorage.removeItem(getProjectKey(id));
}

export function useProjectsStore() {
  const [projects, setProjects] = useState<ProjectData[]>([]);

  // Reload projects from localStorage
  const reloadProjects = useCallback(() => {
    const ids = loadIndex();
    const loaded: ProjectData[] = [];
    for (const id of ids) {
      const p = loadProject(id);
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
    const ids = loadIndex();
    ids.unshift(project.id);
    saveIndex(ids);
    setProjects(prev => [project, ...prev]);
    return project;
  }, []);

  const deleteProject = useCallback((id: string) => {
    removeProject(id);
    const ids = loadIndex().filter(i => i !== id);
    saveIndex(ids);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  const duplicateProject = useCallback((id: string): ProjectData | null => {
    const source = projects.find(p => p.id === id);
    if (!source) return null;
    const copy = createEmptyProject(`${source.name} (copy)`);
    copy.schema = JSON.parse(JSON.stringify(source.schema));
    copy.settings = { ...source.settings };
    copy.snapshot = source.snapshot;
    copy.description = source.description;
    saveProject(copy);
    const ids = loadIndex();
    ids.unshift(copy.id);
    saveIndex(ids);
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
    const project = loadProject(id);
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
    const parsed = JSON.parse(jsonString);

    // Support both wrapped format { formatVersion, project: {...} } and raw ProjectData
    let name: string;
    let description: string | undefined;
    let schema: ProjectData['schema'];
    let settings: ProjectData['settings'];

    if (parsed.formatVersion && parsed.project) {
      name = parsed.project.name || 'Imported Schema';
      description = parsed.project.description;
      schema = parsed.project.schema;
      settings = parsed.project.settings;
    } else if (parsed.schema && parsed.name) {
      name = parsed.name;
      description = parsed.description;
      schema = parsed.schema;
      settings = parsed.settings;
    } else {
      throw new Error('Invalid .drawsql file format');
    }

    const project = createEmptyProject(name);
    project.description = description;
    project.schema = schema;
    if (settings) project.settings = settings;
    saveProject(project);
    const ids = loadIndex();
    ids.unshift(project.id);
    saveIndex(ids);
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