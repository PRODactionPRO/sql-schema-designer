import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { INITIAL_WINDOWS, createTab } from './catalog';
import { findTabLocation, getNextActiveTabId, relocateTab } from './tab-utils';
import { useWorkspaceMenus } from './useWorkspaceMenus';
import { useWorkspacePanels } from './useWorkspacePanels';
import type {
  TabType,
  WorkspaceWindowId,
} from './types';

export function useWorkspaceLayout() {
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [heldTabId, setHeldTabId] = useState<string | null>(null);
  const windowsRef = useRef(windows);
  const pointerDragRef = useRef<{
    tabId: string;
    fromWindowId: WorkspaceWindowId;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const menus = useWorkspaceMenus();
  const panels = useWorkspacePanels();

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  const activateTab = (windowId: WorkspaceWindowId, tabId: string) => {
    if (suppressClickRef.current === tabId) {
      suppressClickRef.current = null;
      return;
    }

    setWindows((current) => ({
      ...current,
      [windowId]: {
        ...current[windowId],
        activeTabId: tabId,
      },
    }));
  };

  const closeTab = (windowId: WorkspaceWindowId, tabId: string) => {
    setWindows((current) => {
      const source = current[windowId];
      const removedIndex = source.tabs.findIndex((tab) => tab.id === tabId);
      if (removedIndex < 0) return current;

      const nextTabs = source.tabs.filter((tab) => tab.id !== tabId);
      const nextActiveTabId = source.activeTabId === tabId ? getNextActiveTabId(nextTabs, removedIndex) : source.activeTabId;

      return {
        ...current,
        [windowId]: {
          ...source,
          tabs: nextTabs,
          activeTabId: nextActiveTabId,
        },
      };
    });
  };

  const addTab = (windowId: WorkspaceWindowId, type: TabType) => {
    setWindows((current) => {
      const nextTab = createTab(type);
      const target = current[windowId];

      return {
        ...current,
        [windowId]: {
          ...target,
          tabs: [...target.tabs, nextTab],
          activeTabId: nextTab.id,
        },
      };
    });
    menus.closeAddMenu();
  };

  const moveTab = (
    fromWindowId: WorkspaceWindowId,
    tabId: string,
    toWindowId: WorkspaceWindowId,
    targetIndex: number,
  ) => {
    setWindows((current) => {
      const next = relocateTab(current, fromWindowId, tabId, toWindowId, targetIndex);
      windowsRef.current = next;
      return next;
    });
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
    windows,
    draggingTabId,
    heldTabId,
    activateTab,
    closeTab,
    addTab,
    startTabPointerDrag,
    ...menus,
    ...panels,
  };
}
