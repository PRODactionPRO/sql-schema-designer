import { RotateCcw } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import { ProTooltip } from '@/shared/ui/pro-tooltip';
import { GhostActionButton } from '@/shared/ui/ghost-action-button';

import { FilterPopup, GroupMode, SortMode, TableKind } from './constants';
import { GroupMenu } from './GroupMenu';
import { TypeToggleGroup } from './TypeToggleGroup';
import { resetSidebarFilters } from './utils';

interface FiltersBarProps {
  visibleKinds: Record<TableKind, boolean>;
  onToggleKind: (kind: TableKind) => void;
  openFilterPopup: FilterPopup;
  setOpenFilterPopup: Dispatch<SetStateAction<FilterPopup>>;
  groupMode: GroupMode;
  setGroupMode: Dispatch<SetStateAction<GroupMode>>;
  setVisibleKinds: Dispatch<SetStateAction<Record<TableKind, boolean>>>;
  setSortMode: Dispatch<SetStateAction<SortMode>>;
  closeAllFilterPopups: () => void;
}

export function FiltersBar({
  visibleKinds,
  onToggleKind,
  openFilterPopup,
  setOpenFilterPopup,
  groupMode,
  setGroupMode,
  setVisibleKinds,
  setSortMode,
  closeAllFilterPopups,
}: FiltersBarProps) {
  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-1">
        <TypeToggleGroup visibleKinds={visibleKinds} onToggle={onToggleKind} />

        <GroupMenu
          open={openFilterPopup === 'group'}
          onOpenChange={(open) => setOpenFilterPopup((prev) => (open ? 'group' : (prev === 'group' ? 'none' : prev)))}
          groupMode={groupMode}
          onChange={setGroupMode}
        />

        <ProTooltip label="Reset Filters">
          <GhostActionButton
            Icon={RotateCcw}
            onClick={() => resetSidebarFilters({
              setVisibleKinds,
              setGroupMode,
              setSortMode,
              closeAllFilterPopups,
            })}
            aria-label="Reset filters"
          />
        </ProTooltip>
      </div>
    </div>
  );
}
