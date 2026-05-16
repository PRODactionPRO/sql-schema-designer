import { useCallback, useMemo } from 'react';
import { useReorderableDragList } from '@/shared/ui/useReorderableDragList';

export type WorkspaceCatalogSortMode = 'manual' | 'asc' | 'desc';

interface CatalogItem {
  id: string;
  name: string;
  sidebarOrder?: number;
}

export function useWorkspaceCatalogOrdering<TItem extends CatalogItem>({
  items,
  query,
  sortMode,
  enabled,
  onCommitReorder,
}: {
  items: TItem[];
  query: string;
  sortMode: WorkspaceCatalogSortMode;
  enabled: boolean;
  onCommitReorder: (items: TItem[]) => void;
}) {
  const baseOrderedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const orderDiff = (a.sidebarOrder ?? Number.MAX_SAFE_INTEGER) - (b.sidebarOrder ?? Number.MAX_SAFE_INTEGER);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const manualItemIds = useMemo(() => baseOrderedItems.map((item) => item.id), [baseOrderedItems]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const canPreviewReorder = sortMode === 'manual' && !query.trim();

  const handleCommitReorder = useCallback((fromIndex: number, toIndex: number) => {
    const nextIds = [...manualItemIds];
    const [movedId] = nextIds.splice(fromIndex, 1);
    if (!movedId) return;
    nextIds.splice(toIndex, 0, movedId);

    const reorderedItems = nextIds
      .map((id) => itemById.get(id))
      .filter((item): item is TItem => Boolean(item));
    const missingItems = items.filter((item) => !nextIds.includes(item.id));
    onCommitReorder([...reorderedItems, ...missingItems]);
  }, [itemById, items, manualItemIds, onCommitReorder]);

  const dnd = useReorderableDragList({
    itemIds: manualItemIds,
    enabled: enabled && canPreviewReorder,
    onCommit: handleCommitReorder,
  });

  const renderedItemIds = dnd.renderedIds;
  const dndIndexById = useMemo(
    () => new Map(renderedItemIds.map((id, index) => [id, index])),
    [renderedItemIds],
  );

  const orderedItems = useMemo(() => {
    if (sortMode === 'asc') return [...baseOrderedItems].sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === 'desc') return [...baseOrderedItems].sort((a, b) => b.name.localeCompare(a.name));
    if (!canPreviewReorder) return baseOrderedItems;
    return renderedItemIds
      .map((id) => itemById.get(id))
      .filter((item): item is TItem => Boolean(item));
  }, [baseOrderedItems, canPreviewReorder, itemById, renderedItemIds, sortMode]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return orderedItems;
    return orderedItems.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [orderedItems, query]);

  return {
    canPreviewReorder,
    dnd,
    dndIndexById,
    filteredItems,
    itemById,
  };
}
