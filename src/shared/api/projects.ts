import { normalizeProjectData, normalizeProjectSchema } from '@/shared/lib/schema-normalizer';
import type { ProjectData } from '@/shared/types/project';
import { DEFAULT_PROJECT_SETTINGS } from '@/shared/types/schema';
import { apiRequest } from './http';

interface ApiProject {
  id: string;
  name: string;
  description?: string | null;
  schemaJson: unknown;
  createdAt: string;
  updatedAt: string;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function mapApiProjectToProjectData(project: ApiProject): ProjectData {
  const schemaJson = toRecord(project.schemaJson);
  const schemaSource = toRecord(schemaJson.schema ?? schemaJson);
  const normalized = normalizeProjectData({
    id: project.id,
    name: project.name,
    description: project.description || undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    snapshot: typeof schemaJson.snapshot === 'string' ? schemaJson.snapshot : undefined,
    pinned: schemaJson.pinned === true,
    domains: schemaJson.domains,
    schema: normalizeProjectSchema(schemaSource),
    documents: schemaJson.documents,
    settings: {
      ...DEFAULT_PROJECT_SETTINGS,
      ...toRecord(schemaJson.settings),
    },
  });

  if (!normalized) {
    throw new Error('Invalid project payload from API');
  }

  return normalized;
}

function toSchemaJson(project: ProjectData): Record<string, unknown> {
  const domains = project.domains ?? project.schema.domains;
  return {
    schema: {
      schemaVersion: project.schema.schemaVersion ?? 2,
      tables: project.schema.tables,
      relations: project.schema.relations,
      domains,
      enums: project.schema.enums,
      jsonSchemas: project.schema.jsonSchemas ?? [],
    },
    schemaVersion: project.schema.schemaVersion ?? 2,
    tables: project.schema.tables,
    relations: project.schema.relations,
    domains,
    enums: project.schema.enums,
    jsonSchemas: project.schema.jsonSchemas ?? [],
    documents: project.documents,
    pinned: project.pinned,
    settings: project.settings,
    snapshot: project.snapshot,
  };
}

export async function getProjects(): Promise<ProjectData[]> {
  const projects = await apiRequest<ApiProject[]>('/projects');
  return projects.map(mapApiProjectToProjectData);
}

export async function getProjectById(projectId: string): Promise<ProjectData> {
  const project = await apiRequest<ApiProject>(`/projects/${projectId}`);
  return mapApiProjectToProjectData(project);
}

export async function createProject(payload: {
  name: string;
  description?: string;
  schemaJson?: Record<string, unknown>;
}): Promise<ProjectData> {
  const project = await apiRequest<ApiProject>('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      description: payload.description,
      schemaJson: payload.schemaJson ?? {
        schema: { schemaVersion: 2, tables: [], relations: [], domains: [], enums: [], jsonSchemas: [] },
        schemaVersion: 2,
        tables: [],
        relations: [],
        domains: [],
        enums: [],
        jsonSchemas: [],
        documents: [],
        settings: DEFAULT_PROJECT_SETTINGS,
      },
    }),
  });

  return mapApiProjectToProjectData(project);
}

export async function updateProject(project: ProjectData): Promise<ProjectData> {
  const updated = await apiRequest<ApiProject>(`/projects/${project.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: project.name,
      description: project.description,
      schemaJson: toSchemaJson(project),
    }),
  });

  return mapApiProjectToProjectData(updated);
}

export function deleteProject(projectId: string) {
  return apiRequest(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}
