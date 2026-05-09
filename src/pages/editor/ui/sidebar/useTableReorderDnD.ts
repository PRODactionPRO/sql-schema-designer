import { useMemo } from 'react';
import type React from 'react';
import { useReorderableDragList } from '../hooks/useReorderableDragList';
import type { GroupMode, SortMode } from './constants';

interface UseTableReorderDnDParams {
  flatTableIds: string[];
  groupMode: GroupMode;
  searchQuery: string;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  onReorderTables: (orderedIds: string[]) => void;
}

export function useTableReorderDnD({
  flatTableIds,
  groupMode,
  searchQuery,
  sortMode,
  setSortMode,
  onReorderTables,
}: UseTableReorderDnDParams) {
  const isDragEnabled = groupMode === 'none' && !searchQuery;
  const isDomainDragEnabled = groupMode === 'domain';
  const dndEnabled = isDragEnabled || isDomainDragEnabled;
  const dndRowIds = useMemo(() => flatTableIds, [flatTableIds]);

  const dnd = useReorderableDragList({
    itemIds: dndRowIds,
    enabled: dndEnabled,
    onCommit: (fromIndex, toIndex) => {
      const next = [...dndRowIds];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return;
      next.splice(toIndex, 0, moved);
      if (sortMode !== 'none') setSortMode('none');
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

  return {
    dnd,
    dndEnabled,
    dndIndexById,
    isDomainDragEnabled,
    rowRankById,
  };
}
