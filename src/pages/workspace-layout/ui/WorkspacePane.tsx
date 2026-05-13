import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Maximize2,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { CATALOG_DISPLAY_BY_TYPE } from '../model/catalog-icons';
import type { WorkspaceTab, WorkspaceWindow, WorkspaceWindowId } from '../model/types';
import { IconButton } from '@/shared/ui/icon-button';
import { cn } from '@/shared/ui/utils';
import { EmptyPane, TabContent } from './WorkspaceTabContent';

export function WorkspacePane({
  windowState,
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
}: {
  windowState: WorkspaceWindow;
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
}) {
  const activeTab = windowState.tabs.find((tab) => tab.id === windowState.activeTabId) ?? windowState.tabs[0] ?? null;

  return (
    <section
      data-testid={`workspace-pane-${windowState.id}`}
      data-window-id={windowState.id}
      className={cn('flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-white bg-[#f8f8f9]', className)}
    >
      {windowState.id === 'project' ? <ProjectTitleHeader onCollapseLeft={onCollapseLeft} /> : null}
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
                {windowState.tabs.map((tab) => (
                  <DraggableTab
                    key={tab.id}
                    tab={tab}
                    windowId={windowState.id}
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
        {activeTab ? <TabContent tab={activeTab} windowId={windowState.id} /> : <EmptyPane />}
      </div>
    </section>
  );
}

function ProjectTitleHeader({ onCollapseLeft }: { onCollapseLeft: () => void }) {
  return (
    <div className="relative flex h-[70px] shrink-0 items-center border-b border-[#e6e7e9] px-5">
      <div className="min-w-0 pr-10">
        <h1 className="truncate text-base font-medium leading-4 text-black">Data Design Schema</h1>
        <p className="mt-1 text-[10px] leading-4 text-[#b2b8be]">Saved</p>
      </div>
      <div className="absolute right-4 top-4">
        <IconButton label="Collapse left panel" onClick={onCollapseLeft}>
          <PanelLeftClose className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}

function PanelSearchBar({
  onClose,
  onToggleFilters,
}: {
  onClose: () => void;
  onToggleFilters: (trigger: HTMLElement) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md bg-[#eeeff0] px-2 text-[#8a919c]">
        <Search className="size-4 shrink-0" />
        <input
          ref={inputRef}
          aria-label="Search workspace"
          className="min-w-0 flex-1 bg-transparent text-sm font-normal text-slate-800 outline-none placeholder:text-[#8a919c]"
          placeholder="Find..."
        />
      </div>
      <button
        type="button"
        data-search-filter-trigger="true"
        aria-label="Search filters"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-[#eeeff0] hover:text-slate-950"
        onClick={(event) => onToggleFilters(event.currentTarget)}
      >
        <SlidersHorizontal className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Close search"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-[#eeeff0]"
        onClick={onClose}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function DraggableTab({
  tab,
  windowId,
  active,
  dragging,
  held,
  showIcon = false,
  onActivate,
  onClose,
  onStartDrag,
}: {
  tab: WorkspaceTab;
  windowId: WorkspaceWindowId;
  active: boolean;
  dragging: boolean;
  held: boolean;
  showIcon?: boolean;
  onActivate: (windowId: WorkspaceWindowId, tabId: string) => void;
  onClose: (windowId: WorkspaceWindowId, tabId: string) => void;
  onStartDrag: (windowId: WorkspaceWindowId, tabId: string, event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const catalogItem = showIcon ? CATALOG_DISPLAY_BY_TYPE.get(tab.type) : null;
  const [closeVisible, setCloseVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const highlighted = active || dragging || held;

  useEffect(() => () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (dragging || held) {
      setCloseVisible(false);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }
  }, [dragging, held]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  return (
    <div
      data-testid={`workspace-tab-${tab.id}`}
      data-tab-id={tab.id}
      data-window-id={windowId}
      data-tab-type={tab.type}
      className={cn(
        'relative shrink-0 select-none touch-none',
      )}
      onPointerEnter={() => {
        if (dragging || held) return;
        clearCloseTimer();
        closeTimerRef.current = window.setTimeout(() => {
          setCloseVisible(true);
          closeTimerRef.current = null;
        }, 3000);
      }}
      onPointerLeave={() => {
        clearCloseTimer();
        setCloseVisible(false);
      }}
      onPointerDown={(event) => onStartDrag(windowId, tab.id, event)}
    >
      <div
        className={cn(
          'group flex h-7 max-w-[170px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium leading-4 transition-colors',
          highlighted ? 'bg-[#eeeff0] text-[#111827]' : 'text-[#8a919c] hover:bg-[#eeeff0]/70 hover:text-[#111827]',
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => onActivate(windowId, tab.id)}
        >
          {catalogItem ? <span className="shrink-0 text-slate-400">{catalogItem.icon}</span> : null}
          <span className="truncate">{tab.title}</span>
        </button>
        <button
          type="button"
          aria-label={`Close ${tab.title}`}
          className={cn(
            'ml-0.5 size-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700',
            closeVisible && !dragging && !held ? 'flex' : 'hidden',
          )}
          onClick={(event) => {
            event.stopPropagation();
            onClose(windowId, tab.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}
