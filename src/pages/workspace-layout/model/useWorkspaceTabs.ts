import { useEffect, useRef, useState } from 'react';
import { INITIAL_WINDOWS, createTab } from './catalog';
import { getNextActiveTabId, relocateTab } from './tab-utils';
import type { TabType, WorkspaceWindow, WorkspaceWindowId } from './types';
import { cloneWorkspaceWindows } from './workspace-layout-preferences';

export function useWorkspaceTabs(initialWindows?: Record<WorkspaceWindowId, WorkspaceWindow> | null) {
  const [windows, setWindows] = useState(() => cloneWorkspaceWindows(initialWindows ?? INITIAL_WINDOWS));
  const windowsRef = useRef(windows);
  const appliedInitialWindowsRef = useRef<Record<WorkspaceWindowId, WorkspaceWindow> | null>(initialWindows ?? null);

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    if (!initialWindows || appliedInitialWindowsRef.current === initialWindows) return;

    const nextWindows = cloneWorkspaceWindows(initialWindows);
    appliedInitialWindowsRef.current = initialWindows;
    windowsRef.current = nextWindows;
    setWindows(nextWindows);
  }, [initialWindows]);

  const commitWindows = (
    updater: Record<WorkspaceWindowId, WorkspaceWindow>
      | ((current: Record<WorkspaceWindowId, WorkspaceWindow>) => Record<WorkspaceWindowId, WorkspaceWindow>),
  ) => {
    setWindows((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      windowsRef.current = next;
      return next;
    });
  };

  const activateTab = (windowId: WorkspaceWindowId, tabId: string) => {
    commitWindows((current) => ({
      ...current,
      [windowId]: {
        ...current[windowId],
        activeTabId: tabId,
      },
    }));
  };

  const closeTab = (windowId: WorkspaceWindowId, tabId: string) => {
    commitWindows((current) => {
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
    commitWindows((current) => {
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

  const openDocumentTab = (windowId: WorkspaceWindowId, type: TabType, documentId: string, title: string) => {
    commitWindows((current) => {
      const target = current[windowId];
      const existing = target.tabs.find((tab) => tab.documentId === documentId);
      if (existing) {
        return {
          ...current,
          [windowId]: {
            ...target,
            activeTabId: existing.id,
          },
        };
      }

      const nextTab = createTab(type, `${type}-${documentId}`, { documentId, title });

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

  const closeDocumentTabs = (documentId: string) => {
    commitWindows((current) => {
      let changed = false;
      const nextWindows = { ...current };

      for (const windowId of Object.keys(current) as WorkspaceWindowId[]) {
        const source = current[windowId];
        const removedIndex = source.tabs.findIndex((tab) => tab.documentId === documentId);
        if (removedIndex < 0) continue;

        changed = true;
        const activeTabRemoved = source.tabs.some((tab) => tab.id === source.activeTabId && tab.documentId === documentId);
        const nextTabs = source.tabs.filter((tab) => tab.documentId !== documentId);
        nextWindows[windowId] = {
          ...source,
          tabs: nextTabs,
          activeTabId: activeTabRemoved ? getNextActiveTabId(nextTabs, removedIndex) : source.activeTabId,
        };
      }

      return changed ? nextWindows : current;
    });
  };

  const replaceWindows = (nextWindows: Record<WorkspaceWindowId, WorkspaceWindow>) => {
    commitWindows(cloneWorkspaceWindows(nextWindows));
  };

  const moveTab = (
    fromWindowId: WorkspaceWindowId,
    tabId: string,
    toWindowId: WorkspaceWindowId,
    targetIndex: number,
  ) => {
    commitWindows((current) => relocateTab(current, fromWindowId, tabId, toWindowId, targetIndex));
  };

  return {
    windows,
    windowsRef,
    activateTab,
    closeTab,
    addTab,
    openDocumentTab,
    closeDocumentTabs,
    moveTab,
    replaceWindows,
  };
}
