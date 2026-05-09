import { useState, useRef, useCallback, useMemo } from 'react';
import type { Table, Domain } from '../model/types';
import { DOMAIN_COLORS } from '../model/types';
import { Search, MoreVertical, Plus, Palette, X, PanelLeftClose, PanelLeft, ArrowUpAZ, ArrowDownAZ, GripVertical, SlidersHorizontal, Group, Shapes, ChevronDown, ChevronRight, Minimize2 } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { useReorderableDragList } from './hooks/useReorderableDragList';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

interface SidebarProps {
  tables: Table[];
  domains: Domain[];
  selectedTableId: string | null;
  selectedTableIds: Set<string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTableSelect: (id: string) => void;
  onTableDelete: (id: string) => void;
  onAddTable: (name: string) => void;
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

type TabType = 'tables' | 'domains';
type SortMode = 'none' | 'asc' | 'desc';
type GroupMode = 'none' | 'domain' | 'type';
type TableKind = 'table' | 'enum' | 'json';

function sortTables(tables: Table[], mode: SortMode): Table[] {
  if (mode === 'none') return tables;
  return [...tables].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return mode === 'asc' ? cmp : -cmp;
  });
}

interface TableGroup {
  domainId: string | null;
  domain: Domain | null;
  label?: string;
  tables: Table[];
}

function getTableKind(tableId: string): TableKind {
  if (tableId.startsWith('enum::')) return 'enum';
  if (tableId.startsWith('jsonschema::')) return 'json';
  return 'table';
}

export function Sidebar({
  tables, domains, selectedTableId, selectedTableIds, collapsed, onToggleCollapse,
  onTableSelect, onTableDelete, onAddTable, onAddDomain, onUpdateDomain, onDeleteDomain,
  onAssignDomain, onRemoveFromDomain, getTableColor, onToggleTableSelection, onReorderTables, onReorderDomains, onCenterOnTable, onClearMultiSelection,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [renamingDomainId, setRenamingDomainId] = useState<string | null>(null);
  const [renamingDomainName, setRenamingDomainName] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleKinds, setVisibleKinds] = useState<Record<TableKind, boolean>>({
    table: true,
    enum: true,
    json: true,
  });
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [draggingDomainId, setDraggingDomainId] = useState<string | null>(null);
  const [domainDropTargetId, setDomainDropTargetId] = useState<string | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const draggingTableIdRef = useRef<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ tableId: string; targetDomainId: string | null; targetDomainName: string } | null>(null);

  // Last clicked table for shift-select range
  const lastClickedId = useRef<string | null>(null);

  const filteredTables = useMemo(() => tables.filter(table => {
    const kind = getTableKind(table.id);
    return visibleKinds[kind] && (!searchQuery || table.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }), [tables, searchQuery, visibleKinds]);

  // Compute display list: sort + group
  const displayGroups: TableGroup[] = useMemo(() => {
    const sorted = sortTables(filteredTables, sortMode);

    if (groupMode === 'none') {
      return [{ domainId: null, domain: null, tables: sorted }];
    }

    if (groupMode === 'type') {
      const regular = sorted.filter((t) => getTableKind(t.id) === 'table');
      const enums = sorted.filter((t) => getTableKind(t.id) === 'enum');
      const jsonSchemas = sorted.filter((t) => getTableKind(t.id) === 'json');
      const groups: TableGroup[] = [];
      if (regular.length > 0) groups.push({ domainId: '__type_table', domain: null, label: 'Structure Tables', tables: regular });
      if (enums.length > 0) groups.push({ domainId: '__type_enum', domain: null, label: 'Enum Tables', tables: enums });
      if (jsonSchemas.length > 0) groups.push({ domainId: '__type_json', domain: null, label: 'JSON Schema', tables: jsonSchemas });
      return groups;
    }

    // Group by domain
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

    const result: TableGroup[] = [];
    // Domains in order they appear in the domains list
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

  // Flat ordered list for shift-select
  const flatTableIds = useMemo(() => {
    return displayGroups.flatMap(g => g.tables.map(t => t.id));
  }, [displayGroups]);

  const handleTableClick = useCallback((tableId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Range select
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
      // Don't update lastClickedId on shift-click
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      onToggleTableSelection(tableId, true);
      lastClickedId.current = tableId;
      return;
    }

    // Normal click - clear multi-selection, select single table
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
    // Validate duplicate name
    const isDuplicate = tables.some(t => t.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      // Auto-suffix with _2, _3, etc.
      let suffix = 2;
      while (tables.some(t => t.name.toLowerCase() === `${name}_${suffix}`.toLowerCase())) suffix++;
      onAddTable(`${name}_${suffix}`);
    } else {
      onAddTable(name);
    }
    setNewTableName(''); setIsAddingTable(false);
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
  const hasActiveFilters = sortMode !== 'none' || groupMode !== 'none' || hasHiddenKinds;
  const isDragEnabled = sortMode === 'none' && groupMode === 'none' && !searchQuery;
  const isDomainDragEnabled = groupMode === 'domain';
  const dndEnabled = isDragEnabled || isDomainDragEnabled;
  const dndRowIds = useMemo(
    () => (
      groupMode === 'domain' || groupMode === 'none'
        ? flatTableIds
        : flatTableIds.filter((id) => getTableKind(id) === 'table')
    ),
    [flatTableIds, groupMode],
  );
  const dnd = useReorderableDragList({
    itemIds: dndRowIds,
    enabled: dndEnabled,
    onCommit: (fromIndex, toIndex) => {
      const next = [...dndRowIds];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      onReorderTables(next);
    },
  });
  const dndIndexById = useMemo(() => {
    const map = new Map<string, number>();
    dnd.renderedIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [dnd.renderedIds]);
  const rowRankById = useMemo(() => {
    const map = new Map<string, number>();
    dnd.renderedIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [dnd.renderedIds]);
  const domainIdsForDnd = useMemo(
    () => displayGroups
      .filter((g) => !!g.domainId && !!g.domain)
      .map((g) => g.domainId as string),
    [displayGroups],
  );
  const domainDnd = useReorderableDragList({
    itemIds: domainIdsForDnd,
    enabled: groupMode === 'domain',
    onCommit: (fromIndex, toIndex) => {
      const next = [...domainIdsForDnd];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      onReorderDomains(next);
    },
  });
  const domainDndIndexById = useMemo(() => {
    const map = new Map<string, number>();
    domainDnd.renderedIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [domainDnd.renderedIds]);
  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);
  const collapsibleGroupIds = useMemo(
    () => displayGroups
      .filter((g) => !!g.domainId)
      .map((g) => g.domainId as string),
    [displayGroups],
  );
  const areAllGroupsCollapsed = useMemo(
    () => collapsibleGroupIds.length > 0 && collapsibleGroupIds.every((id) => collapsedGroupIds.has(id)),
    [collapsedGroupIds, collapsibleGroupIds],
  );
  const handleCollapseAllGroups = useCallback(() => {
    if (collapsibleGroupIds.length === 0) return;
    setCollapsedGroupIds(new Set(collapsibleGroupIds));
  }, [collapsibleGroupIds]);
  const handleDomainHeaderDragStart = useCallback((domainId: string, e: React.DragEvent) => {
    if (groupMode !== 'domain') return;
    setDraggingDomainId(domainId);
    const index = domainDndIndexById.get(domainId);
    if (index == null) return;
    domainDnd.handleDragStart({ index, itemId: domainId, event: e });
  }, [domainDnd, domainDndIndexById, groupMode]);
  const handleDomainHeaderDragOver = useCallback((domainId: string, e: React.DragEvent) => {
    if (groupMode !== 'domain') return;
    const tableId = draggingTableIdRef.current || e.dataTransfer.getData('text/table-id');
    if (!tableId) {
      const index = domainDndIndexById.get(domainId);
      if (index != null) domainDnd.handleDragOver({ index, itemId: domainId, event: e });
    } else {
      e.preventDefault();
    }
    setDomainDropTargetId(domainId);
  }, [domainDnd, domainDndIndexById, groupMode]);
  const handleDomainHeaderDrop = useCallback((targetDomainId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceDomainId = draggingDomainId || e.dataTransfer.getData('text/domain-id');
    setDomainDropTargetId(null);

    const droppedTableId = draggingTableIdRef.current || draggingTableId || e.dataTransfer.getData('text/table-id');
    if (droppedTableId) {
      const table = tables.find((t) => t.id === droppedTableId);
      if (!table) return;
      if (table.domainId === targetDomainId) return;
      const targetDomain = domains.find((d) => d.id === targetDomainId);
      setPendingMove({
        tableId: table.id,
        targetDomainId,
        targetDomainName: targetDomain?.name ?? 'Unknown',
      });
      setDraggingTableId(null);
      draggingTableIdRef.current = null;
      return;
    }

    if (!sourceDomainId || sourceDomainId === targetDomainId) return;
    domainDnd.handleDrop({ event: e });
  }, [domainDnd, domains, draggingDomainId, draggingTableId, tables]);
  const handleDomainHeaderDragEnd = useCallback(() => {
    setDraggingDomainId(null);
    setDomainDropTargetId(null);
    setDraggingTableId(null);
    draggingTableIdRef.current = null;
    domainDnd.handleDragEnd();
  }, [domainDnd]);
  const getGroupTablesForRender = useCallback((group: TableGroup): Table[] => {
    if (group.domain && draggingDomainId) return [];
    if (group.domainId && collapsedGroupIds.has(group.domainId)) return [];
    if (groupMode === 'none') {
      return group.tables
        .slice()
        .sort((a, b) => (rowRankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rowRankById.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    if (groupMode === 'domain') {
      return group.tables
        .slice()
        .sort((a, b) => (rowRankById.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rowRankById.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    return group.tables;
  }, [collapsedGroupIds, draggingDomainId, groupMode, rowRankById]);
  const renderedGroups = useMemo(() => {
    if (!(groupMode === 'domain' && domainDnd.isDragging)) return displayGroups;
    const byDomainId = new Map(displayGroups.map((g) => [g.domainId, g] as const));
    const ordered: TableGroup[] = [];
    for (const id of domainDnd.renderedIds) {
      const g = byDomainId.get(id);
      if (g) ordered.push(g);
    }
    for (const g of displayGroups) {
      if (!g.domainId || !domainDnd.renderedIds.includes(g.domainId)) ordered.push(g);
    }
    return ordered;
  }, [displayGroups, domainDnd.isDragging, domainDnd.renderedIds, groupMode]);

  const renderTableRow = (table: Table) => {
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

    return (
      <div
        key={table.id}
        className={`group/table-row px-3 py-2 flex items-center justify-between cursor-pointer select-none transition-colors ${!dnd.isDragging ? 'hover:bg-gray-100' : ''} ${isSelected && !isMultiSelected ? 'bg-blue-50' : ''} ${isMultiSelected ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-200' : ''} ${shouldDimRow ? 'opacity-55' : ''} ${isDragSource ? 'bg-blue-50 ring-1 ring-inset ring-blue-300 text-gray-900' : ''} ${isDragTarget ? 'ring-2 ring-inset ring-blue-300' : ''}`}
        style={{
          borderLeft: `3px solid ${getTableColor(table)}`,
        }}
        onClick={(e) => handleTableClick(table.id, e)}
        onDoubleClick={() => handleTableDoubleClick(table.id)}
        draggable={canDrag || canDomainDrag}
        onDragStart={(canDrag || canDomainDrag) ? (e) => {
          if (canDrag) dnd.handleDragStart({ index: dndIndex, itemId: table.id, event: e });
          if (canDomainDrag) {
            setDraggingTableId(table.id);
            draggingTableIdRef.current = table.id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/table-id', table.id);
          }
        } : undefined}
        onDragOver={canDrag && canAcceptReorderDrop ? (e) => dnd.handleDragOver({ index: dndIndex, itemId: table.id, event: e }) : undefined}
        onDragLeave={canDrag ? dnd.handleDragLeave : undefined}
        onDrop={canDrag ? (e) => {
          if (isDomainDragEnabled) {
            const sourceId = draggingTableIdRef.current || draggingTableId;
            if (sourceId) {
              const source = tables.find((t) => t.id === sourceId);
              if (source && source.domainId !== table.domainId) {
                const targetDomain = table.domainId ? domains.find((d) => d.id === table.domainId) : null;
                const targetLabel = targetDomain?.name ?? 'No Domain';
                setPendingMove({
                  tableId: source.id,
                  targetDomainId: table.domainId ?? null,
                  targetDomainName: targetLabel,
                });
                draggingTableIdRef.current = null;
                setDraggingTableId(null);
                return;
              }
            }
          }
          if (!canAcceptReorderDrop) {
            dnd.handleDragEnd();
            return;
          }
          dnd.handleDrop({ event: e });
        } : undefined}
        onDragEnd={(canDrag || canDomainDrag) ? () => {
          if (canDrag) dnd.handleDragEnd();
          if (canDomainDrag) {
            setDraggingTableId(null);
            draggingTableIdRef.current = null;
          }
        } : undefined}
      >
        <GripVertical
          className={`size-3.5 mr-1.5 flex-shrink-0 ${
            canDrag
              ? 'text-gray-300 cursor-grab'
              : 'text-gray-200 cursor-default'
          }`}
        />
        <span className="text-sm truncate flex-1 flex items-center gap-2">
          <span className="truncate">{table.name}</span>
          {badgeLabel && (
            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${kind === 'enum' ? 'bg-orange-100 text-orange-700' : 'bg-violet-100 text-violet-700'}`}>
              {badgeLabel}
            </span>
          )}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 flex-shrink-0 opacity-0 group-hover/table-row:opacity-100 hover:bg-gray-200 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.domainId && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemoveFromDomain(table.id); }}>Remove from domain</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTableDelete(table.id); }} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  if (collapsed) {
    return (
      <div className="w-10 bg-white/95 backdrop-blur-sm flex flex-col items-center pt-2 h-full rounded-r-lg">
        <button onClick={onToggleCollapse} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Expand sidebar">
          <PanelLeft className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white/95 backdrop-blur-sm flex flex-col h-full rounded-r-lg">
      {/* Header with tabs */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-3 pt-2 pb-2">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab('tables')} className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${activeTab === 'tables' ? 'bg-gray-100 border-gray-200 text-gray-900 font-medium' : 'bg-white border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              Tables
            </button>
            <button onClick={() => setActiveTab('domains')} className={`px-3 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1 ${activeTab === 'domains' ? 'bg-gray-100 border-gray-200 text-gray-900 font-medium' : 'bg-white border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              <Palette className="size-3" /> Domains
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            {activeTab === 'tables' && (
              <button
                onClick={() => {
                  const next = !searchOpen;
                  setSearchOpen(next);
                  if (!next) {
                    setSearchQuery('');
                    setFiltersOpen(false);
                  }
                }}
                className={`p-1.5 rounded transition-colors ${searchOpen ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-400'}`}
                title="Search tables"
              >
                <Search className="size-3.5" />
              </button>
            )}
            {activeTab === 'tables' && (groupMode === 'domain' || groupMode === 'type') && (
              <button
                onClick={handleCollapseAllGroups}
                disabled={areAllGroupsCollapsed}
                className={`p-1.5 rounded transition-colors ${areAllGroupsCollapsed ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-400'}`}
                title="Collapse all groups"
              >
                <Minimize2 className="size-3.5" />
              </button>
            )}
            {activeTab === 'tables' && (
              <button
                onClick={() => {
                  setFiltersOpen((prev) => {
                    const next = !prev;
                    if (next) setSearchOpen(true);
                    return next;
                  });
                }}
                className={`p-1.5 rounded transition-colors ${filtersOpen || hasActiveFilters ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-400'}`}
                title="Sort & Group"
              >
                <SlidersHorizontal className="size-3.5" />
              </button>
            )}
            <button onClick={onToggleCollapse} className="p-1.5 hover:bg-gray-100 rounded text-gray-400" title="Collapse sidebar">
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>
        </div>
        {activeTab === 'tables' && searchOpen && (
          <div className="px-3 pb-2 pt-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <Input type="text" placeholder="Search tables..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus className="pl-8 h-8 text-sm" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
        )}
        {activeTab === 'tables' && filtersOpen && (
          <div className="px-3 pb-2">
            <div className="rounded-md bg-gray-50 p-2 space-y-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Sort</div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setSortMode('none')}
                    className={`h-7 px-2 rounded text-xs flex items-center justify-center gap-1 ${sortMode === 'none' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    <GripVertical className="size-3" />
                    Manual
                  </button>
                  <button
                    onClick={() => setSortMode('asc')}
                    className={`h-7 px-2 rounded text-xs flex items-center justify-center gap-1 ${sortMode === 'asc' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    <ArrowUpAZ className="size-3" />
                    A-Z
                  </button>
                  <button
                    onClick={() => setSortMode('desc')}
                    className={`h-7 px-2 rounded text-xs flex items-center justify-center gap-1 ${sortMode === 'desc' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    <ArrowDownAZ className="size-3" />
                    Z-A
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Group</div>
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => setGroupMode('none')} className={`h-7 px-2 rounded text-xs ${groupMode === 'none' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>None</button>
                  <button onClick={() => setGroupMode('domain')} className={`h-7 px-2 rounded text-xs flex items-center justify-center gap-1 ${groupMode === 'domain' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Group className="size-3" /> Domain</button>
                  <button onClick={() => setGroupMode('type')} className={`h-7 px-2 rounded text-xs flex items-center justify-center gap-1 ${groupMode === 'type' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}><Shapes className="size-3" /> Type</button>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Type</div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setVisibleKinds((prev) => ({ ...prev, table: !prev.table }))}
                    className={`h-7 px-2 rounded text-xs ${visibleKinds.table ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    Structure Tables
                  </button>
                  <button
                    onClick={() => setVisibleKinds((prev) => ({ ...prev, enum: !prev.enum }))}
                    className={`h-7 px-2 rounded text-xs ${visibleKinds.enum ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    Enum Tables
                  </button>
                  <button
                    onClick={() => setVisibleKinds((prev) => ({ ...prev, json: !prev.json }))}
                    className={`h-7 px-2 rounded text-xs ${visibleKinds.json ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    JSON Schema
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto panel-scroll pb-12">
        {activeTab === 'tables' ? (
          <>
            <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
              {isAddingTable ? (
                <div className="px-3 py-2">
                  <Input type="text" placeholder="Table name..." value={newTableName} onChange={(e) => setNewTableName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddTable(); if (e.key === 'Escape') { setIsAddingTable(false); setNewTableName(''); } }} autoFocus className="mb-2 h-8 text-sm" />
                  <div className="flex gap-2">
                    <Button onClick={handleAddTable} size="sm" className="flex-1 h-7">Add</Button>
                    <Button onClick={() => { setIsAddingTable(false); setNewTableName(''); }} variant="outline" size="sm" className="flex-1 h-7">Cancel</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsAddingTable(true)} className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                  <Plus className="size-3.5" /> Add Table
                </button>
              )}
            </div>
            {renderedGroups.map((group) => (
              <div key={group.domainId || '__ungrouped__'}>
                {/* Domain group header */}
                {groupMode !== 'none' && (
                  <div
                    className={`px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 sticky top-0 z-10 ${domainDropTargetId === group.domainId ? 'ring-2 ring-inset ring-blue-300' : ''}`}
                    draggable={groupMode === 'domain' && !!group.domain}
                    onDragStart={group.domainId ? (e) => handleDomainHeaderDragStart(group.domainId!, e) : undefined}
                    onDragOver={group.domainId ? (e) => handleDomainHeaderDragOver(group.domainId!, e) : undefined}
                    onDrop={group.domainId ? (e) => handleDomainHeaderDrop(group.domainId!, e) : undefined}
                    onDragEnd={group.domain ? handleDomainHeaderDragEnd : undefined}
                    onClick={group.domainId ? (() => {
                      const groupId = group.domainId;
                      if (!groupId) return;
                      if (group.domain && draggingDomainId) return;
                      if (group.domain && domainDnd.isDragging) return;
                      toggleGroupCollapsed(groupId);
                    }) : undefined}
                  >
                    {group.label ? (
                      <>
                        <button
                          type="button"
                          className="text-gray-500 hover:text-gray-700"
                          onClick={(e) => { e.stopPropagation(); if (group.domainId) toggleGroupCollapsed(group.domainId); }}
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
                          onClick={(e) => { e.stopPropagation(); toggleGroupCollapsed(group.domain!.id); }}
                        >
                          {(draggingDomainId || collapsedGroupIds.has(group.domain.id)) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>
                        <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.domain.color }} />
                        <span className="text-xs text-gray-600 truncate">{group.domain.name}</span>
                        <span className="text-xs text-gray-400 ml-auto tabular-nums">{group.tables.length}</span>
                      </>
                    ) : (
                      <>
                        <span className="size-2.5 rounded-full flex-shrink-0 bg-gray-300" />
                        <span className="text-xs text-gray-500 truncate">No Domain</span>
                        <span className="text-xs text-gray-400 ml-auto tabular-nums">{group.tables.length}</span>
                      </>
                    )}
                  </div>
                )}
                {getGroupTablesForRender(group).map(renderTableRow)}
              </div>
            ))}
          </>
        ) : activeTab === 'domains' ? (
          <>
            {domains.map(domain => {
              const domainTableCount = tables.filter(t => t.domainId === domain.id).length;
              return (
                <div key={domain.id} className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 group relative">
                  {/* Color dot with picker */}
                  <div className="relative">
                    <button
                      onClick={() => setEditingDomainId(editingDomainId === domain.id ? null : domain.id)}
                      className="size-5 rounded-full border-2 border-white shadow-sm flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: domain.color }}
                    />
                    {editingDomainId === domain.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setEditingDomainId(null)} />
                        <div className="absolute left-0 top-full z-50 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-[200px]">
                          <div className="text-xs text-gray-400 mb-2 font-medium">Pick a color</div>
                          <div className="grid grid-cols-7 gap-2">
                            {DOMAIN_COLORS.map(c => (
                              <button
                                key={c}
                                className={`size-6 rounded-full border-2 transition-all hover:scale-125 ${domain.color === c ? 'border-white shadow-lg' : 'border-transparent hover:border-gray-500'}`}
                                style={{ backgroundColor: c }}
                                onClick={() => { onUpdateDomain(domain.id, { color: c }); setEditingDomainId(null); }}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {renamingDomainId === domain.id ? (
                    <input
                      type="text"
                      value={renamingDomainName}
                      onChange={(e) => setRenamingDomainName(e.target.value)}
                      onBlur={() => {
                        if (renamingDomainName.trim()) {
                          onUpdateDomain(domain.id, { name: renamingDomainName.trim() });
                        }
                        setRenamingDomainId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (renamingDomainName.trim()) {
                            onUpdateDomain(domain.id, { name: renamingDomainName.trim() });
                          }
                          setRenamingDomainId(null);
                        }
                        if (e.key === 'Escape') {
                          setRenamingDomainId(null);
                        }
                      }}
                      autoFocus
                      className="flex-1 min-w-0 text-sm bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  ) : (
                    <span
                      className="text-sm flex-1 truncate cursor-default"
                      onDoubleClick={() => {
                        setRenamingDomainId(domain.id);
                        setRenamingDomainName(domain.name);
                      }}
                    >
                      {domain.name}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 tabular-nums">{domainTableCount}</span>

                  {/* Assign selected tables button (visible on hover when multi-selected) */}
                  {hasMultiSelection && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAssignDomain(domain.id, Array.from(selectedTableIds)); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-all flex-shrink-0"
                      title={`Add ${selectedTableIds.size} selected table${selectedTableIds.size > 1 ? 's' : ''} to ${domain.name}`}
                    >
                      <Plus className="size-3" />
                    </button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded p-1 flex-shrink-0">
                      <MoreVertical className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setRenamingDomainId(domain.id);
                        setRenamingDomainName(domain.name);
                      }}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDeleteDomain(domain.id)} className="text-red-600">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

            {isAddingDomain ? (
              <div className="px-3 py-2 border-t border-gray-200">
                <Input type="text" placeholder="Domain name..." value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); if (e.key === 'Escape') { setIsAddingDomain(false); setNewDomainName(''); } }} autoFocus className="mb-2 h-8 text-sm" />
                <div className="flex gap-2">
                  <Button onClick={handleAddDomain} size="sm" className="flex-1 h-7">Add</Button>
                  <Button onClick={() => { setIsAddingDomain(false); setNewDomainName(''); }} variant="outline" size="sm" className="flex-1 h-7">Cancel</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAddingDomain(true)} className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-200">
                <Plus className="size-3.5" /> Add Domain
              </button>
            )}
            {domains.length === 0 && !isAddingDomain && (
              <div className="px-3 py-6 text-center text-xs text-gray-400">Domains help organize tables<br />into logical groups</div>
            )}
          </>
        ) : null}
      </div>
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm px-3 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Tables: <span className="font-medium text-gray-700">{totalTablesCount}</span></span>
          <span>Domains: <span className="font-medium text-gray-700">{totalDomainsCount}</span></span>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingMove}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
        title="Confirm Move"
        description={pendingMove && (() => {
          const table = tables.find((t) => t.id === pendingMove.tableId);
          const sourceDomain = table?.domainId ? domains.find((d) => d.id === table.domainId) : null;
          const targetDomain = pendingMove.targetDomainId ? domains.find((d) => d.id === pendingMove.targetDomainId) : null;
          const targetDomainName = targetDomain?.name ?? 'No Domain';
          const tableColor = sourceDomain?.color ?? '#6b7280';
          const targetDomainColor = targetDomain?.color ?? '#6b7280';

          return (
            <>
              Move table{' '}
              <span className="font-semibold" style={{ color: tableColor }}>
                "{table?.name ?? pendingMove.tableId}"
              </span>{' '}
              to domain{' '}
              <span className="font-semibold" style={{ color: targetDomainColor }}>
                "{targetDomainName}"
              </span>
              ?
            </>
          );
        })()}
        cancelLabel="Cancel"
        confirmLabel="Move"
        onConfirm={() => {
          if (!pendingMove) return;
          if (pendingMove.targetDomainId) onAssignDomain(pendingMove.targetDomainId, [pendingMove.tableId]);
          else onRemoveFromDomain(pendingMove.tableId);
          setPendingMove(null);
        }}
      />
    </div>
  );
}
