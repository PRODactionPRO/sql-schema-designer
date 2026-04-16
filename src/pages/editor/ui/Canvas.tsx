import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { Table, Relation, Field, FieldType, RelationType, LineType, TypeCompatibility, Domain } from '../model/types';
import { getTypeCompatibility } from '../model/types';
import { TableNode } from './TableNode';
import type { DragFieldInfo } from './TableNode';
import { LayoutGrid, Trash2, Plus, Maximize2, FolderPlus, Pencil, Eye, EyeOff, Key, Code, Trash } from 'lucide-react';

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
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.001;
const SCROLL_SPEED = 1.5;
const TABLE_WIDTH = 280;
const HEADER_HEIGHT = 40;
const FIELD_HEIGHT = 36;
const CULLING_MARGIN = 200; // extra px margin around viewport for culling

interface DragState {
  source: DragFieldInfo;
  startWorldX: number; startWorldY: number;
  currentScreenX: number; currentScreenY: number;
  targetTableId: string | null; targetFieldId: string | null;
}

interface SelectionRect { startX: number; startY: number; currentX: number; currentY: number; }

interface ContextMenuState {
  x: number;
  y: number;
  type: 'canvas' | 'table' | 'multi-table' | 'field';
  tableId?: string;
  fieldId?: string;
  worldX?: number;
  worldY?: number;
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
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  // Panning + wheel zoom + scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOrigin.current = { ...panRef.current };
        canvas.style.cursor = 'grabbing';
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      setPan({ x: panOrigin.current.x + e.clientX - panStart.current.x, y: panOrigin.current.y + e.clientY - panStart.current.y });
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && isPanning.current) { isPanning.current = false; canvas.style.cursor = ''; }
    };
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const curPan = panRef.current;
        const curZoom = zoomRef.current;
        const wx = (mx - curPan.x) / curZoom, wy = (my - curPan.y) / curZoom;
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, curZoom * (1 - e.deltaY * ZOOM_SENSITIVITY)));
        setPan({ x: mx - wx * nz, y: my - wy * nz }); setZoom(nz);
      } else {
        e.preventDefault();
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          const dx = (e.deltaX !== 0 ? e.deltaX : e.deltaY) * SCROLL_SPEED;
          setPan(prev => ({ ...prev, x: prev.x - dx }));
        } else {
          const dy = e.deltaY * SCROLL_SPEED;
          setPan(prev => ({ ...prev, y: prev.y - dy }));
        }
      }
    };
    const handleAuxClick = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('auxclick', handleAuxClick);
    return () => { canvas.removeEventListener('mousedown', handleMouseDown); window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); canvas.removeEventListener('wheel', handleWheel); canvas.removeEventListener('auxclick', handleAuxClick); };
  }, []);

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
        onCreateRelation(ds.source.tableId, ds.source.fieldId, ds.targetTableId, ds.targetFieldId);
      }
      setDragState(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState, onCreateRelation]);

  // Rubber-band selection
  useEffect(() => {
    if (!selectionRect) return;
    const handleMouseMove = (e: MouseEvent) => {
      setSelectionRect(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    };
    const handleMouseUp = () => {
      if (selectionRect) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const s = selectionRect;
          const x1 = (Math.min(s.startX, s.currentX) - rect.left - pan.x) / zoom;
          const y1 = (Math.min(s.startY, s.currentY) - rect.top - pan.y) / zoom;
          const x2 = (Math.max(s.startX, s.currentX) - rect.left - pan.x) / zoom;
          const y2 = (Math.max(s.startY, s.currentY) - rect.top - pan.y) / zoom;
          onSelectTablesInRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
        }
      }
      setSelectionRect(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [selectionRect, pan, zoom, onSelectTablesInRect]);

  // Group drag — now state-based for proper lifecycle
  useEffect(() => {
    if (!groupDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - groupDragStart.current.x) / zoomRef.current;
      const dy = (e.clientY - groupDragStart.current.y) / zoomRef.current;
      groupDragStart.current = { x: e.clientX, y: e.clientY };
      onMoveSelectedTables(dx, dy);
    };
    const handleMouseUp = () => { setGroupDragging(false); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [groupDragging, onMoveSelectedTables]);

  // Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedTableIds.size > 0) {
        e.preventDefault();
        setConfirmDelete(true);
      }
      if (e.key === 'Escape') {
        onClearMultiSelection();
        setContextMenu(null);
        setConfirmDelete(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTableIds, onClearMultiSelection]);

  const handleFieldDragStart = useCallback((info: DragFieldInfo, e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDragState({
      source: info,
      startWorldX: (e.clientX - rect.left - pan.x) / zoom,
      startWorldY: (e.clientY - rect.top - pan.y) / zoom,
      currentScreenX: e.clientX, currentScreenY: e.clientY,
      targetTableId: null, targetFieldId: null,
    });
  }, [pan, zoom]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-table-id]')) return;
    setContextMenu(null);
    if (!e.shiftKey) onClearMultiSelection();
    setSelectionRect({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
  };

  // Context menu handler - rich context-aware menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - pan.x) / zoom;
    const worldY = (e.clientY - rect.top - pan.y) / zoom;

    const target = e.target as HTMLElement;

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

      // Single table context menu
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'table', tableId });
      return;
    }

    // Empty canvas context menu
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'canvas', worldX, worldY });
  };

  const handleConfirmDelete = () => {
    onDeleteTables(Array.from(selectedTableIds));
    setConfirmDelete(false);
    setContextMenu(null);
  };

  const getFieldAnchor = useCallback((tableId: string, fieldId: string, otherTableId: string): { x: number; y: number } | null => {
    const table = tables.find(t => t.id === tableId);
    const otherTable = tables.find(t => t.id === otherTableId);
    if (!table || !otherTable) return null;
    const fi = table.fields.findIndex(f => f.id === fieldId);
    if (fi === -1) return null;
    // Use drag override position if this table is being dragged
    const override = dragOverrideRef.current;
    const tPos = (override && override.tableId === tableId) ? override.pos : table.position;
    const oPos = (override && override.tableId === otherTableId) ? override.pos : otherTable.position;
    const cy = tPos.y + HEADER_HEIGHT + fi * FIELD_HEIGHT + FIELD_HEIGHT / 2;
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

  const dragSourceFieldType = dragState
    ? (() => {
        const sourceTable = tables.find(t => t.id === dragState.source.tableId);
        const sourceField = sourceTable?.fields.find(f => f.id === dragState.source.fieldId);
        return sourceField?.type || null;
      })()
    : null;

  const drawDragLine = () => {
    if (!dragState) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const st = tables.find(t => t.id === dragState.source.tableId);
    if (!st) return null;
    const fi = st.fields.findIndex(f => f.id === dragState.source.fieldId);
    if (fi === -1) return null;
    const startY = st.position.y + HEADER_HEIGHT + fi * FIELD_HEIGHT + FIELD_HEIGHT / 2;
    const rect = canvas.getBoundingClientRect();
    const endX = (dragState.currentScreenX - rect.left - pan.x) / zoom;
    const endY = (dragState.currentScreenY - rect.top - pan.y) / zoom;
    const startX = endX > st.position.x + TABLE_WIDTH / 2 ? st.position.x + TABLE_WIDTH : st.position.x;
    const hasTarget = !!dragState.targetTableId;
    let compat: TypeCompatibility = 'exact';
    if (hasTarget && dragState.targetFieldId && dragSourceFieldType) {
      const targetTable = tables.find(t => t.id === dragState.targetTableId);
      const targetField = targetTable?.fields.find(f => f.id === dragState.targetFieldId);
      if (targetField) {
        compat = getTypeCompatibility(dragSourceFieldType, targetField.type);
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

  const getSelectionRectStyle = () => {
    if (!selectionRect) return null;
    const x = Math.min(selectionRect.startX, selectionRect.currentX);
    const y = Math.min(selectionRect.startY, selectionRect.currentY);
    const w = Math.abs(selectionRect.currentX - selectionRect.startX);
    const h = Math.abs(selectionRect.currentY - selectionRect.startY);
    return { left: x, top: y, width: w, height: h };
  };

  const handleTablePositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    onTablePositionChange(id, position);
  }, [onTablePositionChange]);

  const handleTableNodeSelect = useCallback((tableId: string, e?: React.MouseEvent) => {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      onToggleTableSelection(tableId, true);
    } else if (selectedTableIds.has(tableId) && selectedTableIds.size > 1) {
      // Don't deselect multi-selection on single click
      return;
    } else {
      onClearMultiSelection();
      onTableSelect(tableId);
    }
  }, [onTableSelect, onToggleTableSelection, onClearMultiSelection, selectedTableIds]);

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
        const fi = t.fields.findIndex(f => f.id === fId);
        if (fi === -1) return null;
        const cy = tPos.y + HEADER_HEIGHT + fi * FIELD_HEIGHT + FIELD_HEIGHT / 2;
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
  }, []);

  const handleTableDragStop = useCallback((_tableId: string) => {
    dragOverrideRef.current = null;
  }, []);

  const zoomPercent = Math.round(zoom * 100);
  const selRectStyle = getSelectionRectStyle();

  // LOD level based on zoom
  const lodLevel: 'full' | 'compact' | 'minimal' = zoom > 0.45 ? 'full' : zoom > 0.2 ? 'compact' : 'minimal';

  // Viewport culling: only cull tables, never relations (arrows need DOM for direct updates during drag)
  const visibleTables = useMemo(() => {
    // Skip culling if we have few tables or canvas isn't mounted yet
    const canvas = canvasRef.current;
    if (!canvas || tables.length <= 50) return tables;
    const rect = canvas.getBoundingClientRect();
    const margin = CULLING_MARGIN / zoom;
    const x1 = (-pan.x / zoom) - margin;
    const y1 = (-pan.y / zoom) - margin;
    const x2 = (rect.width - pan.x) / zoom + margin;
    const y2 = (rect.height - pan.y) / zoom + margin;
    return tables.filter(t => {
      // Always keep selected/focused tables rendered
      if (selectedTableId === t.id || selectedTableIds.has(t.id)) return true;
      const tableH = HEADER_HEIGHT + t.fields.length * FIELD_HEIGHT;
      const tx2 = t.position.x + TABLE_WIDTH;
      const ty2 = t.position.y + tableH;
      return tx2 >= x1 && t.position.x <= x2 && ty2 >= y1 && t.position.y <= y2;
    });
  }, [tables, pan.x, pan.y, zoom, selectedTableId, selectedTableIds]);

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
  }, [pan, zoom, viewportRef]);

  // Expose centerOnTable function to parent
  useEffect(() => {
    if (centerOnTableRef) {
      centerOnTableRef.current = (tableId: string) => {
        const table = tables.find(t => t.id === tableId);
        if (table) {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const tableHeight = HEADER_HEIGHT + table.fields.length * FIELD_HEIGHT;
            const centerX = table.position.x + TABLE_WIDTH / 2;
            const centerY = table.position.y + tableHeight / 2;
            setPan({ x: rect.width / 2 - centerX * zoom, y: rect.height / 2 - centerY * zoom });
          }
        }
      };
    }
  }, [tables, canvasRef, centerOnTableRef, zoom]);

  // Expose zoomToFit function to parent
  useEffect(() => {
    if (zoomToFitRef) {
      zoomToFitRef.current = () => {
        if (tables.length === 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const PADDING = 60;

        // Calculate bounding box of all tables
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const t of tables) {
          minX = Math.min(minX, t.position.x);
          minY = Math.min(minY, t.position.y);
          maxX = Math.max(maxX, t.position.x + TABLE_WIDTH);
          maxY = Math.max(maxY, t.position.y + HEADER_HEIGHT + t.fields.length * FIELD_HEIGHT);
        }

        const contentW = maxX - minX + PADDING * 2;
        const contentH = maxY - minY + PADDING * 2;
        const newZoom = Math.min(
          Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rect.width / contentW, rect.height / contentH)),
          1.5
        );
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        setPan({ x: rect.width / 2 - centerX * newZoom, y: rect.height / 2 - centerY * newZoom });
        setZoom(newZoom);
      };
    }
  }, [tables, canvasRef, zoomToFitRef]);

  // Drag tooltip
  const dragTooltip = dragState && (() => {
    let tooltipContent: React.ReactNode;
    if (dragState.targetTableId) {
      let compat: TypeCompatibility = 'exact';
      let targetTypeName = '';
      if (dragState.targetFieldId && dragSourceFieldType) {
        const tt = tables.find(t => t.id === dragState.targetTableId);
        const tf = tt?.fields.find(f => f.id === dragState.targetFieldId);
        if (tf) {
          compat = getTypeCompatibility(dragSourceFieldType, tf.type);
          targetTypeName = tf.type;
        }
      }
      if (compat === 'forbidden') {
        tooltipContent = <span className="text-red-400">Incompatible types: {dragState.source.fieldType} ✗ {targetTypeName}</span>;
      } else if (compat === 'warning') {
        tooltipContent = <span className="text-yellow-300">Requires cast: {dragState.source.fieldType} → {targetTypeName}</span>;
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
    onTableDelete(tableId);
  };

  const handleCtxDeleteMulti = () => {
    setContextMenu(null);
    setConfirmDelete(true);
  };

  const handleCtxCodeMode = (tableId: string, fieldId?: string) => {
    setContextMenu(null);
    onOpenInCodeEditor?.(tableId, fieldId);
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
    onDeleteField?.(tableId, fieldId);
  };

  // Render context menu content based on type
  const renderContextMenuContent = () => {
    if (!contextMenu) return null;
    // Always dark/inverted style for context menus
    const menuCls = 'fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1.5 min-w-[200px]';
    const itemCls = 'w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-200 hover:bg-gray-800 hover:text-white transition-colors';
    const shortcutCls = 'ml-auto text-xs text-gray-500';
    const dangerCls = 'w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors';
    const separatorCls = 'h-px mx-2 my-1 bg-gray-700';
    const labelCls = 'px-3 py-1.5 text-xs text-gray-500';

    switch (contextMenu.type) {
      case 'canvas':
        return (
          <div className={menuCls} style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={e => e.stopPropagation()}>
            <button className={itemCls} onClick={handleCtxAddTable}>
              <Plus className="size-3.5" /> Create table
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
        return (
          <div className={menuCls} style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={e => e.stopPropagation()}>
            {domains.length > 0 && (
              <>
                <div className={labelCls}>Assign to domain</div>
                {domains.map(d => (
                  <button key={d.id} className={itemCls} onClick={() => { setContextMenu(null); onAssignDomain?.(d.id, [tableId]); }}>
                    <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </button>
                ))}
                <div className={separatorCls} />
              </>
            )}
            <button className={itemCls} onClick={() => handleCtxCodeMode(tableId)}>
              <Code className="size-3.5" /> Open in code editor
            </button>
            <div className={separatorCls} />
            <button className={dangerCls} onClick={() => handleCtxDeleteTable(tableId)}>
              <Trash className="size-3.5" /> Delete table <span className={shortcutCls}>Del</span>
            </button>
          </div>
        );
      }

      case 'multi-table':
        return (
          <div className={menuCls} style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={e => e.stopPropagation()}>
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
          <div className={menuCls} style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={e => e.stopPropagation()}>
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
      className={`relative size-full overflow-hidden ${darkMode ? 'bg-[#11111b]' : 'bg-gray-50'}`}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={handleContextMenu}
      style={{ cursor: dragState ? 'crosshair' : selectionRect ? 'crosshair' : undefined }}
    >
      {/* Background grid */}
      {(() => {
        const baseStep = 20;
        let step = baseStep;
        if (zoom < 0.25) step = baseStep * 4;
        else if (zoom < 0.5) step = baseStep * 2;
        const screenStep = step * zoom;
        const dotR = zoom < 0.35 ? 0.5 : 1;
        const dotColor = darkMode ? '#313244' : '#d1d5db';
        return (
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle, ${dotColor} ${dotR}px, transparent ${dotR}px)`,
            backgroundSize: `${screenStep}px ${screenStep}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }} />
        );
      })()}

      {/* Transformed layer */}
      <div className="absolute inset-0 origin-top-left" style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }}>
        <svg className="absolute pointer-events-none" style={{ width: 10000, height: 10000, pointerEvents: 'none', overflow: 'visible' }}>
          <g style={{ pointerEvents: 'auto' }}>{relations.map(drawRelationLine)}</g>
          {drawDragLine()}
        </svg>
        <div className="relative" style={{ minWidth: 10000, minHeight: 10000 }}>
          {visibleTables.map(table => {
            const isFocused = !hasSelection || focusedTableIds.has(table.id);
            return (
              <TableNode
                key={table.id}
                table={table}
                tableColor={getTableColor(table)}
                isSelected={selectedTableId === table.id}
                isMultiSelected={selectedTableIds.has(table.id)}
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
                dragSourceFieldType={dragState ? dragSourceFieldType : null}
                isDragSourceTable={dragState?.source.tableId === table.id}
                existingFKFieldIds={dragState ? existingFKFieldIds : undefined}
                dragSourceFieldId={dragState?.source.fieldId}
                onDoubleClick={onTableDoubleClick ? () => onTableDoubleClick(table.id) : undefined}
                onUpdateField={onUpdateField ? (fieldId, updates) => onUpdateField(table.id, fieldId, updates) : undefined}
                onDragEnd={onPushHistory}
                onDragMove={handleTableDragMove}
                onDragStop={handleTableDragStop}
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
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onMouseDown={e => e.stopPropagation()} />
          {renderContextMenuContent()}
        </>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setConfirmDelete(false)} onMouseDown={e => e.stopPropagation()}>
          <div className={`rounded-xl shadow-2xl p-6 max-w-sm mx-4 ${
            darkMode ? 'bg-[#1e1e2e] text-[#cdd6f4]' : 'bg-white'
          }`} onClick={e => e.stopPropagation()}>
            <h3 className={`mb-2 ${darkMode ? 'text-[#cdd6f4]' : 'text-gray-900'}`} style={{ fontWeight: 600 }}>Confirm Deletion</h3>
            <p className={`text-sm mb-4 ${darkMode ? 'text-[#a6adc8]' : 'text-gray-600'}`}>
              Are you sure you want to delete {selectedTableIds.size} table{selectedTableIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button className={`px-4 py-2 text-sm rounded-lg ${darkMode ? 'text-[#a6adc8] hover:bg-[#313244]' : 'text-gray-600 hover:bg-gray-100'}`} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg" onClick={handleConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-select info */}
      {selectedTableIds.size > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-lg px-4 py-1.5 text-xs shadow-lg flex items-center gap-3 z-30" onMouseDown={e => e.stopPropagation()}>
          <span>{selectedTableIds.size} table{selectedTableIds.size > 1 ? 's' : ''} selected</span>
          <button onClick={() => setConfirmDelete(true)} className="hover:bg-blue-500 rounded p-1" title="Delete selected"><Trash2 className="size-3.5" /></button>
          <button onClick={onClearMultiSelection} className="hover:bg-blue-500 rounded px-2 py-0.5">Esc</button>
        </div>
      )}

      {/* Zoom indicator */}
      <div className={`absolute bottom-12 right-3 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-xs shadow-sm select-none ${
        darkMode ? 'bg-[#1e1e2e]/90 border-[#45475a] text-[#a6adc8]' : 'bg-white/90 border-gray-200 text-gray-600'
      }`}>{zoomPercent}% {tables.length > 0 && visibleTables.length < tables.length && <span className="ml-1 opacity-60">({visibleTables.length}/{tables.length})</span>}</div>
      <div className={`absolute bottom-12 left-3 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-xs shadow-sm select-none ${
        darkMode ? 'bg-[#1e1e2e]/90 border-[#45475a] text-[#585b70]' : 'bg-white/90 border-gray-200 text-gray-400'
      }`}>
        Scroll: pan · Shift+scroll: pan X · Ctrl+wheel: zoom
      </div>
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