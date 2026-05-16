import { useEffect, useRef, useState } from 'react';
import { INITIAL_WINDOWS, createTab } from './catalog';
import { getNextActiveTabId, relocateTab } from './tab-utils';
import type { TabType, WorkspaceWindowId } from './types';

export function useWorkspaceTabs() {
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const windowsRef = useRef(windows);

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  const activateTab = (windowId: WorkspaceWindowId, tabId: string) => {
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

  return {
    windows,
    windowsRef,
    activateTab,
    closeTab,
    addTab,
    moveTab,
  };
}
