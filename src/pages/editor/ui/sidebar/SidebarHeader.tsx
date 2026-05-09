import type React from 'react';
import { Search, X, SlidersHorizontal, PanelLeftClose } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { ProTooltip } from '@/shared/ui/pro-tooltip';
import { GhostActionButton } from '@/shared/ui/ghost-action-button';
import { FiltersBar } from './FiltersBar';
import type { FilterPopup, GroupMode, SortMode, TableKind } from './constants';
import type { SidebarTab } from './types';

interface SidebarHeaderProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  searchOpen: boolean;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filtersOpen: boolean;
  setFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hasActiveFilters: boolean;
  visibleKinds: Record<TableKind, boolean>;
  toggleVisibleKind: (kind: TableKind) => void;
  openFilterPopup: FilterPopup;
  setOpenFilterPopup: React.Dispatch<React.SetStateAction<FilterPopup>>;
  groupMode: GroupMode;
  setGroupMode: React.Dispatch<React.SetStateAction<GroupMode>>;
  setVisibleKinds: React.Dispatch<React.SetStateAction<Record<TableKind, boolean>>>;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  closeAllFilterPopups: () => void;
  onToggleCollapse: () => void;
}

export function SidebarHeader({
  activeTab,
  setActiveTab,
  searchOpen,
  setSearchOpen,
  searchQuery,
  setSearchQuery,
  filtersOpen,
  setFiltersOpen,
  hasActiveFilters,
  visibleKinds,
  toggleVisibleKind,
  openFilterPopup,
  setOpenFilterPopup,
  groupMode,
  setGroupMode,
  setVisibleKinds,
  setSortMode,
  closeAllFilterPopups,
  onToggleCollapse,
}: SidebarHeaderProps) {
  return (
    <div className="border-b border-gray-200">
      <div className="flex items-center justify-between px-3 pt-2 pb-2">
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('tables')} className={`px-3 py-1.5 text-xs rounded-md transition-colors ${activeTab === 'tables' ? 'bg-gray-100 text-gray-900 font-medium' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            Tables
          </button>
          <button onClick={() => setActiveTab('domains')} className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${activeTab === 'domains' ? 'bg-gray-100 text-gray-900 font-medium' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            Domains
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          {activeTab === 'tables' && (
            <ProTooltip label="Search Tables">
              <GhostActionButton
                Icon={Search}
                onClick={() => {
                  const next = !searchOpen;
                  setSearchOpen(next);
                  if (!next) {
                    setSearchQuery('');
                  }
                }}
                active={searchOpen}
                aria-label="Search tables"
              />
            </ProTooltip>
          )}
          {activeTab === 'tables' && (
            <ProTooltip label="Filter Controls">
              <GhostActionButton
                Icon={SlidersHorizontal}
                onClick={() => {
                  setFiltersOpen((prev) => {
                    const next = !prev;
                    if (!next) closeAllFilterPopups();
                    return next;
                  });
                }}
                active={filtersOpen || hasActiveFilters}
                aria-label="Filter controls"
              />
            </ProTooltip>
          )}
          <ProTooltip label="Collapse Sidebar">
            <GhostActionButton
              Icon={PanelLeftClose}
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
            />
          </ProTooltip>
        </div>
      </div>
      {activeTab === 'tables' && searchOpen && (
        <div className="px-3 pb-2 pt-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <Input type="text" placeholder="Search tables..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus className="pl-8 h-8 text-sm" />
            {searchQuery && (
              <GhostActionButton
                Icon={X}
                size="xs"
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              />
            )}
          </div>
        </div>
      )}
      {activeTab === 'tables' && filtersOpen && (
        <FiltersBar
          visibleKinds={visibleKinds}
          onToggleKind={toggleVisibleKind}
          openFilterPopup={openFilterPopup}
          setOpenFilterPopup={setOpenFilterPopup}
          groupMode={groupMode}
          setGroupMode={setGroupMode}
          setVisibleKinds={setVisibleKinds}
          setSortMode={setSortMode}
          closeAllFilterPopups={closeAllFilterPopups}
        />
      )}
    </div>
  );
}
