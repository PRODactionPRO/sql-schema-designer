import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUp,
  Blocks,
  Bot,
  Braces,
  CheckCircle2,
  Check,
  Code2,
  Database,
  FileText,
  GitCompare,
  Layers3,
  Menu,
  Mic,
  Network,
  PanelBottom,
  PanelBottomClose,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Workflow,
  X,
  Maximize2,
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { ImperativePanelGroupHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { CanvasToolbar } from '@/pages/editor/ui/CanvasToolbar';
import { cn } from '@/shared/ui/utils';

type WorkspaceWindowId = 'project' | 'library' | 'canvas' | 'behavior' | 'inspector';

type TabType =
  | 'file'
  | 'assets'
  | 'domains'
  | 'entities'
  | 'actions'
  | 'schemas'
  | 'erDiagram'
  | 'classDiagram'
  | 'dependencyGraph'
  | 'lifecycle'
  | 'impact'
  | 'process'
  | 'functions'
  | 'events'
  | 'scenario'
  | 'trace'
  | 'tables'
  | 'properties'
  | 'validation'
  | 'history'
  | 'permissions'
  | 'aiAssistant'
  | 'codeMode'
  | 'apiContract'
  | 'dataSamples';

interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
}

interface WorkspaceWindow {
  id: WorkspaceWindowId;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

interface TabCatalogItem {
  type: TabType;
  title: string;
  group: string;
  icon: ReactNode;
}

interface AddMenuState {
  windowId: WorkspaceWindowId;
  left: number;
  top: number;
}

interface SearchFilterMenuState {
  left: number;
  top: number;
}

interface LayoutVisibility {
  left: boolean;
  right: boolean;
  bottom: boolean;
  canvasMaximized: boolean;
}

type CollapsiblePanelKey = keyof Pick<LayoutVisibility, 'left' | 'right' | 'bottom'>;

interface TabLocation {
  windowId: WorkspaceWindowId;
  index: number;
}

const ADD_MENU_WIDTH = 280;
const ADD_MENU_MAX_HEIGHT = 420;
const SEARCH_FILTER_MENU_WIDTH = 250;
const SEARCH_FILTER_MENU_MAX_HEIGHT = 430;
const PANEL_ANIMATION_MS = 260;

const CATALOG: TabCatalogItem[] = [
  { type: 'file', title: 'File', group: 'Project', icon: <FileText className="size-3.5" /> },
  { type: 'assets', title: 'Assets', group: 'Project', icon: <Layers3 className="size-3.5" /> },
  { type: 'domains', title: 'Domains', group: 'Semantic Core', icon: <Blocks className="size-3.5" /> },
  { type: 'entities', title: 'Entities', group: 'Semantic Core', icon: <Database className="size-3.5" /> },
  { type: 'actions', title: 'Actions', group: 'Semantic Core', icon: <Workflow className="size-3.5" /> },
  { type: 'schemas', title: 'Schemas', group: 'Semantic Core', icon: <Braces className="size-3.5" /> },
  { type: 'erDiagram', title: 'ER diagram', group: 'Diagrams', icon: <Network className="size-3.5" /> },
  { type: 'classDiagram', title: 'Class Diagram', group: 'Diagrams', icon: <Blocks className="size-3.5" /> },
  { type: 'dependencyGraph', title: 'Dependency Graph', group: 'Diagrams', icon: <Network className="size-3.5" /> },
  { type: 'lifecycle', title: 'Lifecycle', group: 'Diagrams', icon: <Workflow className="size-3.5" /> },
  { type: 'impact', title: 'Impact View', group: 'Diagrams', icon: <GitCompare className="size-3.5" /> },
  { type: 'process', title: 'Process', group: 'Behavior', icon: <Workflow className="size-3.5" /> },
  { type: 'functions', title: 'Functions', group: 'Behavior', icon: <Code2 className="size-3.5" /> },
  { type: 'events', title: 'Events', group: 'Behavior', icon: <Sparkles className="size-3.5" /> },
  { type: 'scenario', title: 'Scenario', group: 'Behavior', icon: <Workflow className="size-3.5" /> },
  { type: 'trace', title: 'Trace', group: 'Behavior', icon: <Network className="size-3.5" /> },
  { type: 'tables', title: 'Tables', group: 'Inspector', icon: <Table2 className="size-3.5" /> },
  { type: 'properties', title: 'Properties', group: 'Inspector', icon: <FileText className="size-3.5" /> },
  { type: 'validation', title: 'Validation', group: 'Inspector', icon: <CheckCircle2 className="size-3.5" /> },
  { type: 'history', title: 'Diff / History', group: 'Inspector', icon: <GitCompare className="size-3.5" /> },
  { type: 'permissions', title: 'Permissions', group: 'Inspector', icon: <ShieldCheck className="size-3.5" /> },
  { type: 'aiAssistant', title: 'AI Asistent', group: 'AI & Code', icon: <Bot className="size-3.5" /> },
  { type: 'codeMode', title: 'Code Mode', group: 'AI & Code', icon: <Code2 className="size-3.5" /> },
  { type: 'apiContract', title: 'API Contract', group: 'AI & Code', icon: <Braces className="size-3.5" /> },
  { type: 'dataSamples', title: 'Data Samples', group: 'AI & Code', icon: <Database className="size-3.5" /> },
];

const CATALOG_BY_TYPE = new Map(CATALOG.map((item) => [item.type, item]));

const GENERIC_ROWS_BY_TYPE: Partial<Record<TabType, string[]>> = {
  dependencyGraph: ['Project', 'Documents', 'Entities', 'Events', 'API'],
  lifecycle: ['draft', 'active', 'archived', 'deleted'],
  impact: ['2 relations', '3 events', '1 API contract', '5 generated types'],
  process: ['Discovery', 'Design', 'Validation', 'Publishing'],
  functions: ['normalizeSchema()', 'validateRelations()', 'generateDDL()'],
  scenario: ['Create segment', 'Map journey', 'Review impact', 'Publish schema'],
  trace: ['Action', 'Command', 'Event', 'Projection'],
  validation: ['No orphan relations', 'Enum coverage 92%', 'Descriptions 68%'],
  history: ['Added JourneyStage', 'Renamed stageType', 'Linked ContextPreset'],
  permissions: ['Admin', 'Architect', 'Analyst', 'Viewer'],
  apiContract: ['GET /schemas', 'POST /entities', 'PATCH /relations'],
  dataSamples: ['CustomerJourney #184', 'JourneyStage #912', 'ContextPreset #44'],
  file: ['schema.json', 'revisions.log', 'exports', 'assets'],
  assets: ['live-db-schema.json', 'schema-snapshot.png', 'openapi.yaml'],
  actions: ['Create entity', 'Link relation', 'Generate migration'],
};

const INITIAL_WINDOWS: Record<WorkspaceWindowId, WorkspaceWindow> = {
  project: {
    id: 'project',
    activeTabId: 'project-assets',
    tabs: [
      createTab('file', 'project-file'),
      createTab('assets', 'project-assets'),
    ],
  },
  library: {
    id: 'library',
    activeTabId: 'library-domains',
    tabs: [
      createTab('domains', 'library-domains'),
      createTab('entities', 'library-entities'),
      createTab('actions', 'library-actions'),
      createTab('schemas', 'library-schemas'),
    ],
  },
  canvas: {
    id: 'canvas',
    activeTabId: 'canvas-er',
    tabs: [
      createTab('erDiagram', 'canvas-er'),
      createTab('classDiagram', 'canvas-class'),
      createTab('actions', 'canvas-actions'),
    ],
  },
  behavior: {
    id: 'behavior',
    activeTabId: 'behavior-events',
    tabs: [
      createTab('process', 'behavior-process'),
      createTab('functions', 'behavior-functions'),
      createTab('events', 'behavior-events'),
    ],
  },
  inspector: {
    id: 'inspector',
    activeTabId: 'inspector-ai',
    tabs: [
      createTab('tables', 'inspector-tables'),
      createTab('properties', 'inspector-properties'),
      createTab('aiAssistant', 'inspector-ai'),
    ],
  },
};

let nextTabCounter = 1;

function createTab(type: TabType, id?: string): WorkspaceTab {
  const item = CATALOG_BY_TYPE.get(type);
  return {
    id: id ?? `${type}-${nextTabCounter++}`,
    type,
    title: item?.title ?? type,
  };
}

function groupCatalogItems() {
  return CATALOG.reduce<Record<string, TabCatalogItem[]>>((groups, item) => {
    groups[item.group] = groups[item.group] ?? [];
    groups[item.group].push(item);
    return groups;
  }, {});
}

function getNextActiveTabId(tabs: WorkspaceTab[], removedIndex: number): string | null {
  if (tabs.length === 0) return null;
  return tabs[Math.min(removedIndex, tabs.length - 1)]?.id ?? tabs[0]?.id ?? null;
}

function findTabLocation(
  windows: Record<WorkspaceWindowId, WorkspaceWindow>,
  tabId: string,
): TabLocation | null {
  for (const windowId of Object.keys(windows) as WorkspaceWindowId[]) {
    const index = windows[windowId].tabs.findIndex((tab) => tab.id === tabId);
    if (index >= 0) return { windowId, index };
  }

  return null;
}

function relocateTab(
  current: Record<WorkspaceWindowId, WorkspaceWindow>,
  fromWindowId: WorkspaceWindowId,
  tabId: string,
  toWindowId: WorkspaceWindowId,
  targetIndex: number,
) {
  const source = current[fromWindowId];
  const sourceIndex = source.tabs.findIndex((tab) => tab.id === tabId);
  if (sourceIndex < 0) return current;

  const movingTab = source.tabs[sourceIndex];
  const sourceTabs = source.tabs.filter((tab) => tab.id !== tabId);
  const sameWindow = fromWindowId === toWindowId;
  const rawTargetTabs = sameWindow ? sourceTabs : current[toWindowId].tabs;
  const adjustedIndex = sameWindow && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const boundedIndex = Math.max(0, Math.min(adjustedIndex, rawTargetTabs.length));
  const targetTabs = [...rawTargetTabs];

  targetTabs.splice(boundedIndex, 0, movingTab);

  if (sameWindow) {
    return {
      ...current,
      [fromWindowId]: {
        ...source,
        tabs: targetTabs,
      },
    };
  }

  const target = current[toWindowId];
  const sourceActiveTabId =
    source.activeTabId === tabId ? getNextActiveTabId(sourceTabs, sourceIndex) : source.activeTabId;

  return {
    ...current,
    [fromWindowId]: {
      ...source,
      tabs: sourceTabs,
      activeTabId: sourceActiveTabId,
    },
    [toWindowId]: {
      ...target,
      tabs: targetTabs,
      activeTabId: movingTab.id,
    },
  };
}

function getFloatingMenuPosition(
  button: HTMLElement,
  width: number,
  maxHeight: number,
): { left: number; top: number } {
  const rect = button.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(
    Math.max(rect.left, margin),
    Math.max(margin, window.innerWidth - width - margin),
  );
  const top = Math.min(
    Math.max(rect.bottom + margin, margin),
    Math.max(margin, window.innerHeight - maxHeight - margin),
  );

  return { left, top };
}

function getAddMenuPosition(button: HTMLElement): Pick<AddMenuState, 'left' | 'top'> {
  return getFloatingMenuPosition(button, ADD_MENU_WIDTH, ADD_MENU_MAX_HEIGHT);
}

function getSearchFilterMenuPosition(button: HTMLElement): SearchFilterMenuState {
  return getFloatingMenuPosition(button, SEARCH_FILTER_MENU_WIDTH, SEARCH_FILTER_MENU_MAX_HEIGHT);
}

export function WorkspaceLayoutPage() {
  const [windows, setWindows] = useState(INITIAL_WINDOWS);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [heldTabId, setHeldTabId] = useState<string | null>(null);
  const [projectSearchActive, setProjectSearchActive] = useState(false);
  const [searchFilterMenu, setSearchFilterMenu] = useState<SearchFilterMenuState | null>(null);
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>({
    left: true,
    right: true,
    bottom: true,
    canvasMaximized: false,
  });
  const [layoutAnimating, setLayoutAnimating] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const searchFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const windowsRef = useRef(windows);
  const layoutAnimationTimerRef = useRef<number | null>(null);
  const centerGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);
  const behaviorPanelRef = useRef<ImperativePanelHandle | null>(null);
  const resizingPanelRef = useRef<CollapsiblePanelKey | null>(null);
  const pendingPanelVisibilityRef = useRef<Partial<Record<CollapsiblePanelKey, boolean>>>({});
  const pointerDragRef = useRef<{
    tabId: string;
    fromWindowId: WorkspaceWindowId;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const catalogGroups = useMemo(() => groupCatalogItems(), []);

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    if (!addMenu && !searchFilterMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        addMenu &&
        !addMenuRef.current?.contains(target) &&
        !target.closest('[data-add-tab-trigger="true"]')
      ) {
        setAddMenu(null);
      }
      if (
        searchFilterMenu &&
        !searchFilterMenuRef.current?.contains(target) &&
        !target.closest('[data-search-filter-trigger="true"]')
      ) {
        setSearchFilterMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [addMenu, searchFilterMenu]);

  useEffect(() => () => {
    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current);
    }
  }, []);

  const activateTab = (windowId: WorkspaceWindowId, tabId: string) => {
    if (suppressClickRef.current === tabId) {
      suppressClickRef.current = null;
      return;
    }

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
    setAddMenu(null);
  };

  const openAddMenu = (windowId: WorkspaceWindowId, trigger: HTMLElement) => {
    setAddMenu((current) => {
      if (current?.windowId === windowId) return null;
      return {
        windowId,
        ...getAddMenuPosition(trigger),
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

  const applyLayoutVisibility = (next: LayoutVisibility) => {
    setLayoutVisibility(next);
    setLayoutAnimating(true);

    window.requestAnimationFrame(() => {
      if (next.left) {
        leftPanelRef.current?.expand(13);
      } else {
        leftPanelRef.current?.collapse();
      }

      if (next.right) {
        rightPanelRef.current?.expand(18);
      } else {
        rightPanelRef.current?.collapse();
      }

      if (next.bottom) {
        behaviorPanelRef.current?.expand(19);
      } else {
        behaviorPanelRef.current?.collapse();
      }
    });

    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current);
    }
    layoutAnimationTimerRef.current = window.setTimeout(() => {
      setLayoutAnimating(false);
      layoutAnimationTimerRef.current = null;
    }, PANEL_ANIMATION_MS);
  };

  const getPanelVisibility = (key: CollapsiblePanelKey) => {
    const panel =
      key === 'left'
        ? leftPanelRef.current
        : key === 'right'
          ? rightPanelRef.current
          : behaviorPanelRef.current;

    return panel ? !panel.isCollapsed() : layoutVisibility[key];
  };

  const syncPanelVisibility = (key: CollapsiblePanelKey, visible: boolean) => {
    if (resizingPanelRef.current === key) {
      pendingPanelVisibilityRef.current[key] = visible;
      return;
    }

    setLayoutVisibility((current) => (
      current[key] === visible
        ? current
        : {
          ...current,
          [key]: visible,
        }
    ));
  };

  const handleResizeDragging = (key: CollapsiblePanelKey, isDragging: boolean) => {
    if (isDragging) {
      resizingPanelRef.current = key;
      pendingPanelVisibilityRef.current[key] = layoutVisibility[key];
      return;
    }

    resizingPanelRef.current = null;
    pendingPanelVisibilityRef.current[key] = getPanelVisibility(key);
    syncPanelVisibility(key, pendingPanelVisibilityRef.current[key] ?? layoutVisibility[key]);
    delete pendingPanelVisibilityRef.current[key];
  };

  const toggleLeftColumn = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      left: !layoutVisibility.left,
      canvasMaximized: false,
    });
  };

  const toggleRightColumn = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      right: !layoutVisibility.right,
      canvasMaximized: false,
    });
  };

  const toggleBottomPanel = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      bottom: !layoutVisibility.bottom,
      canvasMaximized: false,
    });
  };

  const toggleCanvasMaximized = () => {
    applyLayoutVisibility(
      layoutVisibility.canvasMaximized
        ? { left: true, right: true, bottom: true, canvasMaximized: false }
        : { left: false, right: false, bottom: false, canvasMaximized: true },
    );
  };

  const openProjectSearch = () => {
    setProjectSearchActive(true);
    setSearchFilterMenu(null);
  };

  const closeProjectSearch = () => {
    setProjectSearchActive(false);
    setSearchFilterMenu(null);
  };

  const toggleSearchFilterMenu = (trigger: HTMLElement) => {
    setSearchFilterMenu((current) => (
      current ? null : getSearchFilterMenuPosition(trigger)
    ));
  };

  const startBottomHeaderResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !layoutVisibility.bottom) return;

    const target = event.target as HTMLElement;
    if (target.closest('[data-tab-id], button')) return;

    const groupElement = document.getElementById('workspace-layout-center-group');
    const startLayout = centerGroupRef.current?.getLayout();
    if (!groupElement || !startLayout || startLayout.length < 2) return;

    event.preventDefault();

    const groupRect = groupElement.getBoundingClientRect();
    const startY = event.clientY;
    const startBottomSize = startLayout[1] ?? 30;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaPercent = ((startY - moveEvent.clientY) / groupRect.height) * 100;
      const nextBottomSize = Math.max(19, Math.min(68, startBottomSize + deltaPercent));
      centerGroupRef.current?.setLayout([100 - nextBottomSize, nextBottomSize]);
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const resolveDropTarget = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!(element instanceof HTMLElement)) return null;

    const tabElement = element.closest<HTMLElement>('[data-tab-id][data-window-id]');
    if (tabElement?.dataset.windowId && tabElement.dataset.tabId) {
      const targetWindowId = tabElement.dataset.windowId as WorkspaceWindowId;
      const targetWindow = windowsRef.current[targetWindowId];
      if (!targetWindow) return null;

      const targetIndex = targetWindow.tabs.findIndex((tab) => tab.id === tabElement.dataset.tabId);
      if (targetIndex < 0) return null;

      const rect = tabElement.getBoundingClientRect();
      return {
        windowId: targetWindowId,
        index: clientX > rect.left + rect.width / 2 ? targetIndex + 1 : targetIndex,
      };
    }

    const paneElement = element.closest<HTMLElement>('[data-window-id]');
    if (!paneElement?.dataset.windowId) return null;

    const targetWindowId = paneElement.dataset.windowId as WorkspaceWindowId;
    const targetWindow = windowsRef.current[targetWindowId];
    if (!targetWindow) return null;

    return {
      windowId: targetWindowId,
      index: targetWindow.tabs.length,
    };
  };

  const clearPointerDrag = () => {
    pointerDragRef.current = null;
    setDraggingTabId(null);
    setHeldTabId(null);
  };

  const startTabPointerDrag = (
    windowId: WorkspaceWindowId,
    tabId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;
    setHeldTabId(tabId);

    pointerDragRef.current = {
      tabId,
      fromWindowId: windowId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragState = pointerDragRef.current;
      if (!dragState) return;

      const distance = Math.hypot(moveEvent.clientX - dragState.startX, moveEvent.clientY - dragState.startY);
      if (!dragState.dragging && distance < 6) return;

      dragState.dragging = true;
      setDraggingTabId(dragState.tabId);
      const target = resolveDropTarget(moveEvent.clientX, moveEvent.clientY);

      if (target) {
        const currentLocation = findTabLocation(windowsRef.current, dragState.tabId);
        if (!currentLocation) return;

        const samePosition =
          currentLocation.windowId === target.windowId &&
          (currentLocation.index === target.index || currentLocation.index + 1 === target.index);

        if (!samePosition) {
          moveTab(currentLocation.windowId, dragState.tabId, target.windowId, target.index);
          dragState.fromWindowId = target.windowId;
        }
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      const dragState = pointerDragRef.current;
      if (!dragState) return;

      if (dragState.dragging) {
        const target = resolveDropTarget(upEvent.clientX, upEvent.clientY);
        const currentLocation = findTabLocation(windowsRef.current, dragState.tabId);
        if (target && currentLocation) {
          moveTab(currentLocation.windowId, dragState.tabId, target.windowId, target.index);
        }

        suppressClickRef.current = dragState.tabId;
        window.setTimeout(() => {
          if (suppressClickRef.current === dragState.tabId) {
            suppressClickRef.current = null;
          }
        }, 0);
      }

      clearPointerDrag();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

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

function WorkspacePane({
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
  const catalogItem = showIcon ? CATALOG_BY_TYPE.get(tab.type) : null;
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
      <button
        type="button"
        className={cn(
          'group flex h-7 max-w-[170px] items-center gap-1.5 rounded-lg px-3 text-xs font-medium leading-4 transition-colors',
          highlighted ? 'bg-[#eeeff0] text-[#111827]' : 'text-[#8a919c] hover:bg-[#eeeff0]/70 hover:text-[#111827]',
        )}
        onClick={() => onActivate(windowId, tab.id)}
      >
        {catalogItem ? <span className="text-slate-400">{catalogItem.icon}</span> : null}
        <span className="truncate">{tab.title}</span>
        <span
          role="button"
          aria-label={`Close ${tab.title}`}
          tabIndex={0}
          className={cn(
            'ml-0.5 size-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700',
            closeVisible && !dragging && !held ? 'flex' : 'hidden',
          )}
          onClick={(event) => {
            event.stopPropagation();
            onClose(windowId, tab.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onClose(windowId, tab.id);
            }
          }}
        >
          <X className="size-3" />
        </span>
      </button>
    </div>
  );
}

function AddTabMenu({
  groups,
  menuRef,
  position,
  onAdd,
}: {
  groups: Record<string, TabCatalogItem[]>;
  menuRef: RefObject<HTMLDivElement | null>;
  position: { left: number; top: number };
  onAdd: (type: TabType) => void;
}) {
  return (
    <div
      ref={menuRef}
      className="fixed z-[1000] w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.16)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="workspace-popup-scroll max-h-[420px] overflow-y-auto p-1.5">
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="py-0.5">
            <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {groupName}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
                  onClick={() => onAdd(item.type)}
                >
                  <span className="flex size-4 items-center justify-center text-slate-500">
                    {item.icon}
                  </span>
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchFilterMenu({
  groups,
  menuRef,
  position,
}: {
  groups: Record<string, TabCatalogItem[]>;
  menuRef: RefObject<HTMLDivElement | null>;
  position: SearchFilterMenuState;
}) {
  const allItems = Object.values(groups).flat();

  return (
    <div
      ref={menuRef}
      className="fixed z-[1001] w-[250px] overflow-hidden rounded-2xl bg-[#1f1f1f] py-2 text-white shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="border-b border-white/10 px-2 pb-2">
        {['Find', 'Replace'].map((item, index) => (
          <button
            key={item}
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-white hover:bg-white/10"
          >
            <span className="flex size-4 items-center justify-center">
              {index === 0 ? <Check className="size-3.5" /> : null}
            </span>
            {item}
          </button>
        ))}
      </div>
      <div className="workspace-dark-popup-scroll max-h-[250px] overflow-y-auto border-b border-white/10 px-2 py-2">
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-white hover:bg-white/10"
        >
          <Check className="size-3.5" />
          <Layers3 className="size-4 text-white/75" />
          All
        </button>
        {allItems.map((item) => (
          <button
            key={`filter-${item.type}`}
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-white hover:bg-white/10"
          >
            <span className="size-3.5" />
            <span className="flex size-4 items-center justify-center text-white/75">{item.icon}</span>
            {item.title}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2">
        {['Match case', 'Whole words'].map((item) => (
          <button
            key={item}
            type="button"
            className="flex h-8 w-full items-center rounded-md px-8 text-left text-xs font-semibold text-white hover:bg-white/10"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconButton({
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
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-lg transition-colors',
        active ? 'bg-[#030213] text-white' : 'text-slate-500 hover:bg-[#eeeff0] hover:text-slate-900',
      )}
    >
      {children}
    </button>
  );
}

function TabContent({ tab, windowId }: { tab: WorkspaceTab; windowId: WorkspaceWindowId }) {
  if (tab.type === 'erDiagram') return <DiagramCanvas />;
  if (tab.type === 'classDiagram') return <ClassDiagramCanvas />;
  if (tab.type === 'aiAssistant') return <AiAssistantPane />;
  if (tab.type === 'codeMode') return <CodeModePane />;
  if (tab.type === 'tables') return <TablesPane />;
  if (tab.type === 'properties') return <PropertiesPane />;
  if (tab.type === 'events') return <EventsPane />;
  if (tab.type === 'schemas' || tab.type === 'domains' || tab.type === 'entities') return <SemanticList type={tab.type} />;

  return <GenericPane tab={tab} windowId={windowId} />;
}

function DiagramCanvas() {
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <div className="absolute inset-0 diagram-grid opacity-80" />
      <svg className="absolute inset-0 size-full text-[#bcc7d5]" viewBox="0 0 1280 760" preserveAspectRatio="none" aria-hidden="true">
        <path d="M140 130 C260 120 320 190 420 180" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M220 445 C350 405 430 420 560 350" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M560 270 C730 260 820 220 1010 150" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M700 430 C830 440 920 510 1080 500" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <EntityCard title="ProductAudienceFit" accent="#d5a176" className="left-[7%] top-[5%]" rows={['id', 'publicId', 'brandId', 'productId', 'audienceSegmentId', 'status', 'metadata']} />
      <EntityCard title="AlternateSolution" accent="#d49c73" className="left-[32%] top-[7%]" rows={['id', 'publicId', 'productAudienceFitId', 'competitorProductId', 'name', 'type']} />
      <EntityCard title="CustomerJourney" accent="#d4af69" className="left-[27%] top-[47%]" rows={['id', 'publicId', 'brandId', 'audienceSegmentId', 'name', 'description']} />
      <EntityCard title="JourneyStage" accent="#f39b12" selected className="left-[50%] top-[39%]" rows={['id', 'publicId', 'customerJourneyId', 'name', 'stageType', 'customerTriggers', 'sortOrder']} />
      <EntityCard title="ContextPreset" accent="#8a82c8" className="right-[4%] top-[22%]" rows={['id', 'publicId', 'brandId', 'key', 'name', 'taskType', 'rules']} />
      <EntityCard title="JourneyStageType" accent="#d7ba77" className="right-[20%] bottom-[17%]" rows={['unaware', 'problem_aware', 'solution_aware', 'trial', 'purchase']} />
      <FloatingCanvasToolbar />
    </div>
  );
}

function EntityCard({
  title,
  rows,
  accent,
  selected,
  className,
}: {
  title: string;
  rows: string[];
  accent: string;
  selected?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'absolute w-[178px] overflow-hidden rounded-md border bg-white text-[10px] shadow-[0_2px_12px_rgba(15,23,42,0.08)]',
        selected ? 'border-[#f39b12] ring-1 ring-[#f39b12]' : 'border-slate-200',
        className,
      )}
    >
      <div className="flex h-7 items-center px-2 text-[11px] font-semibold text-white" style={{ backgroundColor: accent }}>
        {title}
      </div>
      <div>
        {rows.map((row, index) => (
          <div key={row} className="flex h-6 items-center justify-between border-t border-slate-100 px-2 text-slate-500">
            <span className={index < 4 ? 'text-blue-500' : undefined}>{row}</span>
            <span className="text-[9px] text-slate-400">{index % 3 === 0 ? 'bigint' : index % 3 === 1 ? 'uuid' : 'text'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FloatingCanvasToolbar() {
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
      <CanvasToolbar
        canRedo
        canUndo
        highlightRelations
        onAutoLayout={() => undefined}
        onOpenDiff={() => undefined}
        onOpenValidation={() => undefined}
        onRedo={() => undefined}
        onToggleHighlightRelations={() => undefined}
        onUndo={() => undefined}
        onZoomToFit={() => undefined}
        showCodeModeButton={false}
      />
    </div>
  );
}

function ClassDiagramCanvas() {
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <div className="absolute inset-0 diagram-grid opacity-70" />
      <div className="grid h-full grid-cols-3 gap-5 p-8">
        {[
          ['Domain Model', 'Entity', 'Value Object', 'Aggregate'],
          ['Application', 'Command', 'Query', 'Use Case'],
          ['Infrastructure', 'Repository', 'Adapter', 'Mapper'],
        ].map(([title, ...items]) => (
          <div key={title} className="self-start rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{title}</div>
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item} className="px-4 py-3 text-xs text-slate-500">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiAssistantPane() {
  return (
    <div className="flex h-full flex-col bg-[#f8f8f9]">
      <div className="min-h-0 flex-1 p-6">
        <div className="grid gap-3">
          {['Schema consistency', 'Relation naming', 'Missing lifecycle events'].map((item, index) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Sparkles className="size-3.5 text-[#5d3df5]" />
                {item}
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#5d3df5]" style={{ width: `${70 - index * 15}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 pb-3">
        <div className="rounded-2xl border border-white bg-white/90 p-3 shadow-[0_2px_15px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.05)]">
          <div className="inline-flex rounded-full border border-white bg-[#fcfcfc] px-3 py-1 text-xs text-slate-600">
            live-db-schema.json
          </div>
          <div className="flex h-14 items-start pt-3 text-sm text-[#bdc3ce]">Enter your query text</div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <RoundButton label="Attach">
                <Plus className="size-4" />
              </RoundButton>
              <RoundButton label="Blocks">
                <Blocks className="size-4" />
              </RoundButton>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="flex h-9 items-center gap-1.5 rounded-full bg-[#eeeff0] px-3 text-xs font-medium text-[#828293]">
                GPT-4o
              </button>
              <RoundButton label="Voice" muted>
                <Mic className="size-4" />
              </RoundButton>
              <RoundButton label="Send" strong>
                <ArrowUp className="size-4" />
              </RoundButton>
            </div>
          </div>
        </div>
        <div className="py-2 text-center text-[11px] text-[#8f98a8]">The AI assistant sometimes makes mistakes. Check its results.</div>
      </div>
    </div>
  );
}

function RoundButton({ label, children, muted, strong }: { label: string; children: ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-full',
        strong ? 'bg-[#cacad2] text-white' : muted ? 'bg-[#eeeff0] text-slate-500' : 'text-slate-500 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  );
}

function CodeModePane() {
  return (
    <div className="h-full bg-[#151622] p-4 font-mono text-xs text-[#cdd6f4]">
      <div className="mb-3 flex items-center justify-between text-[#8a919c]">
        <span>schema.workspace.ts</span>
        <Code2 className="size-4" />
      </div>
      <pre className="overflow-hidden rounded-lg border border-[#313244] bg-[#1e1f2e] p-4 leading-6">
{`entity("JourneyStage", {
  id: bigint().primary(),
  customerJourneyId: relation("CustomerJourney"),
  name: text().required(),
  stageType: enumRef("JourneyStageType"),
  sortOrder: integer()
})`}
      </pre>
    </div>
  );
}

function TablesPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {['ProductAudienceFit', 'AlternateSolution', 'CustomerJourney', 'JourneyStage', 'ContextPreset'].map((table, index) => (
          <div key={table} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Table2 className="size-3.5 text-slate-400" />
              {table}
            </div>
            <span className="text-[11px] text-slate-400">{8 + index} fields</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertiesPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="rounded-lg border border-[#f39b12]/50 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-800">JourneyStage</div>
        <div className="mt-4 grid gap-3 text-xs">
          {[
            ['Domain', 'Customer Journey'],
            ['Primary key', 'id'],
            ['Status', 'active'],
            ['Relations', '2 inbound / 1 outbound'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
              <span className="text-slate-400">{label}</span>
              <span className="font-medium text-slate-700">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {[
          ['AudienceMatched', 'ProductAudienceFit'],
          ['JourneyStageCreated', 'CustomerJourney'],
          ['CompetitorLinked', 'AlternateSolution'],
        ].map(([event, source]) => (
          <div key={event} className="grid grid-cols-[1fr_auto] items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-slate-700">{event}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">{source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticList({ type }: { type: 'schemas' | 'domains' | 'entities' }) {
  const items = {
    schemas: ['Data Design Schema', 'Live DB Schema', 'Public API Schema', 'Analytics Schema'],
    domains: ['Brand', 'Audience', 'Journey', 'Context', 'Competitor'],
    entities: ['ProductAudienceFit', 'AlternateSolution', 'CustomerJourney', 'JourneyStage'],
  }[type];

  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid gap-1.5">
        {items.map((item, index) => (
          <button
            key={item}
            type="button"
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors',
              index === 0 ? 'bg-[#eeeff0] text-slate-900' : 'text-slate-500 hover:bg-white hover:text-slate-800',
            )}
          >
            {item}
            <span className="text-[10px] text-slate-400">{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GenericPane({ tab, windowId }: { tab: WorkspaceTab; windowId: WorkspaceWindowId }) {
  const rows = GENERIC_ROWS_BY_TYPE[tab.type] ?? ['Semantic object', 'Projection', 'Relation', 'Action'];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={row} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">{row}</span>
            <span className="text-[11px] text-slate-400">{windowId}.{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="flex h-full items-center justify-center text-xs font-medium text-slate-300">
      Empty workspace pane
    </div>
  );
}
