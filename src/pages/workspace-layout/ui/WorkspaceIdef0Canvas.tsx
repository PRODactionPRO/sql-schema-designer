import { useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Box, CircleDot, Database, FileText, Maximize2, Plus, ShieldCheck, Trash2, UserRound, Workflow, Wrench } from 'lucide-react';
import type { Idef0Arrow, Idef0ArrowRole, Idef0Concept, Idef0ConceptKind, Idef0Function } from '@/shared/types/idef0';
import type { Idef0ProjectDocument, ProjectData } from '@/shared/types/project';
import type { CanvasViewport } from '@/shared/ui/useCanvasNavigation';
import { CanvasGridBackground, CanvasZoomIndicator } from '@/shared/ui/canvas-navigation-ui';
import { ContextMenu } from '@/shared/ui/ContextMenu';
import { useCanvasBoxSelection } from '@/shared/ui/useCanvasBoxSelection';
import { useContextMenu } from '@/shared/ui/useContextMenu';
import { cn } from '@/shared/ui/utils';
import {
  getIdef0ArrowRoleLabel,
  getIdef0DiagramBounds,
  getIdef0NodeId,
  getIdef0Path,
  IDEF0_CANVAS_WORLD_SIZE,
  type Idef0NodeRef,
  type Idef0NodeSide,
} from '../model/idef0-view-utils';
import { IDEF0_ARROW_ROLE_META, IDEF0_CONCEPT_KIND_META } from '../model/idef0-meta';
import type { WorkspaceSelection } from '../model/types';
import { useWorkspaceIdef0Canvas } from '../model/useWorkspaceIdef0Canvas';
import { withIdef0Diagram } from '../model/workspace-project-utils';
import { WorkspaceFloatingCanvasToolbar } from './WorkspaceFloatingCanvasToolbar';

const CONCEPT_MENU: Array<{ kind: Idef0ConceptKind; label: string; icon: ReactNode; separatorBefore?: boolean }> = [
  { kind: 'dataset', label: 'Input / Output: Dataset', icon: <Database className="size-3.5" /> },
  { kind: 'artifact', label: 'Input / Output: Artifact', icon: <FileText className="size-3.5" /> },
  { kind: 'material_object', label: 'Input / Output: Material object', icon: <Box className="size-3.5" /> },
  { kind: 'state', label: 'Input / Output: State', icon: <CircleDot className="size-3.5" /> },
  { kind: 'event', label: 'Input / Output: Event', icon: <Workflow className="size-3.5" /> },
  { kind: 'rule', label: 'Control: Rule / constraint', icon: <ShieldCheck className="size-3.5" />, separatorBefore: true },
  { kind: 'actor', label: 'Mechanism: Actor / role', icon: <UserRound className="size-3.5" />, separatorBefore: true },
  { kind: 'component', label: 'Mechanism: Component', icon: <Wrench className="size-3.5" /> },
];

export function Idef0Canvas({
  project,
  document,
  selection,
  initialViewport,
  viewportRestoreKey,
  onProjectChange,
  onSelectionChange,
  onViewportChange,
}: {
  project: ProjectData;
  document: Idef0ProjectDocument;
  selection: WorkspaceSelection | null;
  initialViewport?: CanvasViewport;
  viewportRestoreKey?: string | number;
  onProjectChange?: (project: ProjectData) => void;
  onSelectionChange?: (selection: WorkspaceSelection | null) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
}) {
  const contextMenu = useContextMenu();
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const canvas = useWorkspaceIdef0Canvas(document.idef0, {
    initialViewport,
    viewportRestoreKey,
    resizeAnchor: 'document',
    onViewportChange,
    onCommit: (diagram) => onProjectChange?.(withIdef0Diagram(project, document.id, diagram)),
  });
  const bounds = getIdef0DiagramBounds(canvas.diagram);
  const boxSelection = useCanvasBoxSelection({
    screenToWorld: canvas.screenToWorld,
    onSelect: (rect) => {
      const ids = canvas.selectNodesInRect(rect);
      const first = ids[0];
      if (!first) {
        onSelectionChange?.(null);
        return;
      }
      const [kind, id] = first.split(':');
      onSelectionChange?.({
        kind: kind === 'function' ? 'idef0Function' : 'idef0Concept',
        id,
        sourceView: 'idef0',
        parentId: document.id,
      });
    },
  });
  const functionsById = useMemo(() => new Map(canvas.diagram.functions.map((fn) => [fn.id, fn])), [canvas.diagram.functions]);
  const conceptsById = useMemo(() => new Map(canvas.diagram.concepts.map((concept) => [concept.id, concept])), [canvas.diagram.concepts]);

  const selectNode = (ref: Idef0NodeRef, additive = false) => {
    setSelectedArrowId(null);
    canvas.selectNode(ref, additive);
    onSelectionChange?.({
      kind: ref.kind === 'function' ? 'idef0Function' : 'idef0Concept',
      id: ref.id,
      sourceView: 'idef0',
      parentId: document.id,
    });
  };

  const openCanvasContextMenu = (event: ReactMouseEvent) => {
    const worldPoint = canvas.screenToWorld(event.nativeEvent) ?? { x: 160, y: 140 };
    contextMenu.openContextMenu(event, [
      {
        id: 'create-function',
        label: 'Create function',
        icon: <Plus className="size-3.5" />,
        onSelect: () => {
          const fn = canvas.addFunction(worldPoint);
          onSelectionChange?.({ kind: 'idef0Function', id: fn.id, sourceView: 'idef0', parentId: document.id });
        },
      },
      ...CONCEPT_MENU.map((item) => ({
        id: `create-${item.kind}`,
        label: item.label,
        icon: item.icon,
        separatorBefore: item.separatorBefore,
        onSelect: () => {
          const concept = canvas.addConcept(item.kind, worldPoint);
          onSelectionChange?.({ kind: 'idef0Concept', id: concept.id, sourceView: 'idef0', parentId: document.id });
        },
      })),
      {
        id: 'zoom-to-fit',
        label: 'Zoom to fit',
        icon: <Maximize2 className="size-3.5" />,
        separatorBefore: true,
        onSelect: () => canvas.zoomToBounds(bounds),
      },
    ]);
  };

  const openNodeContextMenu = (event: ReactMouseEvent, ref: Idef0NodeRef) => {
    selectNode(ref);
    const node = ref.kind === 'function' ? functionsById.get(ref.id) : conceptsById.get(ref.id);
    contextMenu.openContextMenu(event, [
      {
        id: 'rename-node',
        label: 'Rename',
        icon: <FileText className="size-3.5" />,
        onSelect: () => {
          const nextName = window.prompt('Name', node?.name ?? '');
          if (nextName) canvas.renameNode(ref, nextName);
        },
      },
      {
        id: 'delete-node',
        label: 'Delete node',
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        separatorBefore: true,
        onSelect: () => {
          canvas.deleteNode(ref);
          onSelectionChange?.(null);
        },
      },
    ]);
  };

  const openArrowContextMenu = (event: ReactMouseEvent, arrow: Idef0Arrow) => {
    setSelectedArrowId(arrow.id);
    onSelectionChange?.({ kind: 'relation', id: arrow.id, sourceView: 'idef0', parentId: document.id });
    contextMenu.openContextMenu(event, [
      {
        id: 'delete-arrow',
        label: 'Delete arrow',
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        onSelect: () => {
          canvas.deleteArrow(arrow.id);
          setSelectedArrowId(null);
          onSelectionChange?.(null);
        },
      },
    ]);
  };

  const handleCanvasMouseDown = (event: ReactMouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-idef0-node-kind]') || target.closest('[data-idef0-arrow-id]')) return;

    contextMenu.closeContextMenu();
    setSelectedArrowId(null);
    if (!event.shiftKey) {
      canvas.clearSelection();
      onSelectionChange?.(null);
    }
    boxSelection.startSelection(event);
  };

  return (
    <div
      ref={canvas.containerRef}
      className="canvas-surface relative h-full overflow-hidden"
      onContextMenu={openCanvasContextMenu}
      onMouseDown={handleCanvasMouseDown}
      style={{ cursor: canvas.isPanning ? 'grabbing' : boxSelection.isSelecting ? 'crosshair' : undefined }}
    >
      <CanvasGridBackground pan={canvas.pan} zoom={canvas.zoom} />
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.zoom})` }}
      >
        <svg
          className="absolute left-0 top-0 text-[#9fb0c6]"
          width={IDEF0_CANVAS_WORLD_SIZE}
          height={IDEF0_CANVAS_WORLD_SIZE}
          style={{ overflow: 'visible' }}
          aria-hidden="true"
        >
          <defs>
            {(['input', 'control', 'output', 'mechanism'] as Idef0ArrowRole[]).map((role) => (
              <marker
                key={role}
                id={`idef0-arrow-${role}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={IDEF0_ARROW_ROLE_META[role].color} />
              </marker>
            ))}
          </defs>
          {canvas.diagram.arrows.map((arrow) => {
            const path = getIdef0Path(arrow, canvas.nodeBoxes);
            if (!path) return null;
            const isSelected = selectedArrowId === arrow.id || (selection?.sourceView === 'idef0' && selection.kind === 'relation' && selection.id === arrow.id);
            const color = IDEF0_ARROW_ROLE_META[arrow.role].color;
            return (
              <g key={arrow.id} data-idef0-arrow-id={arrow.id} opacity={selectedArrowId && !isSelected ? 0.4 : 1}>
                <path
                  d={path.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedArrowId(arrow.id);
                    onSelectionChange?.({ kind: 'relation', id: arrow.id, sourceView: 'idef0', parentId: document.id });
                  }}
                  onContextMenu={(event) => openArrowContextMenu(event, arrow)}
                />
                <path
                  d={path.d}
                  fill="none"
                  stroke={isSelected ? '#111827' : color}
                  strokeWidth={isSelected ? 2.8 : 1.8}
                  strokeDasharray={arrow.status === 'optional' ? '6 6' : undefined}
                  markerEnd={`url(#idef0-arrow-${arrow.role})`}
                  className="pointer-events-none"
                />
                <text x={path.labelX} y={path.labelY} className="pointer-events-none fill-slate-500 text-[10px] font-semibold">
                  {arrow.label ?? getIdef0ArrowRoleLabel(arrow.role)}
                </text>
              </g>
            );
          })}
          {canvas.connectionDraft ? (
            <path
              d={`M ${canvas.connectionDraft.start.x} ${canvas.connectionDraft.start.y} L ${canvas.connectionDraft.current.x} ${canvas.connectionDraft.current.y}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeDasharray="6 5"
              className="pointer-events-none"
            />
          ) : null}
        </svg>
        {canvas.diagram.functions.map((fn) => (
          <Idef0FunctionNode
            key={fn.id}
            fn={fn}
            selected={canvas.selectedNodeIds.has(getIdef0NodeId({ kind: 'function', id: fn.id }))}
            onSelect={(event) => selectNode({ kind: 'function', id: fn.id }, event.shiftKey)}
            onStartDrag={canvas.startNodeDrag}
            onStartConnection={canvas.startConnectionDrag}
            onContextMenu={(event) => openNodeContextMenu(event, { kind: 'function', id: fn.id })}
          />
        ))}
        {canvas.diagram.concepts.map((concept) => (
          <Idef0ConceptNode
            key={concept.id}
            concept={concept}
            selected={canvas.selectedNodeIds.has(getIdef0NodeId({ kind: 'concept', id: concept.id }))}
            onSelect={(event) => selectNode({ kind: 'concept', id: concept.id }, event.shiftKey)}
            onStartDrag={canvas.startNodeDrag}
            onStartConnection={canvas.startConnectionDrag}
            onContextMenu={(event) => openNodeContextMenu(event, { kind: 'concept', id: concept.id })}
          />
        ))}
      </div>
      {canvas.diagram.functions.length === 0 && canvas.diagram.concepts.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-xs font-medium text-slate-400 shadow-sm">
            Right click to create IDEF0 nodes
          </div>
        </div>
      ) : null}
      <WorkspaceFloatingCanvasToolbar
        canUndo={canvas.canUndo}
        canRedo={canvas.canRedo}
        onUndo={canvas.undo}
        onRedo={canvas.redo}
        onZoomToFit={() => canvas.zoomToBounds(bounds)}
      />
      <CanvasZoomIndicator>
        {Math.round(canvas.zoom * 100)}%
      </CanvasZoomIndicator>
      {boxSelection.rectStyle ? (
        <div className="pointer-events-none fixed z-40 border-2 border-blue-400 bg-blue-400/10" style={boxSelection.rectStyle} />
      ) : null}
      <ContextMenu menu={contextMenu.menu} onClose={contextMenu.closeContextMenu} />
    </div>
  );
}

function Idef0FunctionNode({
  fn,
  selected,
  onSelect,
  onStartDrag,
  onStartConnection,
  onContextMenu,
}: {
  fn: Idef0Function;
  selected: boolean;
  onSelect: (event: ReactMouseEvent) => void;
  onStartDrag: (ref: Idef0NodeRef, position: { x: number; y: number }, event: ReactPointerEvent<HTMLElement>) => void;
  onStartConnection: (from: Idef0NodeRef, event: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  const width = fn.size?.width ?? 240;
  const height = fn.size?.height ?? 128;
  const accent = fn.domainId ? '#2563eb' : '#111827';

  return (
    <div
      data-idef0-node-kind="function"
      data-idef0-node-id={fn.id}
      className={cn(
        'absolute rounded border bg-white shadow-sm transition-shadow',
        selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 hover:border-slate-400',
      )}
      style={{ left: fn.position.x, top: fn.position.y, width, height }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(event);
      }}
      onPointerDown={(event) => onStartDrag({ kind: 'function', id: fn.id }, fn.position, event)}
      onContextMenu={onContextMenu}
    >
      <div className="flex h-full flex-col overflow-hidden rounded">
        <div className="flex h-8 items-center gap-2 border-b border-slate-200 px-3" style={{ backgroundColor: accent }}>
          <Workflow className="size-3.5 shrink-0 text-white/90" />
          <div className="min-w-0 flex-1 truncate text-xs font-semibold text-white">{fn.name}</div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-[11px] font-medium leading-4 text-slate-500">
          {fn.description || 'Function'}
        </div>
      </div>
      <FunctionHandle side="left" role="input" fnId={fn.id} onStartConnection={onStartConnection} />
      <FunctionHandle side="top" role="control" fnId={fn.id} onStartConnection={onStartConnection} />
      <FunctionHandle side="right" role="output" fnId={fn.id} onStartConnection={onStartConnection} />
      <FunctionHandle side="bottom" role="mechanism" fnId={fn.id} onStartConnection={onStartConnection} />
    </div>
  );
}

function FunctionHandle({
  side,
  role,
  fnId,
  onStartConnection,
}: {
  side: Exclude<Idef0NodeSide, 'center'>;
  role: Idef0ArrowRole;
  fnId: string;
  onStartConnection: (from: Idef0NodeRef, event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      data-idef0-node-kind="function"
      data-idef0-node-id={fnId}
      data-idef0-node-side={side}
      aria-label={`${getIdef0ArrowRoleLabel(role)} handle`}
      title={`${getIdef0ArrowRoleLabel(role)} handle`}
      className={cn(
        'absolute z-20 size-4 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125',
        side === 'left' && 'left-[-8px] top-1/2 -translate-y-1/2',
        side === 'top' && 'left-1/2 top-[-8px] -translate-x-1/2',
        side === 'right' && 'right-[-8px] top-1/2 -translate-y-1/2',
        side === 'bottom' && 'bottom-[-8px] left-1/2 -translate-x-1/2',
      )}
      style={{ backgroundColor: IDEF0_ARROW_ROLE_META[role].color }}
      onPointerDown={(event) => onStartConnection({ kind: 'function', id: fnId, side }, event)}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

function Idef0ConceptNode({
  concept,
  selected,
  onSelect,
  onStartDrag,
  onStartConnection,
  onContextMenu,
}: {
  concept: Idef0Concept;
  selected: boolean;
  onSelect: (event: ReactMouseEvent) => void;
  onStartDrag: (ref: Idef0NodeRef, position: { x: number; y: number }, event: ReactPointerEvent<HTMLElement>) => void;
  onStartConnection: (from: Idef0NodeRef, event: ReactPointerEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  const meta = IDEF0_CONCEPT_KIND_META[concept.kind];
  const width = concept.size?.width ?? 190;
  const height = concept.size?.height ?? 58;

  return (
    <div
      data-idef0-node-kind="concept"
      data-idef0-node-id={concept.id}
      className={cn(
        'absolute rounded border bg-white shadow-sm transition-shadow',
        selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 hover:border-slate-400',
      )}
      style={{ left: concept.position.x, top: concept.position.y, width, minHeight: height }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(event);
      }}
      onPointerDown={(event) => onStartDrag({ kind: 'concept', id: concept.id }, concept.position, event)}
      onContextMenu={onContextMenu}
    >
      <div className="flex h-full min-h-[58px] items-center gap-2 px-3">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-slate-800">{concept.name}</div>
          <div className="truncate text-[10px] font-medium text-slate-400">{meta.label}</div>
        </div>
      </div>
      <button
        type="button"
        data-idef0-node-kind="concept"
        data-idef0-node-id={concept.id}
        data-idef0-node-side="center"
        aria-label="Concept connection handle"
        title="Concept connection handle"
        className="absolute right-[-8px] top-1/2 z-20 size-4 -translate-y-1/2 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125"
        style={{ backgroundColor: meta.color }}
        onPointerDown={(event) => onStartConnection({ kind: 'concept', id: concept.id, side: 'center' }, event)}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
