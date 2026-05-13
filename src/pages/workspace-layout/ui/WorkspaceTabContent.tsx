import { Code2 } from 'lucide-react';
import { CODE_MODE_SNIPPET } from '../model/workspace-mock-data';
import type { WorkspaceTab, WorkspaceWindowId } from '../model/types';
import type { ProjectData } from '@/shared/types/project';
import { AiAssistantPane } from './WorkspaceAssistantPane';
import { ClassDiagramCanvas, DiagramCanvas } from './WorkspaceDiagramCanvases';
import { EventsPane, GenericPane, PropertiesPane, SemanticList, TablesPane } from './WorkspaceInspectorPanes';
import { ProjectErDiagramCanvas } from './WorkspaceProjectCanvas';

export function TabContent({
  tab,
  windowId,
  project,
  projectLoading = false,
  projectError = null,
}: {
  tab: WorkspaceTab;
  windowId: WorkspaceWindowId;
  project?: ProjectData;
  projectLoading?: boolean;
  projectError?: string | null;
}) {
  if (projectLoading) return <PaneMessage>Loading project workspace...</PaneMessage>;
  if (projectError) return <PaneMessage>{projectError}</PaneMessage>;

  if (tab.type === 'erDiagram') return project ? <ProjectErDiagramCanvas project={project} /> : <DiagramCanvas />;
  if (tab.type === 'classDiagram') return <ClassDiagramCanvas />;
  if (tab.type === 'aiAssistant') return <AiAssistantPane />;
  if (tab.type === 'codeMode') return <CodeModePane />;
  if (tab.type === 'tables') return <TablesPane project={project} />;
  if (tab.type === 'properties') return <PropertiesPane />;
  if (tab.type === 'events') return <EventsPane />;
  if (tab.type === 'schemas' || tab.type === 'domains' || tab.type === 'entities') return <SemanticList type={tab.type} project={project} />;

  return <GenericPane tab={tab} windowId={windowId} />;
}

function PaneMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-xs font-medium text-slate-400">
      {children}
    </div>
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
        {CODE_MODE_SNIPPET}
      </pre>
    </div>
  );
}

export function EmptyPane() {
  return (
    <div className="flex h-full items-center justify-center text-xs font-medium text-slate-300">
      Empty workspace pane
    </div>
  );
}
