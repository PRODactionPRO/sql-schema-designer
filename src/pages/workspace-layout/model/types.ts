export type WorkspaceWindowId = 'project' | 'library' | 'canvas' | 'behavior' | 'inspector';

export type TabType =
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

export interface WorkspaceTab {
  id: string;
  type: TabType;
  title: string;
}

export interface WorkspaceWindow {
  id: WorkspaceWindowId;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

export interface TabCatalogItem {
  type: TabType;
  title: string;
  group: string;
}

export interface AddMenuState {
  windowId: WorkspaceWindowId;
  left: number;
  top: number;
}

export interface SearchFilterMenuState {
  left: number;
  top: number;
}

export interface LayoutVisibility {
  left: boolean;
  right: boolean;
  bottom: boolean;
  canvasMaximized: boolean;
}

export type CollapsiblePanelKey = keyof Pick<LayoutVisibility, 'left' | 'right' | 'bottom'>;

export interface TabLocation {
  windowId: WorkspaceWindowId;
  index: number;
}
