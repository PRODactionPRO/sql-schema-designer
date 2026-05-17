import { deepClone } from '@/shared/lib/json';
import type { ProjectData } from '@/shared/types/project';
import type { Relation, Table } from '@/shared/types/schema';

export const ERD_TABLE_WIDTH = 280;
export const ERD_HEADER_HEIGHT = 40;
export const ERD_FIELD_HEIGHT = 36;

export interface ErdCanvasSnapshot {
  tables: Table[];
  relations: Relation[];
}

export function cloneTables(tables: Table[]): Table[] {
  return deepClone(tables);
}

export function cloneRelations(relations: Relation[]): Relation[] {
  return deepClone(relations);
}

export function cloneErdSnapshot(snapshot: ErdCanvasSnapshot): ErdCanvasSnapshot {
  return {
    tables: cloneTables(snapshot.tables),
    relations: cloneRelations(snapshot.relations),
  };
}

export function estimateErdTableHeight(table: Table): number {
  return ERD_HEADER_HEIGHT + (table.collapsed ? 0 : table.fields.length * ERD_FIELD_HEIGHT);
}

export function getProjectDomains(project: ProjectData) {
  return project.domains.length > 0 ? project.domains : project.schema.domains;
}

export function createTablePositionMap(tables: Table[]) {
  return new Map(tables.map((table) => [table.id, table.position]));
}
