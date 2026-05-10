import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { Domain, Table } from '../../model/types';
import { applyHiddenDragImage } from '../hooks/useReorderableDragList';
import { GroupMode, NO_DOMAIN_GROUP_ID } from './constants';
import type { SidebarPendingMove, SidebarTableGroup } from './types';

interface UseDomainDnDParams {
  tables: Table[];
  domains: Domain[];
  displayGroups: SidebarTableGroup[];
  groupMode: GroupMode;
  onReorderDomains: (orderedIds: string[]) => void;
  collapsedGroupIds: Set<string>;
  setCollapsedGroupIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  collapsibleGroupIds: string[];
}

export function useDomainDnD({
  tables,
  domains,
  displayGroups,
  groupMode,
  onReorderDomains,
  collapsedGroupIds,
  setCollapsedGroupIds,
  collapsibleGroupIds,
}: UseDomainDnDParams) {
  const [draggingDomainId, setDraggingDomainId] = useState<string | null>(null);
  const [domainDropTargetId, setDomainDropTargetId] = useState<string | null>(null);
  const [previewDomainOrder, setPreviewDomainOrder] = useState<string[] | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [draggingTableSourceGroupId, setDraggingTableSourceGroupId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<SidebarPendingMove | null>(null);

  const draggingTableIdRef = useRef<string | null>(null);
  const preMoveCollapsedGroupsRef = useRef<Set<string> | null>(null);
  const hasAutoCollapsedForMoveRef = useRef(false);

  const domainIdsForDnd = useMemo(
    () => displayGroups
      .filter((g) => !!g.domainId && !!g.domain)
      .map((g) => g.domainId as string),
    [displayGroups],
  );

  const clearTableDomainDragState = useCallback(() => {
    setDraggingTableId(null);
    setDraggingTableSourceGroupId(null);
    draggingTableIdRef.current = null;
  }, []);

  const restoreCollapsedAfterTableDomainDrag = useCallback(() => {
    if (hasAutoCollapsedForMoveRef.current && preMoveCollapsedGroupsRef.current) {
      setCollapsedGroupIds(new Set(preMoveCollapsedGroupsRef.current));
    }
    preMoveCollapsedGroupsRef.current = null;
    hasAutoCollapsedForMoveRef.current = false;
  }, [setCollapsedGroupIds]);

  const maybeAutoCollapseForTableDomainDrag = useCallback(() => {
    if (groupMode !== 'domain') return;
    if (!draggingTableSourceGroupId) return;
    if (hasAutoCollapsedForMoveRef.current) return;
    preMoveCollapsedGroupsRef.current = new Set(collapsedGroupIds);
    const nextCollapsed = new Set(collapsibleGroupIds.filter((id) => id !== draggingTableSourceGroupId));
    setCollapsedGroupIds(nextCollapsed);
    hasAutoCollapsedForMoveRef.current = true;
  }, [collapsedGroupIds, collapsibleGroupIds, draggingTableSourceGroupId, groupMode, setCollapsedGroupIds]);

  const commitDomainReorder = useCallback((sourceDomainId: string, targetDomainId: string) => {
    if (!sourceDomainId || !targetDomainId || sourceDomainId === targetDomainId) return;
    const fromIndex = domainIdsForDnd.indexOf(sourceDomainId);
    const toIndex = domainIdsForDnd.indexOf(targetDomainId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const next = [...domainIdsForDnd];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    onReorderDomains(next);
  }, [domainIdsForDnd, onReorderDomains]);

  const setPendingMoveFromTarget = useCallback((tableId: string, targetDomainId: string | null) => {
    const targetDomain = domains.find((d) => d.id === targetDomainId);
    setPendingMove({
      tableId,
      targetDomainId,
      targetDomainName: targetDomain?.name ?? 'No Domain',
    });
  }, [domains]);

  const handleTableDomainDragStart = useCallback((tableId: string, tableDomainId: string | null | undefined, event: React.DragEvent) => {
    setDraggingTableId(tableId);
    setDraggingTableSourceGroupId(tableDomainId ?? NO_DOMAIN_GROUP_ID);
    preMoveCollapsedGroupsRef.current = null;
    hasAutoCollapsedForMoveRef.current = false;
    draggingTableIdRef.current = tableId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/table-id', tableId);
  }, []);

  const tryHandleTableDropToTable = useCallback((targetTable: Table): boolean => {
    if (groupMode !== 'domain') return false;
    const sourceId = draggingTableIdRef.current || draggingTableId;
    if (!sourceId) return false;
    const source = tables.find((t) => t.id === sourceId);
    if (!source || source.domainId === targetTable.domainId) return false;
    setPendingMoveFromTarget(source.id, targetTable.domainId ?? null);
    clearTableDomainDragState();
    return true;
  }, [clearTableDomainDragState, draggingTableId, groupMode, setPendingMoveFromTarget, tables]);

  const handleTableDomainDragEnd = useCallback(() => {
    restoreCollapsedAfterTableDomainDrag();
    clearTableDomainDragState();
    setDomainDropTargetId(null);
  }, [clearTableDomainDragState, restoreCollapsedAfterTableDomainDrag]);

  const handleDomainHeaderDragStart = useCallback((domainId: string, e: React.DragEvent) => {
    if (groupMode !== 'domain') return;
    clearTableDomainDragState();
    setDraggingDomainId(domainId);
    setPreviewDomainOrder(domainIdsForDnd);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/domain-id', domainId);
    applyHiddenDragImage(e);
  }, [clearTableDomainDragState, domainIdsForDnd, groupMode]);

  const handleDomainHeaderDragOver = useCallback((domainId: string | null, e: React.DragEvent) => {
    if (groupMode !== 'domain') return;
    const tableId = draggingTableIdRef.current || e.dataTransfer.getData('text/table-id');
    const sourceDomainId = draggingDomainId || e.dataTransfer.getData('text/domain-id');
    if (tableId || sourceDomainId) e.preventDefault();
    const targetGroupId = domainId ?? NO_DOMAIN_GROUP_ID;
    if (tableId && draggingTableSourceGroupId && targetGroupId !== draggingTableSourceGroupId) {
      maybeAutoCollapseForTableDomainDrag();
    }
    if (!tableId && sourceDomainId && domainId && sourceDomainId !== domainId) {
      setPreviewDomainOrder((prev) => {
        const base = prev ?? domainIdsForDnd;
        const fromIndex = base.indexOf(sourceDomainId);
        const toIndex = base.indexOf(domainId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return base;
        const next = [...base];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return base;
        next.splice(toIndex, 0, moved);
        return next;
      });
    }
    setDomainDropTargetId(targetGroupId);
  }, [domainIdsForDnd, draggingDomainId, draggingTableSourceGroupId, groupMode, maybeAutoCollapseForTableDomainDrag]);

  const handleDomainHeaderDrop = useCallback((targetDomainId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceDomainId = draggingDomainId || e.dataTransfer.getData('text/domain-id');
    setDomainDropTargetId(null);
    if (sourceDomainId) {
      if (previewDomainOrder && previewDomainOrder.length > 0) {
        onReorderDomains(previewDomainOrder);
      } else if (targetDomainId) {
        commitDomainReorder(sourceDomainId, targetDomainId);
      }
      setPreviewDomainOrder(null);
      setDraggingDomainId(null);
      return;
    }
    const droppedTableId = draggingTableIdRef.current || draggingTableId || e.dataTransfer.getData('text/table-id');
    if (droppedTableId) {
      const table = tables.find((t) => t.id === droppedTableId);
      if (!table) return;
      if ((table.domainId ?? null) === targetDomainId) return;
      setPendingMoveFromTarget(table.id, targetDomainId);
      restoreCollapsedAfterTableDomainDrag();
      clearTableDomainDragState();
    }
  }, [clearTableDomainDragState, commitDomainReorder, draggingDomainId, draggingTableId, onReorderDomains, previewDomainOrder, restoreCollapsedAfterTableDomainDrag, setPendingMoveFromTarget, tables]);

  const handleDomainHeaderDragEnd = useCallback(() => {
    setDraggingDomainId(null);
    setDomainDropTargetId(null);
    setPreviewDomainOrder(null);
    restoreCollapsedAfterTableDomainDrag();
    clearTableDomainDragState();
  }, [clearTableDomainDragState, restoreCollapsedAfterTableDomainDrag]);

  const handleDomainListDragOver = useCallback((e: React.DragEvent) => {
    if (groupMode !== 'domain' || !draggingDomainId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [draggingDomainId, groupMode]);

  const handleDomainListDrop = useCallback((e: React.DragEvent) => {
    if (groupMode !== 'domain' || !draggingDomainId) return;
    e.preventDefault();
    if (previewDomainOrder && previewDomainOrder.length > 0) {
      onReorderDomains(previewDomainOrder);
    } else {
      const target = domainDropTargetId;
      if (target) commitDomainReorder(draggingDomainId, target);
    }
    setDraggingDomainId(null);
    setDomainDropTargetId(null);
    setPreviewDomainOrder(null);
  }, [commitDomainReorder, domainDropTargetId, draggingDomainId, groupMode, onReorderDomains, previewDomainOrder]);

  const renderedGroups = useMemo<SidebarTableGroup[]>(() => {
    if (!(groupMode === 'domain' && draggingDomainId && previewDomainOrder)) return displayGroups;
    const byDomainId = new Map(displayGroups.map((g) => [g.domainId, g] as const));
    const ordered: SidebarTableGroup[] = [];
    for (const id of previewDomainOrder) {
      const group = byDomainId.get(id);
      if (group) ordered.push(group);
    }
    for (const group of displayGroups) {
      if (!group.domainId || !previewDomainOrder.includes(group.domainId)) ordered.push(group);
    }
    return ordered;
  }, [displayGroups, draggingDomainId, groupMode, previewDomainOrder]);

  return {
    domainDropTargetId,
    draggingDomainId,
    draggingTableId,
    draggingTableSourceGroupId,
    pendingMove,
    renderedGroups,
    setPendingMove,
    handleDomainHeaderDragEnd,
    handleDomainHeaderDragOver,
    handleDomainHeaderDragStart,
    handleDomainHeaderDrop,
    handleDomainListDragOver,
    handleDomainListDrop,
    handleTableDomainDragStart,
    handleTableDomainDragEnd,
    tryHandleTableDropToTable,
  };
}
