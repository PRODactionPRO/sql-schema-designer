import type { DragEvent } from 'react';
import { Table2 } from 'lucide-react';
import type { Table } from '@/shared/types/schema';
import type { WorkspaceSelection } from '../model/types';
import type { useWorkspaceCatalogOrdering } from '../model/useWorkspaceCatalogOrdering';
import { selectionMatches } from '../model/workspace-project-utils';
import { WorkspaceCatalogRow } from './WorkspaceCatalogRow';

export function WorkspaceTableCatalogRow({
  table,
  domainColor,
  selection,
  dnd,
  dndIndexById,
  canPreviewReorder,
  draggingTableId,
  tableById,
  onDelete,
  onDropOnRow,
  onSelect,
  onSetDraggingTableId,
  onSetDropGroupId,
  onUnlink,
}: {
  table: Table;
  domainColor?: string;
  selection: WorkspaceSelection | null;
  dnd: ReturnType<typeof useWorkspaceCatalogOrdering<Table>>['dnd'];
  dndIndexById: Map<string, number>;
  canPreviewReorder: boolean;
  draggingTableId: string | null;
  tableById: Map<string, Table>;
  onDelete: (tableId: string) => void;
  onDropOnRow: (event: DragEvent<HTMLElement>, table: Table) => void;
  onSelect: (tableId: string) => void;
  onSetDraggingTableId: (tableId: string | null) => void;
  onSetDropGroupId: (groupId: string | null) => void;
  onUnlink: (tableId: string) => void;
}) {
  const active = selectionMatches(selection, { kind: 'table', id: table.id, sourceView: 'model' });
  const isDragging = draggingTableId === table.id;
  const dragIndex = dndIndexById.get(table.id) ?? -1;
  const canReorder = canPreviewReorder && dragIndex >= 0;
  const isDragTarget = dnd.dragOverIndex === dragIndex;

  return (
    <WorkspaceCatalogRow
      active={active}
      badge={<span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{table.fields.length}</span>}
      borderColor={domainColor}
      canReorder={canReorder}
      deleteLabel="Delete table"
      dimmed={dnd.isDragging && !isDragging}
      dragTarget={isDragTarget}
      dragging={isDragging}
      icon={<Table2 className="size-4 shrink-0 text-gray-400" />}
      label={table.name}
      showUnlink={!!table.domainId}
      unlinkLabel="Remove table from domain"
      onDelete={() => onDelete(table.id)}
      onDragStart={(event) => {
        onSetDraggingTableId(table.id);
        dnd.handleDragStart({ index: dragIndex, itemId: table.id, event });
        event.dataTransfer.setData('text/table-id', table.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (canReorder) {
          dnd.handleDragOver({ index: dragIndex, itemId: table.id, event });
        }
      }}
      onDragLeave={canReorder ? dnd.handleDragLeave : undefined}
      onDrop={(event) => {
        const sourceId = draggingTableId || event.dataTransfer.getData('text/table-id');
        const sourceTable = sourceId ? tableById.get(sourceId) : null;
        const sameDomain = sourceTable && (sourceTable.domainId ?? null) === (table.domainId ?? null);

        if (canReorder && sameDomain) {
          dnd.handleDrop({ event });
          onSetDraggingTableId(null);
          onSetDropGroupId(null);
          return;
        }

        onDropOnRow(event, table);
        dnd.handleDragEnd();
      }}
      onDragEnd={() => {
        dnd.handleDragEnd();
        onSetDraggingTableId(null);
        onSetDropGroupId(null);
      }}
      onSelect={() => onSelect(table.id)}
      onUnlink={() => onUnlink(table.id)}
    />
  );
}
