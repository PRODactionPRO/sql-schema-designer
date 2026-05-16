import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { findTabLocation } from './tab-utils';
import type { WorkspaceWindow, WorkspaceWindowId } from './types';

interface UseWorkspaceTabDragOptions {
  windowsRef: RefObject<Record<WorkspaceWindowId, WorkspaceWindow>>;
  moveTab: (
    fromWindowId: WorkspaceWindowId,
    tabId: string,
    toWindowId: WorkspaceWindowId,
    targetIndex: number,
  ) => void;
}

export function useWorkspaceTabDrag({ windowsRef, moveTab }: UseWorkspaceTabDragOptions) {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [heldTabId, setHeldTabId] = useState<string | null>(null);
  const pointerDragRef = useRef<{
    tabId: string;
    fromWindowId: WorkspaceWindowId;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef<string | null>(null);

  const shouldSuppressTabActivation = (tabId: string) => {
    if (suppressClickRef.current !== tabId) return false;
    suppressClickRef.current = null;
    return true;
  };

  const resolveDropTarget = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!(element instanceof HTMLElement)) return null;

    const tabElement = element.closest<HTMLElement>('[data-tab-id][data-window-id]');
    if (tabElement?.dataset.windowId && tabElement.dataset.tabId) {
      const targetWindowId = tabElement.dataset.windowId as WorkspaceWindowId;
      const targetWindow = windowsRef.current[targetWindowId];
      if (!targetWindow) return null;

      const targetIndex = targetWindow.tabs.findIndex((tab) => tab.id === tabElement.dataset.tabId);
      if (targetIndex < 0) return null;

      const rect = tabElement.getBoundingClientRect();
      return {
        windowId: targetWindowId,
        index: clientX > rect.left + rect.width / 2 ? targetIndex + 1 : targetIndex,
      };
    }

    const paneElement = element.closest<HTMLElement>('[data-window-id]');
    if (!paneElement?.dataset.windowId) return null;

    const targetWindowId = paneElement.dataset.windowId as WorkspaceWindowId;
    const targetWindow = windowsRef.current[targetWindowId];
    if (!targetWindow) return null;

    return {
      windowId: targetWindowId,
      index: targetWindow.tabs.length,
    };
  };

  const clearPointerDrag = () => {
    pointerDragRef.current = null;
    setDraggingTabId(null);
    setHeldTabId(null);
  };

  const startTabPointerDrag = (
    windowId: WorkspaceWindowId,
    tabId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;
    setHeldTabId(tabId);

    pointerDragRef.current = {
      tabId,
      fromWindowId: windowId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragState = pointerDragRef.current;
      if (!dragState) return;

      const distance = Math.hypot(moveEvent.clientX - dragState.startX, moveEvent.clientY - dragState.startY);
      if (!dragState.dragging && distance < 6) return;

      dragState.dragging = true;
      setDraggingTabId(dragState.tabId);
      const target = resolveDropTarget(moveEvent.clientX, moveEvent.clientY);

      if (target) {
        const currentLocation = findTabLocation(windowsRef.current, dragState.tabId);
        if (!currentLocation) return;

        const samePosition =
          currentLocation.windowId === target.windowId &&
          (currentLocation.index === target.index || currentLocation.index + 1 === target.index);

        if (!samePosition) {
          moveTab(currentLocation.windowId, dragState.tabId, target.windowId, target.index);
          dragState.fromWindowId = target.windowId;
        }
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      const dragState = pointerDragRef.current;
      if (!dragState) return;

      if (dragState.dragging) {
        const target = resolveDropTarget(upEvent.clientX, upEvent.clientY);
        const currentLocation = findTabLocation(windowsRef.current, dragState.tabId);
        if (target && currentLocation) {
          moveTab(currentLocation.windowId, dragState.tabId, target.windowId, target.index);
        }

        suppressClickRef.current = dragState.tabId;
        window.setTimeout(() => {
          if (suppressClickRef.current === dragState.tabId) {
            suppressClickRef.current = null;
          }
        }, 0);
      }

      clearPointerDrag();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return {
    draggingTabId,
    heldTabId,
    shouldSuppressTabActivation,
    startTabPointerDrag,
  };
}
