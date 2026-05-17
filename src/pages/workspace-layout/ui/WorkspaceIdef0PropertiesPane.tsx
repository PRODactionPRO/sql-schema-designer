import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Idef0Arrow,
  Idef0Attribute,
  Idef0AttributeValueType,
  Idef0Concept,
  Idef0ConceptKind,
  Idef0Function,
} from '@/shared/types/idef0';
import {
  IDEF0_ARROW_STATUSES,
  IDEF0_ATTRIBUTE_VALUE_TYPES,
  IDEF0_CONCEPT_KINDS,
  IDEF0_CONCEPT_STATUSES,
  IDEF0_FUNCTION_STATUSES,
} from '@/shared/types/idef0';
import { IDEF0_ARROW_ROLE_META, IDEF0_CONCEPT_KIND_META } from '../model/idef0-meta';
import { nextWorkspaceId } from '../model/workspace-project-utils';
import { IconDangerButton, PropertyField, PropertyTextArea, SelectField, TabButton } from './WorkspacePropertyControls';

const ATTRIBUTE_TYPE_OPTIONS = IDEF0_ATTRIBUTE_VALUE_TYPES.map((value) => ({ value, label: value }));
const FUNCTION_STATUS_OPTIONS = IDEF0_FUNCTION_STATUSES.map((value) => ({ value, label: value }));
const CONCEPT_STATUS_OPTIONS = IDEF0_CONCEPT_STATUSES.map((value) => ({ value, label: value }));
const CONCEPT_KIND_OPTIONS = IDEF0_CONCEPT_KINDS.map((value) => ({
  value,
  label: IDEF0_CONCEPT_KIND_META[value].label,
}));
const ARROW_STATUS_OPTIONS = IDEF0_ARROW_STATUSES.map((value) => ({ value, label: value }));

export function Idef0FunctionPropertiesPane({
  fn,
  onUpdate,
  onDelete,
}: {
  fn: Idef0Function;
  onUpdate: (updates: Partial<Idef0Function>) => void;
  onDelete: () => void;
}) {
  return (
    <Idef0NodePropertiesShell
      title={fn.name}
      subtitle="IDEF0 function"
      onDelete={onDelete}
      tabs={[
        {
          id: 'properties',
          label: 'Function',
          content: (
            <section className="space-y-4">
              <PropertyField label="Name" value={fn.name} onChange={(name) => onUpdate({ name })} />
              <PropertyTextArea label="Description" value={fn.description ?? ''} onChange={(description) => onUpdate({ description })} />
              <SelectField label="Status" value={fn.status} options={FUNCTION_STATUS_OPTIONS} onChange={(status) => onUpdate({ status: status as Idef0Function['status'] })} />
              <PropertyField label="Owner" value={fn.ownerId ?? ''} onChange={(ownerId) => onUpdate({ ownerId: ownerId || undefined })} />
            </section>
          ),
        },
        {
          id: 'attributes',
          label: 'Attributes',
          content: (
            <Idef0AttributesEditor
              attributes={fn.attributes ?? []}
              onChange={(attributes) => onUpdate({ attributes })}
            />
          ),
        },
      ]}
    />
  );
}

export function Idef0ConceptPropertiesPane({
  concept,
  onUpdate,
  onDelete,
}: {
  concept: Idef0Concept;
  onUpdate: (updates: Partial<Idef0Concept>) => void;
  onDelete: () => void;
}) {
  return (
    <Idef0NodePropertiesShell
      title={concept.name}
      subtitle={IDEF0_CONCEPT_KIND_META[concept.kind].label}
      onDelete={onDelete}
      tabs={[
        {
          id: 'properties',
          label: 'Object',
          content: (
            <section className="space-y-4">
              <PropertyField label="Name" value={concept.name} onChange={(name) => onUpdate({ name })} />
              <PropertyTextArea label="Description" value={concept.description ?? ''} onChange={(description) => onUpdate({ description })} />
              <SelectField label="Kind" value={concept.kind} options={CONCEPT_KIND_OPTIONS} onChange={(kind) => onUpdate({ kind: kind as Idef0ConceptKind })} />
              <SelectField label="Status" value={concept.status} options={CONCEPT_STATUS_OPTIONS} onChange={(status) => onUpdate({ status: status as Idef0Concept['status'] })} />
              <PropertyField label="Linked object" value={concept.linkedObjectId ?? ''} onChange={(linkedObjectId) => onUpdate({ linkedObjectId: linkedObjectId || undefined })} />
            </section>
          ),
        },
        {
          id: 'attributes',
          label: 'Attributes',
          content: (
            <Idef0AttributesEditor
              attributes={concept.attributes ?? []}
              onChange={(attributes) => onUpdate({ attributes })}
            />
          ),
        },
      ]}
    />
  );
}

export function Idef0ArrowPropertiesPane({
  arrow,
  onUpdate,
  onDelete,
}: {
  arrow: Idef0Arrow;
  onUpdate: (updates: Partial<Idef0Arrow>) => void;
  onDelete: () => void;
}) {
  const roleMeta = IDEF0_ARROW_ROLE_META[arrow.role];
  return (
    <Idef0NodePropertiesShell
      title={roleMeta.label}
      subtitle="IDEF0 arrow"
      onDelete={onDelete}
      tabs={[
        {
          id: 'properties',
          label: 'Arrow',
          content: (
            <section className="space-y-4">
              <SelectField label="Status" value={arrow.status} options={ARROW_STATUS_OPTIONS} onChange={(status) => onUpdate({ status: status as Idef0Arrow['status'] })} />
              <PropertyField label="Label" value={arrow.label ?? ''} onChange={(label) => onUpdate({ label: label || undefined })} />
              <PropertyTextArea label="Description" value={arrow.description ?? ''} onChange={(description) => onUpdate({ description })} />
              <PropertyTextArea label="Condition" value={arrow.condition ?? ''} compact onChange={(condition) => onUpdate({ condition: condition || undefined })} />
            </section>
          ),
        },
      ]}
    />
  );
}

function Idef0NodePropertiesShell({
  title,
  subtitle,
  tabs,
  onDelete,
}: {
  title: string;
  subtitle: string;
  tabs: Array<{ id: string; label: string; content: ReactNode }>;
  onDelete: () => void;
}) {
  const [firstTab] = tabs;
  const [activeTab, setActiveTab] = useState(firstTab.id);
  const active = tabs.find((tab) => tab.id === activeTab) ?? firstTab;

  return (
    <div className="flex h-full flex-col bg-white text-sm">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-3">
        <div className="flex min-w-0 items-center gap-1">
          {tabs.map((tab) => (
            <TabButton key={tab.id} active={active.id === tab.id} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </TabButton>
          ))}
        </div>
        <IconDangerButton label={`Delete ${title}`} onClick={onDelete} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">{subtitle}</div>
        </div>
        {active.content}
      </div>
    </div>
  );
}

function Idef0AttributesEditor({
  attributes,
  onChange,
}: {
  attributes: Idef0Attribute[];
  onChange: (attributes: Idef0Attribute[]) => void;
}) {
  const addAttribute = () => {
    onChange([
      ...attributes,
      {
        id: nextWorkspaceId('idef0_attr'),
        name: `attribute_${attributes.length + 1}`,
        value: '',
        valueType: 'text',
      },
    ]);
  };

  const updateAttribute = (attributeId: string, updates: Partial<Idef0Attribute>) => {
    onChange(attributes.map((attribute) => (
      attribute.id === attributeId ? { ...attribute, ...updates } : attribute
    )));
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Attributes</div>
          <div className="mt-0.5 text-[11px] text-gray-400">{attributes.length} attribute{attributes.length === 1 ? '' : 's'}</div>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          onClick={addAttribute}
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>
      <div className="space-y-3">
        {attributes.map((attribute) => (
          <div key={attribute.id} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-3">
                <PropertyField label="Name" value={attribute.name} onChange={(name) => updateAttribute(attribute.id, { name })} />
                <PropertyField label="Value" value={attribute.value ?? ''} onChange={(value) => updateAttribute(attribute.id, { value })} />
                <SelectField
                  label="Value type"
                  value={attribute.valueType ?? 'text'}
                  options={ATTRIBUTE_TYPE_OPTIONS}
                  onChange={(valueType) => updateAttribute(attribute.id, { valueType: valueType as Idef0AttributeValueType })}
                />
                <PropertyTextArea compact label="Description" value={attribute.description ?? ''} onChange={(description) => updateAttribute(attribute.id, { description })} />
              </div>
              <IconDangerButton label={`Delete ${attribute.name}`} onClick={() => onChange(attributes.filter((item) => item.id !== attribute.id))} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
