import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ImperativePanelGroupHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { INITIAL_WINDOWS, createTab, groupCatalogItems } from './catalog';
import { getAddMenuPosition, getSearchFilterMenuPosition } from './floating-position';
import { PANEL_ANIMATION_MS } from './layout-constants';
import { findTabLocation, getNextActiveTabId, relocateTab } from './tab-utils';
import type {
  AddMenuState,
  CollapsiblePanelKey,
  LayoutVisibility,
  SearchFilterMenuState,
  TabType,
  WorkspaceWindowId,
} from './types';

export function useWorkspaceLayout() {
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [heldTabId, setHeldTabId] = useState<string | null>(null);
  const [projectSearchActive, setProjectSearchActive] = useState(false);
  const [searchFilterMenu, setSearchFilterMenu] = useState<SearchFilterMenuState | null>(null);
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>({
    left: true,
    right: true,
    bottom: true,
    canvasMaximized: false,
  });
  const [layoutAnimating, setLayoutAnimating] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const searchFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const windowsRef = useRef(windows);
  const layoutAnimationTimerRef = useRef<number | null>(null);
  const centerGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);
  const behaviorPanelRef = useRef<ImperativePanelHandle | null>(null);
  const resizingPanelRef = useRef<CollapsiblePanelKey | null>(null);
  const pendingPanelVisibilityRef = useRef<Partial<Record<CollapsiblePanelKey, boolean>>>({});
  const pointerDragRef = useRef<{
    tabId: string;
    fromWindowId: WorkspaceWindowId;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const catalogGroups = useMemo(() => groupCatalogItems(), []);

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    if (!addMenu && !searchFilterMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        addMenu &&
        !addMenuRef.current?.contains(target) &&
        !target.closest('[data-add-tab-trigger="true"]')
      ) {
        setAddMenu(null);
      }
      if (
        searchFilterMenu &&
        !searchFilterMenuRef.current?.contains(target) &&
        !target.closest('[data-search-filter-trigger="true"]')
      ) {
        setSearchFilterMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [addMenu, searchFilterMenu]);

  useEffect(() => () => {
    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current);
    }
  }, []);

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
    setAddMenu(null);
  };

  const openAddMenu = (windowId: WorkspaceWindowId, trigger: HTMLElement) => {
    setAddMenu((current) => {
      if (current?.windowId === windowId) return null;
      return {
        windowId,
        ...getAddMenuPosition(trigger),
      };
    });
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

  const applyLayoutVisibility = (next: LayoutVisibility) => {
    setLayoutVisibility(next);
    setLayoutAnimating(true);

    window.requestAnimationFrame(() => {
      if (next.left) {
        leftPanelRef.current?.expand(13);
      } else {
        leftPanelRef.current?.collapse();
      }

      if (next.right) {
        rightPanelRef.current?.expand(18);
      } else {
        rightPanelRef.current?.collapse();
      }

      if (next.bottom) {
        behaviorPanelRef.current?.expand(19);
      } else {
        behaviorPanelRef.current?.collapse();
      }
    });

    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current);
    }
    layoutAnimationTimerRef.current = window.setTimeout(() => {
      setLayoutAnimating(false);
      layoutAnimationTimerRef.current = null;
    }, PANEL_ANIMATION_MS);
  };

  const getPanelVisibility = (key: CollapsiblePanelKey) => {
    const panel =
      key === 'left'
        ? leftPanelRef.current
        : key === 'right'
          ? rightPanelRef.current
          : behaviorPanelRef.current;

    return panel ? !panel.isCollapsed() : layoutVisibility[key];
  };

  const syncPanelVisibility = (key: CollapsiblePanelKey, visible: boolean) => {
    if (resizingPanelRef.current === key) {
      pendingPanelVisibilityRef.current[key] = visible;
      return;
    }

    setLayoutVisibility((current) => (
      current[key] === visible
        ? current
        : {
          ...current,
          [key]: visible,
        }
    ));
  };

  const handleResizeDragging = (key: CollapsiblePanelKey, isDragging: boolean) => {
    if (isDragging) {
      resizingPanelRef.current = key;
      pendingPanelVisibilityRef.current[key] = layoutVisibility[key];
      return;
    }

    resizingPanelRef.current = null;
    pendingPanelVisibilityRef.current[key] = getPanelVisibility(key);
    syncPanelVisibility(key, pendingPanelVisibilityRef.current[key] ?? layoutVisibility[key]);
    delete pendingPanelVisibilityRef.current[key];
  };

  const toggleLeftColumn = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      left: !layoutVisibility.left,
      canvasMaximized: false,
    });
  };

  const toggleRightColumn = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      right: !layoutVisibility.right,
      canvasMaximized: false,
    });
  };

  const toggleBottomPanel = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      bottom: !layoutVisibility.bottom,
      canvasMaximized: false,
    });
  };

  const toggleCanvasMaximized = () => {
    applyLayoutVisibility(
      layoutVisibility.canvasMaximized
        ? { left: true, right: true, bottom: true, canvasMaximized: false }
        : { left: false, right: false, bottom: false, canvasMaximized: true },
    );
  };

  const openProjectSearch = () => {
    setProjectSearchActive(true);
    setSearchFilterMenu(null);
  };

  const closeProjectSearch = () => {
    setProjectSearchActive(false);
    setSearchFilterMenu(null);
  };

  const toggleSearchFilterMenu = (trigger: HTMLElement) => {
    setSearchFilterMenu((current) => (
      current ? null : getSearchFilterMenuPosition(trigger)
    ));
  };

  const startBottomHeaderResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !layoutVisibility.bottom) return;

    const target = event.target as HTMLElement;
    if (target.closest('[data-tab-id], button')) return;

    const groupElement = document.getElementById('workspace-layout-center-group');
    const startLayout = centerGroupRef.current?.getLayout();
    if (!groupElement || !startLayout || startLayout.length < 2) return;

    event.preventDefault();

    const groupRect = groupElement.getBoundingClientRect();
    const startY = event.clientY;
    const startBottomSize = startLayout[1] ?? 30;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaPercent = ((startY - moveEvent.clientY) / groupRect.height) * 100;
      const nextBottomSize = Math.max(19, Math.min(68, startBottomSize + deltaPercent));
      centerGroupRef.current?.setLayout([100 - nextBottomSize, nextBottomSize]);
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
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
    addMenu,
    draggingTabId,
    heldTabId,
    projectSearchActive,
    searchFilterMenu,
    layoutVisibility,
    layoutAnimating,
    addMenuRef,
    searchFilterMenuRef,
    centerGroupRef,
    leftPanelRef,
    rightPanelRef,
    behaviorPanelRef,
    catalogGroups,
    activateTab,
    closeTab,
    addTab,
    openAddMenu,
    syncPanelVisibility,
    handleResizeDragging,
    toggleLeftColumn,
    toggleRightColumn,
    toggleBottomPanel,
    toggleCanvasMaximized,
    openProjectSearch,
    closeProjectSearch,
    toggleSearchFilterMenu,
    startBottomHeaderResize,
    startTabPointerDrag,
  };
}
