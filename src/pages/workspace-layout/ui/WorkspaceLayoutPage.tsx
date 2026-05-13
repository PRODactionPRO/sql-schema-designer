import { createPortal } from 'react-dom';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { cn } from '@/shared/ui/utils';
import { useWorkspaceLayout } from '../model/useWorkspaceLayout';
import { ResizeHandle, TopApplicationBar } from './WorkspaceChrome';
import { AddTabMenu, SearchFilterMenu } from './WorkspaceMenus';
import { WorkspacePane } from './WorkspacePane';
import type { WorkspaceWindowId } from '../model/types';

export function WorkspaceLayoutPage() {
  const {
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
  } = useWorkspaceLayout();

  const renderWindow = (windowId: WorkspaceWindowId, className?: string) => (
    <WorkspacePane
      key={windowId}
      windowState={windows[windowId]}
      className={className}
      draggingTabId={draggingTabId}
      heldTabId={heldTabId}
      isCanvasMaximized={layoutVisibility.canvasMaximized}
      searchActive={windowId === 'project' && projectSearchActive}
      onActivate={activateTab}
      onCloseSearch={closeProjectSearch}
      onCloseTab={closeTab}
      onCollapseLeft={toggleLeftColumn}
      onOpenSearch={windowId === 'project' ? openProjectSearch : undefined}
      onMaximizeCanvas={toggleCanvasMaximized}
      onOpenAddMenu={openAddMenu}
      onResizeHeaderPointerDown={windowId === 'behavior' ? startBottomHeaderResize : undefined}
      onToggleSearchFilterMenu={toggleSearchFilterMenu}
      onStartTabDrag={startTabPointerDrag}
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
      />
      <main className="min-h-0 flex-1 px-2 pb-2">
        <PanelGroup direction="horizontal" className="h-full gap-0">
          <Panel
            ref={leftPanelRef}
            id="left-column"
            order={1}
            defaultSize={18.7}
            minSize={layoutVisibility.left ? 13 : 0}
            maxSize={32}
            collapsible
            collapsedSize={0}
            onCollapse={() => syncPanelVisibility('left', false)}
            onExpand={() => syncPanelVisibility('left', true)}
          >
            <PanelGroup direction="vertical" className="h-full">
              <Panel id="project-pane" order={1} defaultSize={47} minSize={24}>
                {renderWindow('project', 'h-full')}
              </Panel>
              <ResizeHandle orientation="vertical" />
              <Panel id="library-pane" order={2} minSize={28}>
                {renderWindow('library', 'h-full')}
              </Panel>
            </PanelGroup>
          </Panel>
          {layoutVisibility.left || layoutAnimating ? (
            <ResizeHandle
              orientation="horizontal"
              onDragging={(isDragging) => handleResizeDragging('left', isDragging)}
            />
          ) : null}
          <Panel id="center-column" order={2} defaultSize={55.5} minSize={34}>
            <PanelGroup
              ref={centerGroupRef}
              id="workspace-layout-center-group"
              direction="vertical"
              className="h-full"
            >
              <Panel id="canvas-pane" order={1} defaultSize={69.8} minSize={38}>
                {renderWindow('canvas', 'h-full')}
              </Panel>
              {layoutVisibility.bottom || layoutAnimating ? (
                <ResizeHandle
                  orientation="vertical"
                  onDragging={(isDragging) => handleResizeDragging('bottom', isDragging)}
                />
              ) : null}
              <Panel
                ref={behaviorPanelRef}
                id="behavior-pane"
                order={2}
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
          {layoutVisibility.right || layoutAnimating ? (
            <ResizeHandle
              orientation="horizontal"
              onDragging={(isDragging) => handleResizeDragging('right', isDragging)}
            />
          ) : null}
          <Panel
            ref={rightPanelRef}
            id="right-column"
            order={3}
            defaultSize={25.8}
            minSize={layoutVisibility.right ? 18 : 0}
            maxSize={42}
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
