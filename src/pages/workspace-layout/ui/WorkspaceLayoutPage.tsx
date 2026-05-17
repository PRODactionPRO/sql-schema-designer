import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { useAuthStore } from '@/shared/auth/store';
import { cn } from '@/shared/ui/utils';
import { useWorkspaceGlobalHistoryShortcuts } from '../model/useWorkspaceGlobalHistoryShortcuts';
import { useWorkspaceLayout } from '../model/useWorkspaceLayout';
import { useWorkspaceLayoutPersistence, useWorkspaceLayoutPreference } from '../model/useWorkspaceLayoutPreference';
import { useWorkspaceProjectData } from '../model/useWorkspaceProjectData';
import { ResizeHandle, TopApplicationBar } from './WorkspaceChrome';
import { AddTabMenu, SearchFilterMenu } from './WorkspaceMenus';
import { WorkspacePane } from './WorkspacePane';
import type { WorkspaceSelection, WorkspaceTab, WorkspaceWindowId } from '../model/types';

export function WorkspaceLayoutPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isProjectWorkspace = Boolean(projectId);
  const [selection, setSelection] = useState<WorkspaceSelection | null>(null);

  useEffect(() => {
    if (isProjectWorkspace && !isAuthenticated) {
      navigate('/auth', { replace: true });
    }
  }, [isAuthenticated, isProjectWorkspace, navigate]);

  const {
    activeProject,
    projectLoading,
    projectError,
    saveStatus,
    handleProjectChange,
    canUndoProject,
    canRedoProject,
    undoProject,
    redoProject,
  } = useWorkspaceProjectData({
    projectId,
    enabled: isProjectWorkspace && isAuthenticated,
  });
  const { initialWorkspaceLayout, preferenceLoaded } = useWorkspaceLayoutPreference({
    projectId,
    enabled: isProjectWorkspace && isAuthenticated,
  });

  useWorkspaceGlobalHistoryShortcuts({
    onUndo: undoProject,
    onRedo: redoProject,
  });

  const {
    windows,
    tabHeaderWindows,
    workspaceLayoutState,
    canvasViewports,
    hydrationRevision,
    addMenu,
    draggingTabId,
    heldTabId,
    projectSearchActive,
    projectSearchQuery,
    searchFilterMenu,
    layoutVisibility,
    layoutAnimating,
    addMenuRef,
    searchFilterMenuRef,
    rootGroupRef,
    leftGroupRef,
    centerGroupRef,
    leftPanelRef,
    rightPanelRef,
    behaviorPanelRef,
    panelLayouts,
    catalogGroups,
    activateTab,
    closeTab,
    closeDocumentTabs,
    addTab,
    duplicateTab,
    openDocumentTab,
    updateCanvasViewport,
    openAddMenu,
    commitPanelLayout,
    syncPanelVisibility,
    handleResizeDragging,
    toggleLeftColumn,
    toggleRightColumn,
    toggleBottomPanel,
    toggleCanvasMaximized,
    openProjectSearch,
    closeProjectSearch,
    setProjectSearchQuery,
    toggleSearchFilterMenu,
    startBottomHeaderResize,
    startTabPointerDrag,
  } = useWorkspaceLayout(initialWorkspaceLayout);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable
        || Boolean(target?.closest('.cm-editor'));
      if (isTyping) return;

      const isMod = event.metaKey || event.ctrlKey;
      const isPlainFullscreen = event.code === 'KeyF' && !isMod && !event.altKey && !event.shiftKey;
      const isModBackslash = isMod
        && !event.altKey
        && !event.shiftKey
        && (event.code === 'Backslash' || event.code === 'IntlBackslash' || event.key === '\\');
      if (!isPlainFullscreen && !isModBackslash) return;

      event.preventDefault();
      toggleCanvasMaximized();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [toggleCanvasMaximized]);

  useWorkspaceLayoutPersistence({
    projectId,
    enabled: isProjectWorkspace && isAuthenticated && preferenceLoaded,
    layoutState: workspaceLayoutState,
  });

  if (isProjectWorkspace && !isAuthenticated) {
    return null;
  }

  const renderWindow = (windowId: WorkspaceWindowId, className?: string) => (
    <WorkspacePane
      key={windowId}
      windowState={windows[windowId]}
      headerWindowState={tabHeaderWindows[windowId]}
      project={activeProject}
      projectLoading={projectLoading}
      projectError={projectError}
      saveStatus={saveStatus}
      selection={selection}
      canvasViewports={canvasViewports}
      viewportRestoreKey={hydrationRevision}
      className={className}
      draggingTabId={draggingTabId}
      heldTabId={heldTabId}
      isCanvasMaximized={layoutVisibility.canvasMaximized}
      searchActive={windowId === 'project' && projectSearchActive}
      searchQuery={windowId === 'project' ? projectSearchQuery : ''}
      onActivate={activateTab}
      onCloseSearch={closeProjectSearch}
      onSearchQueryChange={setProjectSearchQuery}
      onCloseTab={closeTab}
      onDuplicateTab={duplicateTab}
      onCollapseLeft={toggleLeftColumn}
      onOpenSearch={windowId === 'project' ? openProjectSearch : undefined}
      onMaximizeCanvas={toggleCanvasMaximized}
      onOpenAddMenu={openAddMenu}
      onResizeHeaderPointerDown={windowId === 'behavior' ? startBottomHeaderResize : undefined}
      onToggleSearchFilterMenu={toggleSearchFilterMenu}
      onStartTabDrag={startTabPointerDrag}
      onProjectChange={handleProjectChange}
      onSelectionChange={setSelection}
      onCloseDocument={closeDocumentTabs}
      onOpenDocument={(documentId, fallback) => {
        const document = activeProject?.documents.find((item) => item.id === documentId);
        const tabType: WorkspaceTab['type'] | undefined = document
          ? document.type === 'idef0'
            ? 'idef0'
            : document.type === 'class-diagram'
            ? 'classDiagram'
            : document.type === 'erd'
            ? 'erDiagram'
            : 'file'
          : fallback?.type;
        const title = document?.name ?? fallback?.title;
        if (!tabType || !title) return;
        openDocumentTab('canvas', tabType, documentId, title);
      }}
      onCanvasViewportChange={updateCanvasViewport}
    />
  );

  return (
    <div
      className={cn(
        'flex h-screen min-h-[720px] flex-col overflow-hidden bg-[#eeeff0] text-[#111827]',
        layoutAnimating && 'workspace-layout-animating',
      )}
    >
      <TopApplicationBar
        bottomVisible={layoutVisibility.bottom}
        leftVisible={layoutVisibility.left}
        rightVisible={layoutVisibility.right}
        onToggleBottom={toggleBottomPanel}
        onToggleLeft={toggleLeftColumn}
        onToggleRight={toggleRightColumn}
        canUndo={canUndoProject}
        canRedo={canRedoProject}
        onUndo={undoProject}
        onRedo={redoProject}
      />
      <main className="min-h-0 flex-1 px-2 pb-2">
        <PanelGroup
          ref={rootGroupRef}
          direction="horizontal"
          className="h-full gap-0"
          onLayout={(layout) => commitPanelLayout('root', layout)}
        >
          <Panel
            ref={leftPanelRef}
            id="left-column"
            order={1}
            defaultSize={panelLayouts.root[0]}
            minSize={layoutVisibility.left ? 10 : 0}
            collapsible
            collapsedSize={0}
            onCollapse={() => syncPanelVisibility('left', false)}
            onExpand={() => syncPanelVisibility('left', true)}
          >
            <PanelGroup
              ref={leftGroupRef}
              direction="vertical"
              className="h-full"
              onLayout={(layout) => commitPanelLayout('left', layout)}
            >
              <Panel id="project-pane" order={1} defaultSize={panelLayouts.left[0]} minSize={24}>
                {renderWindow('project', 'h-full')}
              </Panel>
              <ResizeHandle orientation="vertical" />
              <Panel id="library-pane" order={2} defaultSize={panelLayouts.left[1]} minSize={28}>
                {renderWindow('library', 'h-full')}
              </Panel>
            </PanelGroup>
          </Panel>
          <ResizeHandle
            orientation="horizontal"
            disabled={!layoutVisibility.left && !layoutAnimating}
            hidden={!layoutVisibility.left && !layoutAnimating}
            onDragging={(isDragging) => handleResizeDragging('left', isDragging)}
          />
          <Panel
            id="center-column"
            order={2}
            defaultSize={panelLayouts.root[1]}
            minSize={12}
            collapsible
            collapsedSize={0}
          >
            <PanelGroup
              ref={centerGroupRef}
              id="workspace-layout-center-group"
              direction="vertical"
              className="h-full"
              onLayout={(layout) => commitPanelLayout('center', layout)}
            >
              <Panel id="canvas-pane" order={1} defaultSize={panelLayouts.center[0]} minSize={38}>
                {renderWindow('canvas', 'h-full')}
              </Panel>
              <ResizeHandle
                orientation="vertical"
                disabled={!layoutVisibility.bottom && !layoutAnimating}
                hidden={!layoutVisibility.bottom && !layoutAnimating}
                onDragging={(isDragging) => handleResizeDragging('bottom', isDragging)}
              />
              <Panel
                ref={behaviorPanelRef}
                id="behavior-pane"
                order={2}
                defaultSize={panelLayouts.center[1]}
                minSize={layoutVisibility.bottom ? 19 : 0}
                collapsible
                collapsedSize={0}
                onCollapse={() => syncPanelVisibility('bottom', false)}
                onExpand={() => syncPanelVisibility('bottom', true)}
              >
                {renderWindow('behavior', 'h-full')}
              </Panel>
            </PanelGroup>
          </Panel>
          <ResizeHandle
            orientation="horizontal"
            disabled={!layoutVisibility.right && !layoutAnimating}
            hidden={!layoutVisibility.right && !layoutAnimating}
            onDragging={(isDragging) => handleResizeDragging('right', isDragging)}
          />
          <Panel
            ref={rightPanelRef}
            id="right-column"
            order={3}
            defaultSize={panelLayouts.root[2]}
            minSize={layoutVisibility.right ? 10 : 0}
            collapsible
            collapsedSize={0}
            onCollapse={() => syncPanelVisibility('right', false)}
            onExpand={() => syncPanelVisibility('right', true)}
          >
            {renderWindow('inspector', 'h-full')}
          </Panel>
        </PanelGroup>
      </main>
      {addMenu && typeof document !== 'undefined'
        ? createPortal(
          <AddTabMenu
            groups={catalogGroups}
            menuRef={addMenuRef}
            position={{ left: addMenu.left, top: addMenu.top }}
            onAdd={(type) => addTab(addMenu.windowId, type)}
          />,
          document.body,
        )
        : null}
      {searchFilterMenu && typeof document !== 'undefined'
        ? createPortal(
          <SearchFilterMenu
            groups={catalogGroups}
            menuRef={searchFilterMenuRef}
            position={searchFilterMenu}
          />,
          document.body,
        )
        : null}
    </div>
  );
}
