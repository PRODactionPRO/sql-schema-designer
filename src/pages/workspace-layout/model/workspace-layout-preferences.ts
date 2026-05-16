import { INITIAL_WINDOWS } from './catalog';
import type {
  LayoutVisibility,
  WorkspaceLayoutSnapshot,
  WorkspacePanelLayouts,
  WorkspaceTab,
  WorkspaceWindow,
  WorkspaceWindowId,
} from './types';
import { CATALOG_BY_TYPE } from './catalog';

export const DEFAULT_LAYOUT_VISIBILITY: LayoutVisibility = {
  left: true,
  right: true,
  bottom: true,
  canvasMaximized: false,
};

export const DEFAULT_PANEL_LAYOUTS: WorkspacePanelLayouts = {
  root: [18.7, 55.5, 25.8],
  left: [47, 53],
  center: [69.8, 30.2],
};

const WORKSPACE_WINDOW_IDS: WorkspaceWindowId[] = ['project', 'library', 'canvas', 'behavior', 'inspector'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneWindows(windows: Record<WorkspaceWindowId, WorkspaceWindow>) {
  return Object.fromEntries(
    WORKSPACE_WINDOW_IDS.map((windowId) => [
      windowId,
      {
        ...windows[windowId],
        tabs: windows[windowId].tabs.map((tab) => ({ ...tab })),
      },
    ]),
  ) as Record<WorkspaceWindowId, WorkspaceWindow>;
}

function normalizeNumberArray(value: unknown, fallback: number[], expectedLength: number) {
  if (!Array.isArray(value)) return [...fallback];
  const numbers = value
    .slice(0, expectedLength)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0);

  return numbers.length === expectedLength ? numbers : [...fallback];
}

function normalizeLayoutVisibility(value: unknown): LayoutVisibility {
  if (!isRecord(value)) return { ...DEFAULT_LAYOUT_VISIBILITY };

  return {
    left: typeof value.left === 'boolean' ? value.left : DEFAULT_LAYOUT_VISIBILITY.left,
    right: typeof value.right === 'boolean' ? value.right : DEFAULT_LAYOUT_VISIBILITY.right,
    bottom: typeof value.bottom === 'boolean' ? value.bottom : DEFAULT_LAYOUT_VISIBILITY.bottom,
    canvasMaximized: typeof value.canvasMaximized === 'boolean'
      ? value.canvasMaximized
      : DEFAULT_LAYOUT_VISIBILITY.canvasMaximized,
  };
}

function normalizePanelLayouts(value: unknown): WorkspacePanelLayouts {
  if (!isRecord(value)) {
    return {
      root: [...DEFAULT_PANEL_LAYOUTS.root],
      left: [...DEFAULT_PANEL_LAYOUTS.left],
      center: [...DEFAULT_PANEL_LAYOUTS.center],
    };
  }

  return {
    root: normalizeNumberArray(value.root, DEFAULT_PANEL_LAYOUTS.root, 3),
    left: normalizeNumberArray(value.left, DEFAULT_PANEL_LAYOUTS.left, 2),
    center: normalizeNumberArray(value.center, DEFAULT_PANEL_LAYOUTS.center, 2),
  };
}

function normalizeTab(value: unknown): WorkspaceTab | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') {
    return null;
  }

  const catalogItem = CATALOG_BY_TYPE.get(value.type as WorkspaceTab['type']);
  if (!catalogItem) return null;

  return {
    id: value.id,
    type: catalogItem.type,
    title: typeof value.title === 'string' && value.title.trim()
      ? value.title
      : catalogItem.title,
  };
}

function normalizeWindow(value: unknown, fallback: WorkspaceWindow, id: WorkspaceWindowId): WorkspaceWindow {
  if (!isRecord(value)) {
    return {
      ...fallback,
      tabs: fallback.tabs.map((tab) => ({ ...tab })),
    };
  }

  const tabs = Array.isArray(value.tabs)
    ? value.tabs.map(normalizeTab).filter((tab): tab is WorkspaceTab => Boolean(tab))
    : [];
  const safeTabs = tabs.length > 0 ? tabs : fallback.tabs.map((tab) => ({ ...tab }));
  const activeTabId = typeof value.activeTabId === 'string'
    && safeTabs.some((tab) => tab.id === value.activeTabId)
    ? value.activeTabId
    : safeTabs[0]?.id ?? null;

  return {
    id,
    tabs: safeTabs,
    activeTabId,
  };
}

function normalizeWindows(value: unknown) {
  if (!isRecord(value)) return cloneWindows(INITIAL_WINDOWS);

  return Object.fromEntries(
    WORKSPACE_WINDOW_IDS.map((windowId) => [
      windowId,
      normalizeWindow(value[windowId], INITIAL_WINDOWS[windowId], windowId),
    ]),
  ) as Record<WorkspaceWindowId, WorkspaceWindow>;
}

function normalizeCanvasViewports(value: unknown): WorkspaceLayoutSnapshot['canvasViewports'] {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    (['erDiagram', 'classDiagram'] as const).flatMap((viewId) => {
      const viewport = value[viewId];
      if (!isRecord(viewport) || !isRecord(viewport.pan)) return [];

      const x = Number(viewport.pan.x);
      const y = Number(viewport.pan.y);
      const zoom = Number(viewport.zoom);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return [];

      return [[viewId, {
        pan: { x, y },
        zoom,
      }]];
    }),
  );
}

export function normalizeWorkspaceLayoutSnapshot(value: unknown): WorkspaceLayoutSnapshot {
  const record = isRecord(value) ? value : {};

  return {
    version: 1,
    windows: normalizeWindows(record.windows),
    layoutVisibility: normalizeLayoutVisibility(record.layoutVisibility),
    panelLayouts: normalizePanelLayouts(record.panelLayouts),
    canvasViewports: normalizeCanvasViewports(record.canvasViewports),
  };
}

export function cloneWorkspaceWindows(windows: Record<WorkspaceWindowId, WorkspaceWindow>) {
  return cloneWindows(windows);
}
