import {
  Blocks,
  Bot,
  Braces,
  CheckCircle2,
  Code2,
  Database,
  FileText,
  GitCompare,
  Layers3,
  Network,
  ShieldCheck,
  Sparkles,
  Table2,
  Workflow,
} from 'lucide-react';
import type { TabCatalogItem, TabType, WorkspaceWindow, WorkspaceWindowId, WorkspaceTab } from './types';

export const CATALOG: TabCatalogItem[] = [
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
  { type: 'aiAssistant', title: 'AI Assistant', group: 'AI & Code', icon: <Bot className="size-3.5" /> },
  { type: 'codeMode', title: 'Code Mode', group: 'AI & Code', icon: <Code2 className="size-3.5" /> },
  { type: 'apiContract', title: 'API Contract', group: 'AI & Code', icon: <Braces className="size-3.5" /> },
  { type: 'dataSamples', title: 'Data Samples', group: 'AI & Code', icon: <Database className="size-3.5" /> },
];

export const CATALOG_BY_TYPE = new Map(CATALOG.map((item) => [item.type, item]));

export const GENERIC_ROWS_BY_TYPE: Partial<Record<TabType, string[]>> = {
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

export function groupCatalogItems() {
  return CATALOG.reduce<Record<string, TabCatalogItem[]>>((groups, item) => {
    groups[item.group] = groups[item.group] ?? [];
    groups[item.group].push(item);
    return groups;
  }, {});
}
