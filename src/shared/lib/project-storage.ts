import { STORAGE_INDEX_KEY, STORAGE_PROJECT_PREFIX } from '@/shared/config/storage';
import { safeJsonParse } from '@/shared/lib/json';
import { normalizeProjectData } from '@/shared/lib/schema-normalizer';
import type { ProjectData } from '@/shared/types/project';

export function getProjectStorageKey(id: string): string {
  return `${STORAGE_PROJECT_PREFIX}${id}`;
}

export function loadProjectIndex(): string[] {
  const raw = localStorage.getItem(STORAGE_INDEX_KEY);
  if (!raw) return [];
  const parsed = safeJsonParse<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

export function saveProjectIndex(ids: string[]): void {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(ids));
}

export function loadProjectById(id: string): ProjectData | null {
  const raw = localStorage.getItem(getProjectStorageKey(id));
  if (!raw) return null;
  const parsed = safeJsonParse<unknown>(raw, null);
  if (!parsed) return null;
  return normalizeProjectData(parsed);
}

export function saveProject(project: ProjectData): void {
  const normalized = normalizeProjectData(project);
  if (!normalized) {
    throw new Error('Cannot save invalid project');
  }
  localStorage.setItem(getProjectStorageKey(project.id), JSON.stringify(normalized));
}

export function removeProject(id: string): void {
  localStorage.removeItem(getProjectStorageKey(id));
}
