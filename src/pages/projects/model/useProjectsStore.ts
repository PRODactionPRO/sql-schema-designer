import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createEmptyProject } from './types';
import type { ProjectData } from './types';
import { createProject, deleteProject, getProjects, updateProject } from '@/shared/api/projects';
import { normalizeProjectData, normalizeProjectSchema } from '@/shared/lib/schema-normalizer';
import { safeJsonParse } from '@/shared/lib/json';
import { useAuthStore } from '@/shared/auth/store';

const PROJECTS_QUERY_KEY = ['projects'];

export function useProjectsStore() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const projectsQuery = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: getProjects,
    enabled: isAuthenticated,
  });

  const projects = useMemo(
    () => (projectsQuery.data || []).slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [projectsQuery.data],
  );

  const reloadProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (name: string) => createProject({ name }),
    onSuccess: async () => {
      await reloadProjects();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: async () => {
      await reloadProjects();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (project: ProjectData) => updateProject(project),
    onSuccess: async () => {
      await reloadProjects();
    },
  });

  const createProjectAction = useCallback(async (name: string): Promise<ProjectData> => {
    return createMutation.mutateAsync(name);
  }, [createMutation]);

  const deleteProjectAction = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const duplicateProject = useCallback(async (id: string): Promise<ProjectData | null> => {
    const source = projects.find((p) => p.id === id);
    if (!source) return null;

    return createProject({
      name: `${source.name} (copy)`,
      description: source.description,
      schemaJson: {
        tables: source.schema.tables,
        relations: source.schema.relations,
        domains: source.domains,
        enums: source.schema.enums,
        jsonSchemas: source.schema.jsonSchemas ?? [],
        schema: {
          ...source.schema,
          domains: source.domains,
        },
        documents: source.documents,
        pinned: source.pinned,
        settings: source.settings,
        snapshot: source.snapshot,
      },
    });
  }, [projects]);

  const renameProject = useCallback(async (id: string, name: string) => {
    const source = projects.find((p) => p.id === id);
    if (!source) return;

    await updateMutation.mutateAsync({
      ...source,
      name,
      updatedAt: new Date().toISOString(),
    });
  }, [projects, updateMutation]);

  const toggleProjectPinned = useCallback(async (id: string) => {
    const source = projects.find((p) => p.id === id);
    if (!source) return;

    await updateMutation.mutateAsync({
      ...source,
      pinned: !source.pinned,
      updatedAt: new Date().toISOString(),
    });
  }, [projects, updateMutation]);

  const exportProjectFile = useCallback((id: string): { content: string; filename: string } | null => {
    const project = projects.find((p) => p.id === id);
    if (!project) return null;

    const exportData = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description,
        domains: project.domains,
        schema: {
          ...project.schema,
          domains: project.domains,
        },
        documents: project.documents,
        pinned: project.pinned,
        settings: project.settings,
      },
    };

    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `${safeName}.drawsql`,
    };
  }, [projects]);

  const importProjectFile = useCallback(async (jsonString: string): Promise<ProjectData> => {
    const parsed = safeJsonParse<unknown>(jsonString, null);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid .drawsql file format');
    }

    let name: string;
    let description: string | undefined;
    let schema: ProjectData['schema'];
    let settings: ProjectData['settings'];
    let domains: ProjectData['domains'];

    const data = parsed as Record<string, unknown>;
    const wrappedProject = data.project as Record<string, unknown> | undefined;

    if (data.formatVersion && wrappedProject) {
      name = typeof wrappedProject.name === 'string' ? wrappedProject.name : 'Imported Schema';
      description = typeof wrappedProject.description === 'string' ? wrappedProject.description : undefined;
      schema = normalizeProjectSchema(wrappedProject.schema);
      settings = wrappedProject.settings as ProjectData['settings'];
      domains = normalizeProjectData({
        id: 'import_preview',
        name,
        schema,
        domains: wrappedProject.domains,
        documents: wrappedProject.documents,
      })?.domains ?? schema.domains;
    } else if (data.schema && data.name) {
      name = typeof data.name === 'string' ? data.name : 'Imported Schema';
      description = typeof data.description === 'string' ? data.description : undefined;
      schema = normalizeProjectSchema(data.schema);
      settings = data.settings as ProjectData['settings'];
      domains = normalizeProjectData({
        id: 'import_preview',
        name,
        schema,
        domains: data.domains,
        documents: data.documents,
      })?.domains ?? schema.domains;
    } else {
      const normalizedRaw = normalizeProjectData(parsed);
      if (!normalizedRaw) {
        throw new Error('Invalid .drawsql file format');
      }
      name = normalizedRaw.name;
      description = normalizedRaw.description;
      schema = normalizedRaw.schema;
      settings = normalizedRaw.settings;
      domains = normalizedRaw.domains;
    }

    const newProject = createEmptyProject(name);
    newProject.description = description;
    newProject.schema = schema;
    newProject.domains = domains;
    const normalizedWithDocuments = normalizeProjectData({
      ...newProject,
      documents: wrappedProject?.documents ?? data.documents ?? [],
    });
    if (normalizedWithDocuments) {
      newProject.documents = normalizedWithDocuments.documents;
      newProject.domains = normalizedWithDocuments.domains;
      newProject.schema = normalizedWithDocuments.schema;
    }
    if (settings) {
      newProject.settings = settings;
    }

    return createProject({
      name: newProject.name,
      description: newProject.description,
      schemaJson: {
        tables: newProject.schema.tables,
        relations: newProject.schema.relations,
        domains: newProject.domains,
        enums: newProject.schema.enums,
        jsonSchemas: newProject.schema.jsonSchemas ?? [],
        schema: {
          ...newProject.schema,
          domains: newProject.domains,
        },
        documents: newProject.documents,
        settings: newProject.settings,
        snapshot: newProject.snapshot,
      },
    });
  }, []);

  return {
    projects,
    reloadProjects,
    createProject: createProjectAction,
    deleteProject: deleteProjectAction,
    duplicateProject,
    renameProject,
    toggleProjectPinned,
    exportProjectFile,
    importProjectFile,
    isLoading: projectsQuery.isLoading,
  };
}
