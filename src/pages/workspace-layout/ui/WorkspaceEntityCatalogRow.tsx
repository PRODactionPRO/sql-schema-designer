import type { DragEvent } from 'react';
import { Box } from 'lucide-react';
import type { ClassEntity } from '@/shared/types/project';
import { ENTITY_KIND_META } from '../model/entity-kind-meta';
import type { WorkspaceSelection } from '../model/types';
import type { useWorkspaceCatalogOrdering } from '../model/useWorkspaceCatalogOrdering';
import { selectionMatches } from '../model/workspace-project-utils';
import { WorkspaceCatalogRow } from './WorkspaceCatalogRow';

export function WorkspaceEntityCatalogRow({
  entity,
  domainColor,
  selection,
  dnd,
  dndIndexById,
  canPreviewReorder,
  draggingEntityId,
  entityById,
  onDelete,
  onDropOnRow,
  onSelect,
  onSetDraggingEntityId,
  onSetDropGroupId,
  onUnlink,
}: {
  entity: ClassEntity;
  domainColor?: string;
  selection: WorkspaceSelection | null;
  dnd: ReturnType<typeof useWorkspaceCatalogOrdering<ClassEntity>>['dnd'];
  dndIndexById: Map<string, number>;
  canPreviewReorder: boolean;
  draggingEntityId: string | null;
  entityById: Map<string, ClassEntity>;
  onDelete: (entityId: string) => void;
  onDropOnRow: (event: DragEvent<HTMLElement>, entity: ClassEntity) => void;
  onSelect: (entityId: string) => void;
  onSetDraggingEntityId: (entityId: string | null) => void;
  onSetDropGroupId: (groupId: string | null) => void;
  onUnlink: (entityId: string) => void;
}) {
  const kind = entity.kind ?? 'class';
  const meta = ENTITY_KIND_META[kind];
  const active = selectionMatches(selection, { kind: 'class', id: entity.id, sourceView: 'model' });
  const isDragging = draggingEntityId === entity.id;
  const dragIndex = dndIndexById.get(entity.id) ?? -1;
  const canReorder = canPreviewReorder && dragIndex >= 0;
  const isDragTarget = dnd.dragOverIndex === dragIndex;

  return (
    <WorkspaceCatalogRow
      active={active}
      badge={<span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{meta.shortLabel}</span>}
      borderColor={domainColor}
      canReorder={canReorder}
      deleteLabel="Delete entity"
      dimmed={dnd.isDragging && !isDragging}
      dragTarget={isDragTarget}
      dragging={isDragging}
      icon={<Box className="size-4 shrink-0" style={{ color: meta.color }} />}
      label={entity.name}
      showUnlink={!!entity.domainId}
      unlinkLabel="Remove entity from domain"
      onDelete={() => onDelete(entity.id)}
      onDragStart={(event) => {
        onSetDraggingEntityId(entity.id);
        dnd.handleDragStart({ index: dragIndex, itemId: entity.id, event });
        event.dataTransfer.setData('text/class-id', entity.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (canReorder) {
          dnd.handleDragOver({ index: dragIndex, itemId: entity.id, event });
        }
      }}
      onDragLeave={canReorder ? dnd.handleDragLeave : undefined}
      onDrop={(event) => {
        const sourceId = draggingEntityId || event.dataTransfer.getData('text/class-id');
        const sourceEntity = sourceId ? entityById.get(sourceId) : null;
        const sameDomain = sourceEntity && (sourceEntity.domainId ?? null) === (entity.domainId ?? null);

        if (canReorder && sameDomain) {
          dnd.handleDrop({ event });
          onSetDraggingEntityId(null);
          onSetDropGroupId(null);
          return;
        }

        onDropOnRow(event, entity);
        dnd.handleDragEnd();
      }}
      onDragEnd={() => {
        dnd.handleDragEnd();
        onSetDraggingEntityId(null);
        onSetDropGroupId(null);
      }}
      onSelect={() => onSelect(entity.id)}
      onUnlink={() => onUnlink(entity.id)}
    />
  );
}
