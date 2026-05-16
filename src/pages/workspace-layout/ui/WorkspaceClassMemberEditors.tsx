import { Plus } from 'lucide-react';
import type {
  ClassAttribute,
  ClassAttributeMultiplicity,
  ClassMemberVisibility,
  ClassMethod,
} from '@/shared/types/project';
import { IconDangerButton, PropertyTextArea } from './WorkspacePropertyControls';

const VISIBILITIES: ClassMemberVisibility[] = ['public', 'protected', 'private'];
const MULTIPLICITIES: ClassAttributeMultiplicity[] = ['one', 'optional', 'many'];

export function AttributeEditor({
  attribute,
  isSelected,
  isEnum,
  onUpdate,
  onDelete,
}: {
  attribute: ClassAttribute;
  isSelected?: boolean;
  isEnum: boolean;
  onUpdate: (updates: Partial<ClassAttribute>) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-md border p-3 ${isSelected ? 'border-[#f39b12] ring-1 ring-[#f39b12]' : 'border-gray-200'}`}>
      <div className="flex gap-2">
        {!isEnum ? (
          <select
            value={attribute.visibility}
            onChange={(event) => onUpdate({ visibility: event.target.value as ClassMemberVisibility })}
            className="h-8 w-24 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
          >
            {VISIBILITIES.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}
          </select>
        ) : null}
        <input
          value={attribute.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-sm outline-none focus:border-blue-500"
        />
        <IconDangerButton label="Delete attribute" onClick={onDelete} />
      </div>
      {!isEnum ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            value={attribute.type}
            onChange={(event) => onUpdate({ type: event.target.value })}
            className="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
            placeholder="type"
          />
          <select
            value={attribute.multiplicity ?? 'one'}
            onChange={(event) => onUpdate({
              multiplicity: event.target.value as ClassAttributeMultiplicity,
              required: event.target.value === 'one',
            })}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
          >
            {MULTIPLICITIES.map((multiplicity) => <option key={multiplicity} value={multiplicity}>{multiplicity}</option>)}
          </select>
        </div>
      ) : null}
      <PropertyTextArea label="Description" value={attribute.description ?? ''} onChange={(description) => onUpdate({ description })} compact />
    </div>
  );
}

export function MethodEditor({
  method,
  isSelected,
  onUpdate,
  onDelete,
}: {
  method: ClassMethod;
  isSelected?: boolean;
  onUpdate: (updates: Partial<ClassMethod>) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-md border p-3 ${isSelected ? 'border-[#f39b12] ring-1 ring-[#f39b12]' : 'border-gray-200'}`}>
      <div className="flex gap-2">
        <select
          value={method.visibility}
          onChange={(event) => onUpdate({ visibility: event.target.value as ClassMemberVisibility })}
          className="h-8 w-24 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
        >
          {VISIBILITIES.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}
        </select>
        <input
          value={method.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-sm outline-none focus:border-blue-500"
        />
        <IconDangerButton label="Delete method" onClick={onDelete} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          value={method.parameters ?? ''}
          onChange={(event) => onUpdate({ parameters: event.target.value })}
          className="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
          placeholder="parameters"
        />
        <input
          value={method.returnType ?? 'void'}
          onChange={(event) => onUpdate({ returnType: event.target.value })}
          className="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
          placeholder="return type"
        />
      </div>
      <PropertyTextArea label="Description" value={method.description ?? ''} onChange={(description) => onUpdate({ description })} compact />
    </div>
  );
}

export function MemberSection({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
