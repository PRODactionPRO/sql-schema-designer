import type { TabCatalogItem, TabType, WorkspaceWindow, WorkspaceWindowId, WorkspaceTab } from './types';

export const CATALOG: TabCatalogItem[] = [
  { type: 'file', title: 'File', group: 'Project' },
  { type: 'assets', title: 'Assets', group: 'Project' },
  { type: 'domains', title: 'Domains', group: 'Semantic Core' },
  { type: 'entities', title: 'Entities', group: 'Semantic Core' },
  { type: 'actions', title: 'Actions', group: 'Semantic Core' },
  { type: 'schemas', title: 'Schemas', group: 'Semantic Core' },
  { type: 'erDiagram', title: 'ER diagram', group: 'Diagrams' },
  { type: 'classDiagram', title: 'Class Diagram', group: 'Diagrams' },
  { type: 'idef0', title: 'IDEF0', group: 'Behavior' },
  { type: 'dependencyGraph', title: 'Dependency Graph', group: 'Diagrams' },
  { type: 'lifecycle', title: 'Lifecycle', group: 'Diagrams' },
  { type: 'impact', title: 'Impact View', group: 'Diagrams' },
  { type: 'process', title: 'Process', group: 'Behavior' },
  { type: 'functions', title: 'Functions', group: 'Behavior' },
  { type: 'events', title: 'Events', group: 'Behavior' },
  { type: 'scenario', title: 'Scenario', group: 'Behavior' },
  { type: 'trace', title: 'Trace', group: 'Behavior' },
  { type: 'tables', title: 'Tables', group: 'Inspector' },
  { type: 'properties', title: 'Properties', group: 'Inspector' },
  { type: 'validation', title: 'Validation', group: 'Inspector' },
  { type: 'history', title: 'Diff / History', group: 'Inspector' },
  { type: 'permissions', title: 'Permissions', group: 'Inspector' },
  { type: 'aiAssistant', title: 'AI Assistant', group: 'AI & Code' },
  { type: 'codeMode', title: 'Code Mode', group: 'AI & Code' },
  { type: 'apiContract', title: 'API Contract', group: 'AI & Code' },
  { type: 'dataSamples', title: 'Data Samples', group: 'AI & Code' },
];

export const CATALOG_BY_TYPE = new Map(CATALOG.map((item) => [item.type, item]));

export const INITIAL_WINDOWS: Record<WorkspaceWindowId, WorkspaceWindow> = {
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
      createTab('idef0', 'canvas-idef0'),
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

export function createTab(type: TabType, id?: string): WorkspaceTab {
  const item = CATALOG_BY_TYPE.get(type);
  return {
    id: id ?? `${type}-${nextTabCounter++}`,
    type,
    title: item?.title ?? type,
  };
}
