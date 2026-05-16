import type { TabLocation, WorkspaceTab, WorkspaceWindow, WorkspaceWindowId } from './types';

export function getNextActiveTabId(tabs: WorkspaceTab[], removedIndex: number): string | null {
  if (tabs.length === 0) return null;
  return tabs[Math.min(removedIndex, tabs.length - 1)]?.id ?? tabs[0]?.id ?? null;
}

export function findTabLocation(
  windows: Record<WorkspaceWindowId, WorkspaceWindow>,
  tabId: string,
): TabLocation | null {
  for (const windowId of Object.keys(windows) as WorkspaceWindowId[]) {
    const index = windows[windowId].tabs.findIndex((tab) => tab.id === tabId);
    if (index >= 0) return { windowId, index };
  }

  return null;
}

export function relocateTab(
  current: Record<WorkspaceWindowId, WorkspaceWindow>,
  fromWindowId: WorkspaceWindowId,
  tabId: string,
  toWindowId: WorkspaceWindowId,
  targetIndex: number,
) {
  const source = current[fromWindowId];
  const sourceIndex = source.tabs.findIndex((tab) => tab.id === tabId);
  if (sourceIndex < 0) return current;

  const movingTab = source.tabs[sourceIndex];
  const sourceTabs = source.tabs.filter((tab) => tab.id !== tabId);
  const sameWindow = fromWindowId === toWindowId;
  const rawTargetTabs = sameWindow ? sourceTabs : current[toWindowId].tabs;
  const adjustedIndex = sameWindow && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const boundedIndex = Math.max(0, Math.min(adjustedIndex, rawTargetTabs.length));
  const targetTabs = [...rawTargetTabs];

  targetTabs.splice(boundedIndex, 0, movingTab);

  if (sameWindow) {
    return {
      ...current,
      [fromWindowId]: {
        ...source,
        tabs: targetTabs,
      },
    };
  }

  const target = current[toWindowId];
  const sourceActiveTabId =
    source.activeTabId === tabId ? getNextActiveTabId(sourceTabs, sourceIndex) : source.activeTabId;

  return {
    ...current,
    [fromWindowId]: {
      ...source,
      tabs: sourceTabs,
      activeTabId: sourceActiveTabId,
    },
    [toWindowId]: {
      ...target,
      tabs: targetTabs,
      activeTabId: movingTab.id,
    },
  };
}

export function relocateTabPreview(
  current: Record<WorkspaceWindowId, WorkspaceWindow>,
  fromWindowId: WorkspaceWindowId,
  tabId: string,
  toWindowId: WorkspaceWindowId,
  targetIndex: number,
) {
  const source = current[fromWindowId];
  const sourceIndex = source.tabs.findIndex((tab) => tab.id === tabId);
  if (sourceIndex < 0) return current;

  const movingTab = source.tabs[sourceIndex];
  const sourceTabs = source.tabs.filter((tab) => tab.id !== tabId);
  const sameWindow = fromWindowId === toWindowId;
  const rawTargetTabs = sameWindow ? sourceTabs : current[toWindowId].tabs;
  const adjustedIndex = sameWindow && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const boundedIndex = Math.max(0, Math.min(adjustedIndex, rawTargetTabs.length));
  const targetTabs = [...rawTargetTabs];

  targetTabs.splice(boundedIndex, 0, movingTab);

  if (sameWindow) {
    return {
      ...current,
      [fromWindowId]: {
        ...source,
        tabs: targetTabs,
      },
    };
  }

  return {
    ...current,
    [fromWindowId]: {
      ...source,
      tabs: sourceTabs,
    },
    [toWindowId]: {
      ...current[toWindowId],
      tabs: targetTabs,
    },
  };
}

export function finalizeTabPreview(
  current: Record<WorkspaceWindowId, WorkspaceWindow>,
  tabId: string,
  originalLocation: TabLocation,
) {
  const finalLocation = findTabLocation(current, tabId);
  if (!finalLocation) return current;

  return Object.fromEntries(
    (Object.keys(current) as WorkspaceWindowId[]).map((windowId) => {
      const windowState = current[windowId];
      const hasActiveTab = windowState.activeTabId
        ? windowState.tabs.some((tab) => tab.id === windowState.activeTabId)
        : false;
      const fallbackIndex =
        windowId === originalLocation.windowId
          ? originalLocation.index
          : windowId === finalLocation.windowId
            ? finalLocation.index
            : 0;
      const activeTabId = hasActiveTab
        ? windowState.activeTabId
        : getNextActiveTabId(windowState.tabs, fallbackIndex);

      return [
        windowId,
        {
          ...windowState,
          activeTabId,
        },
      ];
    }),
  ) as Record<WorkspaceWindowId, WorkspaceWindow>;
}
