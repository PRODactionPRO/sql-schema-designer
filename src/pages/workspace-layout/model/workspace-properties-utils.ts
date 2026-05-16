import type { ProjectData } from '@/shared/types/project';
import type { WorkspaceSelection } from './types';

export interface SelectedProperties {
  title: string;
  subtitle: string;
  rows: Array<[string, unknown]>;
}

export function getSelectedProperties(project: ProjectData | undefined, selection: WorkspaceSelection | null): SelectedProperties | null {
  if (!project || !selection) return null;

  if (selection.kind === 'relation' && selection.sourceView === 'erd') {
    const relation = project.schema.relations.find((item) => item.id === selection.id);
    if (!relation) return null;

    const fromTable = project.schema.tables.find((table) => table.id === relation.fromTableId);
    const toTable = project.schema.tables.find((table) => table.id === relation.toTableId);
    return {
      title: relation.id,
      subtitle: 'ERD relation',
      rows: [
        ['Type', relation.type],
        ['From', fromTable?.name],
        ['To', toTable?.name],
      ],
    };
  }

  return null;
}
