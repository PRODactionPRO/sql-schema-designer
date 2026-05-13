import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  PanelBottom,
  PanelBottomClose,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Sparkles,
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@/shared/ui/utils';
import { useWorkspaceLayout } from '../model/useWorkspaceLayout';
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

function TopApplicationBar({
  bottomVisible,
  leftVisible,
  rightVisible,
  onToggleBottom,
  onToggleLeft,
  onToggleRight,
}: {
  bottomVisible: boolean;
  leftVisible: boolean;
  rightVisible: boolean;
  onToggleBottom: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between px-3 text-sm">
      <div className="flex items-center gap-7">
        <div className="flex h-8 w-12 items-center justify-center text-[26px] font-semibold leading-none text-[#2f3338]">
          {'{A}'}
        </div>
        <nav className="flex items-center gap-5">
          {['File', 'Edit', 'View', 'Object', 'Object', 'Object'].map((item, index) => (
            <button
              key={`${item}-${index}`}
              type="button"
              className="text-xs font-medium leading-4 text-[#8a919c] underline-offset-2 transition-colors hover:text-black hover:underline"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <TopIcon label="Left panel" active={!leftVisible} onClick={onToggleLeft}>
          {leftVisible ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </TopIcon>
        <TopIcon label="Bottom panel" active={!bottomVisible} onClick={onToggleBottom}>
          {bottomVisible ? <PanelBottom className="size-4" /> : <PanelBottomClose className="size-4" />}
        </TopIcon>
        <TopIcon label="Right panel" active={!rightVisible} onClick={onToggleRight}>
          {rightVisible ? <PanelRight className="size-4" /> : <PanelRightClose className="size-4" />}
        </TopIcon>
        <TopIcon label="AI mode" active>
          <Sparkles className="size-4" />
        </TopIcon>
        <div className="ml-1 size-8 overflow-hidden rounded-full border border-white bg-gradient-to-br from-slate-200 via-slate-100 to-slate-400 shadow-sm">
          <div className="flex size-full items-end justify-center text-[10px] font-semibold text-slate-600">MP</div>
        </div>
      </div>
    </header>
  );
}

function TopIcon({
  label,
  active,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-lg transition-colors',
        active ? 'bg-[#030213] text-white' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800',
      )}
    >
      {children}
    </button>
  );
}

function ResizeHandle({
  orientation,
  onDragging,
}: {
  orientation: 'horizontal' | 'vertical';
  onDragging?: (isDragging: boolean) => void;
}) {
  return (
    <PanelResizeHandle
      onDragging={onDragging}
      className={cn(
        'group relative shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400',
        orientation === 'horizontal' ? 'w-2.5 cursor-col-resize px-[4px]' : 'h-2.5 cursor-row-resize py-[4px]',
      )}
    >
      <span
        className={cn(
          'block rounded-full bg-transparent transition-colors group-hover:bg-slate-300 group-data-[resize-handle-active]:bg-slate-400',
          orientation === 'horizontal' ? 'h-full w-px' : 'h-px w-full',
        )}
      />
    </PanelResizeHandle>
  );
}
