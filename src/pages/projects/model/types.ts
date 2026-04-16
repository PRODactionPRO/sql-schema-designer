// Re-export project types from shared layer
// This file exists for backward compatibility within the projects page.
// New code should import directly from '@/shared/types/project'.

export {
  type ProjectData,
  type ProjectMeta,
  createEmptyProject,
} from '@/shared/types/project';
