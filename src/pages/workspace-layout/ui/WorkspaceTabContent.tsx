import { Code2 } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { Idef0Canvas } from './WorkspaceIdef0Canvas';
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
  projectTreeCollapsedSectionIds,
  projectTreeCollapsedTableIds,
  onToggleProjectTreeSectionCollapse,
  onToggleProjectTreeTableCollapse,
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
  projectTreeCollapsedSectionIds: Set<string>;
  projectTreeCollapsedTableIds: Set<string>;
  onToggleProjectTreeSectionCollapse: (sectionId: string) => void;
  onToggleProjectTreeTableCollapse: (tableId: string) => void;
  onProjectChange: (project: ProjectData) => void;
  onSelectionChange: (selection: WorkspaceSelection | null) => void;
  onCloseDocument: (documentId: string) => void;
  onOpenDocument: (documentId: string, fallback?: { type: WorkspaceTab['type']; title: string }) => void;
  onCanvasViewportChange: (viewId: WorkspaceCanvasViewportId, viewport: WorkspaceCanvasViewport) => void;
}) {
  if (projectLoading) return <PaneMessage>Loading project workspace...</PaneMessage>;
  if (projectError) return <PaneMessage>{projectError}</PaneMessage>;

  if (tab.type === 'file') {
    return (
      <ProjectTreePane
        project={project}
        selection={selection}
        collapsedSectionIds={projectTreeCollapsedSectionIds}
        collapsedTableIds={projectTreeCollapsedTableIds}
        onToggleSectionCollapse={onToggleProjectTreeSectionCollapse}
        onToggleTableCollapse={onToggleProjectTreeTableCollapse}
        onProjectChange={onProjectChange}
        onSelectionChange={onSelectionChange}
        onCloseDocument={onCloseDocument}
        onOpenDocument={onOpenDocument}
      />
    );
  }
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
    return project && document ? (
      <Idef0Canvas
        project={project}
        document={document}
        selection={selection}
        initialViewport={canvasViewports.idef0}
        viewportRestoreKey={`idef0-${viewportRestoreKey}-${document.id}`}
        onProjectChange={onProjectChange}
        onSelectionChange={onSelectionChange}
        onViewportChange={(viewport) => onCanvasViewportChange('idef0', viewport)}
      />
    ) : <PaneMessage>Select or create an IDEF0 model from the project tree.</PaneMessage>;
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

function PaneMessage({ children }: { children: ReactNode }) {
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
