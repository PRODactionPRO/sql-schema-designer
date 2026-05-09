import { useCallback } from 'react';
import type React from 'react';
import type { Domain, Table } from '../../model/types';
import { GroupMode, NO_DOMAIN_GROUP_ID, SortMode } from './constants';
import type { SidebarTableGroup } from './types';
import { useDomainDnD } from './useDomainDnD';
import { useTableReorderDnD } from './useTableReorderDnD';

interface UseSidebarDnDControllerParams {
  tables: Table[];
  domains: Domain[];
  displayGroups: SidebarTableGroup[];
  flatTableIds: string[];
  groupMode: GroupMode;
  searchQuery: string;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  onReorderTables: (orderedIds: string[]) => void;
  onReorderDomains: (orderedIds: string[]) => void;
  collapsedGroupIds: Set<string>;
  setCollapsedGroupIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  collapsibleGroupIds: string[];
}

interface TableDragStartParams {
  tableId: string;
  tableDomainId: string | null | undefined;
  canReorderDrag: boolean;
  canDomainDrag: boolean;
  dndIndex: number;
  event: React.DragEvent;
}

interface TableDropParams {
  table: Table;
  canAcceptReorderDrop: boolean;
  event: React.DragEvent;
}

interface TableDragEndParams {
  canReorderDrag: boolean;
  canDomainDrag: boolean;
}

export function useSidebarDnDController({
  tables,
  domains,
  displayGroups,
  flatTableIds,
  groupMode,
  searchQuery,
  sortMode,
  setSortMode,
  onReorderTables,
  onReorderDomains,
  collapsedGroupIds,
  setCollapsedGroupIds,
  collapsibleGroupIds,
}: UseSidebarDnDControllerParams) {
  const {
    dnd,
    dndEnabled,
    dndIndexById,
    isDomainDragEnabled,
    rowRankById,
  } = useTableReorderDnD({
    flatTableIds,
    groupMode,
    searchQuery,
    sortMode,
    setSortMode,
    onReorderTables,
  });

  const {
    domainDropTargetId,
    draggingDomainId,
    draggingTableId,
    draggingTableSourceGroupId,
    pendingMove,
    renderedGroups,
    setPendingMove,
    handleDomainHeaderDragEnd,
    handleDomainHeaderDragOver,
    handleDomainHeaderDragStart,
    handleDomainHeaderDrop,
    handleDomainListDragOver,
    handleDomainListDrop,
    handleTableDomainDragStart,
    handleTableDomainDragEnd,
    tryHandleTableDropToTable,
  } = useDomainDnD({
    tables,
    domains,
    displayGroups,
    groupMode,
    onReorderDomains,
    collapsedGroupIds,
    setCollapsedGroupIds,
    collapsibleGroupIds,
  });

  const handleTableRowDragStart = useCallback(({
    tableId,
    tableDomainId,
    canReorderDrag,
    canDomainDrag,
    dndIndex,
    event,
  }: TableDragStartParams) => {
    if (canReorderDrag) {
      dnd.handleDragStart({ index: dndIndex, itemId: tableId, event });
    }
    if (canDomainDrag) {
      handleTableDomainDragStart(tableId, tableDomainId, event);
    }
  }, [dnd, handleTableDomainDragStart]);

  const handleTableRowDrop = useCallback(({
    table,
    canAcceptReorderDrop,
    event,
  }: TableDropParams) => {
    if (isDomainDragEnabled && tryHandleTableDropToTable(table)) {
      return;
    }
    if (!canAcceptReorderDrop) {
      dnd.handleDragEnd();
      return;
    }
    dnd.handleDrop({ event });
  }, [dnd, isDomainDragEnabled, tryHandleTableDropToTable]);

  const handleTableRowDragEnd = useCallback(({
    canReorderDrag,
    canDomainDrag,
  }: TableDragEndParams) => {
    if (canReorderDrag) dnd.handleDragEnd();
    if (canDomainDrag) {
      handleTableDomainDragEnd();
    }
  }, [dnd, handleTableDomainDragEnd]);

  const getGroupTablesForRender = useCallback((group: SidebarTableGroup): Table[] => {
    if (group.domain && draggingDomainId) return [];
    const collapseId = group.domainId ?? (groupMode === 'domain' && !group.label ? NO_DOMAIN_GROUP_ID : null);
    if (collapseId && collapsedGroupIds.has(collapseId)) return [];
    if (groupMode === 'none' || groupMode === 'domain') {
      return group.tables
        .slice()
        .sort((a, b) => (rowRankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rowRankById.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    return group.tables;
  }, [collapsedGroupIds, draggingDomainId, groupMode, rowRankById]);

  return {
    dnd,
    dndEnabled,
    dndIndexById,
    domainDropTargetId,
    draggingDomainId,
    draggingTableId,
    draggingTableSourceGroupId,
    isDomainDragEnabled,
    pendingMove,
    rowRankById,
    renderedGroups,
    setPendingMove,
    handleDomainHeaderDragEnd,
    handleDomainHeaderDragOver,
    handleDomainHeaderDragStart,
    handleDomainHeaderDrop,
    handleDomainListDragOver,
    handleDomainListDrop,
    handleTableRowDragEnd,
    handleTableRowDragStart,
    handleTableRowDrop,
    getGroupTablesForRender,
  };
}
