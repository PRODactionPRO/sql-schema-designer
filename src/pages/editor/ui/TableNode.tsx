import { useRef, useEffect, useState, memo } from 'react';
import { Key, MoreVertical, ChevronDown, ChevronRight, GripVertical, Ban, AlertTriangle, Link, ListOrdered, Trash2 } from 'lucide-react';
import type { Field, FieldType, Table, TypeCompatibility } from '../model/types';
import { ALL_FIELD_TYPES, getTypeCompatibility } from '../model/types';
import { DataTypeSelect } from '@/shared/ui/data-type-select';
import { ProTooltip } from '@/shared/ui/pro-tooltip';
import { useReorderableDragList } from '@/shared/ui/useReorderableDragList';

function getFieldTypeLabel(field: Field): string {
  if (field.type !== 'enum') return field.type;
  return field.enumName || 'enum';
}

export interface DragFieldInfo {
  tableId: string;
  fieldId: string;
  fieldName: string;
  tableName: string;
  isPrimaryKey: boolean;
  fieldType: FieldType;
  fieldEnumId?: string;
  fieldEnumName?: string;
}

interface TableNodeProps {
  table: Table;
  tableColor: string;
  isSelected: boolean;
  isMultiSelected: boolean;
  isFocused: boolean;
  lodLevel?: 'full' | 'compact' | 'minimal';
  onSelect: (tableId: string, e?: React.MouseEvent) => void;
  onPositionChange: (tableId: string, position: { x: number; y: number }) => void;
  onDelete: () => void;
  onFieldClick: (field: Field) => void;
  onFieldTypeChange?: (fieldId: string, type: FieldType) => void;
  zoom?: number;
  onFieldDragStart?: (info: DragFieldInfo, e: React.MouseEvent) => void;
  isDropTarget?: boolean;
  dropTargetFieldId?: string | null;
  onGroupDragStart?: (tableId: string, e: React.MouseEvent) => void;
  enabledFieldTypes?: FieldType[];
  dragSourceFieldType?: FieldType | null;
  isDragSourceTable?: boolean;
  existingFKFieldIds?: Set<string>;
  dragSourceFieldId?: string;
  onDoubleClick?: () => void;
  onUpdateField?: (fieldId: string, updates: Partial<Field>) => void;
  onDragEnd?: () => void;
  onDragMove?: (tableId: string, position: { x: number; y: number }) => void;
  onDragStop?: (tableId: string) => void;
  isEnumTable?: boolean;
  isJsonSchemaTable?: boolean;
  jsonSchemaFieldMeta?: Record<string, { depth: number; hasChildren: boolean; collapsed: boolean; schemaType: string }>;
  onJsonSchemaToggleCollapse?: (fieldId: string) => void;
  onJsonSchemaFieldTypeChange?: (fieldId: string, schemaType: string) => void;
  onReorderEnumValue?: (fromIndex: number, toIndex: number) => void;
  onReorderField?: (fromIndex: number, toIndex: number) => void;
  onToggleCollapse?: () => void;
  onOpenContextMenu?: (tableId: string, anchor: { x: number; y: number }) => void;
  onDeleteField?: (fieldId: string) => void;
}

export const TableNode = memo(function TableNode({
  table, tableColor, isSelected, isMultiSelected, isFocused, lodLevel = 'full', onSelect, onPositionChange,
  onDelete, onFieldClick, onFieldTypeChange, zoom = 1,
  onFieldDragStart, isDropTarget, dropTargetFieldId, onGroupDragStart,
  enabledFieldTypes,
  dragSourceFieldType,
  isDragSourceTable,
  existingFKFieldIds,
  dragSourceFieldId,
  onDoubleClick,
  onUpdateField,
  onDragEnd,
  onDragMove,
  onDragStop,
  isEnumTable = false,
  isJsonSchemaTable = false,
  jsonSchemaFieldMeta,
  onJsonSchemaToggleCollapse,
  onJsonSchemaFieldTypeChange,
  onReorderEnumValue,
  onReorderField,
  onToggleCollapse,
  onOpenContextMenu,
  onDeleteField,
}: TableNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const headerHandledClick = useRef(false);
  const suppressNextClick = useRef(false);
  const positionRef = useRef(table.position);
  const fieldNameInputRef = useRef<HTMLInputElement>(null);
  positionRef.current = table.position;
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [isFieldReorderPointerDown, setIsFieldReorderPointerDown] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldNameDraft, setFieldNameDraft] = useState('');

  const borderColor = tableColor;
  const availableTypes = enabledFieldTypes || ALL_FIELD_TYPES;
  const jsonSchemaTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null', 'json'] as const;
  const isCollapsed = !!table.collapsed;
  const fieldCount = table.fields.length;

  useEffect(() => {
    const handleMouseUp = () => setIsFieldReorderPointerDown(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    if (!editingFieldId) return;
    fieldNameInputRef.current?.focus();
    fieldNameInputRef.current?.select();
  }, [editingFieldId]);

  const enumDnD = useReorderableDragList({
    itemIds: table.fields.map((f) => f.id),
    enabled: isEnumTable && !!onReorderEnumValue,
    onCommit: (fromIndex, toIndex) => {
      onReorderEnumValue?.(fromIndex, toIndex);
    },
  });

  const fieldDnD = useReorderableDragList({
    itemIds: table.fields.map((f) => f.id),
    enabled: !isEnumTable && !!onReorderField,
    onCommit: (fromIndex, toIndex) => {
      onReorderField?.(fromIndex, toIndex);
    },
  });

  // Unfocus: reduce background contrast, text gets opacity
  // No filter-based opacity — use specific bg color wash and text opacity
  // Transition only opacity/border/box-shadow — NOT transform (transform must be instant for drag)
  const unfocusStyle: React.CSSProperties = {
    transition: 'opacity 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
  };

  // For unfocused tables: desaturate header and wash out field backgrounds
  const headerBg = isDropTarget ? '#3b82f6'
    : !isFocused ? mixColorTowardGray(borderColor, 0.6)
    : borderColor;
  const headerBorderColor = isDropTarget ? '#2563eb'
    : !isFocused ? mixColorTowardGray(borderColor, 0.6)
    : borderColor;
  const textOpacity = !isFocused ? 0.4 : 1;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let lastDragPos: { x: number; y: number } | null = null;
    let rafId: number | null = null;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      const isBlockedTarget = Boolean(target.closest('button, input, textarea, select, [role="button"], [data-no-table-drag], [data-field-reorder-handle], [data-relation-handle], [data-field-name-text]'));
      if (!isBlockedTarget && target.closest('[data-table-drag-surface]')) {
        if (isMultiSelected && onGroupDragStart) {
          onGroupDragStart(table.id, e as any);
          e.preventDefault();
          return;
        }
        isDragging.current = true;
        didDrag.current = false;
        lastDragPos = null;
        onDragEnd?.(); // Push history snapshot BEFORE drag starts
        dragStart.current = { x: e.clientX / zoom - positionRef.current.x, y: e.clientY / zoom - positionRef.current.y };
        headerHandledClick.current = true;
        onSelect(table.id, e as any);
        e.preventDefault();
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      didDrag.current = true;
      const newX = e.clientX / zoom - dragStart.current.x;
      const newY = e.clientY / zoom - dragStart.current.y;
      lastDragPos = { x: newX, y: newY };
      onDragMove?.(table.id, lastDragPos);
      // Update position via React state — arrows will follow via re-render
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (lastDragPos) {
            onPositionChange(table.id, lastDragPos);
          }
        });
      }
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (didDrag.current && lastDragPos) {
          suppressNextClick.current = true;
          window.setTimeout(() => {
            suppressNextClick.current = false;
          }, 100);
          onPositionChange(table.id, lastDragPos);
          onDragStop?.(table.id);
        }
        lastDragPos = null;
      }
      isDragging.current = false;
      didDrag.current = false;
    };
    node.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      node.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [table.id, onSelect, onPositionChange, zoom, isMultiSelected, onGroupDragStart, onDragEnd, onDragMove, onDragStop]);

  const handleTypeSelect = (fieldId: string, type: string) => {
    if (isJsonSchemaTable) {
      onJsonSchemaFieldTypeChange?.(fieldId, type);
    } else if (onFieldTypeChange) {
      onFieldTypeChange(fieldId, type as FieldType);
    }
  };

  const startFieldNameEdit = (e: React.MouseEvent, field: Field) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingFieldId(field.id);
    setFieldNameDraft(field.name);
  };

  const commitFieldNameEdit = () => {
    if (!editingFieldId) return;
    const field = table.fields.find((item) => item.id === editingFieldId);
    const nextName = fieldNameDraft.trim();
    if (field && nextName && nextName !== field.name) {
      onUpdateField?.(editingFieldId, { name: nextName });
    }
    setEditingFieldId(null);
    setFieldNameDraft('');
  };

  const cancelFieldNameEdit = () => {
    setEditingFieldId(null);
    setFieldNameDraft('');
  };

  const renderFieldName = (field: Field) => {
    if (editingFieldId === field.id) {
      return (
        <input
          ref={fieldNameInputRef}
          className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-1 py-0.5 text-sm text-gray-900 shadow-sm outline-none ring-2 ring-blue-100"
          data-no-table-drag
          value={fieldNameDraft}
          onChange={(event) => setFieldNameDraft(event.target.value)}
          onBlur={commitFieldNameEdit}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitFieldNameEdit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelFieldNameEdit();
            }
          }}
        />
      );
    }

    return (
      <span
        data-field-name-text
        className={`min-w-0 flex-1 truncate text-sm ${field.isForeignKey ? 'text-blue-600' : ''}`}
        style={{ opacity: textOpacity }}
        onClick={(event) => {
          if (event.detail === 2) startFieldNameEdit(event, field);
        }}
        onDoubleClick={(event) => startFieldNameEdit(event, field)}
      >
        {field.name}
      </span>
    );
  };

  const handleFieldDragStart = (e: React.MouseEvent, field: Field) => {
    e.stopPropagation(); e.preventDefault();
    if (onFieldDragStart) {
      onFieldDragStart({
        tableId: table.id,
        fieldId: field.id,
        fieldName: field.name,
        tableName: table.name,
        isPrimaryKey: field.isPrimaryKey,
        fieldType: field.type,
        fieldEnumId: field.enumId,
        fieldEnumName: field.enumName,
      }, e);
    }
  };

  const handleFieldRowDragEnd = () => {
    fieldDnD.handleDragEnd();
    setIsFieldReorderPointerDown(false);
  };

  const getFieldDragState = (field: Field): {
    compat: TypeCompatibility;
    blocked: boolean;
    reason?: string;
  } | null => {
    if (isEnumTable) return null;
    if (!dragSourceFieldType || isDragSourceTable) return null;
    if (existingFKFieldIds?.has(field.id)) {
      return { compat: 'forbidden', blocked: true, reason: 'Already has FK' };
    }
    const compat = getTypeCompatibility(
      { type: dragSourceFieldType, enumId: undefined, enumName: undefined },
      field,
    );
    if (compat === 'forbidden') {
      return { compat: 'forbidden', blocked: true, reason: 'Incompatible type' };
    }
    if (compat === 'warning') {
      return { compat: 'warning', blocked: false, reason: 'Requires explicit cast' };
    }
    return { compat, blocked: false };
  };

  // Toggle field flags
  const toggleNotNull = (e: React.MouseEvent, field: Field) => {
    e.stopPropagation();
    onUpdateField?.(field.id, { isNotNull: !field.isNotNull });
  };

  const toggleIndex = (e: React.MouseEvent, field: Field) => {
    e.stopPropagation();
    onUpdateField?.(field.id, { isIndexed: !field.isIndexed });
  };

  const toggleUnique = (e: React.MouseEvent, field: Field) => {
    e.stopPropagation();
    onUpdateField?.(field.id, { isUnique: !field.isUnique });
  };

  // --- Minimal LOD: compact table silhouette for zoomed-out navigation ---
  if (lodLevel === 'minimal') {
    const totalH = 62;
    return (
      <div
        ref={nodeRef}
        className="absolute overflow-hidden rounded-lg bg-white select-none"
        style={{
          left: table.position.x, top: table.position.y, width: 280, height: totalH,
          willChange: 'transform',
          border: isMultiSelected || isSelected ? `3px solid ${borderColor}` : '1px solid rgba(148, 163, 184, 0.7)',
          boxShadow: isMultiSelected || isSelected
            ? `0 0 0 4px ${borderColor}20, 0 8px 18px -10px rgba(15, 23, 42, 0.35)`
            : '0 5px 14px -12px rgba(15, 23, 42, 0.45)',
          opacity: textOpacity,
        }}
        data-table-id={table.id}
        data-table-drag-surface
        onClick={(e) => {
          if (suppressNextClick.current) {
            suppressNextClick.current = false;
            return;
          }
          onSelect(table.id, e);
        }}
      >
        <div
          className="table-header flex h-6 cursor-move items-center px-3"
          style={{ backgroundColor: headerBg }}
          data-table-header={table.id}
        >
          <span className="text-white truncate text-xs" style={{ fontWeight: 600 }}>{table.name}</span>
          <span className="text-white/60 ml-auto text-[10px]">{fieldCount}</span>
        </div>
        <div className="h-[38px] border-t border-slate-200 bg-white px-3 py-2">
          <div className="mb-1.5 h-1.5 w-4/5 rounded-full bg-slate-200" />
          <div className="h-1.5 w-3/5 rounded-full bg-slate-100" />
        </div>
      </div>
    );
  }

  // --- Compact LOD: header + simplified field list (name only) ---
  if (lodLevel === 'compact') {
    return (
      <div
        ref={nodeRef}
        className="absolute bg-white rounded-lg overflow-visible select-none"
        style={{
          left: table.position.x, top: table.position.y, minWidth: 280,
          willChange: 'transform',
          border: isDropTarget ? '3px solid #3b82f6'
            : isMultiSelected ? `3px solid ${borderColor}`
            : isSelected ? `3px solid ${borderColor}`
            : '1px solid #e5e7eb',
          boxShadow: (isSelected || isMultiSelected)
            ? `0 10px 25px -3px ${borderColor}30, 0 0 0 3px ${borderColor}20`
            : '0 4px 6px -1px rgba(0,0,0,0.1)',
          ...unfocusStyle,
        }}
        onClick={(e) => {
          if (suppressNextClick.current) {
            suppressNextClick.current = false;
            return;
          }
          onSelect(table.id, e);
        }}
        data-table-id={table.id}
        data-table-drag-surface
      >
        <div
          className="table-header px-4 py-2 flex items-center justify-between cursor-move rounded-t-lg"
          style={{ backgroundColor: headerBg, borderBottom: `3px solid ${headerBorderColor}` }}
          data-table-header={table.id}
        >
          <span className="text-white truncate" style={{ fontWeight: 600, opacity: textOpacity }}>{table.name}</span>
          {onToggleCollapse ? (
            <button
              type="button"
              className="ml-2 flex size-6 shrink-0 items-center justify-center rounded text-white/80 hover:bg-white/20 hover:text-white"
              data-no-table-drag
              aria-label={isCollapsed ? `Expand ${table.name} fields` : `Collapse ${table.name} fields`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
            >
              {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          ) : null}
        </div>
        {!isCollapsed ? <div className="divide-y divide-gray-200 rounded-b-lg overflow-hidden">
          {table.fields.map(field => (
            <div
              key={field.id}
              className="px-3 py-2 flex items-center"
              data-field-id={field.id}
              data-table-id={table.id}
              onClickCapture={(e) => {
                const target = e.target as HTMLElement;
                if (e.detail === 2 && target.closest('[data-field-name-text]')) startFieldNameEdit(e, field);
              }}
              onDoubleClickCapture={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-field-name-text]')) startFieldNameEdit(e, field);
              }}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {field.isPrimaryKey && <Key className="size-3 text-yellow-500 flex-shrink-0" />}
                {field.isForeignKey && !field.isPrimaryKey && <Key className="size-3 text-blue-400 flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />}
                {renderFieldName(field)}
              </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{getFieldTypeLabel(field)}</span>
            </div>
          ))}
        </div> : null}
      </div>
    );
  }

  // --- Full LOD: original detailed rendering ---
  const renderedFields = isCollapsed
    ? []
    : (!isEnumTable && fieldDnD.renderedIds)
    ? fieldDnD.renderedIds
      .map((id) => table.fields.find((field) => field.id === id))
      .filter((field): field is Field => !!field)
    : (isEnumTable && enumDnD.renderedIds
      ? enumDnD.renderedIds.map((id) => table.fields.find((field) => field.id === id)).filter((field): field is Field => !!field)
      : table.fields);
  const relationHandleHidden = (!isEnumTable && !isJsonSchemaTable) && (isFieldReorderPointerDown || fieldDnD.isDragging);

  return (
    <div
      ref={nodeRef}
      className="absolute bg-white rounded-lg overflow-visible select-none group/table"
      style={{
        left: table.position.x, top: table.position.y, minWidth: 280,
        willChange: 'transform',
        border: isDropTarget ? '3px solid #3b82f6'
          : isMultiSelected ? `3px solid ${borderColor}`
          : isSelected ? `3px solid ${borderColor}`
          : '1px solid #e5e7eb',
        boxShadow: isDropTarget
          ? '0 0 0 3px rgba(59,130,246,0.25)'
          : (isSelected || isMultiSelected)
            ? `0 10px 25px -3px ${borderColor}30, 0 4px 10px -4px ${borderColor}20, 0 0 0 3px ${borderColor}20`
            : '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        ...unfocusStyle,
      }}
      onClick={(e) => {
        if (suppressNextClick.current) {
          suppressNextClick.current = false;
          headerHandledClick.current = false;
          return;
        }
        if (headerHandledClick.current) {
          headerHandledClick.current = false;
          return;
        }
        onSelect(table.id, e);
      }}
      data-table-id={table.id}
      data-table-drag-surface
      onDoubleClick={onDoubleClick}
    >
      <div
        className="table-header px-4 py-2 flex items-center justify-between cursor-move rounded-t-lg"
        style={{ backgroundColor: headerBg, borderBottom: `3px solid ${headerBorderColor}` }}
        data-table-header={table.id}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white truncate" style={{ fontWeight: 600, opacity: textOpacity }}>{table.name}</span>
            {(isEnumTable || isJsonSchemaTable) && (
              <span
                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/20 text-white/90"
                style={{ opacity: textOpacity }}
              >
                {isEnumTable ? 'enum' : 'json'}
              </span>
            )}
          </div>
        </div>
        {onToggleCollapse ? (
          <ProTooltip label={isCollapsed ? 'Expand fields' : 'Collapse fields'}>
            <button
              type="button"
              className="mr-1 flex size-7 shrink-0 items-center justify-center rounded text-white/80 hover:bg-white/20 hover:text-white"
              data-no-table-drag
              aria-label={isCollapsed ? `Expand ${table.name} fields` : `Collapse ${table.name} fields`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
            >
              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </ProTooltip>
        ) : null}
        <ProTooltip label="Table actions">
          <button
            className="text-white hover:bg-white/20 rounded p-1 flex-shrink-0 opacity-0 pointer-events-none group-hover/table:opacity-100 group-hover/table:pointer-events-auto transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onOpenContextMenu?.(table.id, { x: rect.left, y: rect.bottom + 6 });
            }}
          >
            <MoreVertical className="size-4" />
          </button>
        </ProTooltip>
      </div>

      {!isCollapsed ? <div className="divide-y divide-gray-200 rounded-b-lg overflow-visible">
        {renderedFields.map((field, fieldIndex) => {
          const isFieldDropTarget = dropTargetFieldId === field.id;
          const isSource = isDragSourceTable && dragSourceFieldId === field.id;
          const isReorderSource = fieldDnD.draggingItemId === field.id;
          const dragState = getFieldDragState(field);
          const isHovered = hoveredFieldId === field.id;
          const effectiveHover = fieldDnD.isDragging ? isReorderSource : isHovered;

          let fieldBg = '';
          let fieldStyle: React.CSSProperties = {};
          let statusIndicator: React.ReactNode = null;

          if (isSource) {
            fieldBg = 'bg-blue-100 ring-2 ring-inset ring-blue-400';
          } else if (isFieldDropTarget) {
            if (dragState?.compat === 'forbidden' || dragState?.blocked) {
              fieldBg = 'bg-red-50 ring-2 ring-inset ring-red-400';
              statusIndicator = <Ban className="size-3.5 text-red-500 flex-shrink-0" />;
            } else if (dragState?.compat === 'warning') {
              fieldBg = 'bg-amber-50 ring-2 ring-inset ring-amber-400';
              statusIndicator = <AlertTriangle className="size-3.5 text-amber-500 flex-shrink-0" />;
            } else {
              fieldBg = 'bg-green-50 ring-2 ring-inset ring-green-400';
              statusIndicator = <Link className="size-3.5 text-green-500 flex-shrink-0" />;
            }
          } else if (dragState) {
            if (dragState.blocked || dragState.compat === 'forbidden') {
              fieldStyle = { opacity: 0.25 };
              statusIndicator = <Ban className="size-3 text-red-400 flex-shrink-0" />;
            } else if (dragState.compat === 'warning') {
              fieldStyle = { opacity: 0.7 };
              statusIndicator = <AlertTriangle className="size-3 text-amber-400 flex-shrink-0" />;
            } else {
              fieldBg = 'bg-green-50/40';
            }
          }

          // Field action buttons visibility: show if hovered or if the flag is active
          const showNotNull = effectiveHover || field.isNotNull;
          const showIndex = effectiveHover || field.isIndexed;
          const showUnique = effectiveHover || (field.isUnique && !field.isPrimaryKey);

          return (
            <div
              key={field.id}
              className={`px-3 py-2 flex items-center cursor-pointer relative ${
                !isFieldDropTarget && !isSource && !fieldDnD.isDragging ? 'hover:bg-gray-50' : ''
              } ${fieldBg} ${isEnumTable ? 'group/enum-row' : 'group/field-row'} ${isEnumTable && enumDnD.dragOverIndex === fieldIndex ? 'ring-2 ring-inset ring-blue-300' : ''} ${!isEnumTable && fieldDnD.dragOverIndex === fieldIndex ? 'ring-2 ring-inset ring-blue-300' : ''} ${isReorderSource ? 'bg-gray-100 ring-2 ring-inset ring-blue-300' : ''}`}
              style={fieldStyle}
              onClick={(e) => {
                e.stopPropagation();
                if (suppressNextClick.current) {
                  suppressNextClick.current = false;
                  return;
                }
                onFieldClick(field);
              }}
              data-field-id={field.id}
              data-table-id={table.id}
              title={dragState?.reason}
              onClickCapture={(e) => {
                const target = e.target as HTMLElement;
                if (e.detail === 2 && target.closest('[data-field-name-text]')) startFieldNameEdit(e, field);
              }}
              onDoubleClickCapture={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-field-name-text]')) startFieldNameEdit(e, field);
              }}
              onMouseEnter={() => setHoveredFieldId(field.id)}
              onMouseLeave={() => setHoveredFieldId(null)}
              onDragOver={isEnumTable ? (e) => enumDnD.handleDragOver({ index: fieldIndex, itemId: field.id, event: e }) : undefined}
              onDragOverCapture={!isEnumTable && onReorderField ? (e) => fieldDnD.handleDragOver({ index: fieldIndex, itemId: field.id, event: e }) : undefined}
              onDragLeave={isEnumTable ? enumDnD.handleDragLeave : undefined}
              onDragLeaveCapture={!isEnumTable && onReorderField ? fieldDnD.handleDragLeave : undefined}
              onDrop={isEnumTable ? (e) => enumDnD.handleDrop({ event: e }) : undefined}
              onDropCapture={!isEnumTable && onReorderField ? (e) => fieldDnD.handleDrop({ event: e }) : undefined}
              onDragEnd={isEnumTable ? enumDnD.handleDragEnd : (!isEnumTable && onReorderField ? handleFieldRowDragEnd : undefined)}
            >
              <ProTooltip label={isEnumTable ? 'Drag to reorder' : isJsonSchemaTable ? 'Drag handle' : 'Drag to reorder field'}>
                <div
                  className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mr-1 -ml-1"
                  data-field-reorder-handle
                  draggable={isEnumTable || !!onReorderField}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (!isEnumTable && !isJsonSchemaTable) setIsFieldReorderPointerDown(true);
                  }}
                  onDragStart={isEnumTable ? (e) => enumDnD.handleDragStart({ index: fieldIndex, itemId: field.id, event: e }) : (!isEnumTable && onReorderField ? (e) => fieldDnD.handleDragStart({ index: fieldIndex, itemId: field.id, event: e }) : undefined)}
                  onDragEnd={isEnumTable ? enumDnD.handleDragEnd : (!isEnumTable && onReorderField ? handleFieldRowDragEnd : undefined)}
                >
                  <GripVertical className="size-3.5" />
                </div>
              </ProTooltip>
              {!isEnumTable && !relationHandleHidden && (
                <ProTooltip label="Drag to create relation">
                  <button
                    type="button"
                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 size-3 rounded-full border-2 border-blue-500 bg-white opacity-0 group-hover/field-row:opacity-100 hover:bg-blue-500 transition-colors z-30"
                    data-relation-handle
                    onMouseDown={(e) => handleFieldDragStart(e, field)}
                  />
                </ProTooltip>
              )}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {isJsonSchemaTable && (() => {
                  const meta = jsonSchemaFieldMeta?.[field.id];
                  if (!meta) return null;
                  const indentPx = Math.max(0, meta.depth) * 14;
                  return (
                    <>
                      <span style={{ width: indentPx }} className="shrink-0" />
                      {meta.hasChildren ? (
                        <ProTooltip label={meta.collapsed ? 'Expand' : 'Collapse'}>
                          <button
                            type="button"
                            className="size-4 rounded hover:bg-gray-100 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              onJsonSchemaToggleCollapse?.(field.id);
                            }}
                          >
                            {meta.collapsed ? <ChevronRight className="size-3 text-gray-500" /> : <ChevronDown className="size-3 text-gray-500" />}
                          </button>
                        </ProTooltip>
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </>
                  );
                })()}
                {field.isPrimaryKey && <Key className="size-3 text-yellow-500 flex-shrink-0" />}
                {field.isForeignKey && !field.isPrimaryKey && <Key className="size-3 text-blue-400 flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />}
                {renderFieldName(field)}
              </div>
              <div className="flex items-center gap-0.5 ml-1" style={{ minWidth: isEnumTable ? 28 : 68 }}>
                {/* Always render 3 button slots to prevent width changes */}
                {!isEnumTable && !isJsonSchemaTable && (
                  <ProTooltip label="NOT NULL">
                    <button
                      className={`size-5 flex items-center justify-center rounded transition-colors ${
                        field.isNotNull
                          ? 'text-orange-500 bg-orange-50'
                          : showNotNull
                            ? 'text-gray-300 hover:text-orange-400 hover:bg-orange-50'
                            : 'invisible'
                      }`}
                      onClick={(e) => toggleNotNull(e, field)}
                    >
                      <span className="text-[9px]" style={{ fontWeight: 700, lineHeight: 1 }}>N!</span>
                    </button>
                  </ProTooltip>
                )}
                {!isEnumTable && !isJsonSchemaTable && (
                  <ProTooltip label="INDEX">
                    <button
                      className={`size-5 flex items-center justify-center rounded transition-colors ${
                        field.isIndexed
                          ? 'text-cyan-500 bg-cyan-50'
                          : showIndex
                            ? 'text-gray-300 hover:text-cyan-400 hover:bg-cyan-50'
                            : 'invisible'
                      }`}
                      onClick={(e) => toggleIndex(e, field)}
                    >
                      <ListOrdered className="size-3" />
                    </button>
                  </ProTooltip>
                )}
                {!isEnumTable && !isJsonSchemaTable && (
                  <ProTooltip label="UNIQUE">
                    <button
                      className={`size-5 flex items-center justify-center rounded transition-colors ${
                        field.isUnique && !field.isPrimaryKey
                          ? 'text-purple-600 bg-purple-50'
                          : showUnique
                            ? 'text-gray-300 hover:text-purple-400 hover:bg-purple-50'
                            : 'invisible'
                      }`}
                      onClick={(e) => toggleUnique(e, field)}
                    >
                      <span className="text-[9px]" style={{ fontWeight: 700, lineHeight: 1 }}>UQ</span>
                    </button>
                  </ProTooltip>
                )}
                {(isEnumTable || isJsonSchemaTable) && (
                  <ProTooltip label={isEnumTable ? 'Delete value' : 'Delete field'}>
                    <button
                      className="size-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover/enum-row:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteField?.(field.id);
                      }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </ProTooltip>
                )}
                {statusIndicator}
                {!isEnumTable && (
                  <DataTypeSelect
                    value={isJsonSchemaTable ? (jsonSchemaFieldMeta?.[field.id]?.schemaType || 'json') : getFieldTypeLabel(field)}
                    options={isJsonSchemaTable ? jsonSchemaTypes : availableTypes}
                    label="Change field type"
                    align="end"
                    disabled={!onFieldTypeChange && !(isJsonSchemaTable && onJsonSchemaFieldTypeChange)}
                    onChange={(type) => handleTypeSelect(field.id, type)}
                    triggerClassName="ml-0.5 h-6 max-w-[96px] flex-shrink-0 border-transparent px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:ring-0"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div> : null}
    </div>
  );
});

// Helper function to mix a hex color towards gray (reduce contrast)
function mixColorTowardGray(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  // Mix toward a light gray (#c0c0c0)
  const target = 192;
  const mr = Math.round(r + (target - r) * factor);
  const mg = Math.round(g + (target - g) * factor);
  const mb = Math.round(b + (target - b) * factor);
  return `rgb(${mr}, ${mg}, ${mb})`;
}
