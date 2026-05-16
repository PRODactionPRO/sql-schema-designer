import type { ClassAttribute, ClassDiagramModel, ClassMethod } from '@/shared/types/project';
import type { Table } from '@/shared/types/schema';

export function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || toIndex < 0) return items;
  if (fromIndex >= items.length || toIndex >= items.length) return items;

  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  if (!item) return items;
  next.splice(toIndex, 0, item);
  return next;
}

export function reorderTableFields(
  tables: Table[],
  tableId: string,
  fromIndex: number,
  toIndex: number,
): Table[] {
  return tables.map((table) => (
    table.id === tableId
      ? { ...table, fields: moveArrayItem(table.fields, fromIndex, toIndex) }
      : table
  ));
}

export function reorderClassMembers(
  diagram: ClassDiagramModel,
  classId: string,
  memberType: 'attributes' | 'methods',
  fromIndex: number,
  toIndex: number,
): ClassDiagramModel {
  return {
    ...diagram,
    classes: diagram.classes.map((entity) => {
      if (entity.id !== classId) return entity;
      if (memberType === 'attributes') {
        return {
          ...entity,
          attributes: moveArrayItem<ClassAttribute>(entity.attributes, fromIndex, toIndex),
        };
      }

      return {
        ...entity,
        methods: moveArrayItem<ClassMethod>(entity.methods, fromIndex, toIndex),
      };
    }),
  };
}
