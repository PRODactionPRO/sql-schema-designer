import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Maximize2,
  Menu,
  Plus,
  Search,
} from 'lucide-react';
import type {
  WorkspaceCanvasViewport,
  WorkspaceCanvasViewportId,
  WorkspaceSelection,
  WorkspaceWindow,
  WorkspaceWindowId,
} from '../model/types';
import { IconButton } from '@/shared/ui/icon-button';
import { cn } from '@/shared/ui/utils';
import type { ProjectData } from '@/shared/types/project';
import { DraggableTab, PanelSearchBar, ProjectTitleHeader } from './WorkspacePaneHeaders';
import { EmptyPane, TabContent } from './WorkspaceTabContent';

export function WorkspacePane({
  windowState,
  headerWindowState = windowState,
  project,
  projectLoading = false,
  projectError = null,
  selection,
  canvasViewports,
  viewportRestoreKey,
  className,
  draggingTabId,
  heldTabId,
  isCanvasMaximized,
  searchActive,
  onActivate,
  onCloseSearch,
  onCloseTab,
  onCollapseLeft,
  onMaximizeCanvas,
  onOpenSearch,
  onOpenAddMenu,
  onResizeHeaderPointerDown,
  onToggleSearchFilterMenu,
  onStartTabDrag,
  onProjectChange,
  onSelectionChange,
  onCanvasViewportChange,
}: {
  windowState: WorkspaceWindow;
  headerWindowState?: WorkspaceWindow;
  project?: ProjectData;
  projectLoading?: boolean;
  projectError?: string | null;
  selection: WorkspaceSelection | null;
  canvasViewports: Partial<Record<WorkspaceCanvasViewportId, WorkspaceCanvasViewport>>;
  viewportRestoreKey: string | number;
  className?: string;
  draggingTabId: string | null;
  heldTabId: string | null;
  isCanvasMaximized: boolean;
  searchActive: boolean;
  onActivate: (windowId: WorkspaceWindowId, tabId: string) => void;
  onCloseSearch: () => void;
  onCloseTab: (windowId: WorkspaceWindowId, tabId: string) => void;
  onCollapseLeft: () => void;
  onMaximizeCanvas: () => void;
  onOpenSearch?: () => void;
  onOpenAddMenu: (windowId: WorkspaceWindowId, trigger: HTMLElement) => void;
  onResizeHeaderPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onToggleSearchFilterMenu: (trigger: HTMLElement) => void;
  onStartTabDrag: (windowId: WorkspaceWindowId, tabId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onProjectChange: (project: ProjectData) => void;
  onSelectionChange: (selection: WorkspaceSelection | null) => void;
  onCanvasViewportChange: (viewId: WorkspaceCanvasViewportId, viewport: WorkspaceCanvasViewport) => void;
}) {
  const activeTab = windowState.tabs.find((tab) => tab.id === windowState.activeTabId) ?? windowState.tabs[0] ?? null;

  return (
    <section
      data-testid={`workspace-pane-${windowState.id}`}
      data-window-id={windowState.id}
      className={cn('flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-white bg-[#f8f8f9]', className)}
    >
      {windowState.id === 'project' ? (
        <ProjectTitleHeader
          projectName={project?.name ?? 'Data Design Schema'}
          status={projectLoading ? 'Loading project' : projectError ? 'Project unavailable' : 'Saved'}
          onCollapseLeft={onCollapseLeft}
        />
      ) : null}
      <div
        className={cn(
          'flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[#e6e7e9] px-2',
          onResizeHeaderPointerDown && 'cursor-row-resize',
        )}
        onPointerDown={onResizeHeaderPointerDown}
      >
        {searchActive ? (
          <PanelSearchBar
            onClose={onCloseSearch}
            onToggleFilters={onToggleSearchFilterMenu}
          />
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center py-2">
              <div className="workspace-tabs-scroll flex min-w-0 max-w-full shrink items-center gap-1 overflow-x-auto">
                {headerWindowState.tabs.map((tab) => (
                  <DraggableTab
                    key={tab.id}
                    tab={tab}
                    windowId={headerWindowState.id}
                    active={tab.id === activeTab?.id}
                    dragging={draggingTabId === tab.id}
                    held={heldTabId === tab.id}
                    onActivate={onActivate}
                    onClose={onCloseTab}
                    onStartDrag={onStartTabDrag}
                  />
                ))}
              </div>
              <button
                type="button"
                data-testid={`add-tab-${windowState.id}`}
                data-add-tab-trigger="true"
                aria-label="Add tab"
                className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-[#eeeff0] hover:text-slate-950"
                onClick={(event) => onOpenAddMenu(windowState.id, event.currentTarget)}
              >
                <Plus className="size-4" />
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {windowState.id === 'canvas' ? (
                <IconButton label={isCanvasMaximized ? 'Restore canvas' : 'Maximize'} active={isCanvasMaximized} onClick={onMaximizeCanvas}>
                  <Maximize2 className="size-4" />
                </IconButton>
              ) : null}
              {windowState.id === 'project' && onOpenSearch ? (
                <IconButton label="Search" onClick={onOpenSearch}>
                  <Search className="size-4" />
                </IconButton>
              ) : null}
              <IconButton label="Menu">
                <Menu className="size-4" />
              </IconButton>
            </div>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab ? (
          <TabContent
            tab={activeTab}
            windowId={windowState.id}
            project={project}
            projectLoading={projectLoading}
            projectError={projectError}
            selection={selection}
            canvasViewports={canvasViewports}
            viewportRestoreKey={viewportRestoreKey}
            onProjectChange={onProjectChange}
            onSelectionChange={onSelectionChange}
            onCanvasViewportChange={onCanvasViewportChange}
          />
        ) : <EmptyPane />}
      </div>
    </section>
  );
}
