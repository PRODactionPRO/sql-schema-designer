import type { Dispatch, SetStateAction } from 'react';

import {
  DEFAULT_GROUP_MODE,
  DEFAULT_SORT_MODE,
  DEFAULT_VISIBLE_KINDS,
  type GroupMode,
  type SortMode,
  type TableKind,
} from './constants';

interface ResetSidebarFiltersParams {
  setVisibleKinds: Dispatch<SetStateAction<Record<TableKind, boolean>>>;
  setGroupMode: Dispatch<SetStateAction<GroupMode>>;
  setSortMode: Dispatch<SetStateAction<SortMode>>;
  closeAllFilterPopups: () => void;
}

export function resetSidebarFilters({
  setVisibleKinds,
  setGroupMode,
  setSortMode,
  closeAllFilterPopups,
}: ResetSidebarFiltersParams) {
  setVisibleKinds(DEFAULT_VISIBLE_KINDS);
  setGroupMode(DEFAULT_GROUP_MODE);
  setSortMode(DEFAULT_SORT_MODE);
  closeAllFilterPopups();
}
