import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  Copy,
  PanelLeftClose,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { ContextMenu } from '@/shared/ui/ContextMenu';
import { IconButton } from '@/shared/ui/icon-button';
import { useContextMenu } from '@/shared/ui/useContextMenu';
import { cn } from '@/shared/ui/utils';
import { CATALOG_DISPLAY_BY_TYPE } from '../model/catalog-icons';
import type { WorkspaceTab, WorkspaceWindowId } from '../model/types';

export function ProjectTitleHeader({
  projectName,
  status,
  onCollapseLeft,
}: {
  projectName: string;
  status: string;
  onCollapseLeft: () => void;
}) {
  return (
    <div className="relative flex h-[70px] shrink-0 items-center border-b border-[#e6e7e9] px-5">
      <div className="min-w-0 pr-10">
        <h1 className="truncate text-base font-medium leading-4 text-black">{projectName}</h1>
        <p className="mt-1 text-[10px] leading-4 text-[#b2b8be]">{status}</p>
      </div>
      <div className="absolute right-4 top-4">
        <IconButton label="Collapse left panel" onClick={onCollapseLeft}>
          <PanelLeftClose className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}

export function PanelSearchBar({
  query,
  onQueryChange,
  onClose,
  onToggleFilters,
}: {
  query: string;
  onQueryChange: (query: string) => void;
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
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
          }}
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

export function DraggableTab({
  tab,
  windowId,
  active,
  dragging,
  held,
  showIcon = false,
  onActivate,
  onClose,
  onDuplicate,
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
  onDuplicate: (windowId: WorkspaceWindowId, tabId: string) => void;
  onStartDrag: (windowId: WorkspaceWindowId, tabId: string, event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const catalogItem = showIcon ? CATALOG_DISPLAY_BY_TYPE.get(tab.type) : null;
  const contextMenu = useContextMenu();
  const [closeVisible, setCloseVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const highlighted = active || dragging || held;
  const tabTextClassName = 'text-[12px] font-medium leading-4';

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

  const openTabContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    contextMenu.openContextMenu(event, [
      {
        id: 'duplicate-tab',
        label: 'Duplicate',
        icon: <Copy className="size-4" />,
        onSelect: () => onDuplicate(windowId, tab.id),
      },
      {
        id: 'close-tab',
        label: 'Close',
        icon: <X className="size-4" />,
        onSelect: () => onClose(windowId, tab.id),
      },
    ], { minWidth: 180 });
  };

  return (
    <>
      <div
        data-testid={`workspace-tab-${tab.id}`}
        data-tab-id={tab.id}
        data-window-id={windowId}
        data-tab-type={tab.type}
        className="relative shrink-0 select-none touch-none"
        onContextMenu={openTabContextMenu}
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
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          onStartDrag(windowId, tab.id, event);
        }}
      >
        <div
          className={cn(
            'group flex h-7 max-w-[170px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium leading-4 transition-colors',
            highlighted ? 'bg-[#eeeff0] text-[#111827]' : 'text-[#8a919c] hover:bg-[#eeeff0]/70 hover:text-[#111827]',
          )}
        >
          <button
            type="button"
            className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-left', tabTextClassName)}
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
      <ContextMenu menu={contextMenu.menu} onClose={contextMenu.closeContextMenu} />
    </>
  );
}
