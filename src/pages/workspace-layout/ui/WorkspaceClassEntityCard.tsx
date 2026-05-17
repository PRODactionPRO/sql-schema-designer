import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { ALL_FIELD_TYPES } from '@/shared/types/schema';
import type {
  ClassAttributeMultiplicity,
  ClassEntity,
  ClassMemberVisibility,
} from '@/shared/types/project';
import { DataTypeSelect } from '@/shared/ui/data-type-select';
import { useReorderableDragList } from '@/shared/ui/useReorderableDragList';
import { cn } from '@/shared/ui/utils';
import {
  attributeMultiplicityLabel,
  classEntityAttributeSectionLabel,
  classEntityMethodSectionLabel,
  classEntitySupportsAttributes,
  classEntitySupportsMethods,
  CLASS_CARD_WIDTH,
  getClassEntityKindMeta,
  normalizeClassEntityKindValue,
  visibilitySymbol,
} from '../model/class-diagram-view-utils';

const CLASS_ATTRIBUTE_TYPES = ['string', ...ALL_FIELD_TYPES] as const;
const CLASS_METHOD_RETURN_TYPES = ['void', 'string', ...ALL_FIELD_TYPES] as const;

export function ClassEntityCard({
  entity,
  accent,
  selected,
  selectedMemberId,
  onStartDrag,
  onSelectEntity,
  onSelectAttribute,
  onSelectMethod,
  onEntityContextMenu,
  onAttributeContextMenu,
  onMethodContextMenu,
  onAttributeNameChange,
  onAttributeTypeChange,
  onMethodNameChange,
  onMethodReturnTypeChange,
  onReorderAttributes,
  onReorderMethods,
}: {
  entity: ClassEntity;
  accent: string;
  selected?: boolean;
  selectedMemberId?: string;
  onStartDrag: (classId: string, position: { x: number; y: number }, event: ReactPointerEvent<HTMLElement>) => void;
  onSelectEntity: (classId: string) => void;
  onSelectAttribute: (classId: string, attributeId: string) => void;
  onSelectMethod: (classId: string, methodId: string) => void;
  onEntityContextMenu: (event: ReactMouseEvent, classId: string) => void;
  onAttributeContextMenu: (event: ReactMouseEvent, classId: string, attributeId: string) => void;
  onMethodContextMenu: (event: ReactMouseEvent, classId: string, methodId: string) => void;
  onAttributeNameChange: (classId: string, attributeId: string, name: string) => void;
  onAttributeTypeChange: (classId: string, attributeId: string, type: string) => void;
  onMethodNameChange: (classId: string, methodId: string, name: string) => void;
  onMethodReturnTypeChange: (classId: string, methodId: string, returnType: string) => void;
  onReorderAttributes: (classId: string, fromIndex: number, toIndex: number) => void;
  onReorderMethods: (classId: string, fromIndex: number, toIndex: number) => void;
}) {
  const entityKind = normalizeClassEntityKindValue(entity.kind);
  const kindMeta = getClassEntityKindMeta(entity.kind);
  const showAttributes = classEntitySupportsAttributes(entity.kind);
  const showMethods = classEntitySupportsMethods(entity.kind);
  const attributeRows = entity.attributes.map((attribute) => ({
    id: attribute.id,
    name: attribute.name,
    meta: attribute.type,
    visibility: attribute.visibility,
    multiplicity: attribute.multiplicity,
  }));
  const methodRows = entity.methods.map((method) => ({
    id: method.id,
    name: method.name,
    displayName: `${method.name}(${method.parameters ?? ''})`,
    meta: method.returnType ?? 'void',
    visibility: method.visibility,
  }));

  return (
    <div
      className={cn(
        'pointer-events-auto absolute select-none rounded-lg bg-white text-sm shadow-sm',
        selected ? 'border-[3px]' : 'border border-gray-200',
      )}
      style={{
        left: entity.position.x,
        top: entity.position.y,
        width: CLASS_CARD_WIDTH,
        borderColor: selected ? accent : undefined,
        boxShadow: selected
          ? `0 10px 25px -3px ${accent}30, 0 0 0 3px ${accent}20`
          : '0 4px 10px -6px rgba(15,23,42,0.35)',
      }}
      data-class-card-id={entity.id}
      onContextMenu={(event) => onEntityContextMenu(event, entity.id)}
    >
      <div
        className="flex h-[42px] cursor-move items-center justify-between rounded-t-md px-4 text-white"
        style={{ backgroundColor: accent }}
        onPointerDown={(event) => {
          onSelectEntity(entity.id);
          onStartDrag(entity.id, entity.position, event);
        }}
      >
        <div className="min-w-0">
          <div className={cn('truncate text-sm font-semibold', entityKind === 'abstract-class' && 'italic')}>
            {entity.name}
          </div>
          {entity.mappedTableId ? (
            <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/70">mapped</div>
          ) : null}
        </div>
        <span className="ml-3 shrink-0 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/30">
          {kindMeta.shortLabel}
        </span>
      </div>
      {showAttributes ? (
        <ClassEntitySection
          hideVisibility={entityKind === 'enum'}
          rows={attributeRows}
          selectedRowId={selectedMemberId}
          title={classEntityAttributeSectionLabel(entity.kind)}
          typeOptions={CLASS_ATTRIBUTE_TYPES}
          onRowSelect={(attributeId) => onSelectAttribute(entity.id, attributeId)}
          onRowContextMenu={(event, attributeId) => onAttributeContextMenu(event, entity.id, attributeId)}
          onNameChange={(attributeId, name) => onAttributeNameChange(entity.id, attributeId, name)}
          onTypeChange={(attributeId, type) => onAttributeTypeChange(entity.id, attributeId, type)}
          onReorder={(fromIndex, toIndex) => onReorderAttributes(entity.id, fromIndex, toIndex)}
        />
      ) : null}
      {showMethods ? (
        <ClassEntitySection
          rows={methodRows}
          selectedRowId={selectedMemberId}
          title={classEntityMethodSectionLabel(entity.kind)}
          onRowSelect={(methodId) => onSelectMethod(entity.id, methodId)}
          typeOptions={CLASS_METHOD_RETURN_TYPES}
          onRowContextMenu={(event, methodId) => onMethodContextMenu(event, entity.id, methodId)}
          onNameChange={(methodId, name) => onMethodNameChange(entity.id, methodId, name)}
          onTypeChange={(methodId, type) => onMethodReturnTypeChange(entity.id, methodId, type)}
          onReorder={(fromIndex, toIndex) => onReorderMethods(entity.id, fromIndex, toIndex)}
        />
      ) : null}
    </div>
  );
}

function ClassEntitySection({
  title,
  rows,
  hideVisibility = false,
  selectedRowId,
  typeOptions,
  onRowSelect,
  onRowContextMenu,
  onNameChange,
  onTypeChange,
  onReorder,
}: {
  title: string;
  rows: Array<{
    id: string;
    name: string;
    displayName?: string;
    meta: string;
    visibility?: ClassMemberVisibility;
    multiplicity?: ClassAttributeMultiplicity;
  }>;
  hideVisibility?: boolean;
  selectedRowId?: string;
  typeOptions: readonly string[];
  onRowSelect: (rowId: string) => void;
  onRowContextMenu: (event: ReactMouseEvent, rowId: string) => void;
  onNameChange: (rowId: string, name: string) => void;
  onTypeChange: (rowId: string, type: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const dnd = useReorderableDragList({
    itemIds: rows.map((row) => row.id),
    enabled: rows.length > 1,
    onCommit: onReorder,
  });
  const renderedRows = dnd.renderedIds
    .map((id) => rowById.get(id))
    .filter((row): row is {
      id: string;
      name: string;
      displayName?: string;
      meta: string;
      visibility?: ClassMemberVisibility;
      multiplicity?: ClassAttributeMultiplicity;
    } => Boolean(row));
  const getTypeOptions = (value: string) => (
    typeOptions.includes(value) ? typeOptions : [value, ...typeOptions]
  );
  const startNameEdit = (event: ReactMouseEvent, row: { id: string; name: string }) => {
    event.preventDefault();
    event.stopPropagation();
    setEditingRowId(row.id);
    setNameDraft(row.name);
  };
  const commitNameEdit = () => {
    if (!editingRowId) return;

    const row = rowById.get(editingRowId);
    const nextName = nameDraft.trim();
    if (row && nextName && nextName !== row.name) {
      onNameChange(editingRowId, nextName);
    }
    setEditingRowId(null);
    setNameDraft('');
  };
  const cancelNameEdit = () => {
    setEditingRowId(null);
    setNameDraft('');
  };

  useEffect(() => {
    if (!editingRowId) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [editingRowId]);

  return (
    <div className="border-t border-gray-100">
      <div className="flex h-9 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</span>
      </div>
      {renderedRows.length > 0 ? renderedRows.map((row, index) => {
        const canReorder = rows.length > 1;
        const isDragSource = dnd.draggingItemId === row.id;
        const isDragTarget = dnd.dragOverIndex === index;

        return (
          <div
            key={row.id}
            className={cn(
              'flex min-h-9 items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm transition-colors last:border-b-0',
              canReorder && 'cursor-grab active:cursor-grabbing',
              dnd.isDragging && !isDragSource && 'opacity-60',
              isDragSource && 'bg-blue-50',
              isDragTarget && 'ring-2 ring-inset ring-blue-300',
              selectedRowId === row.id && 'bg-orange-50',
            )}
            draggable={canReorder}
            data-class-member-row-id={row.id}
            onClick={() => onRowSelect(row.id)}
            onContextMenu={(event) => onRowContextMenu(event, row.id)}
            onDoubleClickCapture={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('[data-class-member-name-text]')) startNameEdit(event, row);
            }}
            onDragStart={canReorder ? (event) => {
              const target = event.target as HTMLElement;
              if (target.closest('[data-class-member-name-text], [data-class-member-name-input]')) {
                event.preventDefault();
                return;
              }
              dnd.handleDragStart({ index, itemId: row.id, event });
            } : undefined}
            onDragOver={canReorder ? (event) => dnd.handleDragOver({ index, itemId: row.id, event }) : undefined}
            onDragLeave={canReorder ? dnd.handleDragLeave : undefined}
            onDrop={canReorder ? (event) => dnd.handleDrop({ event }) : undefined}
            onDragEnd={canReorder ? dnd.handleDragEnd : undefined}
          >
            <GripVertical className={cn('size-3.5 shrink-0', canReorder ? 'text-gray-300' : 'text-gray-200')} />
            {!hideVisibility && row.visibility ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded text-gray-400">
                {visibilitySymbol(row.visibility)}
              </span>
            ) : null}
            {editingRowId === row.id ? (
              <input
                ref={nameInputRef}
                className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-1 py-0.5 text-left text-sm text-gray-900 shadow-sm outline-none ring-2 ring-blue-100"
                data-class-member-name-input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitNameEdit}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitNameEdit();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelNameEdit();
                  }
                }}
              />
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-left text-gray-800"
                data-class-member-name-text
                draggable={false}
                onClick={(event) => {
                  if (event.detail === 2) startNameEdit(event, row);
                }}
                onDoubleClick={(event) => startNameEdit(event, row)}
              >
                {row.displayName ?? row.name}
              </span>
            )}
            {row.multiplicity ? (
              <span className="flex h-5 min-w-8 shrink-0 items-center justify-center rounded bg-gray-100 px-1.5 text-[10px] font-semibold tabular-nums text-gray-500">
                {attributeMultiplicityLabel(row.multiplicity)}
              </span>
            ) : null}
            <DataTypeSelect
              value={row.meta}
              options={getTypeOptions(row.meta)}
              label="Change type"
              align="end"
              onChange={(type) => onTypeChange(row.id, type)}
              triggerClassName="h-6 max-w-[96px] shrink-0 border-transparent bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gray-500 hover:bg-gray-200 hover:text-gray-800 focus:ring-0"
            />
          </div>
        );
      }) : (
        <div className="flex h-9 items-center px-4 text-xs text-gray-400">Empty</div>
      )}
    </div>
  );
}
