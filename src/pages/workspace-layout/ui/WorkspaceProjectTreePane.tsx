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
  nextWorkspaceId,
  selectionMatches,
  withClassDiagram,
  withSchema,
} from '../model/workspace-project-utils';

function getUniqueName(existingNames: string[], baseName: string): string {
  const used = new Set(existingNames.map((name) => name.toLowerCase()));
  if (!used.has(baseName.toLowerCase())) return baseName;

  let index = 2;
  while (used.has(`${baseName}${index}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName}${index}`;
}

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
  const [editingTarget, setEditingTarget] = useState<{
    kind: 'table' | 'field' | 'class' | 'classAttribute' | 'diagram';
    id: string;
    parentId?: string;
  } | null>(null);
  const [editingName, setEditingName] = useState('');
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

  const classDiagramDocument = getClassDiagramDocument(project);
  const classDiagram = classDiagramDocument?.classDiagram;
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

  const commitProjectSchema = (schema: ProjectData['schema']) => {
    onProjectChange(withSchema(project, schema));
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

  const createTable = () => {
    const name = getUniqueName(project.schema.tables.map((item) => item.name), 'Table');
    const table = {
      id: nextWorkspaceId('table'),
      name,
      fields: [],
      position: { x: 160 + project.schema.tables.length * 28, y: 140 + project.schema.tables.length * 28 },
      color: '#64748b',
      sidebarOrder: project.schema.tables.length,
    };

    commitProjectSchema({
      ...project.schema,
      tables: [...project.schema.tables, table],
    });
    onSelectionChange({ kind: 'table', id: table.id, sourceView: 'model' });
  };

  const createEnum = () => {
    const name = getUniqueName(project.schema.enums.map((item) => item.name), 'NewEnum');
    const enumType = {
      id: nextWorkspaceId('enum'),
      name,
      values: ['value_1', 'value_2'],
      storageStrategy: 'postgres_enum' as const,
      position: { x: 260 + project.schema.enums.length * 40, y: 140 + project.schema.enums.length * 40 },
    };

    commitProjectSchema({
      ...project.schema,
      enums: [...project.schema.enums, enumType],
    });
    onSelectionChange({ kind: 'enum', id: enumType.id, sourceView: 'model' });
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

  const startInlineRename = (
    kind: 'table' | 'field' | 'class' | 'classAttribute' | 'diagram',
    id: string,
    currentName: string,
    parentId?: string,
  ) => {
    setEditingTarget({ kind, id, parentId });
    setEditingName(currentName);
  };

  const cancelInlineRename = () => {
    setEditingTarget(null);
    setEditingName('');
  };

  const commitInlineRename = () => {
    if (!editingTarget) return;
    const nextName = editingName.trim();
    if (!nextName) {
      cancelInlineRename();
      return;
    }

    if (editingTarget.kind === 'table') {
      commitProjectSchema({
        ...project.schema,
        tables: project.schema.tables.map((table) => (
          table.id === editingTarget.id ? { ...table, name: nextName } : table
        )),
      });
      cancelInlineRename();
      return;
    }

    if (editingTarget.kind === 'field') {
      commitProjectSchema({
        ...project.schema,
        tables: project.schema.tables.map((table) => (
          table.id !== editingTarget.parentId
            ? table
            : {
                ...table,
                fields: table.fields.map((field) => (
                  field.id === editingTarget.id ? { ...field, name: nextName } : field
                )),
              }
        )),
      });
      cancelInlineRename();
      return;
    }

    if (editingTarget.kind === 'class' && classDiagramDocument) {
      const nextDiagram = {
        ...classDiagramDocument.classDiagram,
        classes: classDiagramDocument.classDiagram.classes.map((entity) => (
          entity.id === editingTarget.id ? { ...entity, name: nextName } : entity
        )),
      };
      onProjectChange(withClassDiagram(project, nextDiagram));
      cancelInlineRename();
      return;
    }

    if (editingTarget.kind === 'classAttribute' && classDiagramDocument) {
      const nextDiagram = {
        ...classDiagramDocument.classDiagram,
        classes: classDiagramDocument.classDiagram.classes.map((entity) => (
          entity.id !== editingTarget.parentId
            ? entity
            : {
                ...entity,
                attributes: entity.attributes.map((attribute) => (
                  attribute.id === editingTarget.id ? { ...attribute, name: nextName } : attribute
                )),
              }
        )),
      };
      onProjectChange(withClassDiagram(project, nextDiagram));
      cancelInlineRename();
      return;
    }

    if (editingTarget.kind === 'diagram') {
      const now = new Date().toISOString();
      commitProjectDocuments(project.documents.map((document) => {
        if (document.id !== editingTarget.id) return document;
        if (document.type === 'idef0') {
          return {
            ...document,
            name: nextName,
            updatedAt: now,
            idef0: {
              ...document.idef0,
              name: nextName,
            },
          };
        }
        return {
          ...document,
          name: nextName,
          updatedAt: now,
        };
      }));
      cancelInlineRename();
    }
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
          actions={(
            <TreeSectionActionButton label="Create table" onClick={createTable}>
              <Plus className="size-3.5" />
            </TreeSectionActionButton>
          )}
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
                onDoubleClick={() => startInlineRename('table', table.id, table.name)}
                labelNode={editingTarget?.kind === 'table' && editingTarget.id === table.id ? (
                  <InlineRenameInput
                    value={editingName}
                    onChange={setEditingName}
                    onCommit={commitInlineRename}
                    onCancel={cancelInlineRename}
                  />
                ) : undefined}
                actions={editingTarget?.kind === 'table' && editingTarget.id === table.id ? null : (
                  <TreeActionButton label="Rename table" onClick={() => startInlineRename('table', table.id, table.name)}>
                    <Pencil className="size-3" />
                  </TreeActionButton>
                )}
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
                    onDoubleClick={() => startInlineRename('field', field.id, field.name, table.id)}
                    labelNode={editingTarget?.kind === 'field' && editingTarget.id === field.id && editingTarget.parentId === table.id ? (
                      <InlineRenameInput
                        value={editingName}
                        onChange={setEditingName}
                        onCommit={commitInlineRename}
                        onCancel={cancelInlineRename}
                      />
                    ) : undefined}
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
            {classDiagram.classes.map((entity) => {
              const entityActive = selectionMatches(selection, { kind: 'class', id: entity.id, sourceView: 'model' });
              return (
                <TreeBranch
                  key={entity.id}
                  depth={2}
                  icon={<Box className="size-3.5" />}
                  label={entity.name}
                  meta={entity.kind ?? 'class'}
                  active={entityActive}
                  activeGuide={entityActive}
                  collapsed={collapsedTableIds.has(entity.id)}
                  onClick={() => onSelectionChange({ kind: 'class', id: entity.id, sourceView: 'model' })}
                  onToggle={() => onToggleTableCollapse(entity.id)}
                  onDoubleClick={() => startInlineRename('class', entity.id, entity.name)}
                  labelNode={editingTarget?.kind === 'class' && editingTarget.id === entity.id ? (
                    <InlineRenameInput
                      value={editingName}
                      onChange={setEditingName}
                      onCommit={commitInlineRename}
                      onCancel={cancelInlineRename}
                    />
                  ) : undefined}
                  actions={editingTarget?.kind === 'class' && editingTarget.id === entity.id ? null : (
                    <TreeActionButton label="Rename class" onClick={() => startInlineRename('class', entity.id, entity.name)}>
                      <Pencil className="size-3" />
                    </TreeActionButton>
                  )}
                >
                  {entity.attributes.map((attribute) => (
                    <TreeRow
                      key={attribute.id}
                      depth={3}
                      label={attribute.name}
                      meta={attribute.type}
                      active={selectionMatches(selection, { kind: 'classAttribute', id: attribute.id, parentId: entity.id, sourceView: 'model' })}
                      onClick={() => onSelectionChange({ kind: 'classAttribute', id: attribute.id, parentId: entity.id, sourceView: 'model' })}
                      onDoubleClick={() => startInlineRename('classAttribute', attribute.id, attribute.name, entity.id)}
                      labelNode={editingTarget?.kind === 'classAttribute' && editingTarget.id === attribute.id && editingTarget.parentId === entity.id ? (
                        <InlineRenameInput
                          value={editingName}
                          onChange={setEditingName}
                          onCommit={commitInlineRename}
                          onCancel={cancelInlineRename}
                        />
                      ) : undefined}
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
                </TreeBranch>
              );
            })}
          </TreeSection>
        ) : null}
        <TreeSection
          title="Enums"
          icon={<FileJson className="size-3.5" />}
          depth={1}
          collapsed={collapsedSectionIds.has('enums')}
          onToggle={() => onToggleSectionCollapse('enums')}
          actions={(
            <TreeSectionActionButton label="Create enum" onClick={createEnum}>
              <Plus className="size-3.5" />
            </TreeSectionActionButton>
          )}
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
            const isEditing = editingTarget?.kind === 'diagram' && editingTarget.id === document.id;
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
                  <InlineRenameInput
                    value={editingName}
                    onChange={setEditingName}
                    onCommit={commitInlineRename}
                    onCancel={cancelInlineRename}
                  />
                ) : undefined}
                actions={!isEditing ? (
                  <>
                    <TreeActionButton label="Rename process model" onClick={() => startInlineRename('diagram', document.id, document.name)}>
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
              labelNode={editingTarget?.kind === 'diagram' && editingTarget.id === document.id ? (
                <InlineRenameInput
                  value={editingName}
                  onChange={setEditingName}
                  onCommit={commitInlineRename}
                  onCancel={cancelInlineRename}
                />
              ) : undefined}
              actions={editingTarget?.kind === 'diagram' && editingTarget.id === document.id ? null : (
                <TreeActionButton label="Rename diagram" onClick={() => startInlineRename('diagram', document.id, document.name)}>
                  <Pencil className="size-3" />
                </TreeActionButton>
              )}
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
  onDoubleClick,
  labelNode,
  actions,
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
  onDoubleClick?: () => void;
  labelNode?: ReactNode;
  actions?: ReactNode;
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
          className="group/tree-row flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={onClick}
          onDoubleClick={onDoubleClick}
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center text-slate-400">{icon}</span>
          {labelNode ?? <span className="min-w-0 flex-1 truncate">{label}</span>}
          {meta !== undefined ? <span className="shrink-0 text-[10px] text-slate-400">{meta}</span> : null}
          {actions ? <span className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 group-hover/tree-row:opacity-100">{actions}</span> : null}
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
          className={cn('flex min-w-0 flex-1 items-center gap-2 text-left', depth === 0 ? 'font-semibold' : 'font-medium')}
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
  return Math.max(11, 13 - depth);
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

function InlineRenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-1.5 py-0.5 text-slate-900 outline-none"
      style={{ fontSize: 'inherit', lineHeight: '18px' }}
      value={value}
      autoFocus
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    />
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
