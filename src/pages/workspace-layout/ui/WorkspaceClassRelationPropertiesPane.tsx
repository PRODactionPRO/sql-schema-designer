import { Trash2 } from 'lucide-react';
import type { ClassEntity, ClassRelation, ClassRelationType } from '@/shared/types/project';
import { PropertyField, PropertyTextArea, SelectField } from './WorkspacePropertyControls';

const CLASS_RELATION_TYPES: Array<{ value: ClassRelationType; label: string }> = [
  { value: 'association', label: 'Association' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'composition', label: 'Composition' },
  { value: 'aggregation', label: 'Aggregation' },
  { value: 'dependency', label: 'Dependency' },
];

export function ClassRelationPropertiesPane({
  relation,
  classes,
  onUpdate,
  onDelete,
}: {
  relation: ClassRelation;
  classes: ClassEntity[];
  onUpdate: (updates: Partial<ClassRelation>) => void;
  onDelete: () => void;
}) {
  const fromClass = classes.find((entity) => entity.id === relation.fromClassId);
  const toClass = classes.find((entity) => entity.id === relation.toClassId);

  return (
    <div className="flex h-full flex-col bg-white text-sm">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{relation.label || relation.type}</div>
          <div className="truncate text-[11px] font-medium text-gray-400">Class relation</div>
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
          onClick={onDelete}
          aria-label="Delete relation"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <SelectField
          label="Type"
          value={relation.type}
          options={CLASS_RELATION_TYPES}
          onChange={(type) => onUpdate({ type: type as ClassRelationType })}
        />
        <PropertyField label="Label" value={relation.label ?? ''} onChange={(label) => onUpdate({ label })} />
        <PropertyField label="From role" value={relation.fromRole ?? ''} onChange={(fromRole) => onUpdate({ fromRole })} />
        <PropertyField label="To role" value={relation.toRole ?? ''} onChange={(toRole) => onUpdate({ toRole })} />
        <PropertyField label="From multiplicity" value={relation.fromMultiplicity ?? ''} onChange={(fromMultiplicity) => onUpdate({ fromMultiplicity })} />
        <PropertyField label="To multiplicity" value={relation.toMultiplicity ?? ''} onChange={(toMultiplicity) => onUpdate({ toMultiplicity })} />
        <PropertyTextArea label="Description" value={relation.description ?? ''} onChange={(description) => onUpdate({ description })} />
        <div className="grid gap-3 text-xs">
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
            <span className="text-slate-400">From</span>
            <span className="min-w-0 text-right font-medium text-slate-700">{fromClass?.name ?? relation.fromClassId}</span>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
            <span className="text-slate-400">To</span>
            <span className="min-w-0 text-right font-medium text-slate-700">{toClass?.name ?? relation.toClassId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
