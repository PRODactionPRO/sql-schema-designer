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
  | 'idef0'
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
  documentId?: string;
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

export type WorkspaceSelectionKind =
  | 'domain'
  | 'table'
  | 'field'
  | 'relation'
  | 'enum'
  | 'jsonSchema'
  | 'diagram'
  | 'document'
  | 'class'
  | 'classAttribute'
  | 'classMethod';

export interface WorkspaceSelection {
  kind: WorkspaceSelectionKind;
  id: string;
  sourceView: 'model' | 'erd' | 'classDiagram' | 'diagrams' | 'documents';
  parentId?: string;
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

export type WorkspacePanelGroupId = 'root' | 'left' | 'center';

export type WorkspaceCanvasViewportId = 'erDiagram' | 'classDiagram' | 'idef0';

export interface WorkspaceCanvasViewport {
  pan: {
    x: number;
    y: number;
  };
  zoom: number;
}

export interface WorkspacePanelLayouts {
  root: number[];
  left: number[];
  center: number[];
}

export interface WorkspaceLayoutSnapshot {
  version: 1;
  windows: Record<WorkspaceWindowId, WorkspaceWindow>;
  layoutVisibility: LayoutVisibility;
  panelLayouts: WorkspacePanelLayouts;
  canvasViewports: Partial<Record<WorkspaceCanvasViewportId, WorkspaceCanvasViewport>>;
}
