import { Code2 } from 'lucide-react';
import { CODE_MODE_SNIPPET } from '../model/workspace-mock-data';
import type {
  WorkspaceCanvasViewport,
  WorkspaceCanvasViewportId,
  WorkspaceSelection,
  WorkspaceTab,
  WorkspaceWindowId,
} from '../model/types';
import type { ProjectData } from '@/shared/types/project';
import { AiAssistantPane } from './WorkspaceAssistantPane';
import { ClassDiagramCanvas, DiagramCanvas } from './WorkspaceDiagramCanvases';
import { EventsPane, GenericPane, SemanticList } from './WorkspaceInspectorPanes';
import { WorkspaceDomainsPane } from './WorkspaceDomainsPane';
import { WorkspaceEntitiesPane } from './WorkspaceEntitiesPane';
import { ProjectTreePane } from './WorkspaceProjectTreePane';
import { PropertiesPane } from './WorkspacePropertiesPane';
import { ProjectErDiagramCanvas } from './WorkspaceProjectCanvas';
import { WorkspaceTablesPane } from './WorkspaceTablesPane';

export function TabContent({
  tab,
  windowId,
  project,
  projectLoading = false,
  projectError = null,
  selection,
  canvasViewports,
  viewportRestoreKey,
  onProjectChange,
  onSelectionChange,
  onCloseDocument,
  onOpenDocument,
  onCanvasViewportChange,
}: {
  tab: WorkspaceTab;
  windowId: WorkspaceWindowId;
  project?: ProjectData;
  projectLoading?: boolean;
  projectError?: string | null;
  selection: WorkspaceSelection | null;
  canvasViewports: Partial<Record<WorkspaceCanvasViewportId, WorkspaceCanvasViewport>>;
  viewportRestoreKey: string | number;
  onProjectChange: (project: ProjectData) => void;
  onSelectionChange: (selection: WorkspaceSelection | null) => void;
  onCloseDocument: (documentId: string) => void;
  onOpenDocument: (documentId: string, fallback?: { type: WorkspaceTab['type']; title: string }) => void;
  onCanvasViewportChange: (viewId: WorkspaceCanvasViewportId, viewport: WorkspaceCanvasViewport) => void;
}) {
  if (projectLoading) return <PaneMessage>Loading project workspace...</PaneMessage>;
  if (projectError) return <PaneMessage>{projectError}</PaneMessage>;

  if (tab.type === 'file') return <ProjectTreePane project={project} selection={selection} onProjectChange={onProjectChange} onSelectionChange={onSelectionChange} onCloseDocument={onCloseDocument} onOpenDocument={onOpenDocument} />;
  if (tab.type === 'erDiagram') {
    return project ? (
      <ProjectErDiagramCanvas
        project={project}
        initialViewport={canvasViewports.erDiagram}
        viewportRestoreKey={`erd-${viewportRestoreKey}`}
        onProjectChange={onProjectChange}
        onSelectionChange={onSelectionChange}
        onViewportChange={(viewport) => onCanvasViewportChange('erDiagram', viewport)}
      />
    ) : <DiagramCanvas />;
  }
  if (tab.type === 'classDiagram') {
    return (
      <ClassDiagramCanvas
        project={project}
        selection={selection}
        initialViewport={canvasViewports.classDiagram}
        viewportRestoreKey={`class-${viewportRestoreKey}`}
        onProjectChange={onProjectChange}
        onSelectionChange={onSelectionChange}
        onViewportChange={(viewport) => onCanvasViewportChange('classDiagram', viewport)}
      />
    );
  }
  if (tab.type === 'idef0') {
    const document = project?.documents.find((item): item is Extract<ProjectData['documents'][number], { type: 'idef0' }> => (
      item.id === tab.documentId && item.type === 'idef0'
    ));
    return <Idef0Pane document={document} />;
  }
  if (tab.type === 'aiAssistant') return <AiAssistantPane />;
  if (tab.type === 'codeMode') return <CodeModePane />;
  if (tab.type === 'tables') return <WorkspaceTablesPane project={project} selection={selection} onProjectChange={onProjectChange} onSelectionChange={onSelectionChange} />;
  if (tab.type === 'properties') return <PropertiesPane project={project} selection={selection} onProjectChange={onProjectChange} onSelectionChange={onSelectionChange} />;
  if (tab.type === 'events') return <EventsPane />;
  if (tab.type === 'domains') return <WorkspaceDomainsPane project={project} selection={selection} onProjectChange={onProjectChange} />;
  if (tab.type === 'entities') return <WorkspaceEntitiesPane project={project} selection={selection} onProjectChange={onProjectChange} onSelectionChange={onSelectionChange} />;
  if (tab.type === 'schemas') return <SemanticList type={tab.type} project={project} selection={selection} onSelectionChange={onSelectionChange} />;

  return <GenericPane tab={tab} windowId={windowId} />;
}

function Idef0Pane({ document }: { document?: Extract<ProjectData['documents'][number], { type: 'idef0' }> }) {
  if (!document) return <PaneMessage>Select or create an IDEF0 model from the project tree.</PaneMessage>;

  return (
    <div className="flex h-full flex-col bg-[#f8fafc]">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{document.name}</div>
        <div className="mt-1 text-xs text-slate-500">IDEF0 functional model</div>
      </div>
      <div className="grid flex-1 place-items-center p-6">
        <div className="w-full max-w-xl rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
          <div className="font-medium text-slate-800">Canvas placeholder</div>
          <div className="mt-2 text-xs leading-5">
            The model contract is ready: functions, concepts, and ICOM arrows. The visual editor can now be built against this tab.
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-slate-200 px-3 py-2">
              <div className="text-slate-400">Functions</div>
              <div className="mt-1 font-semibold text-slate-800">{document.idef0.functions.length}</div>
            </div>
            <div className="rounded border border-slate-200 px-3 py-2">
              <div className="text-slate-400">Concepts</div>
              <div className="mt-1 font-semibold text-slate-800">{document.idef0.concepts.length}</div>
            </div>
            <div className="rounded border border-slate-200 px-3 py-2">
              <div className="text-slate-400">Arrows</div>
              <div className="mt-1 font-semibold text-slate-800">{document.idef0.arrows.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
