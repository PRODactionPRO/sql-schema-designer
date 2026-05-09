// ── Shared project types ──
// Used across pages/editor (persistence) and pages/projects (listing)

import type { Table, Relation, Domain, EnumType, JsonSchemaDocument, ProjectSettings } from './schema';
import { DEFAULT_PROJECT_SETTINGS } from './schema';

/**
 * Full project data stored in localStorage.
 * Universal JSON format — stores everything needed to
 * fully restore a project including canvas positions.
 */
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  snapshot?: string;    // base64 PNG data URL of the canvas preview
  schema: {
    tables: Table[];
    relations: Relation[];
    domains: Domain[];
    enums: EnumType[];
    jsonSchemas?: JsonSchemaDocument[];
  };
  settings: ProjectSettings;
}

/** Lightweight metadata shown on the project card (derived, not stored separately) */
export interface ProjectMeta {
  id: string;
  name: string;
  tableCount: number;
  updatedAt: string;
}

export function createEmptyProject(name: string): ProjectData {
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schema: {
      tables: [],
      relations: [],
      domains: [],
      enums: [],
      jsonSchemas: [],
    },
    settings: { ...DEFAULT_PROJECT_SETTINGS },
  };
}
