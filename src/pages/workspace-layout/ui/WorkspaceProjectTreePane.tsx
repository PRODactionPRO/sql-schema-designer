import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, ChevronDown, Database, FileJson, FileText, GitBranch, Layers3, Pencil, PencilRuler, Plus, Table2, Trash2, Workflow } from 'lucide-react';
import {
  createClassDiagramProjectDocument,
  createErdProjectDocument,
  createIdef0ProjectDocument,
  type Idef0ProjectDocument,
  type ProjectData,
  type ProjectDocument,
} from '@/shared/types/project';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useOutsidePointerDown } from '@/shared/ui/useOutsidePointerDown';
import { cn } from '@/shared/ui/utils';
import type { WorkspaceSelection, WorkspaceTab } from '../model/types';
import {
  getClassDiagramDocument,
  getProjectDomains,
  selectionMatches,
} from '../model/workspace-project-utils';

export function ProjectTreePane({
  project,
  selection,
  collapsedSectionIds,
  collapsedTableIds,
  onToggleSectionCollapse,
  onToggleTableCollapse,
  onProjectChange,
  onSelectionChange,
  onCloseDocument,
  onOpenDocument,
}: {
  project?: ProjectData;
  selection: WorkspaceSelection | null;
  collapsedSectionIds: Set<string>;
  collapsedTableIds: Set<string>;
  onToggleSectionCollapse: (sectionId: string) => void;
  onToggleTableCollapse: (tableId: string) => void;
  onProjectChange: (project: ProjectData) => void;
  onSelectionChange: (selection: WorkspaceSelection | null) => void;
  onCloseDocument: (documentId: string) => void;
  onOpenDocument: (documentId: string, fallback?: { type: WorkspaceTab['type']; title: string }) => void;
}) {
  const [rootCollapsed, setRootCollapsed] = useState(false);
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [editingProcessName, setEditingProcessName] = useState('');
  const [processToDelete, setProcessToDelete] = useState<Idef0ProjectDocument | null>(null);
  const [diagramMenuOpen, setDiagramMenuOpen] = useState(false);
  const diagramMenuRef = useRef<HTMLDivElement | null>(null);
  const diagramCreateButtonRef = useRef<HTMLButtonElement | null>(null);

  useOutsidePointerDown({
    enabled: diagramMenuOpen,
    refs: [diagramMenuRef, diagramCreateButtonRef],
    onOutsidePointerDown: () => setDiagramMenuOpen(false),
  });

  if (!project) {
    return (
      <div className="h-full overflow-auto p-3">
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
          Project tree will appear after loading
        </div>
      </div>
    );
  }

  const classDiagram = getClassDiagramDocument(project)?.classDiagram;
  const domains = getProjectDomains(project);
  const processModels = project.documents.filter((document): document is Idef0ProjectDocument => document.type === 'idef0');
  const diagrams = project.documents.filter((document) => (
    document.type === 'erd'
    || document.type === 'class-diagram'
    || document.type === 'idef0'
    || document.type === 'bpmn'
    || document.type === 'openapi'
    || document.type === 'sequence'
  ));

  const commitProjectDocuments = (documents: ProjectDocument[]) => {
    onProjectChange({
      ...project,
      documents,
      updatedAt: new Date().toISOString(),
    });
  };

  const createProcessModel = () => {
    const count = processModels.length;
    const name = count === 0 ? 'New process model' : `New process model ${count + 1}`;
    const document = createIdef0ProjectDocument(name, domains);
    const processDocument: Idef0ProjectDocument = {
      ...document,
      idef0: {
        ...document.idef0,
        id: document.id,
        processModelId: document.id,
        name: document.name,
      },
    };
    commitProjectDocuments([...project.documents, processDocument]);
    onSelectionChange({ kind: 'diagram', id: processDocument.id, sourceView: 'diagrams' });
    onOpenDocument(processDocument.id, { type: 'idef0', title: processDocument.name });
  };

  const createDiagram = (type: 'erd' | 'class-diagram' | 'idef0') => {
    if (type === 'idef0') {
      setDiagramMenuOpen(false);
      createProcessModel();
      return;
    }

    const typeDocuments = project.documents.filter((document) => document.type === type);
    const name = type === 'erd'
      ? typeDocuments.length === 0
        ? 'ERD Diagram'
        : `ERD Diagram ${typeDocuments.length + 1}`
      : typeDocuments.length === 0
        ? 'Class Diagram'
        : `Class Diagram ${typeDocuments.length + 1}`;
    const document = type === 'erd'
      ? createErdProjectDocument(name, project.schema)
      : createClassDiagramProjectDocument(name, domains);

    commitProjectDocuments([...project.documents, document]);
    setDiagramMenuOpen(false);
    onSelectionChange({ kind: 'diagram', id: document.id, sourceView: 'diagrams' });
    onOpenDocument(document.id, {
      type: type === 'erd' ? 'erDiagram' : 'classDiagram',
      title: document.name,
    });
  };

  const startRenameProcess = (document: Idef0ProjectDocument) => {
    setEditingProcessId(document.id);
    setEditingProcessName(document.name);
  };

  const commitRenameProcess = () => {
    if (!editingProcessId) return;
    const nextName = editingProcessName.trim();
    if (!nextName) {
      setEditingProcessId(null);
      setEditingProcessName('');
      return;
    }
    commitProjectDocuments(project.documents.map((document) => {
      if (document.id !== editingProcessId || document.type !== 'idef0') return document;
      return {
        ...document,
        name: nextName,
        updatedAt: new Date().toISOString(),
        idef0: {
          ...document.idef0,
          name: nextName,
        },
      };
    }));
    setEditingProcessId(null);
    setEditingProcessName('');
  };

  const deleteProcessModel = () => {
    if (!processToDelete) return;
    commitProjectDocuments(project.documents.filter((document) => document.id !== processToDelete.id));
    if (selection?.id === processToDelete.id) onSelectionChange(null);
    onCloseDocument(processToDelete.id);
    setProcessToDelete(null);
  };

  return (
    <div className="h-full overflow-auto p-2">
      <TreeSection
        title={project.name}
        icon={<Layers3 className="size-3.5" />}
        collapsed={rootCollapsed}
        onToggle={() => setRootCollapsed((current) => !current)}
      >
        <TreeSection
          title="Domains"
          icon={<Box className="size-3.5" />}
          depth={1}
          collapsed={collapsedSectionIds.has('domains')}
          onToggle={() => onToggleSectionCollapse('domains')}
        >
          {domains.map((domain) => (
            <TreeRow
              key={domain.id}
              depth={2}
              icon={<span className="size-2 rounded-full" style={{ backgroundColor: domain.color }} />}
              label={domain.name}
              meta={project.schema.tables.filter((table) => table.domainId === domain.id).length}
              active={selectionMatches(selection, { kind: 'domain', id: domain.id, sourceView: 'model' })}
              onClick={() => onSelectionChange({ kind: 'domain', id: domain.id, sourceView: 'model' })}
            />
          ))}
        </TreeSection>
        <TreeSection
          title="Tables"
          icon={<Table2 className="size-3.5" />}
          depth={1}
          collapsed={collapsedSectionIds.has('tables')}
          onToggle={() => onToggleSectionCollapse('tables')}
        >
          {project.schema.tables.map((table) => {
            const tableActive = selection?.kind === 'table'
              && selection.id === table.id
              && (selection.sourceView === 'model' || selection.sourceView === 'erd');

            return (
              <TreeBranch
                key={table.id}
                depth={2}
                icon={<Table2 className="size-3.5" />}
                label={table.name}
                meta={table.fields.length}
                active={tableActive}
                activeGuide={tableActive}
                collapsed={collapsedTableIds.has(table.id)}
                onClick={() => onSelectionChange({ kind: 'table', id: table.id, sourceView: 'model' })}
                onToggle={() => onToggleTableCollapse(table.id)}
              >
                {table.fields.map((field) => (
                  <TreeRow
                    key={field.id}
                    depth={3}
                    label={field.name}
                    meta={field.type}
                    active={
                      selection?.kind === 'field'
                      && selection.id === field.id
                      && selection.parentId === table.id
                      && (selection.sourceView === 'model' || selection.sourceView === 'erd')
                    }
                    onClick={() => onSelectionChange({ kind: 'field', id: field.id, parentId: table.id, sourceView: 'model' })}
                  />
                ))}
              </TreeBranch>
            );
          })}
        </TreeSection>
        {classDiagram ? (
          <TreeSection
            title="Entities"
            icon={<Box className="size-3.5" />}
            depth={1}
            collapsed={collapsedSectionIds.has('entities')}
            onToggle={() => onToggleSectionCollapse('entities')}
          >
            {classDiagram.classes.map((entity) => (
              <div key={entity.id}>
                <TreeRow
                  depth={2}
                  icon={<Box className="size-3.5" />}
                  label={entity.name}
                  meta={entity.kind ?? 'class'}
                  active={selectionMatches(selection, { kind: 'class', id: entity.id, sourceView: 'model' })}
                  onClick={() => onSelectionChange({ kind: 'class', id: entity.id, sourceView: 'model' })}
                />
                {entity.attributes.map((attribute) => (
                  <TreeRow
                    key={attribute.id}
                    depth={3}
                    label={attribute.name}
                    meta={attribute.type}
                    active={selectionMatches(selection, { kind: 'classAttribute', id: attribute.id, parentId: entity.id, sourceView: 'model' })}
                    onClick={() => onSelectionChange({ kind: 'classAttribute', id: attribute.id, parentId: entity.id, sourceView: 'model' })}
                  />
                ))}
                {entity.methods.map((method) => (
                  <TreeRow
                    key={method.id}
                    depth={3}
                    label={`${method.name}()`}
                    meta={method.returnType ?? 'void'}
                    active={selectionMatches(selection, { kind: 'classMethod', id: method.id, parentId: entity.id, sourceView: 'model' })}
                    onClick={() => onSelectionChange({ kind: 'classMethod', id: method.id, parentId: entity.id, sourceView: 'model' })}
                  />
                ))}
              </div>
            ))}
          </TreeSection>
        ) : null}
        <TreeSection
          title="Enums"
          icon={<FileJson className="size-3.5" />}
          depth={1}
          collapsed={collapsedSectionIds.has('enums')}
          onToggle={() => onToggleSectionCollapse('enums')}
        >
          {project.schema.enums.map((enumType) => (
            <TreeRow
              key={enumType.id}
              depth={2}
              icon={<FileJson className="size-3.5" />}
              label={enumType.name}
              meta={enumType.values.length}
              active={selectionMatches(selection, { kind: 'enum', id: enumType.id, sourceView: 'model' })}
              onClick={() => onSelectionChange({ kind: 'enum', id: enumType.id, sourceView: 'model' })}
            />
          ))}
        </TreeSection>
        <TreeSection
          title="JSON Schemas"
          icon={<FileText className="size-3.5" />}
          depth={1}
          collapsed={collapsedSectionIds.has('jsonSchemas')}
          onToggle={() => onToggleSectionCollapse('jsonSchemas')}
        >
          {(project.schema.jsonSchemas ?? []).map((schema) => (
            <TreeRow
              key={schema.id}
              depth={2}
              icon={<FileText className="size-3.5" />}
              label={schema.name}
              meta={schema.nodes.length}
              active={selectionMatches(selection, { kind: 'jsonSchema', id: schema.id, sourceView: 'model' })}
              onClick={() => onSelectionChange({ kind: 'jsonSchema', id: schema.id, sourceView: 'model' })}
            />
          ))}
        </TreeSection>
        <TreeSection
          title="Processes"
          icon={<Workflow className="size-3.5" />}
          depth={1}
          collapsed={collapsedSectionIds.has('processes')}
          onToggle={() => onToggleSectionCollapse('processes')}
          actions={(
            <TreeSectionActionButton label="Create process model" onClick={createProcessModel}>
              <Plus className="size-3.5" />
            </TreeSectionActionButton>
          )}
        >
          {processModels.map((document) => {
            const isEditing = editingProcessId === document.id;
            return (
              <TreeRow
                key={document.id}
                depth={2}
                icon={<Workflow className="size-3.5" />}
                label={document.name}
                meta="IDEF0"
                active={selectionMatches(selection, { kind: 'diagram', id: document.id, sourceView: 'diagrams' })}
                onClick={() => onSelectionChange({ kind: 'diagram', id: document.id, sourceView: 'diagrams' })}
                onDoubleClick={() => onOpenDocument(document.id, { type: 'idef0', title: document.name })}
                labelNode={isEditing ? (
                  <input
                    className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none"
                    value={editingProcessName}
                    autoFocus
                    onChange={(event) => setEditingProcessName(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onBlur={commitRenameProcess}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitRenameProcess();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingProcessId(null);
                        setEditingProcessName('');
                      }
                    }}
                  />
                ) : undefined}
                actions={!isEditing ? (
                  <>
                    <TreeActionButton label="Rename process model" onClick={() => startRenameProcess(document)}>
                      <Pencil className="size-3" />
                    </TreeActionButton>
                    <TreeActionButton label="Delete process model" danger onClick={() => setProcessToDelete(document)}>
                      <Trash2 className="size-3" />
                    </TreeActionButton>
                  </>
                ) : null}
              />
            );
          })}
        </TreeSection>
        <TreeSection
          title="Diagrams"
          icon={<GitBranch className="size-3.5" />}
          depth={1}
          collapsed={collapsedSectionIds.has('diagrams')}
          onToggle={() => onToggleSectionCollapse('diagrams')}
          actions={(
            <div className="relative">
              <TreeSectionActionButton
                buttonRef={diagramCreateButtonRef}
                label="Create diagram"
                onClick={() => setDiagramMenuOpen((current) => !current)}
              >
                <Plus className="size-3.5" />
              </TreeSectionActionButton>
              {diagramMenuOpen ? (
                <div
                  ref={diagramMenuRef}
                  className="absolute right-0 top-6 z-30 w-[240px] overflow-hidden rounded-2xl bg-[#1f1f1f] py-2 text-white shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
                >
                  <div className="workspace-dark-popup-scroll max-h-[220px] overflow-y-auto px-2">
                    <DiagramCreateMenuItem icon={<Database className="size-4 text-white/75" />} label="ERD diagram" onClick={() => createDiagram('erd')} />
                    <DiagramCreateMenuItem icon={<GitBranch className="size-4 text-white/75" />} label="Class diagram" onClick={() => createDiagram('class-diagram')} />
                    <DiagramCreateMenuItem icon={<Workflow className="size-4 text-white/75" />} label="IDEF0 functional model" onClick={() => createDiagram('idef0')} />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        >
          {diagrams.map((document) => (
            <TreeRow
              key={document.id}
              depth={2}
              icon={getDiagramIcon(document.type)}
              label={document.name}
              meta={document.type}
              active={selectionMatches(selection, { kind: 'diagram', id: document.id, sourceView: 'diagrams' })}
              onClick={() => onSelectionChange({ kind: 'diagram', id: document.id, sourceView: 'diagrams' })}
              onDoubleClick={() => onOpenDocument(document.id)}
            />
          ))}
        </TreeSection>
      </TreeSection>
      <ConfirmDialog
        open={!!processToDelete}
        onOpenChange={(open) => {
          if (!open) setProcessToDelete(null);
        }}
        title="Delete process model?"
        description={processToDelete ? `This will remove "${processToDelete.name}" from the project tree.` : undefined}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={deleteProcessModel}
      />
    </div>
  );
}

function TreeBranch({
  depth,
  icon,
  label,
  meta,
  active,
  activeGuide = false,
  collapsed,
  onClick,
  onToggle,
  children,
}: {
  depth: number;
  icon?: ReactNode;
  label: string;
  meta?: string | number;
  active?: boolean;
  activeGuide?: boolean;
  collapsed: boolean;
  onClick: () => void;
  onToggle: () => void;
  children: ReactNode;
}) {
  const fontSize = getTreeFontSize(depth);
  const guideLeft = 20 + depth * 14;

  return (
    <div className="relative">
      {!collapsed ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-[27px] bottom-1 z-20 w-px rounded-full',
            activeGuide ? 'bg-blue-400/80' : 'bg-slate-300/70',
          )}
          style={{ left: guideLeft }}
        />
      ) : null}
      <div
        className={cn(
          'relative z-10 flex h-7 w-full items-center rounded-md pr-2 text-left font-medium transition-colors',
          active ? 'bg-[#eeeff0] text-slate-950' : 'text-slate-500 hover:bg-white hover:text-slate-800',
        )}
        style={{ paddingLeft: 12 + depth * 14, fontSize, lineHeight: '18px' }}
      >
        <button
          type="button"
          className="mr-1 flex size-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          <ChevronDown className={cn('size-3.5 transition-transform', activeGuide && 'text-blue-500', collapsed && '-rotate-90')} />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={onClick}
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center text-slate-400">{icon}</span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {meta !== undefined ? <span className="shrink-0 text-[10px] text-slate-400">{meta}</span> : null}
        </button>
      </div>
      {collapsed ? null : children}
    </div>
  );
}

function getDiagramIcon(type: ProjectDocument['type']) {
  if (type === 'erd') return <Database className="size-3.5" />;
  if (type === 'class-diagram') return <GitBranch className="size-3.5" />;
  if (type === 'idef0') return <Workflow className="size-3.5" />;
  if (type === 'bpmn') return <Workflow className="size-3.5" />;
  if (type === 'openapi') return <FileJson className="size-3.5" />;
  if (type === 'sequence') return <PencilRuler className="size-3.5" />;
  return <FileText className="size-3.5" />;
}

function TreeSection({
  title,
  icon,
  depth = 0,
  activeGuide = false,
  collapsed,
  onToggle,
  actions,
  children,
}: {
  title: string;
  icon: ReactNode;
  depth?: number;
  activeGuide?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const fontSize = getTreeFontSize(depth);
  const guideLeft = 15 + depth * 14;

  return (
    <div className="relative">
      {!collapsed ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-[23px] bottom-1 z-20 w-px rounded-full',
            activeGuide ? 'bg-blue-400/80' : 'bg-slate-300/70',
          )}
          style={{ left: guideLeft }}
        />
      ) : null}
      <div
        className={cn(
          'relative z-10 flex h-7 w-full items-center gap-1 rounded-md px-2 transition-colors hover:bg-white/70',
          activeGuide ? 'text-slate-800' : 'text-slate-600',
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold"
          onClick={onToggle}
        >
          <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', activeGuide ? 'text-blue-500' : 'text-slate-400', collapsed && '-rotate-90')} />
          <span className="shrink-0 text-slate-400">{icon}</span>
          <span className="min-w-0 truncate" style={{ fontSize, lineHeight: '18px' }}>{title}</span>
        </button>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</div> : null}
      </div>
      {collapsed ? null : children}
    </div>
  );
}

function getTreeFontSize(depth: number): number {
  return Math.max(10, 15 - depth);
}

function TreeRow({
  depth,
  icon,
  label,
  labelNode,
  meta,
  actions,
  active,
  onClick,
  onDoubleClick,
}: {
  depth: number;
  icon?: ReactNode;
  label: string;
  labelNode?: ReactNode;
  meta?: string | number;
  actions?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const className = cn(
    'group/tree-row flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left font-medium transition-colors',
    active ? 'bg-[#eeeff0] text-slate-950' : 'text-slate-500 hover:bg-white hover:text-slate-800',
    !onClick && 'cursor-default hover:bg-transparent',
  );

  return (
    <button
      type="button"
      className={className}
      style={{ paddingLeft: 26 + depth * 14, fontSize: getTreeFontSize(depth), lineHeight: '18px' }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center text-slate-400">{icon}</span>
      {labelNode ?? <span className="min-w-0 flex-1 truncate">{label}</span>}
      {meta !== undefined ? <span className="shrink-0 text-[10px] text-slate-400">{meta}</span> : null}
      {actions ? <span className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 group-hover/tree-row:opacity-100">{actions}</span> : null}
    </button>
  );
}

function TreeActionButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      className={cn(
        'flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700',
        danger && 'hover:text-red-600',
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </span>
  );
}

function TreeSectionActionButton({
  label,
  onClick,
  buttonRef,
  children,
}: {
  label: string;
  onClick: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      className="flex size-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function DiagramCreateMenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-white hover:bg-white/10"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
