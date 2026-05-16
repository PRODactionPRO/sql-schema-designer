import { TableDetailsPanel } from '@/pages/editor/ui/TableDetailsPanel';
import { deleteObjectFromViewCommand } from '@/shared/api/semantic-model';
import type { ProjectData } from '@/shared/types/project';
import type {
  Domain,
  Relation,
  Table,
  TableConstraint,
  TableConstraintType,
} from '@/shared/types/schema';
import { getObjectBinding, nextWorkspaceId, saveObjectMetadata } from '../model/workspace-project-utils';

export function TableProperties({
  project,
  table,
  domains,
  onUpdateTable,
  onUpdateRelations,
  onApplySchema,
}: {
  project: ProjectData;
  table: Table;
  domains: Domain[];
  onUpdateTable: (tableId: string, updates: Partial<Table>) => void;
  onUpdateRelations: (relations: Relation[]) => void;
  onApplySchema: (schema: ProjectData['schema']) => ProjectData;
}) {
  const addTableConstraint = (type: TableConstraintType) => {
    const id = nextWorkspaceId('constraint');
    const constraint: TableConstraint = type === 'primary_key'
      ? { id, type, columnIds: [] }
      : type === 'unique'
        ? { id, type, columnIds: [] }
        : type === 'foreign_key'
          ? { id, type, columnIds: [], referencedTableId: '', referencedColumnIds: [] }
          : { id, type, expression: '' };
    onUpdateTable(table.id, { constraints: [...(table.constraints ?? []), constraint] });
    return id;
  };

  const addTableIndex = () => {
    const id = nextWorkspaceId('index');
    onUpdateTable(table.id, { indexes: [...(table.indexes ?? []), { id, columns: [] }] });
    return id;
  };

  return (
    <div className="h-full overflow-hidden bg-white">
      <TableDetailsPanel
        table={table}
        tables={project.schema.tables}
        domains={domains}
        enums={project.schema.enums}
        relations={project.schema.relations}
        collapsed={false}
        hideHeader
        selectedTableIds={new Set([table.id])}
        onToggleCollapse={() => undefined}
        onUpdateTableName={(name) => onUpdateTable(table.id, { name })}
        onUpdateTableDescription={(description) => onUpdateTable(table.id, { description })}
        onUpdateTableNotes={(notes) => onUpdateTable(table.id, { notes })}
        onUpdateTableDomain={(domainId) => onUpdateTable(table.id, { domainId })}
        onAddField={(field) => onUpdateTable(table.id, { fields: [...table.fields, { ...field, id: nextWorkspaceId('field') }] })}
        onUpdateField={(fieldId, updates) => onUpdateTable(table.id, {
          fields: table.fields.map((field) => field.id === fieldId ? { ...field, ...updates } : field),
        })}
        onDeleteField={(fieldId) => onUpdateTable(table.id, {
          fields: table.fields.filter((field) => field.id !== fieldId),
        })}
        onAddRelation={(relation) => onUpdateRelations([...project.schema.relations, { ...relation, id: nextWorkspaceId('relation') }])}
        onDeleteRelation={(relationId) => onUpdateRelations(project.schema.relations.filter((relation) => relation.id !== relationId))}
        onAddTableConstraint={addTableConstraint}
        onUpdateTableConstraint={(constraintId, updates) => onUpdateTable(table.id, {
          constraints: (table.constraints ?? []).map((constraint) => constraint.id === constraintId ? { ...constraint, ...updates } as TableConstraint : constraint),
        })}
        onDeleteTableConstraint={(constraintId) => onUpdateTable(table.id, {
          constraints: (table.constraints ?? []).filter((constraint) => constraint.id !== constraintId),
        })}
        onAddTableIndex={addTableIndex}
        onUpdateTableIndex={(indexId, updates) => onUpdateTable(table.id, {
          indexes: (table.indexes ?? []).map((index) => index.id === indexId ? { ...index, ...updates } : index),
        })}
        onDeleteTableIndex={(indexId) => onUpdateTable(table.id, {
          indexes: (table.indexes ?? []).filter((index) => index.id !== indexId),
        })}
        enabledFieldTypes={project.settings.enabledFieldTypes}
        onBulkAssignDomain={(domainId, tableIds) => {
          const ids = new Set(tableIds);
          const nextTables = project.schema.tables.map((item) => ids.has(item.id) ? { ...item, domainId } : item);
          onApplySchema({ ...project.schema, tables: nextTables });
          nextTables.filter((item) => ids.has(item.id)).forEach((item) => saveObjectMetadata(project, item.id, item));
        }}
        onBulkDelete={(tableIds) => {
          const ids = new Set(tableIds);
          onApplySchema({
            ...project.schema,
            tables: project.schema.tables.filter((item) => !ids.has(item.id)),
            relations: project.schema.relations.filter((relation) => !ids.has(relation.fromTableId) && !ids.has(relation.toTableId)),
          });
          tableIds.forEach((tableId) => {
            const binding = getObjectBinding(project, tableId);
            if (!binding) return;

            void deleteObjectFromViewCommand(project.id, {
              objectId: binding.objectId,
              viewId: project.semantic?.erd?.viewId,
            }).catch((error) => {
              console.error('[workspace] Failed to delete table object', error);
            });
          });
        }}
      />
    </div>
  );
}
