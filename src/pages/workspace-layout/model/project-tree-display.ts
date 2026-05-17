import type { ProjectData } from '@/shared/types/project';
import { getClassDiagramDocument } from './workspace-project-utils';

const PROJECT_TREE_SECTION_IDS = [
  'domains',
  'tables',
  'entities',
  'enums',
  'jsonSchemas',
  'processes',
  'diagrams',
] as const;

export type ProjectTreeSectionId = typeof PROJECT_TREE_SECTION_IDS[number];

export function getProjectTreeVisibleSectionIds(project?: ProjectData): ProjectTreeSectionId[] {
  if (!project) return [];

  const classDiagram = getClassDiagramDocument(project)?.classDiagram;

  return PROJECT_TREE_SECTION_IDS.filter((sectionId) => {
    if (sectionId === 'entities') return Boolean(classDiagram);
    return true;
  });
}
