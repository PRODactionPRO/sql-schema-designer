import type { ReactNode } from 'react';
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
import { CATALOG } from './catalog';
import type { TabCatalogItem, TabType } from './types';

export type TabCatalogDisplayItem = TabCatalogItem & {
  icon: ReactNode;
};

export const CATALOG_ICON_BY_TYPE: Record<TabType, ReactNode> = {
  file: <FileText className="size-3.5" />,
  assets: <Layers3 className="size-3.5" />,
  domains: <Blocks className="size-3.5" />,
  entities: <Database className="size-3.5" />,
  actions: <Workflow className="size-3.5" />,
  schemas: <Braces className="size-3.5" />,
  erDiagram: <Network className="size-3.5" />,
  classDiagram: <Blocks className="size-3.5" />,
  idef0: <Workflow className="size-3.5" />,
  dependencyGraph: <Network className="size-3.5" />,
  lifecycle: <Workflow className="size-3.5" />,
  impact: <GitCompare className="size-3.5" />,
  process: <Workflow className="size-3.5" />,
  functions: <Code2 className="size-3.5" />,
  events: <Sparkles className="size-3.5" />,
  scenario: <Workflow className="size-3.5" />,
  trace: <Network className="size-3.5" />,
  tables: <Table2 className="size-3.5" />,
  properties: <FileText className="size-3.5" />,
  validation: <CheckCircle2 className="size-3.5" />,
  history: <GitCompare className="size-3.5" />,
  permissions: <ShieldCheck className="size-3.5" />,
  aiAssistant: <Bot className="size-3.5" />,
  codeMode: <Code2 className="size-3.5" />,
  apiContract: <Braces className="size-3.5" />,
  dataSamples: <Database className="size-3.5" />,
};

export const CATALOG_WITH_ICONS: TabCatalogDisplayItem[] = CATALOG.map((item) => ({
  ...item,
  icon: CATALOG_ICON_BY_TYPE[item.type],
}));

export const CATALOG_DISPLAY_BY_TYPE = new Map(CATALOG_WITH_ICONS.map((item) => [item.type, item]));

export function groupCatalogItemsWithIcons() {
  return CATALOG_WITH_ICONS.reduce<Record<string, TabCatalogDisplayItem[]>>((groups, item) => {
    groups[item.group] = groups[item.group] ?? [];
    groups[item.group].push(item);
    return groups;
  }, {});
}
