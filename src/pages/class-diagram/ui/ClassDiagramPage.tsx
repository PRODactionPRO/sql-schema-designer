import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  MoreVertical,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Plus,
  Redo2,
  Save,
  Scan,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getProjectById, updateProject } from '@/shared/api/projects';
import { ALL_FIELD_TYPES, DOMAIN_COLORS, type Domain } from '@/shared/types/schema';
import {
  createEmptyClassDiagram,
  type ClassAttribute,
  type ClassAttributeMultiplicity,
  type ClassDiagramModel,
  type ClassDiagramProjectDocument,
  type ClassEntity,
  type ClassEntityKind,
  type ClassMemberVisibility,
  type ClassMethod,
  type ClassRelation,
  type ClassRelationType,
  type ProjectData,
} from '@/shared/types/project';
import { normalizeClassDiagram } from '@/shared/lib/schema-normalizer';
import { useRequireAuth } from '@/shared/auth/guard';
import { DataTypeSelect } from '@/shared/ui/data-type-select';
import { PopupSelect, type PopupSelectOption } from '@/shared/ui/popup-select';
import { useReorderableDragList } from '@/shared/ui/useReorderableDragList';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { PanelHeader, PanelIconButton, PanelPillButton, PanelTabButton } from '@/shared/ui/panel';
import { ProTooltip } from '@/shared/ui/pro-tooltip';
import { cn } from '@/shared/ui/utils';

const CLASS_WIDTH = 300;
const HEADER_HEIGHT = 42;
const WORLD_EXTENT = 50000;
const VISIBILITY_ORDER: ClassMemberVisibility[] = ['public', 'protected', 'private'];
const CLASS_ATTRIBUTE_TYPES = Array.from(new Set([
  'string',
  'number',
  'boolean',
  'Date',
  'object',
  ...ALL_FIELD_TYPES,
]));
const UML_METHOD_RETURN_TYPES = [
  'void',
  'Boolean',
  'Integer',
  'Real',
  'String',
  'UnlimitedNatural',
  'Date',
  'DateTime',
  'Object',
  'Collection',
  'List',
  'Set',
  'Map',
  'Result',
] as const;
const ATTRIBUTE_MULTIPLICITY_ORDER: ClassAttributeMultiplicity[] = ['one', 'optional', 'many'];
const CLASS_ENTITY_KIND_ORDER: ClassEntityKind[] = ['class', 'abstract-class', 'interface', 'enum', 'datatype'];
const DEFAULT_VISIBLE_CLASS_ENTITY_KINDS: Record<ClassEntityKind, boolean> = {
  class: true,
  'abstract-class': true,
  interface: true,
  enum: true,
  datatype: true,
};
const CLASS_ENTITY_KIND_META: Record<ClassEntityKind, {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}> = {
  class: {
    label: 'Class',
    shortLabel: 'CLASS',
    description: 'Object with attributes and operations.',
    color: '#ef4444',
  },
  'abstract-class': {
    label: 'Abstract',
    shortLabel: 'ABSTRACT',
    description: 'Base class that defines shared structure.',
    color: '#8b5cf6',
  },
  interface: {
    label: 'Interface',
    shortLabel: 'IFACE',
    description: 'Contract of public operations without stored attributes.',
    color: '#2563eb',
  },
  enum: {
    label: 'Enum',
    shortLabel: 'ENUM',
    description: 'Closed list of named literals.',
    color: '#f59e0b',
  },
  datatype: {
    label: 'Data type',
    shortLabel: 'TYPE',
    description: 'Value object with structured properties.',
    color: '#0f766e',
  },
};
const VISIBILITY_OPTIONS: PopupSelectOption<ClassMemberVisibility>[] = [
  { value: 'public', label: 'public' },
  { value: 'protected', label: 'protected' },
  { value: 'private', label: 'private' },
];
const CLASS_ENTITY_KIND_OPTIONS: PopupSelectOption<ClassEntityKind>[] = CLASS_ENTITY_KIND_ORDER.map((kind) => ({
  value: kind,
  label: CLASS_ENTITY_KIND_META[kind].label,
  icon: <Box className="size-3.5" style={{ color: CLASS_ENTITY_KIND_META[kind].color }} />,
}));
const RELATION_TYPE_OPTIONS: PopupSelectOption<ClassRelationType>[] = [
  { value: 'association', label: 'association' },
  { value: 'inheritance', label: 'inheritance' },
  { value: 'composition', label: 'composition' },
  { value: 'aggregation', label: 'aggregation' },
  { value: 'dependency', label: 'dependency' },
];
const ATTRIBUTE_MULTIPLICITY_OPTIONS: PopupSelectOption<ClassAttributeMultiplicity>[] = [
  { value: 'one', label: '1' },
  { value: 'optional', label: '0..1' },
  { value: 'many', label: '0..*' },
];
const CLASS_GROUP_MODE_OPTIONS: PopupSelectOption<ClassGroupMode>[] = [
  { value: 'domain', label: 'Group by domain' },
  { value: 'kind', label: 'Group by type' },
  { value: 'none', label: 'No grouping' },
];

type ClassDiagramSnapshot = {
  diagram: ClassDiagramModel;
};

type ClassGroupMode = 'domain' | 'kind' | 'none';
type ClassSortMode = 'manual' | 'asc' | 'desc';
type ClassRelationHandlePosition = 'top' | 'right' | 'bottom' | 'left';

type ClassSidebarGroup = {
  id: string;
  label: string;
  color: string;
  classes: ClassEntity[];
  targetDomainId: string | null;
  acceptsDomainDrop: boolean;
};

function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeClassEntityKindValue(kind: ClassEntity['kind']): ClassEntityKind {
  return kind && CLASS_ENTITY_KIND_ORDER.includes(kind) ? kind : 'class';
}

function getClassEntityKindMeta(kind: ClassEntity['kind']) {
  return CLASS_ENTITY_KIND_META[normalizeClassEntityKindValue(kind)];
}

function classEntitySupportsAttributes(kind: ClassEntity['kind']): boolean {
  return normalizeClassEntityKindValue(kind) !== 'interface';
}

function classEntitySupportsMethods(kind: ClassEntity['kind']): boolean {
  return normalizeClassEntityKindValue(kind) !== 'enum';
}

function classEntityAttributeSectionLabel(kind: ClassEntity['kind']): string {
  const normalized = normalizeClassEntityKindValue(kind);
  if (normalized === 'enum') return 'Literals';
  if (normalized === 'datatype') return 'Properties';
  return 'Attributes';
}

function classEntityMethodSectionLabel(kind: ClassEntity['kind']): string {
  return normalizeClassEntityKindValue(kind) === 'interface' ? 'Operations' : 'Methods';
}

function classMethodReturnTypeOptions(classes: ClassEntity[]): string[] {
  const classifierTypes = classes
    .map((entity) => entity.name.trim())
    .filter(Boolean)
    .flatMap((name) => [name, `List<${name}>`]);

  return Array.from(new Set([...UML_METHOD_RETURN_TYPES, ...classifierTypes]));
}

function classSortModeLabel(mode: ClassSortMode): string {
  if (mode === 'asc') return 'A-Z';
  if (mode === 'desc') return 'Z-A';
  return 'Manual';
}

function visibilitySymbol(visibility: ClassMemberVisibility): string {
  if (visibility === 'private') return '-';
  if (visibility === 'protected') return '#';
  return '+';
}

function visibilityLabel(visibility: ClassMemberVisibility): string {
  if (visibility === 'private') return 'private';
  if (visibility === 'protected') return 'protected';
  return 'public';
}

function nextVisibility(visibility: ClassMemberVisibility): ClassMemberVisibility {
  const currentIndex = VISIBILITY_ORDER.indexOf(visibility);
  return VISIBILITY_ORDER[(currentIndex + 1) % VISIBILITY_ORDER.length] ?? 'public';
}

function normalizeAttributeMultiplicityValue(value: ClassAttributeMultiplicity | undefined): ClassAttributeMultiplicity {
  return value === 'optional' || value === 'many' ? value : 'one';
}

function attributeMultiplicityLabel(value: ClassAttributeMultiplicity | undefined): string {
  const normalized = normalizeAttributeMultiplicityValue(value);
  if (normalized === 'optional') return '0..1';
  if (normalized === 'many') return '0..*';
  return '1';
}

function attributeMultiplicityTooltip(value: ClassAttributeMultiplicity | undefined): string {
  const normalized = normalizeAttributeMultiplicityValue(value);
  if (normalized === 'optional') return 'Multiplicity: zero or one';
  if (normalized === 'many') return 'Multiplicity: zero or many';
  return 'Multiplicity: exactly one';
}

function nextAttributeMultiplicity(value: ClassAttributeMultiplicity | undefined): ClassAttributeMultiplicity {
  const normalized = normalizeAttributeMultiplicityValue(value);
  const index = ATTRIBUTE_MULTIPLICITY_ORDER.indexOf(normalized);
  return ATTRIBUTE_MULTIPLICITY_ORDER[(index + 1) % ATTRIBUTE_MULTIPLICITY_ORDER.length] ?? 'one';
}

function memberTypeOptions(currentValue: string | undefined, baseOptions: string[]): string[] {
  const value = currentValue?.trim();
  if (!value || baseOptions.includes(value)) return baseOptions;
  return [value, ...baseOptions];
}

function relationLabel(type: ClassRelationType): string {
  switch (type) {
    case 'inheritance':
      return 'inherits';
    case 'composition':
      return 'contains';
    case 'aggregation':
      return 'uses';
    case 'dependency':
      return 'depends on';
    default:
      return 'has';
  }
}

function estimateClassNodeHeight(entity: ClassEntity): number {
  const attributeHeight = classEntitySupportsAttributes(entity.kind) ? 36 + Math.max(entity.attributes.length, 1) * 36 : 0;
  const methodHeight = classEntitySupportsMethods(entity.kind) ? 36 + Math.max(entity.methods.length, 1) * 36 : 0;
  return HEADER_HEIGHT + attributeHeight + methodHeight + 10;
}

function createClassEntity(index: number, kind: ClassEntityKind = 'class'): ClassEntity {
  const meta = getClassEntityKindMeta(kind);
  const supportsAttributes = classEntitySupportsAttributes(kind);
  const supportsMethods = classEntitySupportsMethods(kind);
  return {
    id: nextId('class'),
    name: `${meta.label.replace(/\s+/g, '')}${index + 1}`,
    kind,
    attributes: supportsAttributes ? [
      {
        id: nextId('attribute'),
        name: kind === 'enum' ? 'Value1' : 'id',
        type: kind === 'enum' ? 'literal' : 'string',
        visibility: 'public',
        multiplicity: 'one',
        required: true,
      },
    ] : [],
    methods: supportsMethods ? [
      {
        id: nextId('method'),
        name: kind === 'interface' ? 'operation1' : 'create',
        returnType: 'void',
        visibility: 'public',
      },
    ] : [],
    position: { x: 160 + index * 48, y: 140 + index * 48 },
    color: meta.color || DOMAIN_COLORS[index % DOMAIN_COLORS.length],
    sidebarOrder: index,
  };
}

function applyDomainsToSchema(schema: ProjectData['schema'], domains: Domain[]): ProjectData['schema'] {
  const domainIds = new Set(domains.map((domain) => domain.id));
  return {
    ...schema,
    domains,
    tables: schema.tables.map((table) => ({
      ...table,
      domainId: table.domainId && domainIds.has(table.domainId) ? table.domainId : undefined,
    })),
    enums: schema.enums.map((enumType) => ({
      ...enumType,
      domainId: enumType.domainId && domainIds.has(enumType.domainId) ? enumType.domainId : undefined,
    })),
    jsonSchemas: (schema.jsonSchemas ?? []).map((doc) => ({
      ...doc,
      domainId: doc.domainId && domainIds.has(doc.domainId) ? doc.domainId : undefined,
    })),
  };
}

function buildSavedProject(
  project: ProjectData,
  documentId: string,
  documentName: string,
  diagram: ClassDiagramModel,
): ProjectData {
  const now = new Date().toISOString();
  const domains = diagram.domains;
  const normalizedDiagram = normalizeClassDiagram(diagram, domains);
  return {
    ...project,
    domains,
    schema: applyDomainsToSchema(project.schema, domains),
    documents: project.documents.map((document) => {
      if (document.type === 'erd') {
        return {
          ...document,
          erd: applyDomainsToSchema(document.erd, domains),
        };
      }
      if (document.type !== 'class-diagram') return document;
      if (document.id !== documentId) {
        return {
          ...document,
          classDiagram: normalizeClassDiagram(document.classDiagram, domains),
        };
      }
      return {
        ...document,
        name: documentName.trim() || document.name,
        classDiagram: normalizedDiagram,
        updatedAt: now,
      };
    }),
    updatedAt: now,
  };
}

function ClassAttributeMultiplicityButton({
  value,
  onChange,
}: {
  value?: ClassAttributeMultiplicity;
  onChange: (value: ClassAttributeMultiplicity) => void;
}) {
  return (
    <ProTooltip label={attributeMultiplicityTooltip(value)}>
      <button
        type="button"
        data-class-inline-action
        data-class-attribute-multiplicity
        className="flex h-5 min-w-8 shrink-0 items-center justify-center rounded bg-gray-100 px-1.5 text-[10px] font-semibold tabular-nums text-gray-500 hover:bg-gray-200 hover:text-gray-800"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onChange(nextAttributeMultiplicity(value));
        }}
      >
        {attributeMultiplicityLabel(value)}
      </button>
    </ProTooltip>
  );
}

function ClassVisibilityButton({
  value,
  onChange,
}: {
  value: ClassMemberVisibility;
  onChange: (value: ClassMemberVisibility) => void;
}) {
  return (
    <ProTooltip label={`Visibility: ${visibilityLabel(value)}`}>
      <button
        type="button"
        data-class-inline-action
        data-class-visibility
        className="flex size-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onChange(nextVisibility(value));
        }}
      >
        {visibilitySymbol(value)}
      </button>
    </ProTooltip>
  );
}

function ClassNode({
  entity,
  color,
  isSelected,
  screenToWorld,
  onSelect,
  onPositionChange,
  onDragStop,
  onStartRelation,
  onAddAttribute,
  onUpdateAttribute,
  onReorderAttributes,
  onAddMethod,
  onUpdateMethod,
  onReorderMethods,
  onBeforeMemberChange,
  methodReturnTypeOptions,
}: {
  entity: ClassEntity;
  color: string;
  isSelected: boolean;
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  onSelect: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onDragStop: () => void;
  onStartRelation: (id: string, position: ClassRelationHandlePosition, event: React.MouseEvent) => void;
  onAddAttribute: (classId: string) => void;
  onUpdateAttribute: (classId: string, attributeId: string, updates: Partial<ClassAttribute>) => void;
  onReorderAttributes: (classId: string, fromIndex: number, toIndex: number) => void;
  onAddMethod: (classId: string) => void;
  onUpdateMethod: (classId: string, methodId: string, updates: Partial<ClassMethod>) => void;
  onReorderMethods: (classId: string, fromIndex: number, toIndex: number) => void;
  onBeforeMemberChange: () => void;
  methodReturnTypeOptions: string[];
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number } | null>(null);
  const [editingMember, setEditingMember] = useState<{
    kind: 'attribute' | 'method';
    id: string;
    value: string;
  } | null>(null);
  const entityKind = normalizeClassEntityKindValue(entity.kind);
  const kindMeta = getClassEntityKindMeta(entity.kind);
  const showAttributes = classEntitySupportsAttributes(entity.kind);
  const showMethods = classEntitySupportsMethods(entity.kind);
  const attributeSectionLabel = classEntityAttributeSectionLabel(entity.kind);
  const methodSectionLabel = classEntityMethodSectionLabel(entity.kind);
  const relationHandleClass = 'absolute z-30 size-3 rounded-full border-2 border-blue-500 bg-white opacity-0 transition-colors hover:bg-blue-500 group-hover/class-node:opacity-100';
  const relationHandles: Array<{ position: ClassRelationHandlePosition; className: string; label: string }> = [
    { position: 'top', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', label: 'Connect from top' },
    { position: 'right', className: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2', label: 'Connect from right' },
    { position: 'bottom', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', label: 'Connect from bottom' },
    { position: 'left', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', label: 'Connect from left' },
  ];

  useEffect(() => {
    setEditingMember(null);
  }, [entity.id]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (!target.closest('[data-class-drag-handle]')) return;
      if (target.closest('[data-class-relation-handle], [data-class-inline-action], button, input, select, textarea')) return;
      const pointer = screenToWorld(event.clientX, event.clientY);
      dragState.current = {
        x: pointer.x - entity.position.x,
        y: pointer.y - entity.position.y,
      };
      onSelect(entity.id);
      onDragStop();
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragState.current) return;
      const pointer = screenToWorld(event.clientX, event.clientY);
      onPositionChange(entity.id, {
        x: pointer.x - dragState.current.x,
        y: pointer.y - dragState.current.y,
      });
    };

    const handleMouseUp = () => {
      dragState.current = null;
    };

    node.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      node.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [entity.id, entity.position.x, entity.position.y, onDragStop, onPositionChange, onSelect, screenToWorld]);

  const commitMemberRename = useCallback(() => {
    if (!editingMember) return;
    const name = editingMember.value.trim();
    setEditingMember(null);
    if (!name) return;
    if (editingMember.kind === 'attribute') {
      const current = entity.attributes.find((attribute) => attribute.id === editingMember.id);
      if (current && current.name !== name) {
        onBeforeMemberChange();
        onUpdateAttribute(entity.id, editingMember.id, { name });
      }
      return;
    }
    const current = entity.methods.find((method) => method.id === editingMember.id);
    if (current && current.name !== name) {
      onBeforeMemberChange();
      onUpdateMethod(entity.id, editingMember.id, { name });
    }
  }, [editingMember, entity.attributes, entity.id, entity.methods, onBeforeMemberChange, onUpdateAttribute, onUpdateMethod]);

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Escape') {
      setEditingMember(null);
    }
  };

  const attributeIds = useMemo(() => entity.attributes.map((attribute) => attribute.id), [entity.attributes]);
  const attributeById = useMemo(
    () => new Map(entity.attributes.map((attribute) => [attribute.id, attribute])),
    [entity.attributes],
  );
  const attributeDnd = useReorderableDragList({
    itemIds: attributeIds,
    enabled: entity.attributes.length > 1,
    onCommit: (fromIndex, toIndex) => onReorderAttributes(entity.id, fromIndex, toIndex),
  });
  const attributeDndIndexById = useMemo(() => {
    const map = new Map<string, number>();
    attributeDnd.renderedIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [attributeDnd.renderedIds]);
  const renderedAttributes = useMemo(
    () => attributeDnd.renderedIds.map((id) => attributeById.get(id)).filter((attribute): attribute is ClassAttribute => Boolean(attribute)),
    [attributeById, attributeDnd.renderedIds],
  );

  const methodIds = useMemo(() => entity.methods.map((method) => method.id), [entity.methods]);
  const methodById = useMemo(
    () => new Map(entity.methods.map((method) => [method.id, method])),
    [entity.methods],
  );
  const methodDnd = useReorderableDragList({
    itemIds: methodIds,
    enabled: entity.methods.length > 1,
    onCommit: (fromIndex, toIndex) => onReorderMethods(entity.id, fromIndex, toIndex),
  });
  const methodDndIndexById = useMemo(() => {
    const map = new Map<string, number>();
    methodDnd.renderedIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [methodDnd.renderedIds]);
  const renderedMethods = useMemo(
    () => methodDnd.renderedIds.map((id) => methodById.get(id)).filter((method): method is ClassMethod => Boolean(method)),
    [methodById, methodDnd.renderedIds],
  );

  return (
    <div
      ref={nodeRef}
      className="group/class-node pointer-events-auto absolute select-none rounded-lg bg-white shadow-sm"
      style={{
        left: entity.position.x,
        top: entity.position.y,
        width: CLASS_WIDTH,
        border: isSelected ? `3px solid ${color}` : '1px solid #e5e7eb',
        boxShadow: isSelected
          ? `0 10px 25px -3px ${color}30, 0 0 0 3px ${color}20`
          : '0 4px 10px -6px rgba(15,23,42,0.35)',
      }}
      data-class-id={entity.id}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(entity.id);
      }}
    >
      <div
        className="relative flex h-[42px] cursor-move items-center justify-between rounded-t-md px-4 text-white"
        style={{ backgroundColor: color }}
        data-class-header={entity.id}
        data-class-drag-handle
      >
        <div className="min-w-0">
          <div className={cn('truncate text-sm font-semibold', entityKind === 'abstract-class' && 'italic')}>
            {entity.name}
          </div>
          {entity.mappedTableId && <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/70">mapped</div>}
        </div>
        <span className="ml-3 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/30">
          {kindMeta.shortLabel}
        </span>
      </div>

      {relationHandles.map((handle) => (
        <ProTooltip key={handle.position} label={handle.label}>
          <button
            type="button"
            data-class-relation-handle
            data-class-relation-handle-position={handle.position}
            className={cn(relationHandleClass, handle.className)}
            onMouseDown={(event) => onStartRelation(entity.id, handle.position, event)}
          />
        </ProTooltip>
      ))}

      {showAttributes && (
        <>
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{attributeSectionLabel}</span>
            <ProTooltip label={`Add ${attributeSectionLabel.toLowerCase().slice(0, -1)}`}>
              <button
                type="button"
                data-class-inline-action
                data-class-add-attribute
                className="flex size-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(entity.id);
                  onAddAttribute(entity.id);
                }}
              >
                <Plus className="size-3" />
              </button>
            </ProTooltip>
          </div>
          <div className="divide-y divide-gray-100">
            {entity.attributes.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-400">No {attributeSectionLabel.toLowerCase()}</div>
            ) : (
              renderedAttributes.map((attribute) => {
            const dndIndex = attributeDndIndexById.get(attribute.id) ?? -1;
            const canReorder = entity.attributes.length > 1 && dndIndex >= 0;
            const isDragSource = attributeDnd.draggingItemId === attribute.id;
            const isDragTarget = canReorder && attributeDnd.dragOverIndex === dndIndex;
            return (
              <div
                key={attribute.id}
                draggable={canReorder}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                  canReorder && 'cursor-grab',
                  isDragSource && 'bg-blue-50',
                  isDragTarget && 'ring-2 ring-inset ring-blue-300',
                  attributeDnd.isDragging && !isDragSource && 'opacity-60',
                )}
                onDragStart={canReorder ? (event) => attributeDnd.handleDragStart({ index: dndIndex, itemId: attribute.id, event }) : undefined}
                onDragOver={canReorder ? (event) => attributeDnd.handleDragOver({ index: dndIndex, itemId: attribute.id, event }) : undefined}
                onDragLeave={canReorder ? attributeDnd.handleDragLeave : undefined}
                onDrop={canReorder ? (event) => attributeDnd.handleDrop({ event }) : undefined}
                onDragEnd={canReorder ? attributeDnd.handleDragEnd : undefined}
              >
                <GripVertical className={cn('size-3.5 shrink-0', canReorder ? 'text-gray-300' : 'text-gray-200')} />
                {entityKind !== 'enum' && (
                  <ClassVisibilityButton
                    value={attribute.visibility}
                    onChange={(visibility) => {
                      onBeforeMemberChange();
                      onUpdateAttribute(entity.id, attribute.id, { visibility });
                    }}
                  />
                )}
                {editingMember?.kind === 'attribute' && editingMember.id === attribute.id ? (
                  <input
                    data-class-inline-action
                    data-class-member-name
                    value={editingMember.value}
                    onChange={(event) => setEditingMember({ kind: 'attribute', id: attribute.id, value: event.target.value })}
                    onBlur={commitMemberRename}
                    onKeyDown={handleRenameKeyDown}
                    onFocus={(event) => event.currentTarget.select()}
                    autoFocus
                    className="h-6 min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 text-sm text-gray-800 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    data-class-inline-action
                    data-class-member-name
                    className="min-w-0 flex-1 truncate text-left text-gray-800"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(entity.id);
                      if (event.detail < 2) return;
                      setEditingMember({ kind: 'attribute', id: attribute.id, value: attribute.name });
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setEditingMember({ kind: 'attribute', id: attribute.id, value: attribute.name });
                    }}
                  >
                    {attribute.name}
                  </button>
                )}
                {entityKind !== 'enum' && (
                  <>
                    <ClassAttributeMultiplicityButton
                      value={attribute.multiplicity}
                      onChange={(multiplicity) => {
                        onBeforeMemberChange();
                        onUpdateAttribute(entity.id, attribute.id, { multiplicity, required: multiplicity === 'one' });
                      }}
                    />
                    <DataTypeSelect
                      value={attribute.type}
                      options={memberTypeOptions(attribute.type, CLASS_ATTRIBUTE_TYPES)}
                      label="Change attribute type"
                      inlineAction
                      onChange={(type) => {
                        onBeforeMemberChange();
                        onUpdateAttribute(entity.id, attribute.id, { type });
                      }}
                    />
                  </>
                )}
              </div>
            );
              })
            )}
          </div>
        </>
      )}

      {showMethods && (
        <>
          <div className="flex items-center justify-between border-y border-gray-100 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{methodSectionLabel}</span>
            <ProTooltip label={`Add ${methodSectionLabel.toLowerCase().slice(0, -1)}`}>
              <button
                type="button"
                data-class-inline-action
                data-class-add-method
                className="flex size-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(entity.id);
                  onAddMethod(entity.id);
                }}
              >
                <Plus className="size-3" />
              </button>
            </ProTooltip>
          </div>
          <div className="divide-y divide-gray-100 rounded-b-lg">
            {entity.methods.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-400">No {methodSectionLabel.toLowerCase()}</div>
            ) : (
              renderedMethods.map((method) => {
            const dndIndex = methodDndIndexById.get(method.id) ?? -1;
            const canReorder = entity.methods.length > 1 && dndIndex >= 0;
            const isDragSource = methodDnd.draggingItemId === method.id;
            const isDragTarget = canReorder && methodDnd.dragOverIndex === dndIndex;
            return (
              <div
                key={method.id}
                draggable={canReorder}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                  canReorder && 'cursor-grab',
                  isDragSource && 'bg-blue-50',
                  isDragTarget && 'ring-2 ring-inset ring-blue-300',
                  methodDnd.isDragging && !isDragSource && 'opacity-60',
                )}
                onDragStart={canReorder ? (event) => methodDnd.handleDragStart({ index: dndIndex, itemId: method.id, event }) : undefined}
                onDragOver={canReorder ? (event) => methodDnd.handleDragOver({ index: dndIndex, itemId: method.id, event }) : undefined}
                onDragLeave={canReorder ? methodDnd.handleDragLeave : undefined}
                onDrop={canReorder ? (event) => methodDnd.handleDrop({ event }) : undefined}
                onDragEnd={canReorder ? methodDnd.handleDragEnd : undefined}
              >
                <GripVertical className={cn('size-3.5 shrink-0', canReorder ? 'text-gray-300' : 'text-gray-200')} />
                <ClassVisibilityButton
                  value={method.visibility}
                  onChange={(visibility) => {
                    onBeforeMemberChange();
                    onUpdateMethod(entity.id, method.id, { visibility });
                  }}
                />
                {editingMember?.kind === 'method' && editingMember.id === method.id ? (
                  <input
                    data-class-inline-action
                    data-class-member-name
                    value={editingMember.value}
                    onChange={(event) => setEditingMember({ kind: 'method', id: method.id, value: event.target.value })}
                    onBlur={commitMemberRename}
                    onKeyDown={handleRenameKeyDown}
                    onFocus={(event) => event.currentTarget.select()}
                    autoFocus
                    className="h-6 min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 text-sm text-gray-800 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    data-class-inline-action
                    data-class-member-name
                    className="min-w-0 flex-1 truncate text-left text-gray-800"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(entity.id);
                      if (event.detail < 2) return;
                      setEditingMember({ kind: 'method', id: method.id, value: method.name });
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setEditingMember({ kind: 'method', id: method.id, value: method.name });
                    }}
                  >
                    {method.name}({method.parameters || ''})
                  </button>
                )}
                <DataTypeSelect
                  value={method.returnType || 'void'}
                  options={memberTypeOptions(method.returnType || 'void', methodReturnTypeOptions)}
                  label="Change return type"
                  inlineAction
                  onChange={(returnType) => {
                    onBeforeMemberChange();
                    onUpdateMethod(entity.id, method.id, { returnType });
                  }}
                />
              </div>
            );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ClassDiagramCanvas({
  diagram,
  selectedClassId,
  selectedRelationId,
  onSelectClass,
  onSelectRelation,
  onClearSelection,
  onUpdateClass,
  onAddRelation,
  onPushHistory,
  onAddAttribute,
  onUpdateAttribute,
  onReorderAttributes,
  onAddMethod,
  onUpdateMethod,
  onReorderMethods,
  relationsVisible,
  fitViewportSignal,
}: {
  diagram: ClassDiagramModel;
  selectedClassId: string | null;
  selectedRelationId: string | null;
  onSelectClass: (id: string) => void;
  onSelectRelation: (id: string) => void;
  onClearSelection: () => void;
  onUpdateClass: (id: string, updates: Partial<ClassEntity>) => void;
  onAddRelation: (fromClassId: string, toClassId: string) => void;
  onPushHistory: () => void;
  onAddAttribute: (classId: string) => void;
  onUpdateAttribute: (classId: string, attributeId: string, updates: Partial<ClassAttribute>) => void;
  onReorderAttributes: (classId: string, fromIndex: number, toIndex: number) => void;
  onAddMethod: (classId: string) => void;
  onUpdateMethod: (classId: string, methodId: string, updates: Partial<ClassMethod>) => void;
  onReorderMethods: (classId: string, fromIndex: number, toIndex: number) => void;
  relationsVisible: boolean;
  fitViewportSignal: number;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [relationDrag, setRelationDrag] = useState<{
    fromClassId: string;
    fromAnchor: { x: number; y: number };
    x: number;
    y: number;
  } | null>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  panRef.current = pan;
  zoomRef.current = zoom;

  const classById = useMemo(() => new Map(diagram.classes.map((entity) => [entity.id, entity])), [diagram.classes]);
  const domainById = useMemo(() => new Map(diagram.domains.map((domain) => [domain.id, domain])), [diagram.domains]);
  const methodReturnTypeOptions = useMemo(() => classMethodReturnTypeOptions(diagram.classes), [diagram.classes]);
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const getClassHandleAnchor = useCallback((entity: ClassEntity, position: ClassRelationHandlePosition) => {
    const nodeHeight = estimateClassNodeHeight(entity);
    if (position === 'top') return { x: entity.position.x + CLASS_WIDTH / 2, y: entity.position.y };
    if (position === 'bottom') return { x: entity.position.x + CLASS_WIDTH / 2, y: entity.position.y + nodeHeight };
    if (position === 'left') return { x: entity.position.x, y: entity.position.y + nodeHeight / 2 };
    return { x: entity.position.x + CLASS_WIDTH, y: entity.position.y + nodeHeight / 2 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        const wx = (mx - panRef.current.x) / zoomRef.current;
        const wy = (my - panRef.current.y) / zoomRef.current;
        const nextZoom = Math.min(2.5, Math.max(0.25, zoomRef.current * (1 - event.deltaY * 0.001)));
        setPan({ x: mx - wx * nextZoom, y: my - wy * nextZoom });
        setZoom(nextZoom);
        return;
      }
      setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return;
      panStart.current = { x: event.clientX - panRef.current.x, y: event.clientY - panRef.current.y };
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!panStart.current) return;
      setPan({ x: event.clientX - panStart.current.x, y: event.clientY - panStart.current.y });
    };

    const handleMouseUp = () => {
      panStart.current = null;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const fitToViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || diagram.classes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const padding = 80;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const entity of diagram.classes) {
      minX = Math.min(minX, entity.position.x);
      minY = Math.min(minY, entity.position.y);
      maxX = Math.max(maxX, entity.position.x + CLASS_WIDTH);
      maxY = Math.max(maxY, entity.position.y + estimateClassNodeHeight(entity));
    }

    const contentWidth = Math.max(1, maxX - minX + padding * 2);
    const contentHeight = Math.max(1, maxY - minY + padding * 2);
    const nextZoom = Math.min(1.5, Math.max(0.25, Math.min(rect.width / contentWidth, rect.height / contentHeight)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setPan({ x: rect.width / 2 - centerX * nextZoom, y: rect.height / 2 - centerY * nextZoom });
    setZoom(nextZoom);
  }, [diagram.classes]);

  useEffect(() => {
    if (fitViewportSignal <= 0) return;
    fitToViewport();
  }, [fitToViewport, fitViewportSignal]);

  useEffect(() => {
    if (!relationDrag) return;

    const handleMouseMove = (event: MouseEvent) => {
      const pointer = screenToWorld(event.clientX, event.clientY);
      setRelationDrag((current) => current
        ? {
            ...current,
            x: pointer.x,
            y: pointer.y,
          }
        : null);
    };

    const handleMouseUp = (event: MouseEvent) => {
      const target = document.elementsFromPoint(event.clientX, event.clientY)
        .map((element) => (
          (element as HTMLElement).getAttribute('data-class-id') ||
          (element as HTMLElement).closest('[data-class-id]')?.getAttribute('data-class-id')
        ))
        .find(Boolean);
      if (target && target !== relationDrag.fromClassId) {
        onAddRelation(relationDrag.fromClassId, target);
      }
      setRelationDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onAddRelation, relationDrag, screenToWorld]);

  const getClassEdgeAnchor = useCallback((classId: string, otherId: string) => {
    const entity = classById.get(classId);
    const other = classById.get(otherId);
    if (!entity || !other) return null;
    const entityHeight = estimateClassNodeHeight(entity);
    const otherHeight = estimateClassNodeHeight(other);
    const sourceCenter = {
      x: entity.position.x + CLASS_WIDTH / 2,
      y: entity.position.y + entityHeight / 2,
    };
    const targetCenter = {
      x: other.position.x + CLASS_WIDTH / 2,
      y: other.position.y + otherHeight / 2,
    };
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    if (Math.abs(dx) / CLASS_WIDTH >= Math.abs(dy) / Math.max(entityHeight, 1)) {
      return getClassHandleAnchor(entity, dx >= 0 ? 'right' : 'left');
    }
    return getClassHandleAnchor(entity, dy >= 0 ? 'bottom' : 'top');
  }, [classById, getClassHandleAnchor]);

  const drawRelation = (relation: ClassRelation) => {
    const from = getClassEdgeAnchor(relation.fromClassId, relation.toClassId);
    const to = getClassEdgeAnchor(relation.toClassId, relation.fromClassId);
    if (!from || !to) return null;
    const isSelected = selectedRelationId === relation.id;
    const color = isSelected ? '#2563eb' : '#94a3b8';
    const cp = Math.max(80, Math.abs(to.x - from.x) * 0.4);
    const fromDir = to.x > from.x ? 1 : -1;
    const toDir = to.x > from.x ? -1 : 1;
    const path = `M ${from.x} ${from.y} C ${from.x + cp * fromDir} ${from.y}, ${to.x + cp * toDir} ${to.y}, ${to.x} ${to.y}`;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const label = relation.label || relationLabel(relation.type);

    return (
      <g key={relation.id}>
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          data-class-relation={relation.id}
          className="cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            onSelectRelation(relation.id);
          }}
        />
        <path d={path} fill="none" stroke={color} strokeWidth={isSelected ? 2.5 : 1.6} strokeDasharray={relation.type === 'dependency' ? '7 4' : undefined} className="pointer-events-none" />
        {relation.type === 'inheritance' && (
          <path d={`M ${to.x} ${to.y} l ${-12 * toDir} -7 l 0 14 Z`} fill="white" stroke={color} strokeWidth={1.5} className="pointer-events-none" />
        )}
        <g
          data-class-relation={relation.id}
          data-class-relation-label={relation.id}
          className="cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            onSelectRelation(relation.id);
          }}
        >
          <rect x={midX - 50} y={midY - 14} width="100" height="22" rx="6" fill="white" stroke={isSelected ? '#2563eb' : '#e5e7eb'} />
          <text x={midX} y={midY + 1} textAnchor="middle" fontSize="11" fill={isSelected ? '#2563eb' : '#475569'} fontFamily="system-ui">{label}</text>
        </g>
      </g>
    );
  };

  const dragLine = relationDrag && (() => {
    const start = relationDrag.fromAnchor;
    return (
      <path
        d={`M ${start.x} ${start.y} C ${start.x + 90} ${start.y}, ${relationDrag.x - 90} ${relationDrag.y}, ${relationDrag.x} ${relationDrag.y}`}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
        strokeDasharray="7 4"
      />
    );
  })();

  return (
    <div
      ref={canvasRef}
      className="relative size-full overflow-hidden bg-gray-50"
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest('[data-class-id]')) return;
        if ((event.target as HTMLElement).closest('[data-class-relation]')) return;
        onClearSelection();
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <svg className="absolute overflow-visible" style={{ width: WORLD_EXTENT, height: WORLD_EXTENT }}>
          {relationsVisible && diagram.relations.map(drawRelation)}
          {dragLine}
        </svg>
        <div className="pointer-events-none relative" style={{ minWidth: WORLD_EXTENT, minHeight: WORLD_EXTENT }}>
          {diagram.classes.map((entity) => (
            <ClassNode
              key={entity.id}
              entity={entity}
              color={entity.domainId ? domainById.get(entity.domainId)?.color || entity.color || '#6366f1' : entity.color || '#6366f1'}
              isSelected={selectedClassId === entity.id}
              screenToWorld={screenToWorld}
              onSelect={onSelectClass}
              onPositionChange={(id, position) => onUpdateClass(id, { position })}
              onDragStop={onPushHistory}
              onAddAttribute={onAddAttribute}
              onUpdateAttribute={onUpdateAttribute}
              onReorderAttributes={onReorderAttributes}
              onAddMethod={onAddMethod}
              onUpdateMethod={onUpdateMethod}
              onReorderMethods={onReorderMethods}
              onBeforeMemberChange={onPushHistory}
              methodReturnTypeOptions={methodReturnTypeOptions}
              onStartRelation={(id, handlePosition, event) => {
                event.stopPropagation();
                event.preventDefault();
                const entityForAnchor = classById.get(id);
                if (!entityForAnchor) return;
                const pointer = screenToWorld(event.clientX, event.clientY);
                setRelationDrag({
                  fromClassId: id,
                  fromAnchor: getClassHandleAnchor(entityForAnchor, handlePosition),
                  x: pointer.x,
                  y: pointer.y,
                });
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-12 right-3 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow-sm">
        {Math.round(zoom * 100)}%
      </div>
      {diagram.classes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          Create an entity to start the class diagram.
        </div>
      )}
    </div>
  );
}

function ClassSidebar({
  diagram,
  selectedClassId,
  query,
  onQueryChange,
  onAddClass,
  onAddDomain,
  onUpdateDomain,
  onDeleteDomain,
  onReorderDomains,
  onReorderClasses,
  onRenameClass,
  onAssignDomain,
  onRemoveFromDomain,
  onSelectClass,
  onToggleCollapse,
}: {
  diagram: ClassDiagramModel;
  selectedClassId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onAddClass: (kind?: ClassEntityKind) => void;
  onAddDomain: (name?: string) => void;
  onUpdateDomain: (id: string, updates: Partial<Omit<Domain, 'id'>>) => void;
  onDeleteDomain: (id: string) => void;
  onReorderDomains: (orderedIds: string[]) => void;
  onReorderClasses: (orderedIds: string[]) => void;
  onRenameClass: (id: string, name: string) => void;
  onAssignDomain: (domainId: string, classIds: string[]) => void;
  onRemoveFromDomain: (classId: string) => void;
  onSelectClass: (id: string) => void;
  onToggleCollapse: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'entities' | 'domains'>('entities');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<ClassGroupMode>('domain');
  const [sortMode, setSortMode] = useState<ClassSortMode>('manual');
  const [visibleKinds, setVisibleKinds] = useState<Record<ClassEntityKind, boolean>>({ ...DEFAULT_VISIBLE_CLASS_ENTITY_KINDS });
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [renamingDomainId, setRenamingDomainId] = useState<string | null>(null);
  const [renamingDomainName, setRenamingDomainName] = useState('');
  const [renamingClassId, setRenamingClassId] = useState<string | null>(null);
  const [renamingClassName, setRenamingClassName] = useState('');
  const [classDomainDropTargetId, setClassDomainDropTargetId] = useState<string | null>(null);
  const [draggingClassId, setDraggingClassId] = useState<string | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());
  const [pendingMove, setPendingMove] = useState<{ classId: string; targetDomainId: string | null; targetDomainName: string } | null>(null);
  const [sidebarEngaged, setSidebarEngaged] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const draggingClassIdRef = useRef<string | null>(null);

  const manualOrderedClasses = useMemo(() => (
    [...diagram.classes].sort((a, b) => {
      const aOrder = a.sidebarOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sidebarOrder ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    })
  ), [diagram.classes]);
  const orderedClasses = useMemo(() => {
    if (sortMode === 'asc') return [...manualOrderedClasses].sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === 'desc') return [...manualOrderedClasses].sort((a, b) => b.name.localeCompare(a.name));
    return manualOrderedClasses;
  }, [manualOrderedClasses, sortMode]);

  const filteredClasses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orderedClasses.filter((entity) => {
      const kind = normalizeClassEntityKindValue(entity.kind);
      if (!visibleKinds[kind]) return false;
      if (!normalizedQuery) return true;
      return entity.name.toLowerCase().includes(normalizedQuery);
    });
  }, [orderedClasses, query, visibleKinds]);

  const domainById = useMemo(() => new Map(diagram.domains.map((domain) => [domain.id, domain])), [diagram.domains]);
  const classDndIds = useMemo(() => orderedClasses.map((entity) => entity.id), [orderedClasses]);
  const classDnd = useReorderableDragList({
    itemIds: classDndIds,
    enabled: activeTab === 'entities' && sortMode === 'manual' && !query.trim(),
    onCommit: (fromIndex, toIndex) => {
      const next = [...classDndIds];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      onReorderClasses(next);
    },
  });
  const classDndIndexById = useMemo(() => {
    const map = new Map<string, number>();
    classDnd.renderedIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [classDnd.renderedIds]);
  const classRenderRankById = useMemo(() => {
    const map = new Map<string, number>();
    classDnd.renderedIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [classDnd.renderedIds]);
  const domainDndIds = useMemo(() => diagram.domains.map((domain) => domain.id), [diagram.domains]);
  const domainDnd = useReorderableDragList({
    itemIds: domainDndIds,
    enabled: activeTab === 'domains',
    onCommit: (fromIndex, toIndex) => {
      const next = [...domainDndIds];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      onReorderDomains(next);
    },
  });
  const domainDndIndexById = useMemo(() => {
    const map = new Map<string, number>();
    domainDnd.renderedIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [domainDnd.renderedIds]);
  const renderedDomains = useMemo(
    () => domainDnd.renderedIds.map((id) => domainById.get(id)).filter((domain): domain is Domain => Boolean(domain)),
    [domainById, domainDnd.renderedIds],
  );
  const classGroups = useMemo<ClassSidebarGroup[]>(() => {
    const sortClasses = (classes: ClassEntity[]) => classes
      .slice()
      .sort((a, b) => (classRenderRankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (classRenderRankById.get(b.id) ?? Number.MAX_SAFE_INTEGER));

    if (groupMode === 'none') {
      return [{
        id: '__all__',
        label: 'All entities',
        color: '#d1d5db',
        classes: sortClasses(filteredClasses),
        targetDomainId: null,
        acceptsDomainDrop: false,
      }].filter((group) => group.classes.length > 0);
    }

    if (groupMode === 'kind') {
      return CLASS_ENTITY_KIND_ORDER.map((kind) => {
        const meta = CLASS_ENTITY_KIND_META[kind];
        return {
          id: `kind_${kind}`,
          label: meta.label,
          color: meta.color,
          classes: sortClasses(filteredClasses.filter((entity) => normalizeClassEntityKindValue(entity.kind) === kind)),
          targetDomainId: null,
          acceptsDomainDrop: false,
        };
      }).filter((group) => group.classes.length > 0);
    }

    const groups = diagram.domains.map((domain) => ({
      id: domain.id,
      label: domain.name,
      color: domain.color,
      classes: sortClasses(filteredClasses.filter((entity) => entity.domainId === domain.id)),
      targetDomainId: domain.id,
      acceptsDomainDrop: true,
    }));
    const unassigned = sortClasses(filteredClasses.filter((entity) => !entity.domainId || !domainById.has(entity.domainId)));
    return [
      ...groups.filter((group) => group.classes.length > 0),
      {
        id: '__unassigned__',
        label: 'No domain',
        color: '#d1d5db',
        classes: unassigned,
        targetDomainId: null,
        acceptsDomainDrop: true,
      },
    ].filter((group) => group.classes.length > 0);
  }, [classRenderRankById, diagram.domains, domainById, filteredClasses, groupMode]);

  const selectedClass = selectedClassId ? diagram.classes.find((entity) => entity.id === selectedClassId) ?? null : null;
  const hasActiveEntityFilters = groupMode !== 'domain' || CLASS_ENTITY_KIND_ORDER.some((kind) => !visibleKinds[kind]);
  const collapsibleGroupIds = useMemo(() => classGroups.map((group) => group.id), [classGroups]);
  const areAllGroupsCollapsed = collapsibleGroupIds.length > 0 && collapsibleGroupIds.every((id) => collapsedGroupIds.has(id));
  const handleCollapseAllGroups = useCallback(() => {
    setCollapsedGroupIds(new Set(collapsibleGroupIds));
  }, [collapsibleGroupIds]);

  const commitDomainRename = (domainId: string) => {
    const name = renamingDomainName.trim();
    if (name) onUpdateDomain(domainId, { name });
    setRenamingDomainId(null);
    setRenamingDomainName('');
  };

  const commitClassRename = (classId: string) => {
    const name = renamingClassName.trim();
    if (name) onRenameClass(classId, name);
    setRenamingClassId(null);
    setRenamingClassName('');
  };

  const handleAddDomain = () => {
    onAddDomain(newDomainName.trim() || undefined);
    setNewDomainName('');
    setIsAddingDomain(false);
  };

  const finishClassDrag = () => {
    setDraggingClassId(null);
    setClassDomainDropTargetId(null);
    draggingClassIdRef.current = null;
    classDnd.handleDragEnd();
  };

  const requestClassMoveToDomain = (classId: string, targetDomainId: string | null) => {
    const entity = diagram.classes.find((item) => item.id === classId);
    if (!entity) return false;
    const currentDomainId = entity.domainId ?? null;
    if (currentDomainId === targetDomainId) {
      finishClassDrag();
      return false;
    }
    const targetDomain = targetDomainId ? domainById.get(targetDomainId) : null;
    setPendingMove({
      classId,
      targetDomainId,
      targetDomainName: targetDomain?.name ?? 'No domain',
    });
    finishClassDrag();
    return true;
  };

  const moveDraggedClassToDomain = (targetDomainId: string | null) => {
    const classId = draggingClassIdRef.current || draggingClassId;
    if (!classId) return false;
    return requestClassMoveToDomain(classId, targetDomainId);
  };

  const handleGroupDragOver = (event: React.DragEvent, groupId: string) => {
    if (!draggingClassIdRef.current && !event.dataTransfer.types.includes('text/class-id')) return;
    event.preventDefault();
    setClassDomainDropTargetId(groupId);
  };

  const handleGroupDrop = (event: React.DragEvent, targetDomainId: string | null) => {
    event.preventDefault();
    const classId = draggingClassIdRef.current || event.dataTransfer.getData('text/class-id');
    if (classId) {
      draggingClassIdRef.current = classId;
      setDraggingClassId(classId);
      moveDraggedClassToDomain(targetDomainId);
    }
  };

  const renderEntityRow = (entity: ClassEntity) => {
    const domain = entity.domainId ? domainById.get(entity.domainId) : null;
    const kind = normalizeClassEntityKindValue(entity.kind);
    const kindMeta = CLASS_ENTITY_KIND_META[kind];
    const dndIndex = classDndIndexById.get(entity.id) ?? -1;
	    const canDrag = activeTab === 'entities' && sortMode === 'manual' && !query.trim() && dndIndex >= 0 && renamingClassId !== entity.id;
    const isDragSource = classDnd.draggingItemId === entity.id || draggingClassId === entity.id;
    const isDragTarget = canDrag && classDnd.dragOverIndex === dndIndex;
    const shouldDimRow = classDnd.isDragging && !isDragSource;

    return (
      <div
        key={entity.id}
        role="button"
        tabIndex={0}
        data-class-sidebar-entity={entity.id}
        draggable={canDrag}
        onClick={() => onSelectClass(entity.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectClass(entity.id);
          }
        }}
        onDragStart={canDrag ? (event) => {
          classDnd.handleDragStart({ index: dndIndex, itemId: entity.id, event });
          draggingClassIdRef.current = entity.id;
          setDraggingClassId(entity.id);
          event.dataTransfer.setData('text/class-id', entity.id);
        } : undefined}
        onDragOver={canDrag ? (event) => classDnd.handleDragOver({ index: dndIndex, itemId: entity.id, event }) : undefined}
        onDragLeave={canDrag ? classDnd.handleDragLeave : undefined}
	        onDrop={canDrag ? (event) => {
	          const sourceClassId = draggingClassIdRef.current || draggingClassId || event.dataTransfer.getData('text/class-id');
	          const sourceClass = diagram.classes.find((item) => item.id === sourceClassId);
	          if (sourceClass && sourceClass.domainId !== entity.domainId) {
	            event.preventDefault();
	            requestClassMoveToDomain(sourceClass.id, entity.domainId ?? null);
	            return;
	          }
	          classDnd.handleDrop({ event });
	        } : undefined}
	        onDragEnd={canDrag ? finishClassDrag : undefined}
	        className={cn(
	          'group flex w-full cursor-pointer select-none items-center gap-2 py-2 pl-2.5 pr-3 text-left text-sm transition-colors',
	          selectedClassId === entity.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100',
	          isDragSource && 'bg-blue-50 ring-1 ring-inset ring-blue-300',
	          isDragTarget && 'ring-2 ring-inset ring-blue-300',
	          shouldDimRow && 'opacity-55',
	        )}
	        style={{ borderLeft: `3px solid ${domain?.color ?? 'transparent'}` }}
	      >
	        <GripVertical className={cn('size-3.5 shrink-0', canDrag ? 'cursor-grab text-gray-300' : 'text-gray-200')} />
	        <Box className="size-4 shrink-0" style={{ color: kindMeta.color }} />
	        {renamingClassId === entity.id ? (
	          <input
	            value={renamingClassName}
	            onChange={(event) => setRenamingClassName(event.target.value)}
	            onBlur={() => commitClassRename(entity.id)}
	            onFocus={(event) => event.currentTarget.select()}
	            onClick={(event) => event.stopPropagation()}
	            onMouseDown={(event) => event.stopPropagation()}
	            onKeyDown={(event) => {
	              if (event.key === 'Enter') event.currentTarget.blur();
	              if (event.key === 'Escape') {
	                setRenamingClassId(null);
	                setRenamingClassName('');
	              }
	            }}
	            autoFocus
	            className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm outline-none"
	          />
	        ) : (
	          <span
	            className="min-w-0 flex-1 truncate"
	            onDoubleClick={(event) => {
	              event.stopPropagation();
	              setRenamingClassId(entity.id);
	              setRenamingClassName(entity.name);
	            }}
	          >
	            {entity.name}
	          </span>
	        )}
	        <span className={cn(
	          'rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 transition-opacity',
	          sidebarEngaged ? 'opacity-100' : 'opacity-0',
	        )}>
	          {kindMeta.shortLabel}
	        </span>
      </div>
    );
  };

  return (
    <aside
      ref={sidebarRef}
      className="relative flex h-full w-full flex-col bg-white/95 backdrop-blur-sm"
      onFocusCapture={() => setSidebarEngaged(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) setSidebarEngaged(false);
      }}
      onMouseEnter={() => setSidebarEngaged(true)}
      onMouseLeave={() => setSidebarEngaged(false)}
    >
      <PanelHeader>
        <div className="flex items-center gap-1">
          <PanelTabButton active={activeTab === 'entities'} onClick={() => setActiveTab('entities')}>
            Entities
          </PanelTabButton>
	          <PanelTabButton active={activeTab === 'domains'} onClick={() => setActiveTab('domains')}>
            Domains
          </PanelTabButton>
        </div>
        <div className="flex items-center gap-0.5">
          {activeTab === 'entities' && (
            <PanelIconButton
              label="Search entities"
              active={searchOpen}
              onClick={() => {
                const next = !searchOpen;
                setSearchOpen(next);
                if (!next) onQueryChange('');
              }}
            >
              <Search className="size-3.5" />
            </PanelIconButton>
          )}
          {activeTab === 'entities' && (
            <PanelIconButton
              label="Filters and grouping"
              active={filtersOpen || hasActiveEntityFilters}
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal className="size-3.5" />
            </PanelIconButton>
          )}
          <PanelIconButton label="Collapse sidebar" onClick={onToggleCollapse}>
            <PanelLeftClose className="size-3.5" />
          </PanelIconButton>
        </div>
      </PanelHeader>

      {activeTab === 'entities' && searchOpen && (
        <div className="border-b border-gray-200 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search entities..." className="h-8 pl-8 text-sm" />
            {query && (
              <button onClick={() => onQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'entities' && filtersOpen && (
        <div className="space-y-3 border-b border-gray-200 px-3 py-3">
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Grouping</div>
            <PopupSelect
              value={groupMode}
              options={CLASS_GROUP_MODE_OPTIONS}
              onChange={setGroupMode}
              triggerClassName="h-8 w-full px-2 text-xs"
              menuClassName="min-w-[180px]"
              showCheck
            />
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Types</div>
            <div className="flex flex-wrap gap-1.5">
              {CLASS_ENTITY_KIND_ORDER.map((kind) => {
                const meta = CLASS_ENTITY_KIND_META[kind];
                const visibleCount = CLASS_ENTITY_KIND_ORDER.filter((item) => visibleKinds[item]).length;
                const active = visibleKinds[kind];
                return (
                  <PanelPillButton
                    key={kind}
                    active={active}
                    className={cn(
                      'h-6 px-2 text-[11px]',
                      active ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-100',
                    )}
                    onClick={() => {
                      if (active && visibleCount === 1) return;
                      setVisibleKinds((current) => ({ ...current, [kind]: !current[kind] }));
                    }}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    {meta.label}
                  </PanelPillButton>
                );
              })}
            </div>
          </div>
        </div>
      )}

	      {activeTab === 'entities' && (
	        <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3">
	          <div className="flex items-center gap-2">
	            <span className="text-sm font-medium text-gray-700">Entities</span>
	            <DropdownMenu>
	              <DropdownMenuTrigger asChild>
	                <span>
	                  <PanelIconButton label="Add entity">
	                    <Plus className="size-3.5" />
	                  </PanelIconButton>
	                </span>
	              </DropdownMenuTrigger>
	              <DropdownMenuContent align="start">
	                {CLASS_ENTITY_KIND_ORDER.map((kind) => {
	                  const meta = CLASS_ENTITY_KIND_META[kind];
	                  return (
	                    <DropdownMenuItem key={kind} onClick={() => onAddClass(kind)}>
	                      <Box className="mr-2 size-3.5" style={{ color: meta.color }} />
	                      {meta.label}
	                    </DropdownMenuItem>
	                  );
	                })}
	              </DropdownMenuContent>
	            </DropdownMenu>
	          </div>
	          <div className="flex items-center gap-0.5">
	            <DropdownMenu>
	              <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" title={`Sort: ${classSortModeLabel(sortMode)}`}>
	                {sortMode === 'asc' ? <ArrowUpAZ className="size-3.5" /> : sortMode === 'desc' ? <ArrowDownAZ className="size-3.5" /> : <GripVertical className="size-3.5" />}
	              </DropdownMenuTrigger>
	              <DropdownMenuContent align="end">
	                <DropdownMenuItem onClick={() => setSortMode('manual')}>
	                  <GripVertical className="size-3.5" />
	                  Manual
	                </DropdownMenuItem>
	                <DropdownMenuItem onClick={() => setSortMode('asc')}>
	                  <ArrowUpAZ className="size-3.5" />
	                  A-Z
	                </DropdownMenuItem>
	                <DropdownMenuItem onClick={() => setSortMode('desc')}>
	                  <ArrowDownAZ className="size-3.5" />
	                  Z-A
	                </DropdownMenuItem>
	              </DropdownMenuContent>
	            </DropdownMenu>
	            {groupMode !== 'none' && (
	              <PanelIconButton
	                label="Collapse all groups"
	                onClick={handleCollapseAllGroups}
	                disabled={areAllGroupsCollapsed}
	                className={areAllGroupsCollapsed ? 'cursor-not-allowed text-gray-300 hover:bg-transparent hover:text-gray-300' : undefined}
	              >
	                <Minimize2 className="size-3.5" />
	              </PanelIconButton>
	            )}
	          </div>
	        </div>
	      )}

	      {activeTab === 'domains' && (
	        <div className="shrink-0 border-b border-gray-200 bg-white/95">
	          {isAddingDomain ? (
	            <div className="px-3 py-2">
	              <Input
	                value={newDomainName}
	                onChange={(event) => setNewDomainName(event.target.value)}
	                onKeyDown={(event) => {
	                  if (event.key === 'Enter') handleAddDomain();
	                  if (event.key === 'Escape') {
	                    setIsAddingDomain(false);
	                    setNewDomainName('');
	                  }
	                }}
	                placeholder="Domain name..."
	                autoFocus
	                className="mb-2 h-8 text-sm"
	              />
	              <div className="flex gap-2">
	                <Button onClick={handleAddDomain} size="sm" className="h-7 flex-1">Add</Button>
	                <Button onClick={() => { setIsAddingDomain(false); setNewDomainName(''); }} variant="outline" size="sm" className="h-7 flex-1">Cancel</Button>
	              </div>
	            </div>
	          ) : (
	            <div className="flex h-10 items-center justify-between px-3">
	              <span className="text-sm font-medium text-gray-700">Domains</span>
	              <PanelIconButton label="Add domain" onClick={() => setIsAddingDomain(true)}>
	                <Plus className="size-3.5" />
	              </PanelIconButton>
	            </div>
	          )}
	        </div>
	      )}

	      <div className="flex-1 overflow-y-auto pb-12">
        {activeTab === 'entities' ? (
          <>
            {classGroups.map((group) => {
              const collapsed = collapsedGroupIds.has(group.id);
              return (
                <div key={group.id}>
                  <button
	                    type="button"
	                    data-class-domain-group={group.id}
	                    className={cn(
	                      'sticky top-0 z-10 flex w-full items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-left',
	                      classDomainDropTargetId === group.id && 'ring-2 ring-inset ring-blue-300',
	                    )}
	                    onDragOver={group.acceptsDomainDrop ? (event) => handleGroupDragOver(event, group.id) : undefined}
	                    onDragLeave={group.acceptsDomainDrop ? () => setClassDomainDropTargetId(null) : undefined}
	                    onDrop={group.acceptsDomainDrop ? (event) => handleGroupDrop(event, group.targetDomainId) : undefined}
                    onClick={() => {
                      setCollapsedGroupIds((current) => {
                        const next = new Set(current);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      });
                    }}
                  >
	                    {collapsed ? <ChevronRight className="size-3.5 text-gray-500" /> : <ChevronDown className="size-3.5 text-gray-500" />}
	                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
	                    <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{group.label}</span>
	                    {group.acceptsDomainDrop && classDomainDropTargetId === group.id && draggingClassId && (
	                      <span className="text-[11px] font-medium text-blue-600">Move to this domain</span>
	                    )}
	                    <span className="text-xs tabular-nums text-gray-400">{group.classes.length}</span>
	                  </button>
                  {!collapsed && group.classes.map(renderEntityRow)}
                </div>
              );
            })}
            {filteredClasses.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-gray-400">No entities found</div>
            )}
          </>
        ) : (
          <>
            {renderedDomains.map((domain) => {
              const entityCount = diagram.classes.filter((entity) => entity.domainId === domain.id).length;
              const canAssignSelected = !!selectedClass && selectedClass.domainId !== domain.id;
              const dndIndex = domainDndIndexById.get(domain.id) ?? -1;
              const isDragSource = domainDnd.draggingItemId === domain.id;
              const isDragTarget = domainDnd.dragOverIndex === dndIndex;
              return (
                <div
                  key={domain.id}
                  data-class-domain-row={domain.id}
                  className={cn(
                    'group relative flex items-center gap-2 px-3 py-2 transition-colors hover:bg-gray-50',
                    isDragSource && 'bg-blue-50 ring-1 ring-inset ring-blue-300',
                    isDragTarget && 'ring-2 ring-inset ring-blue-300',
                    domainDnd.isDragging && !isDragSource && 'opacity-60',
                  )}
                  draggable
                  onDragStart={(event) => {
                    if (dndIndex < 0) return;
                    domainDnd.handleDragStart({ index: dndIndex, itemId: domain.id, event });
                  }}
                  onDragOver={(event) => {
                    if (dndIndex >= 0) domainDnd.handleDragOver({ index: dndIndex, itemId: domain.id, event });
                  }}
                  onDragLeave={domainDnd.handleDragLeave}
                  onDrop={(event) => domainDnd.handleDrop({ event })}
                  onDragEnd={domainDnd.handleDragEnd}
                >
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-gray-300" />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEditingDomainId(editingDomainId === domain.id ? null : domain.id)}
                      onMouseDown={(event) => event.stopPropagation()}
                      className="size-5 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110"
                      style={{ backgroundColor: domain.color }}
                    />
                    {editingDomainId === domain.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEditingDomainId(null)} />
                        <div className="absolute left-0 top-full z-50 mt-2 w-[200px] rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-2xl">
                          <div className="mb-2 text-xs font-medium text-gray-400">Pick a color</div>
                          <div className="grid grid-cols-7 gap-2">
                            {DOMAIN_COLORS.map((color) => (
                              <button
                                key={color}
                                className={cn(
                                  'size-6 rounded-full border-2 transition-all hover:scale-125',
                                  domain.color === color ? 'border-white shadow-lg' : 'border-transparent hover:border-gray-500',
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                  onUpdateDomain(domain.id, { color });
                                  setEditingDomainId(null);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {renamingDomainId === domain.id ? (
                    <input
                      value={renamingDomainName}
                      onChange={(event) => setRenamingDomainName(event.target.value)}
                      onBlur={() => commitDomainRename(domain.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitDomainRename(domain.id);
                        if (event.key === 'Escape') {
                          setRenamingDomainId(null);
                          setRenamingDomainName('');
                        }
                      }}
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-blue-400 bg-transparent px-1 py-0.5 text-sm outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm text-gray-700"
                      onMouseDown={(event) => event.stopPropagation()}
                      onDoubleClick={() => {
                        setRenamingDomainId(domain.id);
                        setRenamingDomainName(domain.name);
                      }}
                    >
                      {domain.name}
                    </button>
                  )}

                  <span className="text-xs tabular-nums text-gray-400">{entityCount}</span>
                  {canAssignSelected && (
                    <button
                      type="button"
                      className="rounded bg-blue-500 p-1 text-white opacity-0 transition hover:bg-blue-600 group-hover:opacity-100"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => onAssignDomain(domain.id, [selectedClass.id])}
                      title={`Assign ${selectedClass.name} to ${domain.name}`}
                    >
                      <Plus className="size-3" />
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100">
                      <MoreVertical className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setRenamingDomainId(domain.id);
                        setRenamingDomainName(domain.name);
                      }}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDeleteDomain(domain.id)} className="text-red-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

	            {diagram.domains.length === 0 && !isAddingDomain && (
	              <div className="px-3 py-6 text-center text-xs text-gray-400">Domains are shared by all documents in this project</div>
	            )}
          </>
        )}
      </div>

	      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur-sm">
	        <div className="flex items-center justify-between text-xs text-gray-500">
	          <span>Entities: <span className="font-medium text-gray-700">{diagram.classes.length}</span></span>
	          <span>Domains: <span className="font-medium text-gray-700">{diagram.domains.length}</span></span>
	        </div>
	      </div>

	      <ConfirmDialog
	        open={!!pendingMove}
	        onOpenChange={(open) => {
	          if (!open) setPendingMove(null);
	        }}
	        title="Confirm move"
	        description={pendingMove && (() => {
	          const entity = diagram.classes.find((item) => item.id === pendingMove.classId);
	          const sourceDomain = entity?.domainId ? domainById.get(entity.domainId) : null;
	          const targetDomain = pendingMove.targetDomainId ? domainById.get(pendingMove.targetDomainId) : null;
	          return (
	            <>
	              Move entity{' '}
	              <span className="font-semibold" style={{ color: sourceDomain?.color ?? entity?.color ?? '#374151' }}>
	                "{entity?.name ?? pendingMove.classId}"
	              </span>{' '}
	              to domain{' '}
	              <span className="font-semibold" style={{ color: targetDomain?.color ?? '#6b7280' }}>
	                "{pendingMove.targetDomainName}"
	              </span>
	              ?
	            </>
	          );
	        })()}
	        cancelLabel="Cancel"
	        confirmLabel="Move"
	        onConfirm={() => {
	          if (!pendingMove) return;
	          if (pendingMove.targetDomainId) onAssignDomain(pendingMove.targetDomainId, [pendingMove.classId]);
	          else onRemoveFromDomain(pendingMove.classId);
	          setPendingMove(null);
	        }}
	      />
	    </aside>
	  );
	}

function VisibilitySelect({
  value,
  onChange,
}: {
  value: ClassMemberVisibility;
  onChange: (value: ClassMemberVisibility) => void;
}) {
  return (
    <PopupSelect
      value={value}
      options={VISIBILITY_OPTIONS}
      onChange={onChange}
      triggerClassName="h-8 w-[96px] px-2 text-xs"
      menuClassName="min-w-[120px]"
    />
  );
}

function AttributeMultiplicitySelect({
  value,
  onChange,
}: {
  value?: ClassAttributeMultiplicity;
  onChange: (value: ClassAttributeMultiplicity) => void;
}) {
  const normalized = normalizeAttributeMultiplicityValue(value);
  return (
    <PopupSelect
      value={normalized}
      options={ATTRIBUTE_MULTIPLICITY_OPTIONS}
      onChange={onChange}
      label={attributeMultiplicityTooltip(normalized)}
      triggerClassName="h-8 w-[76px] px-2 text-xs"
      menuClassName="min-w-[110px]"
      showCheck
    />
  );
}

function DomainSelect({
  value,
  domains,
  onChange,
}: {
  value?: string;
  domains: Domain[];
  onChange: (value: string | undefined) => void;
}) {
  const options: PopupSelectOption<string>[] = [
    {
      value: '__none__',
      label: 'No domain',
      icon: <span className="size-2.5 rounded-full bg-gray-300" />,
    },
    ...domains.map((domain) => ({
      value: domain.id,
      label: domain.name,
      icon: <span className="size-2.5 rounded-full" style={{ backgroundColor: domain.color }} />,
    })),
  ];

  return (
    <PopupSelect
      value={value || '__none__'}
      options={options}
      onChange={(nextValue) => onChange(nextValue === '__none__' ? undefined : nextValue)}
      placeholder="No domain"
      triggerClassName="h-9 w-full"
      menuClassName="min-w-[220px]"
      showCheck
      renderValue={(option) => (
        <span className="flex min-w-0 items-center gap-2">
          {option?.icon}
          <span className="truncate">{option?.label ?? 'No domain'}</span>
        </span>
      )}
    />
  );
}

function ClassInspector({
  entity,
  project,
  diagram,
  onUpdateClass,
  onAddAttribute,
  onUpdateAttribute,
  onDeleteAttribute,
  onAddMethod,
  onUpdateMethod,
  onDeleteMethod,
  onDeleteClass,
  onToggleCollapse,
}: {
  entity: ClassEntity | null;
  project: ProjectData;
  diagram: ClassDiagramModel;
  onUpdateClass: (updates: Partial<ClassEntity>) => void;
  onAddAttribute: () => void;
  onUpdateAttribute: (id: string, updates: Partial<ClassAttribute>) => void;
  onDeleteAttribute: (id: string) => void;
  onAddMethod: () => void;
  onUpdateMethod: (id: string, updates: Partial<ClassMethod>) => void;
  onDeleteMethod: (id: string) => void;
  onDeleteClass: () => void;
  onToggleCollapse: () => void;
}) {
  const [activePanelTab, setActivePanelTab] = useState<'properties' | 'attributes' | 'methods'>('properties');
  const entityKind = normalizeClassEntityKindValue(entity?.kind);
  const entityKindMeta = CLASS_ENTITY_KIND_META[entityKind];
  const showAttributes = entity ? classEntitySupportsAttributes(entity.kind) : false;
  const showMethods = entity ? classEntitySupportsMethods(entity.kind) : false;
  const attributePanelLabel = entity ? classEntityAttributeSectionLabel(entity.kind) : 'Attributes';
  const methodPanelLabel = entity ? classEntityMethodSectionLabel(entity.kind) : 'Methods';
  const methodReturnTypeOptions = useMemo(() => classMethodReturnTypeOptions(diagram.classes), [diagram.classes]);

  useEffect(() => {
    if (!entity) return;
    if (activePanelTab === 'attributes' && !showAttributes) setActivePanelTab('properties');
    if (activePanelTab === 'methods' && !showMethods) setActivePanelTab('properties');
  }, [activePanelTab, entity, showAttributes, showMethods]);

  if (!entity) {
    return (
      <aside className="flex h-full w-full flex-col bg-white">
        <PanelHeader>
          <div className="flex items-center gap-1">
            <PanelTabButton active>Properties</PanelTabButton>
          </div>
          <PanelIconButton label="Collapse properties panel" onClick={onToggleCollapse}>
            <PanelRightClose className="size-3.5" />
          </PanelIconButton>
        </PanelHeader>
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-gray-400">
          Select an entity or relation to edit its semantic model.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <PanelHeader>
        <div className="flex items-center gap-1">
          <PanelTabButton active={activePanelTab === 'properties'} onClick={() => setActivePanelTab('properties')}>Properties</PanelTabButton>
          {showAttributes && (
            <PanelTabButton active={activePanelTab === 'attributes'} onClick={() => setActivePanelTab('attributes')}>
              {attributePanelLabel}
            </PanelTabButton>
          )}
          {showMethods && (
            <PanelTabButton active={activePanelTab === 'methods'} onClick={() => setActivePanelTab('methods')}>
              {methodPanelLabel}
            </PanelTabButton>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <PanelIconButton label="Delete entity" onClick={onDeleteClass} className="hover:bg-red-50 hover:text-red-600">
            <Trash2 className="size-4" />
          </PanelIconButton>
          <PanelIconButton label="Collapse properties panel" onClick={onToggleCollapse}>
            <PanelRightClose className="size-3.5" />
          </PanelIconButton>
        </div>
      </PanelHeader>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {activePanelTab === 'properties' ? (
          <section className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Entity</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Box className="size-4" style={{ color: entityKindMeta.color }} />
                {entity.name}
              </div>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Name</label>
            <Input value={entity.name} onChange={(event) => onUpdateClass({ name: event.target.value })} />
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Type</label>
            <PopupSelect
              value={entityKind}
              options={CLASS_ENTITY_KIND_OPTIONS}
              onChange={(kind) => onUpdateClass({ kind, color: CLASS_ENTITY_KIND_META[kind].color })}
              triggerClassName="h-9 w-full"
              menuClassName="min-w-[180px]"
              showCheck
              renderValue={(option) => (
                <span className="flex min-w-0 items-center gap-2">
                  <Box className="size-3.5" style={{ color: entityKindMeta.color }} />
                  <span className="truncate">{option?.label ?? entityKindMeta.label}</span>
                </span>
              )}
            />
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Mapped table</label>
            <select
              value={entity.mappedTableId || ''}
              onChange={(event) => onUpdateClass({ mappedTableId: event.target.value || undefined })}
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">No table mapping</option>
              {project.schema.tables.map((table) => (
                <option key={table.id} value={table.id}>{table.name}</option>
              ))}
            </select>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Domain</label>
            <DomainSelect
              value={entity.domainId}
              domains={diagram.domains}
              onChange={(domainId) => onUpdateClass({ domainId })}
            />
          </section>
        ) : activePanelTab === 'attributes' ? (
          <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{attributePanelLabel}</div>
                <Button size="sm" variant="outline" onClick={onAddAttribute}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {entity.attributes.map((attribute) => (
                  <div key={attribute.id} className="rounded-md border border-gray-200 p-2">
                    <div className="flex gap-2">
                      {entityKind !== 'enum' && (
                        <VisibilitySelect value={attribute.visibility} onChange={(visibility) => onUpdateAttribute(attribute.id, { visibility })} />
                      )}
                      <Input value={attribute.name} onChange={(event) => onUpdateAttribute(attribute.id, { name: event.target.value })} className="h-8" />
                      <button className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDeleteAttribute(attribute.id)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {entityKind !== 'enum' && (
                      <div className="mt-2 flex items-center gap-2">
                        <DataTypeSelect
                          value={attribute.type}
                          options={memberTypeOptions(attribute.type, CLASS_ATTRIBUTE_TYPES)}
                          onChange={(type) => onUpdateAttribute(attribute.id, { type })}
                          label="Change attribute type"
                          align="start"
                          triggerClassName="h-8 w-full max-w-none border-gray-200 px-2 text-xs"
                        />
                        <AttributeMultiplicitySelect
                          value={attribute.multiplicity}
                          onChange={(multiplicity) => onUpdateAttribute(attribute.id, { multiplicity, required: multiplicity === 'one' })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
          </section>
        ) : (
          <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{methodPanelLabel}</div>
                <Button size="sm" variant="outline" onClick={onAddMethod}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {entity.methods.map((method) => (
                  <div key={method.id} className="rounded-md border border-gray-200 p-2">
                    <div className="flex gap-2">
                      <VisibilitySelect value={method.visibility} onChange={(visibility) => onUpdateMethod(method.id, { visibility })} />
                      <Input value={method.name} onChange={(event) => onUpdateMethod(method.id, { name: event.target.value })} className="h-8" />
                      <button className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDeleteMethod(method.id)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Input value={method.parameters || ''} onChange={(event) => onUpdateMethod(method.id, { parameters: event.target.value })} placeholder="parameters" className="h-8 text-xs" />
                      <DataTypeSelect
                        value={method.returnType || 'void'}
                        options={memberTypeOptions(method.returnType || 'void', methodReturnTypeOptions)}
                        onChange={(returnType) => onUpdateMethod(method.id, { returnType })}
                        label="Change return type"
                        align="start"
                        triggerClassName="h-8 w-full max-w-none border-gray-200 px-2 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function RelationInspector({
  relation,
  diagram,
  onUpdate,
  onDelete,
  onToggleCollapse,
}: {
  relation: ClassRelation;
  diagram: ClassDiagramModel;
  onUpdate: (updates: Partial<ClassRelation>) => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
}) {
  const fromEntity = diagram.classes.find((entity) => entity.id === relation.fromClassId) ?? null;
  const toEntity = diagram.classes.find((entity) => entity.id === relation.toClassId) ?? null;

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <PanelHeader>
        <div className="flex items-center gap-1">
          <PanelTabButton active>Properties</PanelTabButton>
        </div>
        <div className="flex items-center gap-0.5">
          <PanelIconButton label="Delete relation" onClick={onDelete} className="hover:bg-red-50 hover:text-red-600">
            <Trash2 className="size-4" />
          </PanelIconButton>
          <PanelIconButton label="Collapse properties panel" onClick={onToggleCollapse}>
            <PanelRightClose className="size-3.5" />
          </PanelIconButton>
        </div>
      </PanelHeader>
      <div className="space-y-4 overflow-y-auto p-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Relation</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{relation.label || relationLabel(relation.type)}</div>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Label</label>
        <Input value={relation.label || ''} onChange={(event) => onUpdate({ label: event.target.value })} placeholder="user has orders" />
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Type</label>
        <PopupSelect
          value={relation.type}
          options={RELATION_TYPE_OPTIONS}
          onChange={(type) => onUpdate({ type })}
          triggerClassName="h-9 w-full"
          menuClassName="min-w-[180px]"
          showCheck
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Source class</label>
            <div className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">{fromEntity?.name ?? 'Unknown'}</div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Target class</label>
            <div className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">{toEntity?.name ?? 'Unknown'}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Source role</label>
            <Input value={relation.fromRole || ''} onChange={(event) => onUpdate({ fromRole: event.target.value })} placeholder="owner" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Target role</label>
            <Input value={relation.toRole || ''} onChange={(event) => onUpdate({ toRole: event.target.value })} placeholder="items" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Source multiplicity</label>
            <Input value={relation.fromMultiplicity || ''} onChange={(event) => onUpdate({ fromMultiplicity: event.target.value })} placeholder="1" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Target multiplicity</label>
            <Input value={relation.toMultiplicity || ''} onChange={(event) => onUpdate({ toMultiplicity: event.target.value })} placeholder="*" />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Description</label>
          <textarea
            value={relation.description || ''}
            onChange={(event) => onUpdate({ description: event.target.value })}
            placeholder="Relationship semantics..."
            className="min-h-24 w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
    </aside>
  );
}

export function ClassDiagramPage() {
  const { isAuthenticated } = useRequireAuth();
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diagram, setDiagram] = useState<ClassDiagramModel>(() => createEmptyClassDiagram());
  const [documentName, setDocumentName] = useState('Class Diagram');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(292);
  const [rightPanelWidth, setRightPanelWidth] = useState(340);
  const [resizingSide, setResizingSide] = useState<'left' | 'right' | null>(null);
  const [history, setHistory] = useState<ClassDiagramSnapshot[]>([]);
  const [future, setFuture] = useState<ClassDiagramSnapshot[]>([]);
  const [query, setQuery] = useState('');
  const [relationsVisible, setRelationsVisible] = useState(true);
  const [fitViewportSignal, setFitViewportSignal] = useState(0);
  const initializedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return getProjectById(projectId);
    },
    enabled: Boolean(projectId) && isAuthenticated,
  });

  const project = projectQuery.data ?? null;
  const document = project?.documents.find((item): item is ClassDiagramProjectDocument => item.id === documentId && item.type === 'class-diagram') ?? null;
  const isMaximized = leftCollapsed && rightCollapsed;

  const updateMutation = useMutation({
    mutationFn: (updated: ProjectData) => updateProject(updated),
    onSuccess: async (updated) => {
      await queryClient.setQueryData(['project', updated.id], updated);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  useEffect(() => {
    if (!document || initializedRef.current) return;
    initializedRef.current = true;
    const domains = project?.domains ?? project?.schema.domains ?? document.classDiagram.domains;
    const normalized = normalizeClassDiagram(document.classDiagram, domains);
    setDiagram(normalized);
    setDocumentName(document.name);
    setSelectedClassId(normalized.classes[0]?.id ?? null);
  }, [document, project?.domains, project?.schema.domains]);

  const persist = useCallback(async () => {
    if (!project || !documentId) return;
    await updateMutation.mutateAsync(buildSavedProject(project, documentId, documentName, diagram));
  }, [diagram, documentId, documentName, project, updateMutation]);

  useEffect(() => {
    if (!initializedRef.current || !project || !documentId) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persist();
    }, 900);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [diagram, documentName, documentId, persist, project]);

  useEffect(() => {
    if (!resizingSide) return;

    const handleMouseMove = (event: MouseEvent) => {
      const viewportWidth = window.innerWidth;
      if (resizingSide === 'left') {
        setLeftSidebarWidth(Math.max(180, Math.min(event.clientX, viewportWidth - 180)));
        return;
      }
      setRightPanelWidth(Math.max(220, Math.min(viewportWidth - event.clientX, viewportWidth - 180)));
    };

    const handleMouseUp = () => {
      setResizingSide(null);
      window.document.body.style.cursor = '';
      window.document.body.style.userSelect = '';
    };

    window.document.body.style.cursor = 'col-resize';
    window.document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.document.body.style.cursor = '';
      window.document.body.style.userSelect = '';
    };
  }, [resizingSide]);

  const pushHistory = useCallback(() => {
    setHistory((current) => [...current, { diagram: structuredClone(diagram) }].slice(-40));
    setFuture([]);
  }, [diagram]);

  const updateDiagram = useCallback((updater: (current: ClassDiagramModel) => ClassDiagramModel) => {
    setDiagram((current) => {
      const next = updater(current);
      return normalizeClassDiagram(next, next.domains);
    });
  }, []);

  const handleAddClass = useCallback((kind: ClassEntityKind = 'class') => {
    pushHistory();
    const newEntity = createClassEntity(diagram.classes.length, kind);
    updateDiagram((current) => ({
      ...current,
      classes: [...current.classes, newEntity],
    }));
    setSelectedRelationId(null);
    setSelectedClassId(newEntity.id);
  }, [diagram.classes.length, pushHistory, updateDiagram]);

  const handleAddDomain = useCallback((name?: string) => {
    pushHistory();
    updateDiagram((current) => ({
      ...current,
      domains: [
        ...current.domains,
        {
          id: nextId('domain'),
          name: name?.trim() || `Domain ${current.domains.length + 1}`,
          color: DOMAIN_COLORS[current.domains.length % DOMAIN_COLORS.length],
        },
      ],
    }));
  }, [pushHistory, updateDiagram]);

  const handleUpdateDomain = useCallback((id: string, updates: Partial<Omit<Domain, 'id'>>) => {
    pushHistory();
    updateDiagram((current) => ({
      ...current,
      domains: current.domains.map((domain) => domain.id === id ? { ...domain, ...updates } : domain),
    }));
  }, [pushHistory, updateDiagram]);

  const handleDeleteDomain = useCallback((id: string) => {
    pushHistory();
    updateDiagram((current) => ({
      ...current,
      domains: current.domains.filter((domain) => domain.id !== id),
      classes: current.classes.map((entity) => entity.domainId === id ? { ...entity, domainId: undefined } : entity),
    }));
  }, [pushHistory, updateDiagram]);

  const handleReorderDomains = useCallback((orderedIds: string[]) => {
    pushHistory();
    updateDiagram((current) => {
      const byId = new Map(current.domains.map((domain) => [domain.id, domain]));
      const ordered = orderedIds.map((id) => byId.get(id)).filter((domain): domain is Domain => Boolean(domain));
      const missing = current.domains.filter((domain) => !orderedIds.includes(domain.id));
      return {
        ...current,
        domains: [...ordered, ...missing],
      };
    });
  }, [pushHistory, updateDiagram]);

  const handleAssignDomain = useCallback((domainId: string, classIds: string[]) => {
    pushHistory();
    const idSet = new Set(classIds);
    updateDiagram((current) => ({
      ...current,
      classes: current.classes.map((entity) => idSet.has(entity.id) ? { ...entity, domainId } : entity),
    }));
  }, [pushHistory, updateDiagram]);

  const handleRemoveFromDomain = useCallback((classId: string) => {
    pushHistory();
    updateDiagram((current) => ({
      ...current,
      classes: current.classes.map((entity) => entity.id === classId ? { ...entity, domainId: undefined } : entity),
    }));
  }, [pushHistory, updateDiagram]);

  const handleReorderClasses = useCallback((orderedIds: string[]) => {
    pushHistory();
    updateDiagram((current) => {
      const orderById = new Map(orderedIds.map((id, index) => [id, index]));
      return {
        ...current,
        classes: current.classes
          .map((entity, index) => ({
            ...entity,
            sidebarOrder: orderById.get(entity.id) ?? orderedIds.length + index,
          }))
          .sort((a, b) => (a.sidebarOrder ?? Number.MAX_SAFE_INTEGER) - (b.sidebarOrder ?? Number.MAX_SAFE_INTEGER)),
      };
    });
  }, [pushHistory, updateDiagram]);

  const handleUpdateClass = useCallback((id: string, updates: Partial<ClassEntity>) => {
    updateDiagram((current) => ({
      ...current,
      classes: current.classes.map((entity) => entity.id === id ? { ...entity, ...updates } : entity),
    }));
  }, [updateDiagram]);

  const handleRenameClass = useCallback((id: string, name: string) => {
    const current = diagram.classes.find((entity) => entity.id === id);
    if (!current || current.name === name) return;
    pushHistory();
    handleUpdateClass(id, { name });
  }, [diagram.classes, handleUpdateClass, pushHistory]);

  const handleAutoLayout = useCallback(() => {
    if (diagram.classes.length === 0) return;
    pushHistory();
    updateDiagram((current) => {
      const orderClasses = (classes: ClassEntity[]) => (
        classes.slice().sort((a, b) => {
          const aOrder = a.sidebarOrder ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.sidebarOrder ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        })
      );
      const domainIds = new Set(current.domains.map((domain) => domain.id));
      const groups = [
        ...current.domains.map((domain) => ({
          id: domain.id,
          classes: orderClasses(current.classes.filter((entity) => entity.domainId === domain.id)),
        })),
        {
          id: '__unassigned__',
          classes: orderClasses(current.classes.filter((entity) => !entity.domainId || !domainIds.has(entity.domainId))),
        },
      ].filter((group) => group.classes.length > 0);
      const nextPositions = new Map<string, { x: number; y: number }>();
      const startX = leftCollapsed ? 80 : leftSidebarWidth + 80;
      let y = 80;
      groups.forEach((group) => {
        let x = startX;
        let rowHeight = 0;
        group.classes.forEach((entity) => {
          nextPositions.set(entity.id, { x, y });
          x += CLASS_WIDTH + 72;
          rowHeight = Math.max(rowHeight, estimateClassNodeHeight(entity));
        });
        y += rowHeight + 120;
      });
      return {
        ...current,
        classes: current.classes.map((entity) => {
          const position = nextPositions.get(entity.id);
          return position ? { ...entity, position } : entity;
        }),
      };
    });
  }, [diagram.classes.length, leftCollapsed, leftSidebarWidth, pushHistory, updateDiagram]);

  const handleDeleteClass = useCallback(() => {
    if (!selectedClassId) return;
    pushHistory();
    updateDiagram((current) => ({
      ...current,
      classes: current.classes.filter((entity) => entity.id !== selectedClassId),
      relations: current.relations.filter((relation) => relation.fromClassId !== selectedClassId && relation.toClassId !== selectedClassId),
    }));
    setSelectedClassId(null);
  }, [pushHistory, selectedClassId, updateDiagram]);

  const handleAddRelation = useCallback((fromClassId: string, toClassId: string) => {
    const fromClass = diagram.classes.find((entity) => entity.id === fromClassId);
    const toClass = diagram.classes.find((entity) => entity.id === toClassId);
    if (!fromClass || !toClass) return;
    const exists = diagram.relations.some((relation) => relation.fromClassId === fromClassId && relation.toClassId === toClassId);
    if (exists) {
      toast.info('Relation already exists');
      return;
    }
    pushHistory();
    updateDiagram((current) => ({
      ...current,
      relations: [
        ...current.relations,
        {
          id: nextId('class_relation'),
          fromClassId,
          toClassId,
          type: 'association',
          label: `${fromClass.name} has ${toClass.name}`,
          fromRole: fromClass.name,
          toRole: toClass.name,
          fromMultiplicity: '1',
          toMultiplicity: '*',
        },
      ],
    }));
    toast.success('Class relation created');
  }, [diagram.classes, diagram.relations, pushHistory, updateDiagram]);

  const selectedClass = diagram.classes.find((entity) => entity.id === selectedClassId) ?? null;
  const selectedRelation = diagram.relations.find((relation) => relation.id === selectedRelationId) ?? null;

  const updateSelectedClass = useCallback((updates: Partial<ClassEntity>) => {
    if (!selectedClassId) return;
    handleUpdateClass(selectedClassId, updates);
  }, [handleUpdateClass, selectedClassId]);

  const addAttributeToClass = useCallback((classId: string) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass || !classEntitySupportsAttributes(targetClass.kind)) return;
    const isEnum = normalizeClassEntityKindValue(targetClass.kind) === 'enum';
    pushHistory();
    handleUpdateClass(classId, {
      attributes: [
        ...targetClass.attributes,
        {
          id: nextId('attribute'),
          name: isEnum ? `Value${targetClass.attributes.length + 1}` : `attribute_${targetClass.attributes.length + 1}`,
          type: isEnum ? 'literal' : 'string',
          visibility: 'public',
          multiplicity: 'one',
          required: true,
        },
      ],
    });
    setSelectedRelationId(null);
    setSelectedClassId(classId);
  }, [diagram.classes, handleUpdateClass, pushHistory]);

  const updateAttributeForClass = useCallback((classId: string, attributeId: string, updates: Partial<ClassAttribute>) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass) return;
    handleUpdateClass(classId, {
      attributes: targetClass.attributes.map((attribute) => attribute.id === attributeId ? { ...attribute, ...updates } : attribute),
    });
  }, [diagram.classes, handleUpdateClass]);

  const reorderAttributesForClass = useCallback((classId: string, fromIndex: number, toIndex: number) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass) return;
    const nextAttributes = [...targetClass.attributes];
    const [moved] = nextAttributes.splice(fromIndex, 1);
    if (!moved) return;
    nextAttributes.splice(toIndex, 0, moved);
    pushHistory();
    handleUpdateClass(classId, { attributes: nextAttributes });
  }, [diagram.classes, handleUpdateClass, pushHistory]);

  const deleteAttributeFromClass = useCallback((classId: string, attributeId: string) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass) return;
    pushHistory();
    handleUpdateClass(classId, {
      attributes: targetClass.attributes.filter((attribute) => attribute.id !== attributeId),
    });
  }, [diagram.classes, handleUpdateClass, pushHistory]);

  const addMethodToClass = useCallback((classId: string) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass || !classEntitySupportsMethods(targetClass.kind)) return;
    const isInterface = normalizeClassEntityKindValue(targetClass.kind) === 'interface';
    pushHistory();
    handleUpdateClass(classId, {
      methods: [
        ...targetClass.methods,
        {
          id: nextId('method'),
          name: isInterface ? `operation${targetClass.methods.length + 1}` : `method_${targetClass.methods.length + 1}`,
          returnType: 'void',
          visibility: 'public',
        },
      ],
    });
    setSelectedRelationId(null);
    setSelectedClassId(classId);
  }, [diagram.classes, handleUpdateClass, pushHistory]);

  const updateMethodForClass = useCallback((classId: string, methodId: string, updates: Partial<ClassMethod>) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass) return;
    handleUpdateClass(classId, {
      methods: targetClass.methods.map((method) => method.id === methodId ? { ...method, ...updates } : method),
    });
  }, [diagram.classes, handleUpdateClass]);

  const reorderMethodsForClass = useCallback((classId: string, fromIndex: number, toIndex: number) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass) return;
    const nextMethods = [...targetClass.methods];
    const [moved] = nextMethods.splice(fromIndex, 1);
    if (!moved) return;
    nextMethods.splice(toIndex, 0, moved);
    pushHistory();
    handleUpdateClass(classId, { methods: nextMethods });
  }, [diagram.classes, handleUpdateClass, pushHistory]);

  const deleteMethodFromClass = useCallback((classId: string, methodId: string) => {
    const targetClass = diagram.classes.find((entity) => entity.id === classId);
    if (!targetClass) return;
    pushHistory();
    handleUpdateClass(classId, {
      methods: targetClass.methods.filter((method) => method.id !== methodId),
    });
  }, [diagram.classes, handleUpdateClass, pushHistory]);

  const addAttribute = useCallback(() => {
    if (!selectedClassId) return;
    addAttributeToClass(selectedClassId);
  }, [addAttributeToClass, selectedClassId]);

  const updateAttribute = useCallback((attributeId: string, updates: Partial<ClassAttribute>) => {
    if (!selectedClassId) return;
    updateAttributeForClass(selectedClassId, attributeId, updates);
  }, [selectedClassId, updateAttributeForClass]);

  const deleteAttribute = useCallback((attributeId: string) => {
    if (!selectedClassId) return;
    deleteAttributeFromClass(selectedClassId, attributeId);
  }, [deleteAttributeFromClass, selectedClassId]);

  const addMethod = useCallback(() => {
    if (!selectedClassId) return;
    addMethodToClass(selectedClassId);
  }, [addMethodToClass, selectedClassId]);

  const updateMethod = useCallback((methodId: string, updates: Partial<ClassMethod>) => {
    if (!selectedClassId) return;
    updateMethodForClass(selectedClassId, methodId, updates);
  }, [selectedClassId, updateMethodForClass]);

  const deleteMethod = useCallback((methodId: string) => {
    if (!selectedClassId) return;
    deleteMethodFromClass(selectedClassId, methodId);
  }, [deleteMethodFromClass, selectedClassId]);

  const updateSelectedRelation = useCallback((updates: Partial<ClassRelation>) => {
    if (!selectedRelationId) return;
    updateDiagram((current) => ({
      ...current,
      relations: current.relations.map((relation) => relation.id === selectedRelationId ? { ...relation, ...updates } : relation),
    }));
  }, [selectedRelationId, updateDiagram]);

  const deleteSelectedRelation = useCallback(() => {
    if (!selectedRelationId) return;
    pushHistory();
    updateDiagram((current) => ({
      ...current,
      relations: current.relations.filter((relation) => relation.id !== selectedRelationId),
    }));
    setSelectedRelationId(null);
  }, [pushHistory, selectedRelationId, updateDiagram]);

  const handleUndo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((current) => [...current, { diagram: structuredClone(diagram) }].slice(-40));
    setDiagram(previous.diagram);
    setHistory((current) => current.slice(0, -1));
  }, [diagram, history]);

  const handleRedo = useCallback(() => {
    const next = future[future.length - 1];
    if (!next) return;
    setHistory((current) => [...current, { diagram: structuredClone(diagram) }].slice(-40));
    setDiagram(next.diagram);
    setFuture((current) => current.slice(0, -1));
  }, [diagram, future]);

  const handleToggleMaximize = useCallback(() => {
    if (isMaximized) {
      setLeftCollapsed(false);
      setRightCollapsed(false);
      return;
    }
    setLeftCollapsed(true);
    setRightCollapsed(true);
  }, [isMaximized]);

  const handleSave = useCallback(async () => {
    await persist();
    toast.success('Class diagram saved');
  }, [persist]);

  const handleBack = useCallback(() => {
    if (projectId) {
      void persist();
      navigate(`/project/${projectId}`);
    } else {
      navigate('/');
    }
  }, [navigate, persist, projectId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      const commandKey = event.metaKey || event.ctrlKey;

      if (commandKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (commandKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (!isEditable && (event.key.toLowerCase() === 'f' || (commandKey && event.key === '\\'))) {
        event.preventDefault();
        handleToggleMaximize();
        return;
      }

      if (!isEditable && event.key === '1') {
        event.preventDefault();
        setFitViewportSignal((current) => current + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleSave, handleToggleMaximize, handleUndo]);

  if (!isAuthenticated || projectQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (!project || !document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500">
        Class diagram not found
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <Box className="size-4 text-blue-600" />
          <Input value={documentName} onChange={(event) => setDocumentName(event.target.value)} className="h-8 w-[260px] border-transparent bg-transparent px-2 font-semibold focus-visible:border-blue-500" />
          <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">CLASS</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="size-4" />
            Save
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <ClassDiagramCanvas
            diagram={diagram}
            selectedClassId={selectedClassId}
            selectedRelationId={selectedRelationId}
            onSelectClass={(id) => {
              setSelectedRelationId(null);
              setSelectedClassId(id);
            }}
	            onSelectRelation={(id) => {
	              setSelectedClassId(null);
	              setSelectedRelationId(id);
	              setRightCollapsed(false);
	            }}
            onClearSelection={() => {
              setSelectedClassId(null);
              setSelectedRelationId(null);
            }}
            onUpdateClass={handleUpdateClass}
            onAddRelation={handleAddRelation}
            onPushHistory={pushHistory}
            onAddAttribute={addAttributeToClass}
            onUpdateAttribute={updateAttributeForClass}
            onReorderAttributes={reorderAttributesForClass}
            onAddMethod={addMethodToClass}
            onUpdateMethod={updateMethodForClass}
            onReorderMethods={reorderMethodsForClass}
            relationsVisible={relationsVisible}
            fitViewportSignal={fitViewportSignal}
          />
        </div>

        <div
          className="absolute left-0 top-0 z-20 h-full overflow-hidden border-r border-gray-200"
          style={{ width: leftCollapsed ? '40px' : `${leftSidebarWidth}px` }}
        >
          <div
            className="h-full"
            style={{
              width: `${leftSidebarWidth}px`,
              transform: leftCollapsed ? 'translateX(-100%)' : 'translateX(0)',
            }}
          >
            <ClassSidebar
              diagram={diagram}
              selectedClassId={selectedClassId}
              query={query}
              onQueryChange={setQuery}
              onAddClass={handleAddClass}
              onAddDomain={handleAddDomain}
	              onUpdateDomain={handleUpdateDomain}
	              onDeleteDomain={handleDeleteDomain}
	              onReorderDomains={handleReorderDomains}
	              onReorderClasses={handleReorderClasses}
	              onRenameClass={handleRenameClass}
	              onAssignDomain={handleAssignDomain}
              onRemoveFromDomain={handleRemoveFromDomain}
              onSelectClass={(id) => {
                setSelectedRelationId(null);
                setSelectedClassId(id);
              }}
              onToggleCollapse={() => setLeftCollapsed(true)}
            />
          </div>
          {leftCollapsed && (
            <div className="absolute inset-0 flex flex-col items-center bg-white/95 pt-2 backdrop-blur-sm">
              <PanelIconButton label="Expand sidebar" onClick={() => setLeftCollapsed(false)}>
                <PanelLeft className="size-4" />
              </PanelIconButton>
            </div>
          )}
          {!leftCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize left panel"
              onMouseDown={(event) => {
                event.preventDefault();
                setResizingSide('left');
              }}
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
            />
          )}
        </div>

        <div
          className="absolute right-0 top-0 z-20 h-full overflow-hidden border-l border-gray-200"
          style={{ width: rightCollapsed ? '40px' : `${rightPanelWidth}px` }}
        >
          <div
            className="absolute right-0 top-0 h-full"
            style={{
              width: `${rightPanelWidth}px`,
              transform: rightCollapsed ? 'translateX(calc(100% - 40px))' : 'translateX(0)',
            }}
          >
            {rightCollapsed ? (
              <div className="flex h-full w-10 flex-col items-center bg-white/95 pt-2 backdrop-blur-sm">
                <PanelIconButton label="Expand properties panel" onClick={() => setRightCollapsed(false)}>
                  <PanelRight className="size-4" />
                </PanelIconButton>
              </div>
            ) : selectedRelation ? (
              <RelationInspector
                relation={selectedRelation}
                diagram={diagram}
                onUpdate={updateSelectedRelation}
                onDelete={deleteSelectedRelation}
                onToggleCollapse={() => setRightCollapsed(true)}
              />
            ) : (
              <ClassInspector
                entity={selectedClass}
                project={project}
                diagram={diagram}
                onUpdateClass={updateSelectedClass}
                onAddAttribute={addAttribute}
                onUpdateAttribute={updateAttribute}
                onDeleteAttribute={deleteAttribute}
                onAddMethod={addMethod}
                onUpdateMethod={updateMethod}
                onDeleteMethod={deleteMethod}
                onDeleteClass={handleDeleteClass}
                onToggleCollapse={() => setRightCollapsed(true)}
              />
            )}
          </div>
          {!rightCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize right panel"
              onMouseDown={(event) => {
                event.preventDefault();
                setResizingSide('right');
              }}
              className="absolute left-0 top-0 h-full w-1 cursor-col-resize"
            />
          )}
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30">
          <div className="pointer-events-auto relative bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-md">
            <ProTooltip label="Undo" shortcut="Ctrl+Z">
              <Button variant="ghost" size="sm" className="size-8 p-0" onClick={handleUndo} disabled={history.length === 0}>
                <Undo2 className="size-4" />
              </Button>
            </ProTooltip>
            <ProTooltip label="Redo" shortcut="Ctrl+Shift+Z">
              <Button variant="ghost" size="sm" className="size-8 p-0" onClick={handleRedo} disabled={future.length === 0}>
                <Redo2 className="size-4" />
              </Button>
	            </ProTooltip>
	            <div className="mx-1 h-6 w-px bg-gray-200" />
	            <ProTooltip label="Auto-layout">
	              <Button variant="ghost" size="sm" className="size-8 p-0" onClick={handleAutoLayout}>
	                <LayoutGrid className="size-4" />
	              </Button>
	            </ProTooltip>
	            <ProTooltip label="Zoom to fit" shortcut="1">
	              <Button variant="ghost" size="sm" className="size-8 p-0" onClick={() => setFitViewportSignal((current) => current + 1)}>
	                <Scan className="size-4" />
	              </Button>
	            </ProTooltip>
	            <ProTooltip label={relationsVisible ? 'Hide relations' : 'Show relations'}>
	              <Button
	                variant="ghost"
	                size="sm"
	                className={cn('size-8 p-0', relationsVisible && 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700')}
	                onClick={() => setRelationsVisible((current) => !current)}
	              >
	                {relationsVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
	              </Button>
	            </ProTooltip>
	            <div className="mx-1 h-6 w-px bg-gray-200" />
	            <Button variant="ghost" size="sm" onClick={() => handleAddClass()}>
	              <Plus className="size-4" />
	              Entity
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleAddDomain()}>
              <FolderPlus className="size-4" />
              Domain
            </Button>
            <div className="mx-1 h-6 w-px bg-gray-200" />
            <ProTooltip label={isMaximized ? 'Show panels' : 'Hide panels'} shortcut="F / ⌘\\">
              <Button variant="ghost" size="sm" className="size-8 p-0" onClick={handleToggleMaximize}>
                {isMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </ProTooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
