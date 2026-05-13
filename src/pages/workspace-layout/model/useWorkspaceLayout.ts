import type { TabType, WorkspaceWindowId } from './types';
import { useWorkspaceMenus } from './useWorkspaceMenus';
import { useWorkspacePanels } from './useWorkspacePanels';
import { useWorkspaceTabDrag } from './useWorkspaceTabDrag';
import { useWorkspaceTabs } from './useWorkspaceTabs';

export function useWorkspaceLayout() {
  const tabs = useWorkspaceTabs();
  const menus = useWorkspaceMenus();
  const panels = useWorkspacePanels();
  const tabDrag = useWorkspaceTabDrag({
    windowsRef: tabs.windowsRef,
    moveTab: tabs.moveTab,
  });

  const activateTab = (windowId: WorkspaceWindowId, tabId: string) => {
    if (tabDrag.shouldSuppressTabActivation(tabId)) return;
    tabs.activateTab(windowId, tabId);
  };

  const addTab = (windowId: WorkspaceWindowId, type: TabType) => {
    tabs.addTab(windowId, type);
    menus.closeAddMenu();
  };

  return {
    windows: tabs.windows,
    draggingTabId: tabDrag.draggingTabId,
    heldTabId: tabDrag.heldTabId,
    activateTab,
    closeTab: tabs.closeTab,
    addTab,
    startTabPointerDrag: tabDrag.startTabPointerDrag,
    ...menus,
    ...panels,
  };
}
