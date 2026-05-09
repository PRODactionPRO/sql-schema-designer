import type React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NO_DOMAIN_GROUP_ID } from './constants';
import type { GroupMode } from './constants';
import type { SidebarTableGroup } from './types';

interface GroupHeaderRowProps {
  group: SidebarTableGroup;
  groupMode: GroupMode;
  domainDropTargetId: string | null;
  draggingDomainId: string | null;
  collapsedGroupIds: Set<string>;
  draggingTableId: string | null;
  draggingTableSourceGroupId: string | null;
  onDomainHeaderDragStart: (domainId: string, event: React.DragEvent) => void;
  onDomainHeaderDragOver: (domainId: string | null, event: React.DragEvent) => void;
  onDomainHeaderDrop: (domainId: string | null, event: React.DragEvent) => void;
  onDomainHeaderDragEnd: () => void;
  onToggleGroupCollapsed: (groupId: string) => void;
}

export function GroupHeaderRow({
  group,
  groupMode,
  domainDropTargetId,
  draggingDomainId,
  collapsedGroupIds,
  draggingTableId,
  draggingTableSourceGroupId,
  onDomainHeaderDragStart,
  onDomainHeaderDragOver,
  onDomainHeaderDrop,
  onDomainHeaderDragEnd,
  onToggleGroupCollapsed,
}: GroupHeaderRowProps) {
  const isNoDomainGroup = !group.label && !group.domain;
  const groupId = group.domainId ?? (isNoDomainGroup ? NO_DOMAIN_GROUP_ID : null);
  const canDragOverAndDrop = group.domainId || (groupMode === 'domain' && !group.label);

  return (
    <div
      className={`px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 sticky top-0 z-10 ${domainDropTargetId && group.domainId && domainDropTargetId === group.domainId ? 'ring-2 ring-inset ring-blue-300' : ''}`}
      draggable={groupMode === 'domain' && !!group.domain}
      onDragStart={group.domainId ? (event) => onDomainHeaderDragStart(group.domainId!, event) : undefined}
      onDragOver={canDragOverAndDrop ? (event) => onDomainHeaderDragOver(group.domainId ?? null, event) : undefined}
      onDrop={canDragOverAndDrop ? (event) => onDomainHeaderDrop(group.domainId ?? null, event) : undefined}
      onDragEnd={group.domain ? onDomainHeaderDragEnd : undefined}
      onClick={canDragOverAndDrop ? (() => {
        if (!groupId) return;
        if (group.domain && draggingDomainId) return;
        onToggleGroupCollapsed(groupId);
      }) : undefined}
    >
      {group.label ? (
        <>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={(event) => {
              event.stopPropagation();
              if (group.domainId) onToggleGroupCollapsed(group.domainId);
            }}
          >
            {group.domainId && collapsedGroupIds.has(group.domainId) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          <span className="size-2.5 rounded-full flex-shrink-0 bg-gray-400" />
          <span className="text-xs text-gray-600 truncate">{group.label}</span>
          <span className="text-xs text-gray-400 ml-auto tabular-nums">{group.tables.length}</span>
        </>
      ) : group.domain ? (
        <>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={(event) => {
              event.stopPropagation();
              onToggleGroupCollapsed(group.domain!.id);
            }}
          >
            {(draggingDomainId || collapsedGroupIds.has(group.domain.id)) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.domain.color }} />
          <span className="text-xs text-gray-600 truncate">{group.domain.name}</span>
          {draggingTableId && draggingTableSourceGroupId !== group.domain.id && domainDropTargetId === group.domain.id ? (
            <span className="text-[11px] text-blue-600 ml-auto">Move table to this domain</span>
          ) : (
            <span className="text-xs text-gray-400 ml-auto tabular-nums">{group.tables.length}</span>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={(event) => {
              event.stopPropagation();
              onToggleGroupCollapsed(NO_DOMAIN_GROUP_ID);
            }}
          >
            {collapsedGroupIds.has(NO_DOMAIN_GROUP_ID) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          <span className="size-2.5 rounded-full flex-shrink-0 bg-gray-300" />
          <span className="text-xs text-gray-500 truncate">No Domain</span>
          {draggingTableId && draggingTableSourceGroupId !== NO_DOMAIN_GROUP_ID && domainDropTargetId === NO_DOMAIN_GROUP_ID ? (
            <span className="text-[11px] text-blue-600 ml-auto">Move table to this domain</span>
          ) : (
            <span className="text-xs text-gray-400 ml-auto tabular-nums">{group.tables.length}</span>
          )}
        </>
      )}
    </div>
  );
}
