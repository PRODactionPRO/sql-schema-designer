import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  TabType,
  WorkspaceCanvasViewport,
  WorkspaceCanvasViewportId,
  WorkspaceLayoutSnapshot,
  WorkspaceWindowId,
} from './types';
import { useWorkspaceMenus } from './useWorkspaceMenus';
import { useWorkspacePanels } from './useWorkspacePanels';
import { useWorkspaceTabDrag } from './useWorkspaceTabDrag';
import { useWorkspaceTabs } from './useWorkspaceTabs';
import { normalizeWorkspaceLayoutSnapshot } from './workspace-layout-preferences';

export function useWorkspaceLayout(initialLayoutSnapshot?: WorkspaceLayoutSnapshot | null) {
  const normalizedInitialLayout = useMemo(
    () => normalizeWorkspaceLayoutSnapshot(initialLayoutSnapshot),
    [initialLayoutSnapshot],
  );
  const [canvasViewports, setCanvasViewports] = useState(normalizedInitialLayout.canvasViewports);
  const [hydrationRevision, setHydrationRevision] = useState(0);
  const appliedInitialLayoutRef = useRef<WorkspaceLayoutSnapshot | null>(initialLayoutSnapshot ?? null);
  const tabs = useWorkspaceTabs(normalizedInitialLayout.windows);
  const menus = useWorkspaceMenus();
  const panels = useWorkspacePanels({
    initialVisibility: normalizedInitialLayout.layoutVisibility,
    initialPanelLayouts: normalizedInitialLayout.panelLayouts,
  });
  const tabDrag = useWorkspaceTabDrag({
    windowsRef: tabs.windowsRef,
    replaceWindows: tabs.replaceWindows,
  });

  useEffect(() => {
    if (!initialLayoutSnapshot || appliedInitialLayoutRef.current === initialLayoutSnapshot) return;

    const next = normalizeWorkspaceLayoutSnapshot(initialLayoutSnapshot);
    appliedInitialLayoutRef.current = initialLayoutSnapshot;
    setCanvasViewports(next.canvasViewports);
    setHydrationRevision((current) => current + 1);
  }, [initialLayoutSnapshot]);

  const activateTab = (windowId: WorkspaceWindowId, tabId: string) => {
    if (tabDrag.shouldSuppressTabActivation(tabId)) return;
    tabs.activateTab(windowId, tabId);
  };

  const addTab = (windowId: WorkspaceWindowId, type: TabType) => {
    tabs.addTab(windowId, type);
    menus.closeAddMenu();
  };

  const updateCanvasViewport = (
    viewId: WorkspaceCanvasViewportId,
    viewport: WorkspaceCanvasViewport,
  ) => {
    setCanvasViewports((current) => ({
      ...current,
      [viewId]: viewport,
    }));
  };

  const workspaceLayoutState = useMemo<WorkspaceLayoutSnapshot>(() => ({
    version: 1,
    windows: tabs.windows,
    layoutVisibility: panels.layoutVisibility,
    panelLayouts: panels.panelLayouts,
    canvasViewports,
  }), [canvasViewports, panels.layoutVisibility, panels.panelLayouts, tabs.windows]);

  return {
    windows: tabs.windows,
    tabHeaderWindows: tabDrag.previewWindows ?? tabs.windows,
    workspaceLayoutState,
    canvasViewports,
    hydrationRevision,
    draggingTabId: tabDrag.draggingTabId,
    heldTabId: tabDrag.heldTabId,
    activateTab,
    closeTab: tabs.closeTab,
    addTab,
    updateCanvasViewport,
    startTabPointerDrag: tabDrag.startTabPointerDrag,
    ...menus,
    ...panels,
  };
}
