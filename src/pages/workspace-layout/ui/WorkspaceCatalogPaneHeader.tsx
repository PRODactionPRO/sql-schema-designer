import {
  ArrowDownAZ,
  ArrowUpAZ,
  GripVertical,
  Minimize2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/shared/ui/utils';
import type { WorkspaceCatalogSortMode } from '../model/useWorkspaceCatalogOrdering';

export function WorkspaceCatalogPaneHeader({
  title,
  addLabel,
  searchPlaceholder,
  query,
  sortMode,
  areAllGroupsCollapsed,
  collapseDisabled,
  onAdd,
  onQueryChange,
  onCycleSortMode,
  onToggleGroupsCollapsed,
}: {
  title: string;
  addLabel: string;
  searchPlaceholder: string;
  query: string;
  sortMode: WorkspaceCatalogSortMode;
  areAllGroupsCollapsed: boolean;
  collapseDisabled: boolean;
  onAdd: () => void;
  onQueryChange: (query: string) => void;
  onCycleSortMode: () => void;
  onToggleGroupsCollapsed: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-sm font-medium text-gray-600">{title}</span>
          <CatalogToolbarButton label={addLabel} onClick={onAdd}>
            <Plus className="size-3.5" />
          </CatalogToolbarButton>
        </div>
        <div className="flex items-center gap-0.5">
          <CatalogToolbarButton label={`Search ${title.toLowerCase()}`} active={!!query} onClick={() => onQueryChange(query ? '' : query)}>
            <Search className="size-3.5" />
          </CatalogToolbarButton>
          <CatalogToolbarButton label={`Sort: ${sortMode}`} active={sortMode !== 'manual'} onClick={onCycleSortMode}>
            {sortMode === 'asc' ? <ArrowUpAZ className="size-3.5" /> : sortMode === 'desc' ? <ArrowDownAZ className="size-3.5" /> : <GripVertical className="size-3.5" />}
          </CatalogToolbarButton>
          <CatalogToolbarButton
            label={areAllGroupsCollapsed ? 'Expand groups' : 'Collapse groups'}
            disabled={collapseDisabled}
            onClick={onToggleGroupsCollapsed}
          >
            <Minimize2 className="size-3.5" />
          </CatalogToolbarButton>
        </div>
      </div>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 w-full rounded-md border border-gray-200 bg-white pl-8 pr-7 text-sm outline-none focus:border-blue-400"
        />
        {query ? (
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" onClick={() => onQueryChange('')}>
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CatalogToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent',
        active && 'bg-gray-100 text-gray-700',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
