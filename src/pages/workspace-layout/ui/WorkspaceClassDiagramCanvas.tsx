import { useCallback, useEffect, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Copy, GitBranch, LayoutGrid, Link2, Maximize2, Plus, Rows3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ClassDiagramProjectDocument, ProjectData } from '@/shared/types/project';
import type { CanvasViewport } from '@/shared/ui/useCanvasNavigation';
import { CanvasGridBackground, CanvasZoomIndicator } from '@/shared/ui/canvas-navigation-ui';
import { ContextMenu } from '@/shared/ui/ContextMenu';
import { useCanvasBoxSelection } from '@/shared/ui/useCanvasBoxSelection';
import { useContextMenu } from '@/shared/ui/useContextMenu';
import {
  CLASS_CANVAS_WORLD_SIZE,
  CLASS_CARD_WIDTH,
  classMethodReturnTypeOptions,
  getClassDiagramBounds,
  getClassEntityKindMeta,
  getClassRelationPath,
} from '../model/class-diagram-view-utils';
import type { WorkspaceSelection } from '../model/types';
import { useWorkspaceClassDiagramCanvas } from '../model/useWorkspaceClassDiagramCanvas';
import { withClassDiagram } from '../model/workspace-project-utils';
import { ClassEntityCard } from './WorkspaceClassEntityCard';
import { WorkspaceFloatingCanvasToolbar } from './WorkspaceFloatingCanvasToolbar';
import { MockClassDiagramCanvas } from './WorkspaceMockDiagramCanvases';

export function ClassDiagramCanvas({
  project,
  selection,
  initialViewport,
  viewportRestoreKey,
  onProjectChange,
  onSelectionChange,
  onViewportChange,
}: {
  project?: ProjectData;
  selection: WorkspaceSelection | null;
  initialViewport?: CanvasViewport;
  viewportRestoreKey?: string | number;
  onProjectChange?: (project: ProjectData) => void;
  onSelectionChange?: (selection: WorkspaceSelection | null) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
}) {
  const document = project?.documents.find((item): item is ClassDiagramProjectDocument => item.type === 'class-diagram');

  if (!project || !document?.classDiagram) return <MockClassDiagramCanvas />;

  return (
    <ProjectClassDiagramCanvas
      project={project}
      sourceDiagram={document.classDiagram}
      selection={selection}
      initialViewport={initialViewport}
      viewportRestoreKey={viewportRestoreKey}
      onProjectChange={onProjectChange}
      onSelectionChange={onSelectionChange}
      onViewportChange={onViewportChange}
    />
  );
}

function ProjectClassDiagramCanvas({
  project,
  sourceDiagram,
  selection,
  initialViewport,
  viewportRestoreKey,
  onProjectChange,
  onSelectionChange,
  onViewportChange,
}: {
  project: ProjectData;
  sourceDiagram: ClassDiagramProjectDocument['classDiagram'];
  selection: WorkspaceSelection | null;
  initialViewport?: CanvasViewport;
  viewportRestoreKey?: string | number;
  onProjectChange?: (project: ProjectData) => void;
  onSelectionChange?: (selection: WorkspaceSelection | null) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
}) {
  const classSemanticBinding = useMemo(() => {
    const binding = project.semantic?.classDiagram;
    if (!binding) return undefined;

    return {
      ...binding,
      objectsByLegacyId: {
        ...project.semantic?.objectsByLegacyId,
        ...binding.objectsByLegacyId,
      },
    };
  }, [project.semantic?.classDiagram, project.semantic?.objectsByLegacyId]);

  const canvas = useWorkspaceClassDiagramCanvas(sourceDiagram, {
    projectId: project.id,
    semanticBinding: classSemanticBinding,
    initialViewport,
    viewportRestoreKey,
    resizeAnchor: 'document',
    onViewportChange,
    onCommit: (diagram) => onProjectChange?.(withClassDiagram(project, diagram)),
  });
  const diagram = canvas.diagram;
  const selectedParentId = selection?.sourceView === 'classDiagram' ? selection.parentId : undefined;
  const selectedClassId = selection?.sourceView === 'classDiagram' ? selection.id : undefined;
  const domainColorById = useMemo(() => new Map(diagram.domains.map((domain) => [domain.id, domain.color])), [diagram.domains]);
  const classById = useMemo(() => new Map(diagram.classes.map((entity) => [entity.id, entity])), [diagram.classes]);
  const methodReturnTypeOptions = useMemo(() => classMethodReturnTypeOptions(diagram.classes), [diagram.classes]);
  const bounds = getClassDiagramBounds(diagram.classes);
  const selectedRelationId = selection?.sourceView === 'classDiagram' && selection.kind === 'relation' ? selection.id : undefined;
  const contextMenu = useContextMenu();
  const boxSelection = useCanvasBoxSelection({
    screenToWorld: canvas.screenToWorld,
    onSelect: (rect) => {
      const ids = canvas.selectClassesInRect(rect);
      onSelectionChange?.(ids[0] ? { kind: 'class', id: ids[0], sourceView: 'classDiagram' } : null);
    },
  });

  const handleCanvasMouseDown = (event: ReactMouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-class-card-id]') || target.closest('[data-class-relation-id]')) return;

    contextMenu.closeContextMenu();
    if (!event.shiftKey) {
      canvas.clearClassSelection();
      onSelectionChange?.(null);
    }
    boxSelection.startSelection(event);
  };

  const openCanvasContextMenu = (event: ReactMouseEvent) => {
    const worldPoint = canvas.screenToWorld(event.nativeEvent) ?? { x: 160, y: 140 };
    contextMenu.openContextMenu(event, [
      {
        id: 'create-class',
        label: 'Create class',
        icon: <Plus className="size-3.5" />,
        onSelect: () => canvas.addClassEntity('class', worldPoint),
      },
      {
        id: 'create-interface',
        label: 'Create interface',
        icon: <Rows3 className="size-3.5" />,
        onSelect: () => canvas.addClassEntity('interface', worldPoint),
      },
      {
        id: 'create-enum',
        label: 'Create enum',
        icon: <Rows3 className="size-3.5" />,
        onSelect: () => canvas.addClassEntity('enum', worldPoint),
      },
      {
        id: 'auto-layout',
        label: 'Auto-layout',
        icon: <LayoutGrid className="size-3.5" />,
        separatorBefore: true,
        onSelect: canvas.autoLayout,
      },
      {
        id: 'zoom-to-fit',
        label: 'Zoom to fit',
        icon: <Maximize2 className="size-3.5" />,
        onSelect: () => canvas.zoomToBounds(bounds),
      },
    ]);
  };

  const openEntityContextMenu = (event: ReactMouseEvent, classId: string) => {
    const relationTargets = diagram.classes
      .filter((entity) => entity.id !== classId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);

    onSelectionChange?.({ kind: 'class', id: classId, sourceView: 'classDiagram' });
    canvas.clearClassSelection();
    contextMenu.openContextMenu(event, [
      {
        id: 'add-attribute',
        label: 'Add attribute',
        icon: <Plus className="size-3.5" />,
        onSelect: () => canvas.addAttribute(classId),
      },
      {
        id: 'add-method',
        label: 'Add method',
        icon: <Plus className="size-3.5" />,
        onSelect: () => canvas.addMethod(classId),
      },
      {
        id: 'duplicate-class',
        label: 'Duplicate',
        icon: <Copy className="size-3.5" />,
        separatorBefore: true,
        onSelect: () => canvas.duplicateClassEntity(classId),
      },
      ...relationTargets.map((target, index) => ({
        id: `relate-${target.id}`,
        label: `Relate to ${target.name}`,
        icon: <Link2 className="size-3.5" />,
        separatorBefore: index === 0,
        onSelect: () => {
          const relation = canvas.addClassRelation(classId, target.id);
          if (relation) onSelectionChange?.({ kind: 'relation', id: relation.id, sourceView: 'classDiagram' });
        },
      })),
      {
        id: 'delete-class',
        label: 'Delete class',
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        separatorBefore: true,
        onSelect: () => {
          canvas.deleteClassEntity(classId);
          onSelectionChange?.(null);
        },
      },
    ]);
  };

  const openMemberContextMenu = (
    event: ReactMouseEvent,
    classId: string,
    memberId: string,
    kind: 'classAttribute' | 'classMethod',
  ) => {
    onSelectionChange?.({ kind, id: memberId, parentId: classId, sourceView: 'classDiagram' });
    contextMenu.openContextMenu(event, [
      {
        id: kind === 'classAttribute' ? 'add-attribute' : 'add-method',
        label: kind === 'classAttribute' ? 'Add attribute' : 'Add method',
        icon: <Plus className="size-3.5" />,
        onSelect: () => {
          if (kind === 'classAttribute') canvas.addAttribute(classId);
          else canvas.addMethod(classId);
        },
      },
    ]);
  };

  const openRelationContextMenu = (event: ReactMouseEvent, relationId: string) => {
    onSelectionChange?.({ kind: 'relation', id: relationId, sourceView: 'classDiagram' });
    contextMenu.openContextMenu(event, [
      {
        id: 'select-relation',
        label: 'Open relation properties',
        icon: <GitBranch className="size-3.5" />,
        onSelect: () => onSelectionChange?.({ kind: 'relation', id: relationId, sourceView: 'classDiagram' }),
      },
      {
        id: 'delete-relation',
        label: 'Delete relation',
        icon: <Trash2 className="size-3.5" />,
        destructive: true,
        separatorBefore: true,
        onSelect: () => {
          canvas.deleteClassRelation(relationId);
          onSelectionChange?.(null);
        },
      },
    ]);
  };

  const getSelectedClassIds = useCallback(() => {
    const ids = new Set(canvas.selectedClassIds);
    if (selection?.sourceView === 'classDiagram') {
      if (selection.kind === 'class') ids.add(selection.id);
      if ((selection.kind === 'classAttribute' || selection.kind === 'classMethod') && selection.parentId) {
        ids.add(selection.parentId);
      }
    }
    return [...ids];
  }, [canvas.selectedClassIds, selection]);

  const getPasteOffsetToViewportCenter = useCallback((content: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return undefined;
    }

    const payload = parsed as { classes?: Array<{ position?: { x: number; y: number }; attributes?: unknown[]; methods?: unknown[] }> };
    const boxes = (payload.classes ?? [])
      .map((entity) => ({
        x: entity.position?.x,
        y: entity.position?.y,
        width: CLASS_CARD_WIDTH,
        height: 114
          + Math.max(1, Array.isArray(entity.attributes) ? entity.attributes.length : 0) * 36
          + Math.max(1, Array.isArray(entity.methods) ? entity.methods.length : 0) * 36,
      }))
      .filter((box): box is { x: number; y: number; width: number; height: number } => (
        typeof box.x === 'number' && typeof box.y === 'number'
      ));
    if (boxes.length === 0) return undefined;

    const rect = canvas.containerRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const viewportCenter = canvas.screenToWorld({
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    if (!viewportCenter) return undefined;

    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    return {
      x: viewportCenter.x - (minX + maxX) / 2,
      y: viewportCenter.y - (minY + maxY) / 2,
    };
  }, [canvas]);

  const handleCopySelection = useCallback(async () => {
    const payload = canvas.exportSelectionForClipboard(getSelectedClassIds());
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Copied selected classes');
    } catch {
      toast.error('Cannot access clipboard in this browser context');
    }
  }, [canvas, getSelectedClassIds]);

  const handlePasteSelection = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      toast.error('Cannot read clipboard in this browser context');
      return;
    }

    const result = canvas.importSelectionFromClipboard(text, getPasteOffsetToViewportCenter(text));
    if (!result) {
      toast.error('Clipboard does not contain copied class diagram objects');
      return;
    }
    toast.success(`Pasted ${result.classes} class${result.classes === 1 ? '' : 'es'} and ${result.relations} relation${result.relations === 1 ? '' : 's'}`);
  }, [canvas, getPasteOffsetToViewportCenter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable
        || Boolean(target?.closest('.cm-editor'));
      if (isTyping) return;

      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.shiftKey) return;
      if (event.code === 'KeyC') {
        event.preventDefault();
        void handleCopySelection();
      }
      if (event.code === 'KeyV') {
        event.preventDefault();
        void handlePasteSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCopySelection, handlePasteSelection]);

  if (diagram.classes.length === 0) {
    return (
      <div
        ref={canvas.containerRef}
        className="canvas-surface relative flex h-full items-center justify-center overflow-hidden"
        onContextMenu={openCanvasContextMenu}
        onMouseDown={handleCanvasMouseDown}
      >
        <CanvasGridBackground pan={canvas.pan} zoom={canvas.zoom} />
        <p className="relative text-xs font-medium text-slate-400">No class diagram objects yet</p>
        <ContextMenu menu={contextMenu.menu} onClose={contextMenu.closeContextMenu} />
      </div>
    );
  }

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
          className="absolute left-0 top-0 text-[#bcc7d5]"
          width={CLASS_CANVAS_WORLD_SIZE}
          height={CLASS_CANVAS_WORLD_SIZE}
          style={{ overflow: 'visible' }}
          aria-hidden="true"
        >
          {diagram.relations.map((relation) => {
            const path = getClassRelationPath(relation, classById);
            if (!path) return null;
            const isSelected = selectedRelationId === relation.id;
            return (
              <g key={relation.id} data-class-relation-id={relation.id} opacity={selectedRelationId && !isSelected ? 0.35 : 1}>
                <path
                  d={path.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  className="cursor-pointer"
                  onClick={() => onSelectionChange?.({ kind: 'relation', id: relation.id, sourceView: 'classDiagram' })}
                  onContextMenu={(event) => openRelationContextMenu(event, relation.id)}
                />
                <path
                  d={path.d}
                  fill="none"
                  stroke={isSelected ? '#3b82f6' : 'currentColor'}
                  strokeWidth={isSelected ? '2.6' : '1.6'}
                  className="pointer-events-none"
                />
                {relation.label ? (
                  <text
                    x={path.labelX}
                    y={path.labelY}
                    className={isSelected ? 'cursor-pointer fill-blue-500 text-[10px] font-semibold' : 'cursor-pointer fill-slate-400 text-[10px] font-medium'}
                    onClick={() => onSelectionChange?.({ kind: 'relation', id: relation.id, sourceView: 'classDiagram' })}
                    onContextMenu={(event) => openRelationContextMenu(event, relation.id)}
                  >
                    {relation.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {diagram.classes.map((entity) => (
          <ClassEntityCard
            key={entity.id}
            entity={entity}
            accent={entity.color ?? (entity.domainId ? domainColorById.get(entity.domainId) : undefined) ?? getClassEntityKindMeta(entity.kind).color}
            selected={canvas.selectedClassIds.has(entity.id) || (selectedParentId ? selectedParentId === entity.id : selectedClassId === entity.id)}
            selectedMemberId={selectedParentId === entity.id ? selectedClassId : undefined}
            methodReturnTypeOptions={methodReturnTypeOptions}
            onStartDrag={canvas.startClassDrag}
            onSelectEntity={(classId) => {
              canvas.clearClassSelection();
              onSelectionChange?.({ kind: 'class', id: classId, sourceView: 'classDiagram' });
            }}
            onSelectAttribute={(classId, attributeId) => {
              canvas.clearClassSelection();
              onSelectionChange?.({ kind: 'classAttribute', id: attributeId, parentId: classId, sourceView: 'classDiagram' });
            }}
            onSelectMethod={(classId, methodId) => {
              canvas.clearClassSelection();
              onSelectionChange?.({ kind: 'classMethod', id: methodId, parentId: classId, sourceView: 'classDiagram' });
            }}
            onEntityContextMenu={openEntityContextMenu}
            onAttributeContextMenu={(event, classId, attributeId) => openMemberContextMenu(event, classId, attributeId, 'classAttribute')}
            onMethodContextMenu={(event, classId, methodId) => openMemberContextMenu(event, classId, methodId, 'classMethod')}
            onAttributeNameChange={canvas.updateAttributeName}
            onAttributeTypeChange={canvas.updateAttributeType}
            onMethodNameChange={canvas.updateMethodName}
            onMethodReturnTypeChange={canvas.updateMethodReturnType}
            onReorderAttributes={canvas.reorderAttributes}
            onReorderMethods={canvas.reorderMethods}
          />
        ))}
      </div>
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
