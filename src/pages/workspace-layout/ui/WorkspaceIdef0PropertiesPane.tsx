import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Idef0Arrow,
  Idef0Attribute,
  Idef0AttributeValueType,
  Idef0Concept,
  Idef0ConceptKind,
  Idef0DataReference,
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
const DATA_LINKED_CONCEPT_KINDS = new Set<Idef0ConceptKind>(['dataset', 'artifact']);

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
  attributeReferenceOptions,
  onUpdate,
  onDelete,
}: {
  concept: Idef0Concept;
  attributeReferenceOptions: Idef0DataReference[];
  onUpdate: (updates: Partial<Idef0Concept>) => void;
  onDelete: () => void;
}) {
  const tabs: Array<{ id: string; label: string; content: ReactNode }> = [
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
  ];

  if (DATA_LINKED_CONCEPT_KINDS.has(concept.kind)) {
    tabs.push({
      id: 'data',
      label: 'Data links',
      content: (
        <Idef0DataReferencesEditor
          references={concept.dataReferences ?? []}
          options={attributeReferenceOptions}
          onChange={(dataReferences) => onUpdate({ dataReferences })}
        />
      ),
    });
  }

  tabs.push({
    id: 'attributes',
    label: 'Attributes',
    content: (
      <Idef0AttributesEditor
        attributes={concept.attributes ?? []}
        onChange={(attributes) => onUpdate({ attributes })}
      />
    ),
  });

  return (
    <Idef0NodePropertiesShell
      title={concept.name}
      subtitle={IDEF0_CONCEPT_KIND_META[concept.kind].label}
      onDelete={onDelete}
      tabs={tabs}
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

function getRefKey(ref: Idef0DataReference): string {
  return ref.objectId ?? ref.legacyId ?? ref.id;
}

function toStoredRef(option: Idef0DataReference): Idef0DataReference {
  const key = getRefKey(option);
  return {
    id: key,
    objectId: option.objectId,
    legacyId: option.legacyId,
    classId: option.classId,
    className: option.className,
    attributeId: option.attributeId,
    attributeName: option.attributeName,
    valueType: option.valueType,
    domainId: option.domainId,
    domainName: option.domainName,
  };
}

function Idef0DataReferencesEditor({
  references,
  options,
  onChange,
}: {
  references: Idef0DataReference[];
  options: Idef0DataReference[];
  onChange: (references: Idef0DataReference[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const selectedKeys = useMemo(() => new Set(references.map(getRefKey)), [references]);

  const domainOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      if (!option.domainId || !option.domainName) continue;
      map.set(option.domainId, option.domainName);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [options]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      if (domainFilter && option.domainId !== domainFilter) continue;
      if (!option.classId || !option.className) continue;
      map.set(option.classId, option.className);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [domainFilter, options]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return options.filter((option) => {
      if (domainFilter && option.domainId !== domainFilter) return false;
      if (classFilter && option.classId !== classFilter) return false;
      if (!query) return true;

      const haystack = [
        option.domainName,
        option.className,
        option.attributeName,
        option.valueType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [classFilter, domainFilter, options, search]);

  const toggleRef = (option: Idef0DataReference) => {
    const key = getRefKey(option);
    if (!key) return;

    if (selectedKeys.has(key)) {
      onChange(references.filter((ref) => getRefKey(ref) !== key));
      return;
    }

    onChange([...references, toStoredRef(option)]);
  };

  const removeRef = (ref: Idef0DataReference) => {
    const key = getRefKey(ref);
    onChange(references.filter((item) => getRefKey(item) !== key));
  };

  return (
    <section className="space-y-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Data links</div>
        <div className="mt-0.5 text-[11px] text-gray-400">Links to class attributes used by this dataset / artifact</div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
          placeholder="Search attribute..."
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={domainFilter}
            onChange={(event) => {
              setDomainFilter(event.target.value);
              setClassFilter('');
            }}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
          >
            <option value="">All domains</option>
            {domainOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs outline-none focus:border-blue-500"
          >
            <option value="">All classes</option>
            {classOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-gray-200 bg-gray-50/50 p-2">
        {filteredOptions.length > 0 ? filteredOptions.map((option) => {
          const key = getRefKey(option);
          const checked = selectedKeys.has(key);
          return (
            <label key={key} className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent bg-white px-2 py-1.5 text-xs hover:border-blue-100">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleRef(option)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-800">{option.attributeName}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {(option.className ?? 'Class')} · {(option.domainName ?? 'No domain')} · {(option.valueType ?? 'custom')}
                </span>
              </span>
            </label>
          );
        }) : (
          <div className="px-2 py-4 text-center text-xs text-slate-400">No attributes found for current filters</div>
        )}
      </div>
      {references.length > 0 ? (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Selected</div>
          <div className="space-y-1">
            {references.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-800">{ref.attributeName}</div>
                  <div className="truncate text-[11px] text-slate-500">{ref.className ?? 'Class'} · {ref.domainName ?? 'No domain'}</div>
                </div>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                  onClick={() => removeRef(ref)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
