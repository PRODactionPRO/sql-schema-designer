import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type {
  ClassEntity,
  ClassEntityKind,
} from '@/shared/types/project';
import type { Domain, Table } from '@/shared/types/schema';
import type { WorkspaceSelection } from '../model/types';
import { nextWorkspaceId } from '../model/workspace-project-utils';
import { AttributeEditor, MemberSection, MethodEditor } from './WorkspaceClassMemberEditors';
import { PropertyField, PropertyTextArea, SelectField, TabButton } from './WorkspacePropertyControls';

const CLASS_ENTITY_KINDS: Array<{ value: ClassEntityKind; label: string }> = [
  { value: 'class', label: 'Class' },
  { value: 'abstract-class', label: 'Abstract class' },
  { value: 'interface', label: 'Interface' },
  { value: 'enum', label: 'Enum' },
  { value: 'datatype', label: 'Datatype' },
];

export function ClassModelPropertiesPane({
  entity,
  selectedMemberId,
  selectedMemberKind,
  domains,
  tables,
  onUpdate,
  onDelete,
}: {
  entity: ClassEntity;
  selectedMemberId?: string;
  selectedMemberKind?: WorkspaceSelection['kind'];
  domains: Domain[];
  tables: Table[];
  onUpdate: (updates: Partial<ClassEntity>) => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'properties' | 'attributes' | 'methods'>(
    selectedMemberKind === 'classMethod' ? 'methods' : selectedMemberKind === 'classAttribute' ? 'attributes' : 'properties',
  );
  const entityKind = entity.kind ?? 'class';
  const showAttributes = entityKind !== 'interface';
  const showMethods = entityKind !== 'enum';

  useEffect(() => {
    if (selectedMemberKind === 'classAttribute') setActiveTab('attributes');
    if (selectedMemberKind === 'classMethod') setActiveTab('methods');
  }, [selectedMemberKind, selectedMemberId]);

  useEffect(() => {
    if (activeTab === 'attributes' && !showAttributes) setActiveTab('properties');
    if (activeTab === 'methods' && !showMethods) setActiveTab('properties');
  }, [activeTab, showAttributes, showMethods]);

  const addAttribute = () => {
    const isEnum = entityKind === 'enum';
    onUpdate({
      attributes: [
        ...entity.attributes,
        {
          id: nextWorkspaceId('class_attr'),
          name: isEnum ? `Value${entity.attributes.length + 1}` : `attribute_${entity.attributes.length + 1}`,
          type: isEnum ? entity.name : 'string',
          visibility: 'public',
          multiplicity: 'one',
          required: true,
        },
      ],
    });
  };

  const addMethod = () => {
    onUpdate({
      methods: [
        ...entity.methods,
        {
          id: nextWorkspaceId('class_method'),
          name: entityKind === 'interface' ? `operation${entity.methods.length + 1}` : `method_${entity.methods.length + 1}`,
          returnType: 'void',
          visibility: 'public',
          parameters: '',
        },
      ],
    });
  };

  return (
    <div className="flex h-full flex-col bg-white text-sm">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-3">
        <div className="flex min-w-0 items-center gap-1">
          <TabButton active={activeTab === 'properties'} onClick={() => setActiveTab('properties')}>Entity</TabButton>
          {showAttributes ? <TabButton active={activeTab === 'attributes'} onClick={() => setActiveTab('attributes')}>{entityKind === 'enum' ? 'Values' : 'Attributes'}</TabButton> : null}
          {showMethods ? <TabButton active={activeTab === 'methods'} onClick={() => setActiveTab('methods')}>{entityKind === 'interface' ? 'Operations' : 'Methods'}</TabButton> : null}
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
          onClick={onDelete}
          aria-label="Delete entity"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === 'properties' ? (
          <ClassEntityProperties
            entity={entity}
            entityKind={entityKind}
            domains={domains}
            tables={tables}
            onUpdate={onUpdate}
          />
        ) : activeTab === 'attributes' ? (
          <MemberSection title={entityKind === 'enum' ? 'Values' : 'Attributes'} onAdd={addAttribute}>
            {entity.attributes.map((attribute) => (
              <AttributeEditor
                key={attribute.id}
                attribute={attribute}
                isSelected={attribute.id === selectedMemberId}
                isEnum={entityKind === 'enum'}
                onUpdate={(updates) => onUpdate({
                  attributes: entity.attributes.map((item) => item.id === attribute.id ? { ...item, ...updates } : item),
                })}
                onDelete={() => onUpdate({ attributes: entity.attributes.filter((item) => item.id !== attribute.id) })}
              />
            ))}
          </MemberSection>
        ) : (
          <MemberSection title={entityKind === 'interface' ? 'Operations' : 'Methods'} onAdd={addMethod}>
            {entity.methods.map((method) => (
              <MethodEditor
                key={method.id}
                method={method}
                isSelected={method.id === selectedMemberId}
                onUpdate={(updates) => onUpdate({
                  methods: entity.methods.map((item) => item.id === method.id ? { ...item, ...updates } : item),
                })}
                onDelete={() => onUpdate({ methods: entity.methods.filter((item) => item.id !== method.id) })}
              />
            ))}
          </MemberSection>
        )}
      </div>
    </div>
  );
}

function ClassEntityProperties({
  entity,
  entityKind,
  domains,
  tables,
  onUpdate,
}: {
  entity: ClassEntity;
  entityKind: ClassEntityKind;
  domains: Domain[];
  tables: Table[];
  onUpdate: (updates: Partial<ClassEntity>) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Entity</div>
        <div className="mt-1 text-sm font-semibold text-gray-900">{entity.name}</div>
      </div>
      <PropertyField label="Name" value={entity.name} onChange={(name) => onUpdate({ name })} />
      <SelectField
        label="Type"
        value={entityKind}
        options={CLASS_ENTITY_KINDS}
        onChange={(kind) => onUpdate({ kind: kind as ClassEntityKind })}
      />
      <SelectField
        label="Mapped table"
        value={entity.mappedTableId ?? ''}
        options={[{ value: '', label: 'No table mapping' }, ...tables.map((table) => ({ value: table.id, label: table.name }))]}
        onChange={(mappedTableId) => onUpdate({ mappedTableId: mappedTableId || undefined })}
      />
      <SelectField
        label="Domain"
        value={entity.domainId ?? ''}
        options={[{ value: '', label: 'No domain' }, ...domains.map((domain) => ({ value: domain.id, label: domain.name }))]}
        onChange={(domainId) => onUpdate({ domainId: domainId || undefined })}
      />
      <PropertyTextArea label="Description" value={entity.description ?? ''} onChange={(description) => onUpdate({ description })} />
    </section>
  );
}
