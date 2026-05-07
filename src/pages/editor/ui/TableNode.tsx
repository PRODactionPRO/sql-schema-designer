import { useRef, useEffect, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { Key, MoreVertical, ChevronDown, GripVertical, Hash, Type, ToggleLeft, Calendar, Clock, Braces, Binary, Globe, MapPin, Circle, FileCode, List, Tag, Fingerprint, DollarSign, Network, Hexagon, Ruler, Box, Database, Ban, AlertTriangle, Link, ShieldCheck, ListOrdered, Zap, Trash2 } from 'lucide-react';
import type { Field, FieldType, Table, TypeCompatibility } from '../model/types';
import { ALL_FIELD_TYPES, getTypeCompatibility } from '../model/types';

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  uuid: <Fingerprint className="size-3.5" />,
  bigint: <Hash className="size-3.5" />,
  integer: <Hash className="size-3.5" />,
  smallint: <Hash className="size-3.5" />,
  serial: <Hash className="size-3.5" />,
  bigserial: <Hash className="size-3.5" />,
  varchar: <Type className="size-3.5" />,
  text: <Type className="size-3.5" />,
  citext: <Type className="size-3.5" />,
  boolean: <ToggleLeft className="size-3.5" />,
  timestamp: <Calendar className="size-3.5" />,
  timestamptz: <Calendar className="size-3.5" />,
  date: <Calendar className="size-3.5" />,
  time: <Clock className="size-3.5" />,
  interval: <Clock className="size-3.5" />,
  json: <Braces className="size-3.5" />,
  jsonb: <Braces className="size-3.5" />,
  decimal: <DollarSign className="size-3.5" />,
  numeric: <Hash className="size-3.5" />,
  real: <Hash className="size-3.5" />,
  'double precision': <Hash className="size-3.5" />,
  money: <DollarSign className="size-3.5" />,
  bytea: <Binary className="size-3.5" />,
  inet: <Globe className="size-3.5" />,
  cidr: <Network className="size-3.5" />,
  macaddr: <Hexagon className="size-3.5" />,
  point: <MapPin className="size-3.5" />,
  line: <Ruler className="size-3.5" />,
  polygon: <Box className="size-3.5" />,
  circle: <Circle className="size-3.5" />,
  xml: <FileCode className="size-3.5" />,
  array: <List className="size-3.5" />,
  enum: <Tag className="size-3.5" />,
  vector: <Zap className="size-3.5" />,
};

function getTypeIcon(type: string) {
  return FIELD_TYPE_ICONS[type] || <Database className="size-3.5" />;
}

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
  onReorderEnumValue?: (fromIndex: number, toIndex: number) => void;
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
  onReorderEnumValue,
  onOpenContextMenu,
  onDeleteField,
}: TableNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const headerHandledClick = useRef(false);
  const positionRef = useRef(table.position);
  positionRef.current = table.position;
  const [editingTypeFieldId, setEditingTypeFieldId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const enumDragSourceIndexRef = useRef<number | null>(null);
  const [enumDragOverIndex, setEnumDragOverIndex] = useState<number | null>(null);

  const borderColor = tableColor;
  const availableTypes = enabledFieldTypes || ALL_FIELD_TYPES;

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
      if ((e.target as HTMLElement).closest('.table-header')) {
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

  const handleTypeClick = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    if (onFieldTypeChange) {
      const isClosing = editingTypeFieldId === fieldId;
      setEditingTypeFieldId(prev => prev === fieldId ? null : fieldId);
      if (!isClosing) {
        const btn = e.currentTarget as HTMLElement;
        const rect = btn.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 4, left: rect.right });
      } else {
        setDropdownPos(null);
      }
    }
  };

  const handleTypeSelect = (fieldId: string, type: FieldType) => {
    if (onFieldTypeChange) onFieldTypeChange(fieldId, type);
    setEditingTypeFieldId(null);
    setDropdownPos(null);
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

  const handleEnumRowDragStart = (index: number, e: React.DragEvent) => {
    enumDragSourceIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleEnumRowDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = enumDragSourceIndexRef.current;
    setEnumDragOverIndex(null);
    enumDragSourceIndexRef.current = null;
    if (sourceIndex == null || sourceIndex === targetIndex) return;
    onReorderEnumValue?.(sourceIndex, targetIndex);
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

  // --- Minimal LOD: colored rectangle with table name only ---
  if (lodLevel === 'minimal') {
    const fieldCount = table.fields.length;
    const totalH = 40 + fieldCount * 36;
    return (
      <div
        ref={nodeRef}
        className="absolute rounded-lg overflow-hidden select-none"
        style={{
          left: table.position.x, top: table.position.y, width: 280, height: totalH,
          willChange: 'transform',
          backgroundColor: headerBg,
          border: isMultiSelected || isSelected ? `3px solid ${borderColor}` : '1px solid #e5e7eb',
          opacity: textOpacity,
        }}
        data-table-id={table.id}
        onClick={(e) => onSelect(table.id, e)}
      >
        <div
          className="table-header px-3 py-1.5 flex items-center cursor-move"
          data-table-header={table.id}
        >
          <span className="text-white truncate text-xs" style={{ fontWeight: 600 }}>{table.name}</span>
          <span className="text-white/60 ml-auto text-[10px]">{fieldCount}</span>
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
        onClick={(e) => onSelect(table.id, e)}
        data-table-id={table.id}
      >
        <div
          className="table-header px-4 py-2 flex items-center justify-between cursor-move rounded-t-lg"
          style={{ backgroundColor: headerBg, borderBottom: `3px solid ${headerBorderColor}` }}
          data-table-header={table.id}
        >
          <span className="text-white truncate" style={{ fontWeight: 600, opacity: textOpacity }}>{table.name}</span>
        </div>
        <div className="divide-y divide-gray-200 rounded-b-lg overflow-hidden">
          {table.fields.map(field => (
            <div
              key={field.id}
              className="px-3 py-2 flex items-center"
              data-field-id={field.id}
              data-table-id={table.id}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {field.isPrimaryKey && <Key className="size-3 text-yellow-500 flex-shrink-0" />}
                {field.isForeignKey && !field.isPrimaryKey && <Key className="size-3 text-blue-400 flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />}
                <span className={`text-sm truncate ${field.isForeignKey ? 'text-blue-600' : ''}`} style={{ opacity: textOpacity }}>{field.name}</span>
              </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{getFieldTypeLabel(field)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Full LOD: original detailed rendering ---
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
        if (headerHandledClick.current) {
          headerHandledClick.current = false;
          return;
        }
        onSelect(table.id, e);
      }}
      data-table-id={table.id}
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
            {isEnumTable && (
              <span
                className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/20 text-white/90"
                style={{ opacity: textOpacity }}
              >
                enum
              </span>
            )}
          </div>
        </div>
        <button
          className="text-white hover:bg-white/20 rounded p-1 flex-shrink-0 opacity-0 pointer-events-none group-hover/table:opacity-100 group-hover/table:pointer-events-auto transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onOpenContextMenu?.(table.id, { x: rect.left, y: rect.bottom + 6 });
          }}
          title="Table actions"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>

      <div className="divide-y divide-gray-200 rounded-b-lg overflow-hidden">
        {table.fields.map((field, fieldIndex) => {
          const isFieldDropTarget = dropTargetFieldId === field.id;
          const isSource = isDragSourceTable && dragSourceFieldId === field.id;
          const dragState = getFieldDragState(field);
          const isHovered = hoveredFieldId === field.id;

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
          const showNotNull = isHovered || field.isNotNull;
          const showIndex = isHovered || field.isIndexed;
          const showUnique = isHovered || (field.isUnique && !field.isPrimaryKey);

          return (
            <div
              key={field.id}
              className={`px-3 py-2 flex items-center cursor-pointer relative ${
                !isFieldDropTarget && !isSource ? 'hover:bg-gray-50' : ''
              } ${fieldBg} ${isEnumTable ? 'group/enum-row' : ''} ${isEnumTable && enumDragOverIndex === fieldIndex ? 'ring-2 ring-inset ring-blue-300' : ''}`}
              style={fieldStyle}
              onClick={(e) => { e.stopPropagation(); onFieldClick(field); }}
              data-field-id={field.id}
              data-table-id={table.id}
              title={dragState?.reason}
              onMouseEnter={() => setHoveredFieldId(field.id)}
              onMouseLeave={() => setHoveredFieldId(null)}
              draggable={isEnumTable}
              onDragStart={isEnumTable ? (e) => handleEnumRowDragStart(fieldIndex, e) : undefined}
              onDragOver={isEnumTable ? (e) => { e.preventDefault(); setEnumDragOverIndex(fieldIndex); } : undefined}
              onDragLeave={isEnumTable ? () => setEnumDragOverIndex(null) : undefined}
              onDrop={isEnumTable ? (e) => handleEnumRowDrop(fieldIndex, e) : undefined}
            >
              {isEnumTable && (
                <div
                  className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mr-1 -ml-1"
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Drag to reorder"
                >
                  <GripVertical className="size-3.5" />
                </div>
              )}
              {!isEnumTable && (
                <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mr-1 -ml-1" onMouseDown={(e) => handleFieldDragStart(e, field)} title="Drag to create relation">
                  <GripVertical className="size-3.5" />
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {field.isPrimaryKey && <Key className="size-3 text-yellow-500 flex-shrink-0" />}
                {field.isForeignKey && !field.isPrimaryKey && <Key className="size-3 text-blue-400 flex-shrink-0" style={{ transform: 'rotate(45deg)' }} />}
                <span className={`text-sm truncate ${field.isForeignKey ? 'text-blue-600' : ''}`} style={{ opacity: textOpacity }}>{field.name}</span>
              </div>
              <div className="flex items-center gap-0.5 ml-1" style={{ minWidth: isEnumTable ? 28 : 68 }}>
                {/* Always render 3 button slots to prevent width changes */}
                {!isEnumTable && (<button
                  className={`size-5 flex items-center justify-center rounded transition-colors ${
                    field.isNotNull
                      ? 'text-orange-500 bg-orange-50'
                      : showNotNull
                        ? 'text-gray-300 hover:text-orange-400 hover:bg-orange-50'
                        : 'invisible'
                  }`}
                  onClick={(e) => toggleNotNull(e, field)}
                  title="NOT NULL"
                >
                  <span className="text-[9px]" style={{ fontWeight: 700, lineHeight: 1 }}>N!</span>
                </button>)}
                {!isEnumTable && (<button
                  className={`size-5 flex items-center justify-center rounded transition-colors ${
                    field.isIndexed
                      ? 'text-cyan-500 bg-cyan-50'
                      : showIndex
                        ? 'text-gray-300 hover:text-cyan-400 hover:bg-cyan-50'
                        : 'invisible'
                  }`}
                  onClick={(e) => toggleIndex(e, field)}
                  title="INDEX"
                >
                  <ListOrdered className="size-3" />
                </button>)}
                {!isEnumTable && (<button
                  className={`size-5 flex items-center justify-center rounded transition-colors ${
                    field.isUnique && !field.isPrimaryKey
                      ? 'text-purple-600 bg-purple-50'
                      : showUnique
                        ? 'text-gray-300 hover:text-purple-400 hover:bg-purple-50'
                        : 'invisible'
                  }`}
                  onClick={(e) => toggleUnique(e, field)}
                  title="UNIQUE"
                >
                  <span className="text-[9px]" style={{ fontWeight: 700, lineHeight: 1 }}>UQ</span>
                </button>)}
                {isEnumTable && (
                  <button
                    className="size-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover/enum-row:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteField?.(field.id);
                    }}
                    title="Delete value"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
                {statusIndicator}
                {!isEnumTable && (<button
                  className="text-xs text-gray-500 ml-0.5 flex-shrink-0 flex items-center gap-0.5 hover:text-gray-800 hover:bg-gray-100 rounded px-1.5 py-0.5 transition-colors"
                  onClick={(e) => handleTypeClick(e, field.id)}
                  title="Click to change type"
                >
                  {getFieldTypeLabel(field)}
                  {onFieldTypeChange && <ChevronDown className="size-2.5 opacity-50" />}
                </button>)}
              </div>
            </div>
          );
        })}
      </div>

      {editingTypeFieldId && dropdownPos && (() => {
        const editingField = table.fields.find(f => f.id === editingTypeFieldId);
        if (!editingField) return null;
        return createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => { setEditingTypeFieldId(null); setDropdownPos(null); }} />
            <div
              className="fixed bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-2 min-w-[160px] max-h-[240px] overflow-y-auto type-dropdown-scroll"
              style={{ zIndex: 9999, top: dropdownPos.top, left: dropdownPos.left, transform: 'translateX(-100%)' }}
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {availableTypes.map(type => (
                <button
                  key={type}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                    editingField.type === type
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                  onClick={() => handleTypeSelect(editingTypeFieldId, type)}
                >
                  <span className={editingField.type === type ? 'text-blue-200' : 'text-gray-500'}>{getTypeIcon(type)}</span>
                  {type}
                </button>
              ))}
            </div>
          </>,
          document.body
        );
      })()}
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
