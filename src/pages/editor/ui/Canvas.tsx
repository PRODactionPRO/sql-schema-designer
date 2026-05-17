import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { Table, Relation, Field, FieldType, RelationType, LineType, TypeCompatibility, Domain } from '../model/types';
import { getTypeCompatibility } from '../model/types';
import { TableNode } from './TableNode';
import type { DragFieldInfo } from './TableNode';
import { LayoutGrid, Trash2, Plus, Maximize2, FolderPlus, Pencil, Eye, EyeOff, Key, Code, Trash, Tag } from 'lucide-react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { actionMenuClasses } from '@/shared/ui/action-menu-styles';
import { useCanvasNavigation, type CanvasBounds, type CanvasResizeAnchor, type CanvasViewport } from '@/shared/ui/useCanvasNavigation';
import { CanvasGridBackground, CanvasZoomIndicator } from '@/shared/ui/canvas-navigation-ui';
import { useCanvasBoxSelection } from '@/shared/ui/useCanvasBoxSelection';

interface CanvasProps {
  tables: Table[];
  relations: Relation[];
  domains: Domain[];
  selectedTableId: string | null;
  selectedTableIds: Set<string>;
  selectedRelation: Relation | null;
  onTableSelect: (id: string) => void;
  onTablePositionChange: (id: string, position: { x: number; y: number }) => void;
  onTableDelete: (id: string) => void;
  onFieldClick: (tableId: string, fieldId: string) => void;
  onRelationSelect: (relation: Relation) => void;
  onFieldTypeChange?: (tableId: string, fieldId: string, type: FieldType) => void;
  onCreateRelation?: (fromTableId: string, fromFieldId: string, toTableId: string, toFieldId: string | null) => void;
  onAutoLayout: () => void;
  onToggleTableSelection: (id: string, additive: boolean) => void;
  onSelectTablesInRect: (rect: { x: number; y: number; w: number; h: number }) => void;
  onClearMultiSelection: () => void;
  onMoveSelectedTables: (dx: number, dy: number) => void;
  onDeleteTables: (ids: string[]) => void;
  getTableColor: (table: Table) => string;
  lineType: LineType;
  enabledFieldTypes?: FieldType[];
  viewportRef?: React.MutableRefObject<{ pan: { x: number; y: number }; zoom: number; width: number; height: number } | null>;
  centerOnTableRef?: React.MutableRefObject<((tableId: string) => void) | null>;
  zoomToFitRef?: React.MutableRefObject<(() => void) | null>;
  darkMode?: boolean;
  onTableDoubleClick?: (tableId: string) => void;
  onAddTable?: (position?: { x: number; y: number }) => void;
  onToggleMaximize?: () => void;
  onUpdateField?: (tableId: string, fieldId: string, updates: Partial<Field>) => void;
  onDeleteField?: (tableId: string, fieldId: string) => void;
  onAssignDomain?: (domainId: string, tableIds: string[]) => void;
  onOpenInCodeEditor?: (tableId: string, fieldId?: string) => void;
  highlightRelations?: boolean;
  onPushHistory?: () => void;
  onTableDragStop?: (tableId: string) => void;
  onTablesDragStop?: (tableIds: string[]) => void;
  initialViewport?: CanvasViewport;
  viewportRestoreKey?: string | number;
  resizeAnchor?: CanvasResizeAnchor;
  onViewportChange?: (viewport: CanvasViewport) => void;
  isEnumTableId?: (id: string) => boolean;
  isJsonSchemaTableId?: (id: string) => boolean;
  getJsonSchemaFieldMeta?: (tableId: string) => Record<string, { depth: number; hasChildren: boolean; collapsed: boolean; schemaType: string }>;
  onJsonSchemaToggleCollapse?: (tableId: string, fieldId: string) => void;
  onJsonSchemaFieldTypeChange?: (tableId: string, fieldId: string, schemaType: string) => void;
  onAddEnumTable?: (position?: { x: number; y: number }) => void;
  onAddJsonSchemaTable?: (position?: { x: number; y: number }) => void;
  onReorderEnumValue?: (enumTableId: string, fromIndex: number, toIndex: number) => void;
  onReorderField?: (tableId: string, fromIndex: number, toIndex: number) => void;
  onToggleTableCollapse?: (tableId: string) => void;
  onConvertTableToEnum?: (tableId: string) => void;
  onAddFieldToTable?: (tableId: string) => void;
  onValidateTable?: (tableId: string) => void;
}

const TABLE_WIDTH = 280;
const HEADER_HEIGHT = 40;
const FIELD_HEIGHT = 36;
const CULLING_MARGIN = 800; // world-space padding around viewport before a table is culled
const CULLING_MIN_TABLES = 180; // avoid culling on medium schemas to prevent visible pop-in
const WORLD_EXTENT = 50000; // generous workspace extent to avoid clipping at far pan positions

function getRenderedFieldCount(table: Table): number {
  return table.collapsed ? 0 : table.fields.length;
}

function getTableHeight(table: Table): number {
  return HEADER_HEIGHT + getRenderedFieldCount(table) * FIELD_HEIGHT;
}

interface DragState {
  source: DragFieldInfo;
  startWorldX: number; startWorldY: number;
  currentScreenX: number; currentScreenY: number;
  targetTableId: string | null; targetFieldId: string | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'canvas' | 'table' | 'multi-table' | 'field';
  tableId?: string;
  fieldId?: string;
  worldX?: number;
  worldY?: number;
}

function getTablesCanvasBounds(tables: Table[]): CanvasBounds | null {
  if (tables.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const table of tables) {
    minX = Math.min(minX, table.position.x);
    minY = Math.min(minY, table.position.y);
    maxX = Math.max(maxX, table.position.x + TABLE_WIDTH);
    maxY = Math.max(maxY, table.position.y + getTableHeight(table));
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function Canvas({
  tables, relations, domains, selectedTableId, selectedTableIds, selectedRelation,
  onTableSelect, onTablePositionChange, onTableDelete, onFieldClick,
  onRelationSelect, onFieldTypeChange, onCreateRelation,
  onAutoLayout, onToggleTableSelection, onSelectTablesInRect,
  onClearMultiSelection, onMoveSelectedTables, onDeleteTables, getTableColor,
  lineType, enabledFieldTypes, viewportRef, centerOnTableRef,
  zoomToFitRef,
  darkMode, onTableDoubleClick, onAddTable, onToggleMaximize,
  onUpdateField, onDeleteField, onAssignDomain, onOpenInCodeEditor,
  highlightRelations,
  onPushHistory,
  onTableDragStop,
  onTablesDragStop,
  initialViewport,
  viewportRestoreKey,
  resizeAnchor,
  onViewportChange,
  isEnumTableId,
  isJsonSchemaTableId,
  getJsonSchemaFieldMeta,
  onJsonSchemaToggleCollapse,
  onJsonSchemaFieldTypeChange,
  onAddEnumTable,
  onAddJsonSchemaTable,
  onReorderEnumValue,
  onReorderField,
  onToggleTableCollapse,
  onConvertTableToEnum,
  onAddFieldToTable,
  onValidateTable,
}: CanvasProps) {
  const {
    containerRef: canvasRef,
    pan,
    zoom,
    isPanning: isCanvasPanning,
    zoomRef,
    screenToWorld,
    centerOnBounds,
    zoomToBounds,
  } = useCanvasNavigation({
    initialPan: initialViewport?.pan,
    initialZoom: initialViewport?.zoom,
    restoreKey: viewportRestoreKey,
    resizeAnchor,
    onViewportChange,
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [convertConfirmTableId, setConvertConfirmTableId] = useState<string | null>(null);
  const [showDomainSubmenu, setShowDomainSubmenu] = useState(false);

  // Group drag state - use state for proper re-render triggers
  const [groupDragging, setGroupDragging] = useState(false);
  const groupDragStart = useRef({ x: 0, y: 0 });

  // Keep refs to latest tables/relations for direct SVG updates during drag
  const tablesRef = useRef(tables);
  const relationsRef = useRef(relations);
  const lineTypeRef = useRef(lineType);
  tablesRef.current = tables;
  relationsRef.current = relations;
  lineTypeRef.current = lineType;

  // Drag override: during single-table drag, store the visual position here
  // so SVG arrows can be updated via DOM without React re-renders
  const dragOverrideRef = useRef<{ tableId: string; pos: { x: number; y: number } } | null>(null);
  const svgGroupRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const existingFKFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rel of relations) {
      ids.add(rel.fromFieldId);
    }
    return ids;
  }, [relations]);

  const {
    isSelecting: isBoxSelecting,
    rectStyle: boxSelectionRectStyle,
    startSelection: startBoxSelection,
    cancelSelection: cancelBoxSelection,
  } = useCanvasBoxSelection({
    screenToWorld,
    onSelect: onSelectTablesInRect,
  });

  // Drag-to-connect — use ref for latest dragState to fix timing bug
  useEffect(() => {
    if (!dragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
      let targetTableId: string | null = null;
      let targetFieldId: string | null = null;
      for (const el of elementsUnder) {
        const htmlEl = el as HTMLElement;
        const fieldId = htmlEl.getAttribute('data-field-id') || htmlEl.closest('[data-field-id]')?.getAttribute('data-field-id');
        const tableId = htmlEl.getAttribute('data-table-id') || htmlEl.closest('[data-table-id]')?.getAttribute('data-table-id');
        if (fieldId && tableId && tableId !== dragStateRef.current?.source.tableId) { targetTableId = tableId; targetFieldId = fieldId; break; }
        const headerTableId = htmlEl.getAttribute('data-table-header') || htmlEl.closest('[data-table-header]')?.getAttribute('data-table-header');
        if (headerTableId && headerTableId !== dragStateRef.current?.source.tableId) { targetTableId = headerTableId; targetFieldId = null; break; }
        if (tableId && tableId !== dragStateRef.current?.source.tableId && !targetTableId) { targetTableId = tableId; }
      }
      setDragState(prev => prev ? { ...prev, currentScreenX: e.clientX, currentScreenY: e.clientY, targetTableId, targetFieldId } : null);
    };
    const handleMouseUp = () => {
      // Use ref to get the LATEST dragState (fixes timing issue)
      const ds = dragStateRef.current;
      if (ds?.targetTableId && onCreateRelation) {
        if (isEnumTableId?.(ds.source.tableId)) {
          setDragState(null);
          return;
        }
        onCreateRelation(ds.source.tableId, ds.source.fieldId, ds.targetTableId, ds.targetFieldId);
      }
      setDragState(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState, isEnumTableId, onCreateRelation]);

  // Group drag — now state-based for proper lifecycle
  useEffect(() => {
    if (!groupDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - groupDragStart.current.x) / zoomRef.current;
      const dy = (e.clientY - groupDragStart.current.y) / zoomRef.current;
      groupDragStart.current = { x: e.clientX, y: e.clientY };
      onMoveSelectedTables(dx, dy);
    };
    const handleMouseUp = () => {
      onTablesDragStop?.(Array.from(selectedTableIds));
      setGroupDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [groupDragging, onMoveSelectedTables, onTablesDragStop, selectedTableIds, zoomRef]);

  // Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        e.preventDefault();
        if (selectedTableIds.size > 0) {
          setPendingDeleteIds(Array.from(selectedTableIds));
        } else if (selectedTableId) {
          setPendingDeleteIds([selectedTableId]);
        }
      }
      if (e.key === 'Escape') {
        onClearMultiSelection();
        setContextMenu(null);
        setPendingDeleteIds(null);
        setConvertConfirmTableId(null);
        cancelBoxSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelBoxSelection, selectedTableId, selectedTableIds, onClearMultiSelection]);

  const handleFieldDragStart = useCallback((info: DragFieldInfo, e: React.MouseEvent) => {
    const worldPoint = screenToWorld(e.nativeEvent);
    if (!worldPoint) return;

    setDragState({
      source: info,
      startWorldX: worldPoint.x,
      startWorldY: worldPoint.y,
      currentScreenX: e.clientX, currentScreenY: e.clientY,
      targetTableId: null, targetFieldId: null,
    });
  }, [screenToWorld]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-table-id]')) return;
    setContextMenu(null);
    setShowDomainSubmenu(false);
    if (!e.shiftKey) onClearMultiSelection();
    startBoxSelection(e);
  };

  // Context menu handler - rich context-aware menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const worldPoint = screenToWorld(e.nativeEvent);
    if (!worldPoint) return;
    const { x: worldX, y: worldY } = worldPoint;

    const target = e.target as HTMLElement;
    const isInCurrentSelection = (tableId: string) =>
      selectedTableId === tableId || selectedTableIds.has(tableId);
    const focusTableForContextMenu = (tableId: string) => {
      if (isInCurrentSelection(tableId)) return;
      onClearMultiSelection();
      onTableSelect(tableId);
    };

    // Check if right-clicked on a field
    const fieldEl = target.closest('[data-field-id]') as HTMLElement | null;
    const tableEl = target.closest('[data-table-id]') as HTMLElement | null;

    if (fieldEl && tableEl) {
      const fieldId = fieldEl.getAttribute('data-field-id')!;
      const tableId = tableEl.getAttribute('data-table-id')!;

      // If multiple tables selected and this table is one of them
      if (selectedTableIds.size > 1 && selectedTableIds.has(tableId)) {
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'multi-table' });
        return;
      }
      focusTableForContextMenu(tableId);

      // Field context menu
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'field', tableId, fieldId });
      return;
    }

    if (tableEl) {
      const tableId = tableEl.getAttribute('data-table-id')!;

      // If multiple tables selected and this table is one of them
      if (selectedTableIds.size > 1 && selectedTableIds.has(tableId)) {
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'multi-table' });
        return;
      }
      focusTableForContextMenu(tableId);

      // Single table context menu
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'table', tableId });
      return;
    }

    // Empty canvas context menu
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'canvas', worldX, worldY });
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteIds || pendingDeleteIds.length === 0) return;
    onDeleteTables(pendingDeleteIds);
    setPendingDeleteIds(null);
    setContextMenu(null);
  };

  const getFieldAnchor = useCallback((tableId: string, fieldId: string, otherTableId: string): { x: number; y: number } | null => {
    const table = tables.find(t => t.id === tableId);
    const otherTable = tables.find(t => t.id === otherTableId);
    if (!table || !otherTable) return null;
    const isHeaderAnchor = fieldId === '__enum_header__' || fieldId === '__json_schema_header__';
    const fi = table.fields.findIndex(f => f.id === fieldId);
    if (!isHeaderAnchor && fi === -1) return null;
    // Use drag override position if this table is being dragged
    const override = dragOverrideRef.current;
    const tPos = (override && override.tableId === tableId) ? override.pos : table.position;
    const oPos = (override && override.tableId === otherTableId) ? override.pos : otherTable.position;
    const cy = isHeaderAnchor || table.collapsed
      ? tPos.y + HEADER_HEIGHT / 2
      : tPos.y + HEADER_HEIGHT + fi * FIELD_HEIGHT + FIELD_HEIGHT / 2;
    const tcx = tPos.x + TABLE_WIDTH / 2;
    const ocx = oPos.x + TABLE_WIDTH / 2;
    return { x: ocx > tcx ? tPos.x + TABLE_WIDTH : tPos.x, y: cy };
  }, [tables]);

  const getRelationHighlight = useCallback((relation: Relation): { highlighted: boolean; color: string } | null => {
    if (!highlightRelations) return null;
    const fromTable = tables.find(t => t.id === relation.fromTableId);
    if (!fromTable) return null;
    const fkOwnerColor = getTableColor(fromTable);
    const isMultiSelection = selectedTableIds.size >= 2;
    const singleSelectedId = selectedTableIds.size === 1
      ? Array.from(selectedTableIds)[0]
      : (selectedTableIds.size === 0 ? selectedTableId : null);
    if (isMultiSelection) {
      if (selectedTableIds.has(relation.fromTableId) && selectedTableIds.has(relation.toTableId)) {
        return { highlighted: true, color: fkOwnerColor };
      }
    } else if (singleSelectedId) {
      if (relation.fromTableId === singleSelectedId || relation.toTableId === singleSelectedId) {
        return { highlighted: true, color: fkOwnerColor };
      }
    }
    return null;
  }, [tables, selectedTableId, selectedTableIds, getTableColor, highlightRelations]);

  const buildPath = useCallback((fromPos: { x: number; y: number }, toPos: { x: number; y: number }, fromRight: boolean, toRight: boolean): string => {
    if (lineType === 'straight') {
      return `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`;
    }
    if (lineType === 'orthogonal') {
      const cpOffset = Math.max(40, Math.abs(fromPos.x - toPos.x) * 0.3);
      const midX1 = fromRight ? fromPos.x + cpOffset : fromPos.x - cpOffset;
      const midX2 = toRight ? toPos.x + cpOffset : toPos.x - cpOffset;
      const midX = (midX1 + midX2) / 2;
      return `M ${fromPos.x} ${fromPos.y} H ${midX} V ${toPos.y} H ${toPos.x}`;
    }
    const cpOffset = Math.max(60, Math.abs(fromPos.x - toPos.x) * 0.4);
    const cp1x = fromRight ? fromPos.x + cpOffset : fromPos.x - cpOffset;
    const cp2x = toRight ? toPos.x + cpOffset : toPos.x - cpOffset;
    return `M ${fromPos.x} ${fromPos.y} C ${cp1x} ${fromPos.y}, ${cp2x} ${toPos.y}, ${toPos.x} ${toPos.y}`;
  }, [lineType]);

  const drawRelationLine = (relation: Relation) => {
    const fromPos = getFieldAnchor(relation.fromTableId, relation.fromFieldId, relation.toTableId);
    const toPos = getFieldAnchor(relation.toTableId, relation.toFieldId, relation.fromTableId);
    if (!fromPos || !toPos) return null;
    const isRelSelected = selectedRelation?.id === relation.id;
    const highlight = getRelationHighlight(relation);
    const isHighlighted = !!highlight;
    const strokeColor = isRelSelected ? '#3b82f6' : isHighlighted ? highlight!.color : (darkMode ? '#585b70' : '#94a3b8');
    const strokeWidth = isRelSelected ? 2.5 : isHighlighted ? 2.5 : 1.5;
    const fromTable = tables.find(t => t.id === relation.fromTableId)!;
    const toTable = tables.find(t => t.id === relation.toTableId)!;
    if (!fromTable || !toTable) return null;
    // Use drag override for fromRight/toRight calculation too
    const override = dragOverrideRef.current;
    const fPos = (override && override.tableId === relation.fromTableId) ? override.pos : fromTable.position;
    const tPos = (override && override.tableId === relation.toTableId) ? override.pos : toTable.position;
    const fromRight = fromPos.x === fPos.x + TABLE_WIDTH;
    const toRight = toPos.x === tPos.x + TABLE_WIDTH;
    const path = buildPath(fromPos, toPos, fromRight, toRight);
    const fromDir = fromRight ? 1 : -1;
    const toDir = toRight ? 1 : -1;
    // Only dim if highlighting is enabled and something is selected but this line is not highlighted
    const hasSelection = selectedTableId || selectedTableIds.size > 0;
    const opacity = (highlightRelations && !isRelSelected && !isHighlighted && hasSelection) ? 0.15 : 1;
    return (
      <g key={relation.id} opacity={opacity}>
        <path d={path} fill="none" stroke="transparent" strokeWidth={14} className="cursor-pointer" onClick={() => onRelationSelect(relation)} data-rel-hit={relation.id} />
        <path d={path} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} className="pointer-events-none" strokeDasharray={relation.type === 'N:M' ? '6 3' : undefined} data-rel-path={relation.id} />
        {isHighlighted && !isRelSelected && (
          <path d={path} fill="none" stroke={strokeColor} strokeWidth={6} opacity={0.15} className="pointer-events-none" />
        )}
        {renderEndpointMarker(fromPos, fromDir, getFromCard(relation.type), strokeColor, isRelSelected || isHighlighted)}
        {renderEndpointMarker(toPos, toDir, getToCard(relation.type), strokeColor, isRelSelected || isHighlighted)}
        {isRelSelected && (
          <text x={(fromPos.x + toPos.x) / 2} y={(fromPos.y + toPos.y) / 2 - 8} textAnchor="middle" fill={strokeColor} fontSize={11} fontFamily="system-ui" className="pointer-events-none select-none">{relation.type}</text>
        )}
      </g>
    );
  };

  const dragSourceField = dragState
    ? (() => {
        const sourceTable = tables.find(t => t.id === dragState.source.tableId);
        return sourceTable?.fields.find(f => f.id === dragState.source.fieldId) || null;
      })()
    : null;

  const drawDragLine = () => {
    if (!dragState) return null;
    const st = tables.find(t => t.id === dragState.source.tableId);
    if (!st) return null;
    const fi = st.fields.findIndex(f => f.id === dragState.source.fieldId);
    if (fi === -1) return null;
    const startY = st.position.y + HEADER_HEIGHT + fi * FIELD_HEIGHT + FIELD_HEIGHT / 2;
    const endPoint = screenToWorld({
      clientX: dragState.currentScreenX,
      clientY: dragState.currentScreenY,
    });
    if (!endPoint) return null;
    const endX = endPoint.x;
    const endY = endPoint.y;
    const startX = endX > st.position.x + TABLE_WIDTH / 2 ? st.position.x + TABLE_WIDTH : st.position.x;
    const hasTarget = !!dragState.targetTableId;
    let compat: TypeCompatibility = 'exact';
    if (hasTarget && dragState.targetFieldId && dragSourceField) {
      const targetTable = tables.find(t => t.id === dragState.targetTableId);
      const targetField = targetTable?.fields.find(f => f.id === dragState.targetFieldId);
      if (targetField) {
        compat = getTypeCompatibility(dragSourceField, targetField);
      }
    }
    const color = compat === 'forbidden' ? '#ef4444'
      : compat === 'warning' ? '#f59e0b'
      : hasTarget ? '#3b82f6' : '#94a3b8';
    const dir = startX === st.position.x + TABLE_WIDTH ? 1 : -1;
    const cpOff = Math.max(60, Math.abs(startX - endX) * 0.4);
    const path = `M ${startX} ${startY} C ${startX + dir * cpOff} ${startY}, ${endX} ${endY}, ${endX} ${endY}`;
    return (<g><path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 3" className="pointer-events-none" /><circle cx={endX} cy={endY} r={5} fill={color} className="pointer-events-none" /></g>);
  };

  const handleTablePositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    onTablePositionChange(id, position);
  }, [onTablePositionChange]);

  const handleTableNodeSelect = useCallback((tableId: string, e?: React.MouseEvent) => {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      onToggleTableSelection(tableId, true);
    } else {
      onClearMultiSelection();
      onTableSelect(tableId);
    }
  }, [onTableSelect, onToggleTableSelection, onClearMultiSelection]);

  const handleGroupDragStart = useCallback((tableId: string, e: React.MouseEvent) => {
    // Allow group drag if this table is part of multi-selection
    if (selectedTableIds.has(tableId) && selectedTableIds.size > 1) {
      onPushHistory?.(); // Save pre-drag state
      groupDragStart.current = { x: e.clientX, y: e.clientY };
      setGroupDragging(true);
    }
  }, [selectedTableIds, onPushHistory]);

  // Direct SVG update during single-table drag — bypasses React for smooth performance
  const handleTableDragMove = useCallback((tableId: string, pos: { x: number; y: number }) => {
    dragOverrideRef.current = { tableId, pos };
    const svg = canvasRef.current?.querySelector('svg');
    if (!svg) return;
    const curTables = tablesRef.current;
    const lt = lineTypeRef.current;
    for (const rel of relationsRef.current) {
      if (rel.fromTableId !== tableId && rel.toTableId !== tableId) continue;
      // Compute anchor with override
      const computeAnchor = (tId: string, fId: string, otherId: string) => {
        const t = curTables.find(x => x.id === tId);
        const o = curTables.find(x => x.id === otherId);
        if (!t || !o) return null;
        const tPos = tId === tableId ? pos : t.position;
        const oPos = otherId === tableId ? pos : o.position;
        const isHeaderAnchor = fId === '__enum_header__' || fId === '__json_schema_header__';
        const fi = t.fields.findIndex(f => f.id === fId);
        if (!isHeaderAnchor && fi === -1) return null;
        const cy = isHeaderAnchor || t.collapsed
          ? tPos.y + HEADER_HEIGHT / 2
          : tPos.y + HEADER_HEIGHT + fi * FIELD_HEIGHT + FIELD_HEIGHT / 2;
        const tcx = tPos.x + TABLE_WIDTH / 2;
        const ocx = oPos.x + TABLE_WIDTH / 2;
        return { x: ocx > tcx ? tPos.x + TABLE_WIDTH : tPos.x, y: cy };
      };
      const fromPos = computeAnchor(rel.fromTableId, rel.fromFieldId, rel.toTableId);
      const toPos = computeAnchor(rel.toTableId, rel.toFieldId, rel.fromTableId);
      if (!fromPos || !toPos) continue;
      const ft = curTables.find(x => x.id === rel.fromTableId);
      const tt = curTables.find(x => x.id === rel.toTableId);
      if (!ft || !tt) continue;
      const fP = rel.fromTableId === tableId ? pos : ft.position;
      const tP = rel.toTableId === tableId ? pos : tt.position;
      const fromRight = fromPos.x === fP.x + TABLE_WIDTH;
      const toRight = toPos.x === tP.x + TABLE_WIDTH;
      let pathD: string;
      if (lt === 'straight') { pathD = `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`; }
      else if (lt === 'orthogonal') {
        const cpO = Math.max(40, Math.abs(fromPos.x - toPos.x) * 0.3);
        const m1 = fromRight ? fromPos.x + cpO : fromPos.x - cpO;
        const m2 = toRight ? toPos.x + cpO : toPos.x - cpO;
        pathD = `M ${fromPos.x} ${fromPos.y} H ${(m1+m2)/2} V ${toPos.y} H ${toPos.x}`;
      } else {
        const cpO = Math.max(60, Math.abs(fromPos.x - toPos.x) * 0.4);
        const c1 = fromRight ? fromPos.x + cpO : fromPos.x - cpO;
        const c2 = toRight ? toPos.x + cpO : toPos.x - cpO;
        pathD = `M ${fromPos.x} ${fromPos.y} C ${c1} ${fromPos.y}, ${c2} ${toPos.y}, ${toPos.x} ${toPos.y}`;
      }
      const hitPath = svg.querySelector(`[data-rel-hit="${rel.id}"]`) as SVGPathElement | null;
      const visPath = svg.querySelector(`[data-rel-path="${rel.id}"]`) as SVGPathElement | null;
      if (hitPath) hitPath.setAttribute('d', pathD);
      if (visPath) visPath.setAttribute('d', pathD);
    }
  }, [canvasRef]);

  const handleTableDragStop = useCallback((tableId: string) => {
    dragOverrideRef.current = null;
    onTableDragStop?.(tableId);
  }, [onTableDragStop]);

  const zoomPercent = Math.round(zoom * 100);
  const selRectStyle = boxSelectionRectStyle;

  // LOD level based on zoom
  const lodLevel: 'full' | 'compact' | 'minimal' = zoom > 0.45 ? 'full' : zoom > 0.2 ? 'compact' : 'minimal';

  // Viewport culling: only cull tables, never relations (arrows need DOM for direct updates during drag)
  const visibleTables = useMemo(() => {
    // Skip culling for medium schemas or when canvas isn't mounted yet.
    // This prevents noticeable pop-in near viewport edges.
    const canvas = canvasRef.current;
    if (!canvas || tables.length < CULLING_MIN_TABLES) return tables;
    const rect = canvas.getBoundingClientRect();
    const margin = CULLING_MARGIN / zoom;
    const x1 = (-pan.x / zoom) - margin;
    const y1 = (-pan.y / zoom) - margin;
    const x2 = (rect.width - pan.x) / zoom + margin;
    const y2 = (rect.height - pan.y) / zoom + margin;
    return tables.filter(t => {
      // Always keep selected/focused tables rendered
      if (selectedTableId === t.id || selectedTableIds.has(t.id)) return true;
      const tableH = getTableHeight(t);
      const tx2 = t.position.x + TABLE_WIDTH;
      const ty2 = t.position.y + tableH;
      return tx2 >= x1 && t.position.x <= x2 && ty2 >= y1 && t.position.y <= y2;
    });
  }, [canvasRef, tables, pan.x, pan.y, zoom, selectedTableId, selectedTableIds]);

  // Determine which tables are "focused" for the dimming feature (#6)
  const hasSelection = !!selectedTableId || selectedTableIds.size > 0;
  const focusedTableIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedTableId) ids.add(selectedTableId);
    selectedTableIds.forEach(id => ids.add(id));
    return ids;
  }, [selectedTableId, selectedTableIds]);

  // Expose viewport info to parent
  useEffect(() => {
    if (viewportRef && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      viewportRef.current = { pan, zoom, width: rect.width, height: rect.height };
    }
  }, [canvasRef, pan, zoom, viewportRef]);

  // Expose centerOnTable function to parent
  useEffect(() => {
    if (centerOnTableRef) {
      centerOnTableRef.current = (tableId: string) => {
        const table = tables.find(t => t.id === tableId);
        if (table) {
          const tableHeight = getTableHeight(table);
          centerOnBounds({
            minX: table.position.x,
            minY: table.position.y,
            maxX: table.position.x + TABLE_WIDTH,
            maxY: table.position.y + tableHeight,
            width: TABLE_WIDTH,
            height: tableHeight,
          }, zoomRef.current);
        }
      };
    }
  }, [centerOnBounds, centerOnTableRef, tables, zoomRef]);

  // Expose zoomToFit function to parent
  useEffect(() => {
    if (zoomToFitRef) {
      zoomToFitRef.current = () => {
        const bounds = getTablesCanvasBounds(tables);
        if (!bounds) return;
        zoomToBounds(bounds, 60, 1.5);
      };
    }
  }, [tables, zoomToBounds, zoomToFitRef]);

  // Drag tooltip
  const dragTooltip = dragState && (() => {
    let tooltipContent: React.ReactNode;
    if (dragState.targetTableId) {
      let compat: TypeCompatibility = 'exact';
      let targetTypeName = '';
      if (dragState.targetFieldId && dragSourceField) {
        const tt = tables.find(t => t.id === dragState.targetTableId);
        const tf = tt?.fields.find(f => f.id === dragState.targetFieldId);
        if (tf) {
          compat = getTypeCompatibility(dragSourceField, tf);
          targetTypeName = tf.type === 'enum' ? tf.enumName || 'enum' : tf.type;
        }
      }
      if (compat === 'forbidden') {
        const sourceTypeName = dragSourceField?.type === 'enum' ? dragSourceField.enumName || 'enum' : dragState.source.fieldType;
        tooltipContent = <span className="text-red-400">Incompatible types: {sourceTypeName} ✗ {targetTypeName}</span>;
      } else if (compat === 'warning') {
        const sourceTypeName = dragSourceField?.type === 'enum' ? dragSourceField.enumName || 'enum' : dragState.source.fieldType;
        tooltipContent = <span className="text-yellow-300">Requires cast: {sourceTypeName} → {targetTypeName}</span>;
      } else {
        tooltipContent = <span className="text-green-300">{dragState.targetFieldId ? 'Link to field' : 'Drop to create FK field'}</span>;
      }
    } else {
      tooltipContent = <span className="text-gray-300">Drag to a table or field...</span>;
    }
    return (
      <div className="fixed z-50 pointer-events-none bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs shadow-lg whitespace-nowrap" style={{ left: dragState.currentScreenX + 16, top: dragState.currentScreenY + 16 }}>
        {tooltipContent}
      </div>
    );
  })();

  // Context menu actions
  const handleCtxAddTable = () => {
    const pos = contextMenu?.worldX != null && contextMenu?.worldY != null
      ? { x: contextMenu.worldX, y: contextMenu.worldY }
      : undefined;
    setContextMenu(null);
    onAddTable?.(pos);
  };

  const handleCtxAddEnumTable = () => {
    const pos = contextMenu?.worldX != null && contextMenu?.worldY != null
      ? { x: contextMenu.worldX, y: contextMenu.worldY }
      : undefined;
    setContextMenu(null);
    onAddEnumTable?.(pos);
  };

  const handleCtxAddJsonSchemaTable = () => {
    const pos = contextMenu?.worldX != null && contextMenu?.worldY != null
      ? { x: contextMenu.worldX, y: contextMenu.worldY }
      : undefined;
    setContextMenu(null);
    onAddJsonSchemaTable?.(pos);
  };

  const handleCtxAutoLayout = () => {
    setContextMenu(null);
    onAutoLayout();
  };

  const handleCtxMaximize = () => {
    setContextMenu(null);
    onToggleMaximize?.();
  };

  const handleCtxDeleteTable = (tableId: string) => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    onTableDelete(tableId);
  };

  const handleCtxDeleteMulti = () => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    setPendingDeleteIds(Array.from(selectedTableIds));
  };

  const handleCtxCodeMode = (tableId: string, fieldId?: string) => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    onOpenInCodeEditor?.(tableId, fieldId);
  };

  const handleCtxAddField = (tableId: string) => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    onAddFieldToTable?.(tableId);
  };

  const handleCtxValidate = (tableId: string) => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    onValidateTable?.(tableId);
  };

  const handleCtxConvertToEnum = (tableId: string) => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    setConvertConfirmTableId(tableId);
  };

  const handleCtxSetPK = (tableId: string, fieldId: string) => {
    setContextMenu(null);
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    const field = table.fields.find(f => f.id === fieldId);
    if (!field) return;
    onUpdateField?.(tableId, fieldId, { isPrimaryKey: !field.isPrimaryKey });
  };

  const handleCtxDeleteField = (tableId: string, fieldId: string) => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    onDeleteField?.(tableId, fieldId);
  };

  const handleCtxRequestDeleteTable = (tableId: string) => {
    setContextMenu(null);
    setShowDomainSubmenu(false);
    setPendingDeleteIds([tableId]);
  };

  const getSafeMenuPosition = (x: number, y: number, menuHeight: number) => {
    const menuW = 240;
    const pad = 8;
    const bottomSafe = 90;
    let left = x;
    let top = y;
    if (left + menuW > window.innerWidth - pad) left = window.innerWidth - menuW - pad;
    if (left < pad) left = pad;
    if (top + menuHeight > window.innerHeight - bottomSafe) top = Math.max(pad, y - menuHeight);
    if (top < pad) top = pad;
    return { left, top };
  };

  // Render context menu content based on type
  const renderContextMenuContent = () => {
    if (!contextMenu) return null;
    const menuHeightByType: Record<ContextMenuState['type'], number> = {
      canvas: 190,
      table: 310,
      'multi-table': 260,
      field: 180,
    };
    const safePos = getSafeMenuPosition(contextMenu.x, contextMenu.y, menuHeightByType[contextMenu.type] || 280);
    // Shared dark action-menu style (reference for the whole project).
    const menuCls = `fixed z-50 select-none ${actionMenuClasses.content}`;
    const itemCls = `w-full text-left flex items-center transition-colors ${actionMenuClasses.item}`;
    const shortcutCls = `ml-auto ${actionMenuClasses.shortcut}`;
    const dangerCls = `w-full text-left flex items-center transition-colors ${actionMenuClasses.dangerItem}`;
    const separatorCls = `h-px mx-2 ${actionMenuClasses.separator}`;
    const labelCls = actionMenuClasses.label;

    switch (contextMenu.type) {
      case 'canvas':
        return (
          <div className={menuCls} style={safePos} onMouseDown={e => e.stopPropagation()}>
            <button className={itemCls} onClick={handleCtxAddTable}>
              <Plus className="size-3.5" /> Create table
            </button>
            <button className={itemCls} onClick={handleCtxAddEnumTable}>
              <Tag className="size-3.5" /> Create ENAM table
            </button>
            <button className={itemCls} onClick={handleCtxAddJsonSchemaTable}>
              <Code className="size-3.5" /> Create JSON Schema
            </button>
            <div className={separatorCls} />
            <button className={itemCls} onClick={handleCtxAutoLayout}>
              <LayoutGrid className="size-3.5" /> Auto-layout
            </button>
            <button className={itemCls} onClick={handleCtxMaximize}>
              <Maximize2 className="size-3.5" /> Toggle fullscreen <span className={shortcutCls}>F</span>
            </button>
          </div>
        );

      case 'table': {
        const tableId = contextMenu.tableId!;
        const isEnumTable = !!isEnumTableId?.(tableId);
        return (
          <div className={menuCls} style={safePos} onMouseDown={e => e.stopPropagation()}>
            {!isEnumTable && (
              <button className={itemCls} onClick={() => handleCtxConvertToEnum(tableId)}>
                <Tag className="size-3.5" /> Convert to enum
              </button>
            )}
            {domains.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() => setShowDomainSubmenu(true)}
                onMouseLeave={() => setShowDomainSubmenu(false)}
              >
                <button className={itemCls}>
                  <FolderPlus className="size-3.5" /> Add to domain
                </button>
                {showDomainSubmenu && (
                  <div className={`absolute left-full top-0 ${actionMenuClasses.content}`}>
                    {domains.map(d => (
                      <button key={d.id} className={itemCls} onClick={() => { setContextMenu(null); setShowDomainSubmenu(false); onAssignDomain?.(d.id, [tableId]); }}>
                        <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className={itemCls} onClick={() => handleCtxAddField(tableId)}>
              <Plus className="size-3.5" /> Add field
            </button>
            <button className={itemCls} onClick={() => handleCtxValidate(tableId)}>
              <Pencil className="size-3.5" /> Check for errors
            </button>
            <button className={itemCls} onClick={() => handleCtxCodeMode(tableId)}>
              <Code className="size-3.5" /> Open in code editor
            </button>
            <div className={separatorCls} />
            <button className={dangerCls} onClick={() => handleCtxRequestDeleteTable(tableId)}>
              <Trash className="size-3.5" /> Delete table <span className={shortcutCls}>Del</span>
            </button>
          </div>
        );
      }

      case 'multi-table':
        return (
          <div className={menuCls} style={safePos} onMouseDown={e => e.stopPropagation()}>
          {domains.length > 0 && (
            <>
              <div className={labelCls}>Assign {selectedTableIds.size} tables to domain</div>
              {domains.map(d => (
                <button key={d.id} className={itemCls} onClick={() => { setContextMenu(null); onAssignDomain?.(d.id, Array.from(selectedTableIds)); }}>
                  <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  {d.name}
                </button>
              ))}
              <div className={separatorCls} />
            </>
          )}
          <button className={dangerCls} onClick={handleCtxDeleteMulti}>
            <Trash className="size-3.5" /> Delete {selectedTableIds.size} tables <span className={shortcutCls}>Del</span>
          </button>
        </div>
        );

      case 'field': {
        const tableId = contextMenu.tableId!;
        const fieldId = contextMenu.fieldId!;
        const table = tables.find(t => t.id === tableId);
        const field = table?.fields.find(f => f.id === fieldId);
        if (!field) return null;
        return (
          <div className={menuCls} style={safePos} onMouseDown={e => e.stopPropagation()}>
            <button className={itemCls} onClick={() => handleCtxSetPK(tableId, fieldId)}>
              <Key className="size-3.5" /> {field.isPrimaryKey ? 'Remove PK' : 'Set as PK'}
            </button>
            <button className={itemCls} onClick={() => handleCtxCodeMode(tableId, fieldId)}>
              <Code className="size-3.5" /> Open in code editor
            </button>
            <div className={separatorCls} />
            <button className={dangerCls} onClick={() => handleCtxDeleteField(tableId, fieldId)}>
              <Trash className="size-3.5" /> Delete field
            </button>
          </div>
        );
      }
    }
  };

  return (
    <div
      ref={canvasRef}
      data-canvas-theme={darkMode ? 'dark' : 'light'}
      className="canvas-surface relative size-full overflow-hidden"
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={handleContextMenu}
      style={{ cursor: isCanvasPanning ? 'grabbing' : dragState ? 'crosshair' : isBoxSelecting ? 'crosshair' : undefined }}
    >
      <CanvasGridBackground pan={pan} zoom={zoom} darkMode={darkMode} />

      {/* Transformed layer */}
      <div className="absolute inset-0 origin-top-left" style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }}>
        <svg className="absolute pointer-events-none" style={{ width: WORLD_EXTENT, height: WORLD_EXTENT, pointerEvents: 'none', overflow: 'visible' }}>
          <g style={{ pointerEvents: 'auto' }}>{relations.map(drawRelationLine)}</g>
          {drawDragLine()}
        </svg>
        <div className="relative" style={{ minWidth: WORLD_EXTENT, minHeight: WORLD_EXTENT }}>
          {visibleTables.map(table => {
            const isFocused = !hasSelection || focusedTableIds.has(table.id);
            return (
              <TableNode
                key={table.id}
                table={table}
                tableColor={getTableColor(table)}
                isSelected={selectedTableId === table.id}
                isMultiSelected={selectedTableIds.size > 1 && selectedTableIds.has(table.id)}
                isFocused={isFocused}
                lodLevel={lodLevel}
                onSelect={handleTableNodeSelect}
                onPositionChange={handleTablePositionChange}
                onDelete={() => onTableDelete(table.id)}
                onFieldClick={(field) => onFieldClick(table.id, field.id)}
                onFieldTypeChange={onFieldTypeChange ? (fieldId, type) => onFieldTypeChange(table.id, fieldId, type) : undefined}
                zoom={zoom}
                onFieldDragStart={handleFieldDragStart}
                isDropTarget={dragState?.targetTableId === table.id}
                dropTargetFieldId={dragState?.targetTableId === table.id ? dragState.targetFieldId : null}
                onGroupDragStart={handleGroupDragStart}
                enabledFieldTypes={enabledFieldTypes}
                dragSourceFieldType={dragState ? dragSourceField?.type || null : null}
                isDragSourceTable={dragState?.source.tableId === table.id}
                existingFKFieldIds={dragState ? existingFKFieldIds : undefined}
                dragSourceFieldId={dragState?.source.fieldId}
                onDoubleClick={onTableDoubleClick ? () => onTableDoubleClick(table.id) : undefined}
                onUpdateField={onUpdateField ? (fieldId, updates) => onUpdateField(table.id, fieldId, updates) : undefined}
                onDeleteField={onDeleteField ? (fieldId) => onDeleteField(table.id, fieldId) : undefined}
                onDragEnd={onPushHistory}
                onDragMove={handleTableDragMove}
                onDragStop={handleTableDragStop}
                isEnumTable={!!isEnumTableId?.(table.id)}
                isJsonSchemaTable={!!isJsonSchemaTableId?.(table.id)}
                jsonSchemaFieldMeta={getJsonSchemaFieldMeta?.(table.id)}
                onJsonSchemaToggleCollapse={(fieldId) => onJsonSchemaToggleCollapse?.(table.id, fieldId)}
                onJsonSchemaFieldTypeChange={(fieldId, schemaType) => onJsonSchemaFieldTypeChange?.(table.id, fieldId, schemaType)}
                onReorderEnumValue={onReorderEnumValue ? ((fromIndex, toIndex) => onReorderEnumValue(table.id, fromIndex, toIndex)) : undefined}
                onReorderField={onReorderField ? ((fromIndex, toIndex) => onReorderField(table.id, fromIndex, toIndex)) : undefined}
                onToggleCollapse={onToggleTableCollapse ? (() => onToggleTableCollapse(table.id)) : undefined}
                onOpenContextMenu={(tableId, anchor) => {
                  setShowDomainSubmenu(false);
                  const isInCurrentSelection = selectedTableId === tableId || selectedTableIds.has(tableId);
                  if (!isInCurrentSelection) {
                    onClearMultiSelection();
                    onTableSelect(tableId);
                  }
                  if (selectedTableIds.size > 1 && selectedTableIds.has(tableId)) {
                    setContextMenu({ x: anchor.x, y: anchor.y, type: 'multi-table' });
                    return;
                  }
                  setContextMenu({ x: anchor.x, y: anchor.y, type: 'table', tableId });
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Rubber-band selection rect */}
      {selRectStyle && (
        <div className="fixed border-2 border-blue-400 bg-blue-400/10 pointer-events-none z-40" style={selRectStyle} />
      )}

      {/* Drag tooltip */}
      {dragTooltip}

      {/* Context menu */}
      {contextMenu && renderContextMenuContent()}

      <ConfirmDialog
        open={!!pendingDeleteIds}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIds(null);
        }}
        title="Confirm Deletion"
        description={
          pendingDeleteIds
            ? `Are you sure you want to delete ${pendingDeleteIds.length} table${pendingDeleteIds.length > 1 ? 's' : ''}? This action cannot be undone.`
            : undefined
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmVariant="destructive"
        darkMode={!!darkMode}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={!!convertConfirmTableId}
        onOpenChange={(open) => {
          if (!open) setConvertConfirmTableId(null);
        }}
        title="Confirm Conversion"
        description="Convert this table to an ENUM table? Existing table links may change."
        cancelLabel="Cancel"
        confirmLabel="Convert"
        darkMode={!!darkMode}
        onConfirm={() => {
          if (!convertConfirmTableId) return;
          onConvertTableToEnum?.(convertConfirmTableId);
          setConvertConfirmTableId(null);
        }}
      />

      {/* Multi-select info */}
      {selectedTableIds.size > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-lg px-4 py-1.5 text-xs shadow-lg flex items-center gap-3 z-30" onMouseDown={e => e.stopPropagation()}>
          <span>{selectedTableIds.size} table{selectedTableIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => setPendingDeleteIds(Array.from(selectedTableIds))} className="hover:bg-blue-500 rounded p-1" title="Delete selected"><Trash2 className="size-3.5" /></button>
          <button onClick={onClearMultiSelection} className="hover:bg-blue-500 rounded px-2 py-0.5">Esc</button>
        </div>
      )}

      <CanvasZoomIndicator darkMode={darkMode}>
        {zoomPercent}% {tables.length > 0 && visibleTables.length < tables.length && <span className="ml-1 opacity-60">({visibleTables.length}/{tables.length})</span>}
      </CanvasZoomIndicator>
    </div>
  );
}

function getFromCard(type: RelationType): 'one' | 'many' {
  return type === '1:1' || type === 'N:1' ? 'one' : 'many';
}
function getToCard(type: RelationType): 'one' | 'many' {
  return type === '1:1' || type === '1:N' ? 'one' : 'many';
}

function renderEndpointMarker(pos: { x: number; y: number }, dir: number, cardinality: 'one' | 'many', color: string, isSelected: boolean) {
  const size = 10, sw = isSelected ? 2 : 1.5;
  if (cardinality === 'many') {
    return (<g className="pointer-events-none">
      <line x1={pos.x} y1={pos.y} x2={pos.x + dir * size} y2={pos.y} stroke={color} strokeWidth={sw} />
      <line x1={pos.x} y1={pos.y} x2={pos.x + dir * size} y2={pos.y - size * 0.7} stroke={color} strokeWidth={sw} />
      <line x1={pos.x} y1={pos.y} x2={pos.x + dir * size} y2={pos.y + size * 0.7} stroke={color} strokeWidth={sw} />
      <line x1={pos.x + dir * (size + 3)} y1={pos.y - 6} x2={pos.x + dir * (size + 3)} y2={pos.y + 6} stroke={color} strokeWidth={sw} />
    </g>);
  }
  return (<g className="pointer-events-none">
    <line x1={pos.x + dir * 3} y1={pos.y - 6} x2={pos.x + dir * 3} y2={pos.y + 6} stroke={color} strokeWidth={sw} />
    <line x1={pos.x + dir * 7} y1={pos.y - 6} x2={pos.x + dir * 7} y2={pos.y + 6} stroke={color} strokeWidth={sw} />
  </g>);
}
