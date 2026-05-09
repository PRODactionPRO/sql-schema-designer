import { useEffect, useMemo, useRef, useState } from 'react';

const HIDDEN_DRAG_IMAGE_SRC =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
let sharedHiddenDragImage: HTMLImageElement | null = null;

function getHiddenDragImage(): HTMLImageElement {
  if (sharedHiddenDragImage) return sharedHiddenDragImage;
  const img = new Image();
  img.src = HIDDEN_DRAG_IMAGE_SRC;
  sharedHiddenDragImage = img;
  return img;
}

export function applyHiddenDragImage(event: React.DragEvent) {
  const img = getHiddenDragImage();
  event.dataTransfer.setDragImage(img, 0, 0);
}

interface UseReorderableDragListOptions {
  itemIds: string[];
  onCommit: (fromIndex: number, toIndex: number) => void;
  enabled?: boolean;
}

interface DragStartArgs {
  index: number;
  itemId: string;
  event: React.DragEvent;
}

interface DragOverArgs {
  index: number;
  itemId: string;
  event: React.DragEvent;
}

interface DropArgs {
  event: React.DragEvent;
}

export function useReorderableDragList({
  itemIds,
  onCommit,
  enabled = true,
}: UseReorderableDragListOptions) {
  const sourceIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [previewOrderIds, setPreviewOrderIds] = useState<string[] | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const hiddenDragImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (hiddenDragImageRef.current) return;
    hiddenDragImageRef.current = getHiddenDragImage();
  }, []);

  const cleanup = () => {
    sourceIndexRef.current = null;
    setDragOverIndex(null);
    setDraggingItemId(null);
    setPreviewOrderIds(null);
  };

  const handleDragStart = ({ index, itemId, event }: DragStartArgs) => {
    if (!enabled) return;
    sourceIndexRef.current = index;
    setDraggingItemId(itemId);
    setPreviewOrderIds(itemIds);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    if (hiddenDragImageRef.current) applyHiddenDragImage(event);
  };

  const handleDragOver = ({ index, itemId, event }: DragOverArgs) => {
    if (!enabled) return;
    event.preventDefault();
    setDragOverIndex(index);

    const sourceIndex = sourceIndexRef.current;
    if (sourceIndex == null) return;
    const sourceItemId = draggingItemId ?? itemIds[sourceIndex];
    if (!sourceItemId || sourceItemId === itemId) return;

    const baseOrder = previewOrderIds ?? itemIds;
    const withoutSource = baseOrder.filter((id) => id !== sourceItemId);
    const targetPos = withoutSource.indexOf(itemId);
    if (targetPos < 0) return;

    const sourcePosInBase = baseOrder.indexOf(sourceItemId);
    const targetPosInBase = baseOrder.indexOf(itemId);
    const movingDown = sourcePosInBase < targetPosInBase;
    const insertPos = movingDown ? targetPos + 1 : targetPos;

    const nextOrder = [...withoutSource];
    nextOrder.splice(insertPos, 0, sourceItemId);

    if (nextOrder.join('|') !== baseOrder.join('|')) {
      setPreviewOrderIds(nextOrder);
    }
  };

  const handleDragLeave = () => {
    if (!enabled) return;
    setDragOverIndex(null);
  };

  const handleDrop = ({ event }: DropArgs) => {
    if (!enabled) return;
    event.preventDefault();

    const sourceIndex = sourceIndexRef.current;
    const sourceItemId = draggingItemId ?? (sourceIndex != null ? itemIds[sourceIndex] : null);
    if (!sourceItemId || sourceIndex == null) {
      cleanup();
      return;
    }

    const finalOrder = previewOrderIds ?? itemIds;
    const fromIndex = itemIds.indexOf(sourceItemId);
    const toIndex = finalOrder.indexOf(sourceItemId);
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      onCommit(fromIndex, toIndex);
    }
    cleanup();
  };

  const handleDragEnd = () => {
    cleanup();
  };

  const renderedIds = useMemo(
    () => (enabled && previewOrderIds ? previewOrderIds : itemIds),
    [enabled, previewOrderIds, itemIds],
  );

  return {
    dragOverIndex,
    draggingItemId,
    isDragging: draggingItemId !== null,
    renderedIds,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
