import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { finalizeTabPreview, findTabLocation, relocateTabPreview } from './tab-utils';
import type { WorkspaceWindow, WorkspaceWindowId } from './types';
import { cloneWorkspaceWindows } from './workspace-layout-preferences';

interface UseWorkspaceTabDragOptions {
  windowsRef: RefObject<Record<WorkspaceWindowId, WorkspaceWindow>>;
  replaceWindows: (windows: Record<WorkspaceWindowId, WorkspaceWindow>) => void;
}

export function useWorkspaceTabDrag({ windowsRef, replaceWindows }: UseWorkspaceTabDragOptions) {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [heldTabId, setHeldTabId] = useState<string | null>(null);
  const [previewWindows, setPreviewWindows] = useState<Record<WorkspaceWindowId, WorkspaceWindow> | null>(null);
  const previewWindowsRef = useRef<Record<WorkspaceWindowId, WorkspaceWindow> | null>(null);
  const pointerDragRef = useRef<{
    tabId: string;
    fromWindowId: WorkspaceWindowId;
    fromIndex: number;
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

  const resolveDropTarget = (
    clientX: number,
    clientY: number,
    windows: Record<WorkspaceWindowId, WorkspaceWindow>,
  ) => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!(element instanceof HTMLElement)) return null;

    const tabElement = element.closest<HTMLElement>('[data-tab-id][data-window-id]');
    if (tabElement?.dataset.windowId && tabElement.dataset.tabId) {
      const targetWindowId = tabElement.dataset.windowId as WorkspaceWindowId;
      const targetWindow = windows[targetWindowId];
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
    const targetWindow = windows[targetWindowId];
    if (!targetWindow) return null;

    return {
      windowId: targetWindowId,
      index: targetWindow.tabs.length,
    };
  };

  const clearPointerDrag = () => {
    pointerDragRef.current = null;
    previewWindowsRef.current = null;
    setPreviewWindows(null);
    setDraggingTabId(null);
    setHeldTabId(null);
  };

  const updatePreview = (clientX: number, clientY: number) => {
    const dragState = pointerDragRef.current;
    if (!dragState) return;

    const baseWindows = previewWindowsRef.current ?? cloneWorkspaceWindows(windowsRef.current);
    const target = resolveDropTarget(clientX, clientY, baseWindows);
    const currentLocation = findTabLocation(baseWindows, dragState.tabId);
    if (!target || !currentLocation) {
      previewWindowsRef.current = baseWindows;
      setPreviewWindows(baseWindows);
      return;
    }

    const samePosition =
      currentLocation.windowId === target.windowId &&
      (
        currentLocation.index === target.index
        || currentLocation.index + 1 === target.index
      );
    const nextWindows = samePosition
      ? baseWindows
      : relocateTabPreview(
        baseWindows,
        currentLocation.windowId,
        dragState.tabId,
        target.windowId,
        target.index,
      );

    previewWindowsRef.current = nextWindows;
    setPreviewWindows(nextWindows);
  };

  const startTabPointerDrag = (
    windowId: WorkspaceWindowId,
    tabId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;
    setHeldTabId(tabId);
    const fromIndex = windowsRef.current[windowId]?.tabs.findIndex((tab) => tab.id === tabId) ?? -1;

    pointerDragRef.current = {
      tabId,
      fromWindowId: windowId,
      fromIndex,
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
      moveEvent.preventDefault();
      updatePreview(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      const dragState = pointerDragRef.current;
      if (!dragState) return;

      if (dragState.dragging) {
        updatePreview(upEvent.clientX, upEvent.clientY);

        const preview = previewWindowsRef.current;
        if (preview) {
          replaceWindows(finalizeTabPreview(preview, dragState.tabId, {
            windowId: dragState.fromWindowId,
            index: dragState.fromIndex,
          }));
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
    previewWindows,
    shouldSuppressTabActivation,
    startTabPointerDrag,
  };
}
