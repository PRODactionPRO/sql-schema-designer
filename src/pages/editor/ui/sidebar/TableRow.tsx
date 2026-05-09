import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Domain, Table } from '../../model/types';
import { MoreVertical, GripVertical, Trash2, FolderX, FolderPlus, Pencil, Crosshair } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { ActionMenuContent, ActionMenuItem, ActionMenuSeparator } from '@/shared/ui/action-menu';
import { actionMenuClasses } from '@/shared/ui/action-menu-styles';
import { GhostActionButton } from '@/shared/ui/ghost-action-button';
import { cn } from '@/shared/ui/utils';
import { SidebarListRow } from './SidebarListRow';
import type { GroupMode, TableKind } from './constants';

interface ReorderableDnd {
  dragOverIndex: number | null;
  draggingItemId: string | null;
  isDragging: boolean;
  handleDragOver: (args: { index: number; itemId: string; event: React.DragEvent }) => void;
  handleDragLeave: () => void;
}

interface TableRowProps {
  table: Table;
  domains: Domain[];
  selectedTableId: string | null;
  selectedTableIds: Set<string>;
  getTableColor: (table: Table) => string;
  groupMode: GroupMode;
  dndEnabled: boolean;
  isDomainDragEnabled: boolean;
  dndIndexById: Map<string, number>;
  dnd: ReorderableDnd;
  onRowClick: (tableId: string, e: React.MouseEvent) => void;
  onRowDoubleClick: (tableId: string) => void;
  onDragStartRow: (args: {
    tableId: string;
    tableDomainId: string | null | undefined;
    canReorderDrag: boolean;
    canDomainDrag: boolean;
    dndIndex: number;
    event: React.DragEvent;
  }) => void;
  onDropRow: (args: { table: Table; canAcceptReorderDrop: boolean; event: React.DragEvent }) => void;
  onDragEndRow: (args: { canReorderDrag: boolean; canDomainDrag: boolean }) => void;
  onAssignDomain: (domainId: string, tableIds: string[]) => void;
  onRenameTable: (tableId: string, name: string) => void;
  onFitToViewport: (tableId: string) => void;
  onRemoveFromDomain: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
}

function getTableKind(tableId: string): TableKind {
  if (tableId.startsWith('enum::')) return 'enum';
  if (tableId.startsWith('jsonschema::')) return 'json';
  return 'table';
}

export function TableRow({
  table,
  domains,
  selectedTableId,
  selectedTableIds,
  getTableColor,
  groupMode,
  dndEnabled,
  isDomainDragEnabled,
  dndIndexById,
  dnd,
  onRowClick,
  onRowDoubleClick,
  onDragStartRow,
  onDropRow,
  onDragEndRow,
  onAssignDomain,
  onRenameTable,
  onFitToViewport,
  onRemoveFromDomain,
  onDeleteTable,
}: TableRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState(table.name);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isRenaming) {
      setRenamingValue(table.name);
    }
  }, [isRenaming, table.name]);

  useEffect(() => {
    if (!isRenaming || !renameInputRef.current) return;
    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [isRenaming]);

  const isSelected = selectedTableId === table.id;
  const isMultiSelected = selectedTableIds.has(table.id);
  const kind = getTableKind(table.id);
  const badgeLabel = kind === 'enum' ? 'ENUM' : kind === 'json' ? 'JSON' : null;
  const dndIndex = dndIndexById.get(table.id) ?? -1;
  const canDrag = dndEnabled && (groupMode === 'domain' || groupMode === 'none' || kind === 'table') && dndIndex >= 0;
  const draggingKind = dnd.draggingItemId ? getTableKind(dnd.draggingItemId) : null;
  const canAcceptReorderDrop = groupMode === 'domain' || groupMode === 'none' || !draggingKind || draggingKind === kind;
  const isDragTarget = canDrag && canAcceptReorderDrop && dnd.dragOverIndex === dndIndex;
  const isDragSource = dnd.draggingItemId === table.id;
  const canDomainDrag = isDomainDragEnabled;
  const shouldDimRow = dnd.isDragging && !isDragSource;
  const canDragOrDrop = !isRenaming;

  const startRename = () => {
    setIsMenuOpen(false);
    setRenamingValue(table.name);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setRenamingValue(table.name);
    setIsRenaming(false);
  };

  const commitRename = () => {
    const nextName = renamingValue.trim();
    setIsRenaming(false);
    if (!nextName || nextName === table.name) return;
    onRenameTable(table.id, nextName);
  };

  return (
    <SidebarListRow
      className={`group/table-row cursor-pointer transition-colors ${!dnd.isDragging ? 'hover:bg-gray-100' : ''} ${isSelected && !isMultiSelected ? 'bg-blue-50' : ''} ${isMultiSelected ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-200' : ''} ${shouldDimRow ? 'opacity-55' : ''} ${isDragSource ? 'bg-blue-50 ring-1 ring-inset ring-blue-300 text-gray-900' : ''} ${isDragTarget ? 'ring-2 ring-inset ring-blue-300' : ''}`}
      style={{ borderLeft: `3px solid ${getTableColor(table)}` }}
      onClick={(e) => onRowClick(table.id, e)}
      onDoubleClick={() => onRowDoubleClick(table.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        setIsMenuOpen(true);
      }}
      draggable={canDragOrDrop && (canDrag || canDomainDrag)}
      onDragStart={(canDragOrDrop && (canDrag || canDomainDrag)) ? (event) => onDragStartRow({
        tableId: table.id,
        tableDomainId: table.domainId,
        canReorderDrag: canDrag,
        canDomainDrag,
        dndIndex,
        event,
      }) : undefined}
      onDragOver={canDragOrDrop && canDrag && canAcceptReorderDrop ? (e) => dnd.handleDragOver({ index: dndIndex, itemId: table.id, event: e }) : undefined}
      onDragLeave={canDragOrDrop && canDrag ? dnd.handleDragLeave : undefined}
      onDrop={canDragOrDrop && canDrag ? (event) => onDropRow({ table, canAcceptReorderDrop, event }) : undefined}
      onDragEnd={(canDragOrDrop && (canDrag || canDomainDrag)) ? () => onDragEndRow({ canReorderDrag: canDrag, canDomainDrag }) : undefined}
      left={(
        <GripVertical
          className={`size-3.5 mr-1.5 flex-shrink-0 ${
            canDrag ? 'text-gray-300 cursor-grab' : 'text-gray-200 cursor-default'
          }`}
        />
      )}
      main={(
        <span className="text-sm truncate flex items-center gap-2">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renamingValue}
              onChange={(event) => setRenamingValue(event.target.value)}
              onBlur={commitRename}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              className="min-w-0 w-full text-sm bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
            />
          ) : (
            <span
              className="truncate"
              onDoubleClick={(event) => {
                event.stopPropagation();
                startRename();
              }}
            >
              {table.name}
            </span>
          )}
          {badgeLabel && (
            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${kind === 'enum' ? 'bg-orange-100 text-orange-700' : 'bg-violet-100 text-violet-700'}`}>
              {badgeLabel}
            </span>
          )}
        </span>
      )}
      right={(
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <GhostActionButton
              Icon={MoreVertical}
              size="xs"
              className="flex-shrink-0 opacity-0 group-hover/table-row:opacity-100 transition-opacity"
              onClick={(event) => event.stopPropagation()}
              aria-label="Table actions"
            />
          </DropdownMenuTrigger>
          <ActionMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={actionMenuClasses.item}>
                <FolderPlus className="size-3.5" />
                Add to domain
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className={cn(actionMenuClasses.content, 'min-w-[220px]')}>
                {domains.map((domain) => (
                  <ActionMenuItem key={domain.id} onClick={() => onAssignDomain(domain.id, [table.id])}>
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: domain.color }} />
                    {domain.name}
                  </ActionMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <ActionMenuItem onClick={startRename}>
              <Pencil className="size-3.5" />
              Rename
            </ActionMenuItem>
            <ActionMenuItem onClick={() => onFitToViewport(table.id)}>
              <Crosshair className="size-3.5" />
              Fit to viewport
            </ActionMenuItem>
            <ActionMenuSeparator />
            {table.domainId && (
              <ActionMenuItem onClick={(e) => { e.stopPropagation(); onRemoveFromDomain(table.id); }}>
                <FolderX className="size-3.5" />
                Remove from domain
              </ActionMenuItem>
            )}
            <ActionMenuItem danger onClick={(e) => { e.stopPropagation(); onDeleteTable(table.id); }}>
              <Trash2 className="size-3.5" />
              Delete
            </ActionMenuItem>
          </ActionMenuContent>
        </DropdownMenu>
      )}
    />
  );
}
