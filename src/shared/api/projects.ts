import { normalizeSchema } from '@/shared/lib/schema-normalizer';
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
  const schema = normalizeSchema(schemaSource);
  const settings = toRecord(schemaJson.settings);

  return {
    id: project.id,
    name: project.name,
    description: project.description || undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    snapshot: typeof schemaJson.snapshot === 'string' ? schemaJson.snapshot : undefined,
    schema,
    settings: {
      ...DEFAULT_PROJECT_SETTINGS,
      ...settings,
    },
  };
}

function toSchemaJson(project: ProjectData): Record<string, unknown> {
  return {
    tables: project.schema.tables,
    relations: project.schema.relations,
    domains: project.schema.domains,
    enums: project.schema.enums,
    jsonSchemas: project.schema.jsonSchemas ?? [],
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
      schemaJson: payload.schemaJson ?? { tables: [], relations: [], domains: [], enums: [], jsonSchemas: [], settings: DEFAULT_PROJECT_SETTINGS },
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
