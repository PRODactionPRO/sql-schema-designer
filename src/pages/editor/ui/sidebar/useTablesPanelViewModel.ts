import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { Table } from '../../model/types';
import type { FilterPopup, GroupMode, SortMode, TableKind } from './constants';
import type { SidebarTableGroup } from './types';

interface UseTablesPanelViewModelParams {
  isAddingTable: boolean;
  setIsAddingTable: React.Dispatch<React.SetStateAction<boolean>>;
  newTableName: string;
  setNewTableName: React.Dispatch<React.SetStateAction<string>>;
  newTableKind: TableKind;
  setNewTableKind: React.Dispatch<React.SetStateAction<TableKind>>;
  handleAddTable: () => void;
  sortModeLabel: string;
  openFilterPopup: FilterPopup;
  setOpenFilterPopup: React.Dispatch<React.SetStateAction<FilterPopup>>;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  areAllGroupsCollapsed: boolean;
  handleToggleAllGroups: () => void;
  groupMode: GroupMode;
  collapsibleGroupIds: string[];
  renderedGroups: SidebarTableGroup[];
  domainDropTargetId: string | null;
  handleDomainHeaderDragStart: (domainId: string, event: React.DragEvent) => void;
  handleDomainHeaderDragOver: (domainId: string | null, event: React.DragEvent) => void;
  handleDomainHeaderDrop: (domainId: string | null, event: React.DragEvent) => void;
  handleDomainHeaderDragEnd: () => void;
  draggingDomainId: string | null;
  toggleGroupCollapsed: (groupId: string) => void;
  collapsedGroupIds: Set<string>;
  draggingTableId: string | null;
  draggingTableSourceGroupId: string | null;
  getGroupTablesForRender: (group: SidebarTableGroup) => Table[];
  renderTableRow: (table: Table) => React.ReactNode;
  handleDomainListDragOver: (event: React.DragEvent) => void;
  handleDomainListDrop: (event: React.DragEvent) => void;
}

export interface TablesPanelViewModel {
  isAddingTable: boolean;
  newTableName: string;
  newTableKind: TableKind;
  sortModeLabel: string;
  openFilterPopup: FilterPopup;
  sortMode: SortMode;
  areAllGroupsCollapsed: boolean;
  groupMode: GroupMode;
  collapsibleGroupIds: string[];
  renderedGroups: SidebarTableGroup[];
  domainDropTargetId: string | null;
  draggingDomainId: string | null;
  collapsedGroupIds: Set<string>;
  draggingTableId: string | null;
  draggingTableSourceGroupId: string | null;
  onStartAddTable: () => void;
  onCancelAddTable: () => void;
  onChangeNewTableName: (value: string) => void;
  onChangeNewTableKind: (kind: TableKind) => void;
  onConfirmAddTable: () => void;
  onSortMenuOpenChange: (open: boolean) => void;
  onSortModeChange: React.Dispatch<React.SetStateAction<SortMode>>;
  onToggleAllGroups: () => void;
  onDomainHeaderDragStart: (domainId: string, event: React.DragEvent) => void;
  onDomainHeaderDragOver: (domainId: string | null, event: React.DragEvent) => void;
  onDomainHeaderDrop: (domainId: string | null, event: React.DragEvent) => void;
  onDomainHeaderDragEnd: () => void;
  onToggleGroupCollapsed: (groupId: string) => void;
  onDomainListDragOver: (event: React.DragEvent) => void;
  onDomainListDrop: (event: React.DragEvent) => void;
  getGroupTablesForRender: (group: SidebarTableGroup) => Table[];
  renderTableRow: (table: Table) => React.ReactNode;
}

export function useTablesPanelViewModel({
  isAddingTable,
  setIsAddingTable,
  newTableName,
  setNewTableName,
  newTableKind,
  setNewTableKind,
  handleAddTable,
  sortModeLabel,
  openFilterPopup,
  setOpenFilterPopup,
  sortMode,
  setSortMode,
  areAllGroupsCollapsed,
  handleToggleAllGroups,
  groupMode,
  collapsibleGroupIds,
  renderedGroups,
  domainDropTargetId,
  handleDomainHeaderDragStart,
  handleDomainHeaderDragOver,
  handleDomainHeaderDrop,
  handleDomainHeaderDragEnd,
  draggingDomainId,
  toggleGroupCollapsed,
  collapsedGroupIds,
  draggingTableId,
  draggingTableSourceGroupId,
  getGroupTablesForRender,
  renderTableRow,
  handleDomainListDragOver,
  handleDomainListDrop,
}: UseTablesPanelViewModelParams): TablesPanelViewModel {
  const onStartAddTable = useCallback(() => setIsAddingTable(true), [setIsAddingTable]);
  const onCancelAddTable = useCallback(() => {
    setIsAddingTable(false);
    setNewTableName('');
    setNewTableKind('table');
  }, [setIsAddingTable, setNewTableKind, setNewTableName]);
  const onChangeNewTableName = useCallback((value: string) => setNewTableName(value), [setNewTableName]);
  const onChangeNewTableKind = useCallback((kind: TableKind) => setNewTableKind(kind), [setNewTableKind]);
  const onSortMenuOpenChange = useCallback((open: boolean) => {
    setOpenFilterPopup((prev) => (open ? 'sort' : (prev === 'sort' ? 'none' : prev)));
  }, [setOpenFilterPopup]);

  return useMemo(() => ({
    isAddingTable,
    newTableName,
    newTableKind,
    sortModeLabel,
    openFilterPopup,
    sortMode,
    areAllGroupsCollapsed,
    groupMode,
    collapsibleGroupIds,
    renderedGroups,
    domainDropTargetId,
    draggingDomainId,
    collapsedGroupIds,
    draggingTableId,
    draggingTableSourceGroupId,
    onStartAddTable,
    onCancelAddTable,
    onChangeNewTableName,
    onChangeNewTableKind,
    onConfirmAddTable: handleAddTable,
    onSortMenuOpenChange,
    onSortModeChange: setSortMode,
    onToggleAllGroups: handleToggleAllGroups,
    onDomainHeaderDragStart: handleDomainHeaderDragStart,
    onDomainHeaderDragOver: handleDomainHeaderDragOver,
    onDomainHeaderDrop: handleDomainHeaderDrop,
    onDomainHeaderDragEnd: handleDomainHeaderDragEnd,
    onToggleGroupCollapsed: toggleGroupCollapsed,
    onDomainListDragOver: handleDomainListDragOver,
    onDomainListDrop: handleDomainListDrop,
    getGroupTablesForRender,
    renderTableRow,
  }), [
    areAllGroupsCollapsed,
    collapsedGroupIds,
    collapsibleGroupIds,
    domainDropTargetId,
    draggingDomainId,
    draggingTableId,
    draggingTableSourceGroupId,
    getGroupTablesForRender,
    groupMode,
    handleAddTable,
    handleDomainHeaderDragEnd,
    handleDomainHeaderDragOver,
    handleDomainHeaderDragStart,
    handleDomainHeaderDrop,
    handleDomainListDragOver,
    handleDomainListDrop,
    handleToggleAllGroups,
    isAddingTable,
    newTableKind,
    newTableName,
    onCancelAddTable,
    onChangeNewTableKind,
    onChangeNewTableName,
    onSortMenuOpenChange,
    onStartAddTable,
    openFilterPopup,
    renderTableRow,
    renderedGroups,
    setSortMode,
    sortMode,
    sortModeLabel,
    toggleGroupCollapsed,
  ]);
}
