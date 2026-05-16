import { TableDetailsPanel } from '@/pages/editor/ui/TableDetailsPanel';
import type { ProjectData } from '@/shared/types/project';
import type { Domain, EnumType, Field } from '@/shared/types/schema';
import {
  enumToTable,
  getEnumValueIndex,
} from '../model/workspace-project-utils';

export function EnumProperties({
  project,
  enumType,
  domains,
  onUpdateEnum,
}: {
  project: ProjectData;
  enumType: EnumType;
  domains: Domain[];
  onUpdateEnum: (enumId: string, updates: Partial<Omit<EnumType, 'id'>>) => void;
}) {
  const enumTable = enumToTable(enumType, domains, project.schema.enums.findIndex((item) => item.id === enumType.id));
  const updateEnumField = (fieldId: string, updates: Partial<Field>) => {
    const index = getEnumValueIndex(fieldId);
    if (index < 0) return;
    const values = [...enumType.values];
    const valueComments = [...(enumType.valueComments ?? enumType.values.map(() => undefined))];
    const valueMetadata = [...(enumType.valueMetadata ?? enumType.values.map((_, valueIndex) => ({ sortOrder: valueIndex + 1, isActive: true })))];
    if (updates.name !== undefined) values[index] = updates.name;
    if (updates.comment !== undefined) {
      valueComments[index] = updates.comment;
      valueMetadata[index] = { ...valueMetadata[index], description: updates.comment };
    }
    onUpdateEnum(enumType.id, { values, valueComments, valueMetadata });
  };

  return (
    <div className="h-full overflow-hidden bg-white">
      <TableDetailsPanel
        table={enumTable}
        tables={project.schema.tables}
        domains={domains}
        enums={project.schema.enums}
        relations={project.schema.relations}
        collapsed={false}
        hideHeader
        selectedTableIds={new Set([enumTable.id])}
        onToggleCollapse={() => undefined}
        onUpdateTableName={(name) => onUpdateEnum(enumType.id, { name })}
        onUpdateTableDescription={(description) => onUpdateEnum(enumType.id, { description })}
        onUpdateTableNotes={(notes) => onUpdateEnum(enumType.id, { notes })}
        onUpdateTableDomain={(domainId) => onUpdateEnum(enumType.id, { domainId })}
        onAddField={(field) => onUpdateEnum(enumType.id, {
          values: [...enumType.values, field.name || `value_${enumType.values.length + 1}`],
          valueComments: [...(enumType.valueComments ?? enumType.values.map(() => undefined)), field.comment],
          valueMetadata: [
            ...(enumType.valueMetadata ?? enumType.values.map((_, valueIndex) => ({ sortOrder: valueIndex + 1, isActive: true }))),
            { label: field.name, description: field.comment, sortOrder: enumType.values.length + 1, isActive: true },
          ],
        })}
        onUpdateField={updateEnumField}
        onDeleteField={(fieldId) => {
          const index = getEnumValueIndex(fieldId);
          if (index < 0) return;
          onUpdateEnum(enumType.id, {
            values: enumType.values.filter((_, valueIndex) => valueIndex !== index),
            valueComments: (enumType.valueComments ?? enumType.values.map(() => undefined)).filter((_, valueIndex) => valueIndex !== index),
            valueMetadata: (enumType.valueMetadata ?? enumType.values.map((_, valueIndex) => ({ sortOrder: valueIndex + 1, isActive: true }))).filter((_, valueIndex) => valueIndex !== index),
          });
        }}
        onAddRelation={() => undefined}
        onDeleteRelation={() => undefined}
        enabledFieldTypes={project.settings.enabledFieldTypes}
        isEnumTable
        enumType={enumType}
        enumUsageItems={project.schema.tables.flatMap((table) => table.fields
          .filter((field) => field.enumId === enumType.id || field.enumName === enumType.name)
          .map((field) => ({ tableName: table.name, fieldName: field.name })))}
        onUpdateEnum={(updates) => onUpdateEnum(enumType.id, updates)}
      />
    </div>
  );
}
