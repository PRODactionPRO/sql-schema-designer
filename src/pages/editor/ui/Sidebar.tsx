import { useState, useRef, useCallback, useMemo } from 'react';
import type { Table, Domain } from '../model/types';
import { PanelLeft } from 'lucide-react';
import { ProTooltip } from '@/shared/ui/pro-tooltip';
import { GhostActionButton } from '@/shared/ui/ghost-action-button';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { TablesPanel } from './sidebar/TablesPanel';
import { DomainsPanel } from './sidebar/DomainsPanel';
import { ConfirmTableMoveDialog } from './sidebar/ConfirmTableMoveDialog';
import { TableRow } from './sidebar/TableRow';
import { useTablesPanelViewModel } from './sidebar/useTablesPanelViewModel';
import { useDomainsPanelViewModel } from './sidebar/useDomainsPanelViewModel';
import { useSidebarDnDController } from './sidebar/useSidebarDnDController';
import {
  DEFAULT_GROUP_MODE,
  DEFAULT_SORT_MODE,
  DEFAULT_VISIBLE_KINDS,
  getSortModeLabel,
  GroupMode,
  NO_DOMAIN_GROUP_ID,
  SortMode,
  TableKind,
} from './sidebar/constants';
import type { FilterPopup } from './sidebar/constants';
import type { SidebarTab, SidebarTableGroup } from './sidebar/types';

interface SidebarProps {
  tables: Table[];
  domains: Domain[];
  selectedTableId: string | null;
  selectedTableIds: Set<string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTableSelect: (id: string) => void;
  onTableDelete: (id: string) => void;
  onRenameTable: (id: string, name: string) => void;
  onAddTable: (name: string) => void;
  onAddEnumTable?: (name: string) => void;
  onAddJsonSchemaTable?: (name: string) => void;
  onAddDomain: (name: string) => void;
  onUpdateDomain: (id: string, updates: Partial<Omit<Domain, 'id'>>) => void;
  onDeleteDomain: (id: string) => void;
  onAssignDomain: (domainId: string, tableIds: string[]) => void;
  onRemoveFromDomain: (tableId: string) => void;
  getTableColor: (table: Table) => string;
  onToggleTableSelection: (id: string, additive: boolean) => void;
  onReorderTables: (orderedIds: string[]) => void;
  onReorderDomains: (orderedIds: string[]) => void;
  onCenterOnTable: (id: string) => void;
  onClearMultiSelection: () => void;
}

function sortTables(tables: Table[], mode: SortMode): Table[] {
  if (mode === 'none') return tables;
  return [...tables].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return mode === 'asc' ? cmp : -cmp;
  });
}

function getTableKind(tableId: string): TableKind {
  if (tableId.startsWith('enum::')) return 'enum';
  if (tableId.startsWith('jsonschema::')) return 'json';
  return 'table';
}

export function Sidebar({
  tables, domains, selectedTableId, selectedTableIds, collapsed, onToggleCollapse,
  onTableSelect, onTableDelete, onRenameTable, onAddTable, onAddEnumTable, onAddJsonSchemaTable, onAddDomain, onUpdateDomain, onDeleteDomain,
  onAssignDomain, onRemoveFromDomain, getTableColor, onToggleTableSelection, onReorderTables, onReorderDomains, onCenterOnTable, onClearMultiSelection,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('tables');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableKind, setNewTableKind] = useState<TableKind>('table');
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [renamingDomainId, setRenamingDomainId] = useState<string | null>(null);
  const [renamingDomainName, setRenamingDomainName] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>(DEFAULT_SORT_MODE);
  const [groupMode, setGroupMode] = useState<GroupMode>(DEFAULT_GROUP_MODE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterPopup, setOpenFilterPopup] = useState<FilterPopup>('none');
  const [visibleKinds, setVisibleKinds] = useState<Record<TableKind, boolean>>(DEFAULT_VISIBLE_KINDS);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  const lastClickedId = useRef<string | null>(null);

  const filteredTables = useMemo(() => tables.filter(table => {
    const kind = getTableKind(table.id);
    return visibleKinds[kind] && (!searchQuery || table.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }), [tables, searchQuery, visibleKinds]);

  const displayGroups: SidebarTableGroup[] = useMemo(() => {
    const sorted = sortTables(filteredTables, sortMode);

    if (groupMode === 'none') {
      return [{ domainId: null, domain: null, tables: sorted }];
    }

    if (groupMode === 'type') {
      const regular = sorted.filter((t) => getTableKind(t.id) === 'table');
      const enums = sorted.filter((t) => getTableKind(t.id) === 'enum');
      const jsonSchemas = sorted.filter((t) => getTableKind(t.id) === 'json');
      const groups: SidebarTableGroup[] = [];
      if (regular.length > 0) groups.push({ domainId: '__type_table', domain: null, label: 'Structure Tables', tables: regular });
      if (enums.length > 0) groups.push({ domainId: '__type_enum', domain: null, label: 'Enum Tables', tables: enums });
      if (jsonSchemas.length > 0) groups.push({ domainId: '__type_json', domain: null, label: 'JSON Schema', tables: jsonSchemas });
      return groups;
    }

    const domainMap = new Map<string, Domain>();
    domains.forEach(d => domainMap.set(d.id, d));

    const groups = new Map<string, Table[]>();
    const noDomain: Table[] = [];

    sorted.forEach(t => {
      if (t.domainId && domainMap.has(t.domainId)) {
        const list = groups.get(t.domainId) || [];
        list.push(t);
        groups.set(t.domainId, list);
      } else {
        noDomain.push(t);
      }
    });

    const result: SidebarTableGroup[] = [];
    domains.forEach(d => {
      const g = groups.get(d.id);
      if (g && g.length > 0) {
        result.push({ domainId: d.id, domain: d, tables: g });
      }
    });
    if (noDomain.length > 0) {
      result.push({ domainId: null, domain: null, tables: noDomain });
    }
    return result;
  }, [filteredTables, sortMode, groupMode, domains]);

  const flatTableIds = useMemo(() => {
    return displayGroups.flatMap(g => g.tables.map(t => t.id));
  }, [displayGroups]);

  const handleTableClick = useCallback((tableId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      const lastIdx = lastClickedId.current ? flatTableIds.indexOf(lastClickedId.current) : -1;
      const curIdx = flatTableIds.indexOf(tableId);
      if (lastIdx >= 0 && curIdx >= 0) {
        const from = Math.min(lastIdx, curIdx);
        const to = Math.max(lastIdx, curIdx);
        for (let i = from; i <= to; i++) {
          const id = flatTableIds[i];
          if (!selectedTableIds.has(id)) {
            onToggleTableSelection(id, true);
          }
        }
      } else {
        onToggleTableSelection(tableId, true);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      onToggleTableSelection(tableId, true);
      lastClickedId.current = tableId;
      return;
    }

    if (selectedTableIds.size > 0) {
      onClearMultiSelection();
    }
    onTableSelect(tableId);
    lastClickedId.current = tableId;
  }, [flatTableIds, selectedTableIds, onToggleTableSelection, onTableSelect, onClearMultiSelection]);

  const handleTableDoubleClick = useCallback((tableId: string) => {
    if (selectedTableIds.size > 0) {
      onClearMultiSelection();
    }
    onTableSelect(tableId);
    onCenterOnTable(tableId);
    lastClickedId.current = tableId;
  }, [onTableSelect, onCenterOnTable, onClearMultiSelection, selectedTableIds]);

  const handleAddTable = () => {
    const name = newTableName.trim();
    if (!name) return;
    if (newTableKind === 'enum') {
      onAddEnumTable?.(name);
      setNewTableName('');
      setNewTableKind('table');
      setIsAddingTable(false);
      return;
    }
    if (newTableKind === 'json') {
      onAddJsonSchemaTable?.(name);
      setNewTableName('');
      setNewTableKind('table');
      setIsAddingTable(false);
      return;
    }
    const isDuplicate = tables.some(t => t.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      let suffix = 2;
      while (tables.some(t => t.name.toLowerCase() === `${name}_${suffix}`.toLowerCase())) suffix++;
      onAddTable(`${name}_${suffix}`);
    } else {
      onAddTable(name);
    }
    setNewTableName('');
    setNewTableKind('table');
    setIsAddingTable(false);
  };
  const handleAddDomain = () => {
    if (newDomainName.trim()) { onAddDomain(newDomainName.trim()); setNewDomainName(''); setIsAddingDomain(false); }
  };

  const hasMultiSelection = selectedTableIds.size > 0;
  const totalTablesCount = tables.length;
  const totalDomainsCount = domains.length;
  const hasHiddenKinds = useMemo(
    () => Object.values(visibleKinds).some((isVisible) => !isVisible),
    [visibleKinds],
  );
  const hasActiveFilters = sortMode !== 'none' || groupMode !== 'domain' || hasHiddenKinds;
  const toggleVisibleKind = useCallback((kind: TableKind) => {
    setVisibleKinds((prev) => {
      if (prev[kind] && Object.values(prev).filter(Boolean).length === 1) return prev;
      return { ...prev, [kind]: !prev[kind] };
    });
  }, []);
  const sortModeLabel = getSortModeLabel(sortMode);
  const closeAllFilterPopups = useCallback(() => setOpenFilterPopup('none'), []);
  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);
  const collapsibleGroupIds = useMemo(
    () => displayGroups.flatMap((g) => {
      if (g.domainId) return [g.domainId];
      if (groupMode === 'domain' && !g.label && g.tables.length > 0) return [NO_DOMAIN_GROUP_ID];
      return [];
    }),
    [displayGroups, groupMode],
  );
  const areAllGroupsCollapsed = useMemo(
    () => collapsibleGroupIds.length > 0 && collapsibleGroupIds.every((id) => collapsedGroupIds.has(id)),
    [collapsedGroupIds, collapsibleGroupIds],
  );
  const handleCollapseAllGroups = useCallback(() => {
    if (collapsibleGroupIds.length === 0) return;
    setCollapsedGroupIds(new Set(collapsibleGroupIds));
  }, [collapsibleGroupIds]);
  const handleToggleAllGroups = useCallback(() => {
    if (collapsibleGroupIds.length === 0) return;
    if (areAllGroupsCollapsed) {
      setCollapsedGroupIds((prev) => {
        const next = new Set(prev);
        collapsibleGroupIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    handleCollapseAllGroups();
  }, [areAllGroupsCollapsed, collapsibleGroupIds, handleCollapseAllGroups]);
  const {
    dnd,
    dndEnabled,
    dndIndexById,
    domainDropTargetId,
    draggingDomainId,
    draggingTableId,
    draggingTableSourceGroupId,
    isDomainDragEnabled,
    pendingMove,
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
  } = useSidebarDnDController({
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
  });

  const renderTableRow = (table: Table) => {
    return (
      <TableRow
        key={table.id}
        table={table}
        domains={domains}
        selectedTableId={selectedTableId}
        selectedTableIds={selectedTableIds}
        getTableColor={getTableColor}
        groupMode={groupMode}
        dndEnabled={dndEnabled}
        isDomainDragEnabled={isDomainDragEnabled}
        dndIndexById={dndIndexById}
        dnd={dnd}
        onRowClick={handleTableClick}
        onRowDoubleClick={handleTableDoubleClick}
        onDragStartRow={handleTableRowDragStart}
        onDropRow={handleTableRowDrop}
        onDragEndRow={handleTableRowDragEnd}
        onAssignDomain={onAssignDomain}
        onRenameTable={onRenameTable}
        onFitToViewport={onCenterOnTable}
        onRemoveFromDomain={onRemoveFromDomain}
        onDeleteTable={onTableDelete}
      />
    );
  };

  const tablesPanelViewModel = useTablesPanelViewModel({
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
  });

  const domainsPanelViewModel = useDomainsPanelViewModel({
    domains,
    tables,
    isAddingDomain,
    setIsAddingDomain,
    newDomainName,
    setNewDomainName,
    editingDomainId,
    setEditingDomainId,
    renamingDomainId,
    setRenamingDomainId,
    renamingDomainName,
    setRenamingDomainName,
    hasMultiSelection,
    selectedTableIds,
    onAssignDomain,
    onUpdateDomain,
    onDeleteDomain,
    onReorderDomains,
    handleAddDomain,
  });

  if (collapsed) {
    return (
      <div className="w-10 bg-white/95 backdrop-blur-sm flex flex-col items-center pt-2 h-full rounded-r-lg">
        <ProTooltip label="Expand Sidebar">
          <GhostActionButton
            Icon={PanelLeft}
            size="s"
            tone="neutral"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
          />
        </ProTooltip>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white/95 backdrop-blur-sm flex flex-col h-full rounded-r-lg">
      <SidebarHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        hasActiveFilters={hasActiveFilters}
        visibleKinds={visibleKinds}
        toggleVisibleKind={toggleVisibleKind}
        openFilterPopup={openFilterPopup}
        setOpenFilterPopup={setOpenFilterPopup}
        groupMode={groupMode}
        setGroupMode={setGroupMode}
        setVisibleKinds={setVisibleKinds}
        setSortMode={setSortMode}
        closeAllFilterPopups={closeAllFilterPopups}
        onToggleCollapse={onToggleCollapse}
      />

      {activeTab === 'tables' ? (
        <TablesPanel viewModel={tablesPanelViewModel} />
      ) : (
        <DomainsPanel viewModel={domainsPanelViewModel} />
      )}
      <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-sm px-3 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Domains: <span className="font-medium text-gray-700">{totalDomainsCount}</span></span>
          <span>Tables: <span className="font-medium text-gray-700">{totalTablesCount}</span></span>
        </div>
      </div>

      <ConfirmTableMoveDialog
        pendingMove={pendingMove}
        tables={tables}
        domains={domains}
        onClose={() => setPendingMove(null)}
        onConfirmMove={(move) => {
          if (move.targetDomainId) onAssignDomain(move.targetDomainId, [move.tableId]);
          else onRemoveFromDomain(move.tableId);
          setPendingMove(null);
        }}
      />
    </div>
  );
}
