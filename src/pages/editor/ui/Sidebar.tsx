import { useState, useRef, useCallback, useMemo } from 'react';
import type { Table, Domain } from '../model/types';
import { DOMAIN_COLORS } from '../model/types';
import { Search, MoreVertical, Plus, Palette, X, PanelLeftClose, PanelLeft, ArrowUpAZ, ArrowDownAZ, GripVertical, SlidersHorizontal, Group, Check } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';

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
  onCenterOnTable: (id: string) => void;
  onClearMultiSelection: () => void;
}

type TabType = 'tables' | 'domains';
type SortMode = 'none' | 'asc' | 'desc';

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
  tables: Table[];
}

export function Sidebar({
  tables, domains, selectedTableId, selectedTableIds, collapsed, onToggleCollapse,
  onTableSelect, onTableDelete, onAddTable, onAddDomain, onUpdateDomain, onDeleteDomain,
  onAssignDomain, onRemoveFromDomain, getTableColor, onToggleTableSelection, onReorderTables, onCenterOnTable, onClearMultiSelection,
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
  const [groupByDomain, setGroupByDomain] = useState(false);
  const [viewPopoverOpen, setViewPopoverOpen] = useState(false);

  // Drag & drop state for manual reorder
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below'>('below');
  const dragSourceId = useRef<string | null>(null);

  // Last clicked table for shift-select range
  const lastClickedId = useRef<string | null>(null);

  const filteredTables = useMemo(() => tables.filter(table =>
    !searchQuery || table.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [tables, searchQuery]);

  // Compute display list: sort + group
  const displayGroups: TableGroup[] = useMemo(() => {
    const sorted = sortTables(filteredTables, sortMode);

    if (!groupByDomain) {
      return [{ domainId: null, domain: null, tables: sorted }];
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
  }, [filteredTables, sortMode, groupByDomain, domains]);

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

  // Drag & drop handlers for manual sort
  const handleDragStart = useCallback((tableId: string, e: React.DragEvent) => {
    dragSourceId.current = tableId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tableId);
    // Make ghost semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragOverId(null);
    dragSourceId.current = null;
  }, []);

  const handleDragOver = useCallback((tableId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';
    setDragOverId(tableId);
    setDragOverPosition(pos);
  }, []);

  const handleDrop = useCallback((targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = dragSourceId.current;
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null);
      return;
    }

    // Compute new order
    const ids = tables.map(t => t.id);
    const sourceIdx = ids.indexOf(sourceId);
    if (sourceIdx < 0) return;

    // Remove source
    ids.splice(sourceIdx, 1);
    // Find target idx in remaining list
    let targetIdx = ids.indexOf(targetId);
    if (targetIdx < 0) return;
    if (dragOverPosition === 'below') targetIdx += 1;
    ids.splice(targetIdx, 0, sourceId);

    onReorderTables(ids);
    setDragOverId(null);
    dragSourceId.current = null;
  }, [tables, dragOverPosition, onReorderTables]);

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
  const isDragEnabled = sortMode === 'none' && !groupByDomain && !searchQuery;

  const renderTableRow = (table: Table) => {
    const isSelected = selectedTableId === table.id;
    const isMultiSelected = selectedTableIds.has(table.id);
    const isDragTarget = dragOverId === table.id;

    return (
      <div
        key={table.id}
        className={`px-3 py-2 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 transition-colors ${isSelected && !isMultiSelected ? 'bg-blue-50' : ''} ${isMultiSelected ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-200' : ''}`}
        style={{
          borderLeft: `3px solid ${getTableColor(table)}`,
          ...(isDragTarget && dragOverPosition === 'above' ? { boxShadow: 'inset 0 2px 0 0 #3b82f6' } : {}),
          ...(isDragTarget && dragOverPosition === 'below' ? { boxShadow: 'inset 0 -2px 0 0 #3b82f6' } : {}),
        }}
        onClick={(e) => handleTableClick(table.id, e)}
        onDoubleClick={() => handleTableDoubleClick(table.id)}
        draggable={isDragEnabled}
        onDragStart={(e) => handleDragStart(table.id, e)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(table.id, e)}
        onDragLeave={() => { if (dragOverId === table.id) setDragOverId(null); }}
        onDrop={(e) => handleDrop(table.id, e)}
      >
        {isDragEnabled && (
          <GripVertical className="size-3 text-gray-300 mr-1 flex-shrink-0 cursor-grab" />
        )}
        <span className="text-sm truncate flex-1">{table.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="hover:bg-gray-200 rounded p-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
    <div className="w-full bg-white/95 backdrop-blur-sm flex flex-col h-full rounded-r-lg">
      {/* Header with tabs */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex gap-0.5">
            <button onClick={() => setActiveTab('tables')} className={`px-3 py-1.5 text-xs rounded-t transition-colors ${activeTab === 'tables' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
              Tables
            </button>
            <button onClick={() => setActiveTab('domains')} className={`px-3 py-1.5 text-xs rounded-t transition-colors flex items-center gap-1 ${activeTab === 'domains' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
              <Palette className="size-3" /> Domains
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            {activeTab === 'tables' && (
              <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(''); }} className={`p-1.5 rounded transition-colors ${searchOpen ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-400'}`} title="Search tables">
                <Search className="size-3.5" />
              </button>
            )}
            {activeTab === 'tables' && (
              <div className="relative">
                <button
                  onClick={() => setViewPopoverOpen(!viewPopoverOpen)}
                  className={`p-1.5 rounded transition-colors ${viewPopoverOpen || sortMode !== 'none' || groupByDomain ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-400'}`}
                  title="Sort & Group"
                >
                  <SlidersHorizontal className="size-3.5" />
                </button>
                {viewPopoverOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setViewPopoverOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-[200px]">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Sort</div>
                      <div className="space-y-0.5 mb-3">
                        <button
                          onClick={() => { setSortMode(sortMode === 'asc' ? 'none' : 'asc'); }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${sortMode === 'asc' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                        >
                          <ArrowUpAZ className="size-3.5" />
                          A → Z
                          {sortMode === 'asc' && <Check className="size-3 ml-auto" />}
                        </button>
                        <button
                          onClick={() => { setSortMode(sortMode === 'desc' ? 'none' : 'desc'); }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${sortMode === 'desc' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                        >
                          <ArrowDownAZ className="size-3.5" />
                          Z → A
                          {sortMode === 'desc' && <Check className="size-3 ml-auto" />}
                        </button>
                        <button
                          onClick={() => { setSortMode('none'); }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${sortMode === 'none' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                        >
                          <GripVertical className="size-3.5" />
                          Manual
                          {sortMode === 'none' && <Check className="size-3 ml-auto" />}
                        </button>
                      </div>
                      <div className="border-t border-gray-700 pt-2">
                        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Group</div>
                        <button
                          onClick={() => setGroupByDomain(!groupByDomain)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${groupByDomain ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                        >
                          <Group className="size-3.5" />
                          By Domain
                          {groupByDomain && <Check className="size-3 ml-auto" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto panel-scroll">
        {activeTab === 'tables' ? (
          <>
            {displayGroups.map((group, gi) => (
              <div key={group.domainId || '__ungrouped__'}>
                {/* Domain group header */}
                {groupByDomain && (
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 sticky top-0 z-10">
                    {group.domain ? (
                      <>
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
                {group.tables.map(renderTableRow)}
              </div>
            ))}
            {isAddingTable ? (
              <div className="px-3 py-2 border-t border-gray-200">
                <Input type="text" placeholder="Table name..." value={newTableName} onChange={(e) => setNewTableName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddTable(); if (e.key === 'Escape') { setIsAddingTable(false); setNewTableName(''); } }} autoFocus className="mb-2 h-8 text-sm" />
                <div className="flex gap-2">
                  <Button onClick={handleAddTable} size="sm" className="flex-1 h-7">Add</Button>
                  <Button onClick={() => { setIsAddingTable(false); setNewTableName(''); }} variant="outline" size="sm" className="flex-1 h-7">Cancel</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAddingTable(true)} className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-200">
                <Plus className="size-3.5" /> Add Table
              </button>
            )}
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
    </div>
  );
}
