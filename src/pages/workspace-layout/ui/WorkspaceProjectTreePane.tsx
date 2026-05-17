import { useState } from 'react';
import type { ReactNode } from 'react';
import { Box, ChevronDown, Database, FileJson, FileText, GitBranch, Layers3, PencilRuler, Table2, Workflow } from 'lucide-react';
import type { ProjectData, ProjectDocument } from '@/shared/types/project';
import { cn } from '@/shared/ui/utils';
import type { WorkspaceSelection } from '../model/types';
import {
  getClassDiagramDocument,
  getProjectDomains,
  selectionMatches,
} from '../model/workspace-project-utils';

export function ProjectTreePane({
  project,
  selection,
  onSelectionChange,
}: {
  project?: ProjectData;
  selection: WorkspaceSelection | null;
  onSelectionChange: (selection: WorkspaceSelection | null) => void;
}) {
  const [collapsedTableIds, setCollapsedTableIds] = useState<Set<string>>(() => new Set());

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
  const domainsActive = selection?.kind === 'domain';
  const tablesActive = selection?.kind === 'table' || selection?.kind === 'field' || selection?.kind === 'relation';
  const entitiesActive = selection?.kind === 'class' || selection?.kind === 'classAttribute' || selection?.kind === 'classMethod';
  const enumsActive = selection?.kind === 'enum';
  const jsonSchemasActive = selection?.kind === 'jsonSchema';
  const diagramsActive = selection?.kind === 'diagram';
  const diagrams = project.documents.filter((document) => (
    document.type === 'erd'
    || document.type === 'class-diagram'
    || document.type === 'bpmn'
    || document.type === 'openapi'
    || document.type === 'sequence'
  ));

  return (
    <div className="h-full overflow-auto p-2">
      <TreeSection title={project.name} icon={<Layers3 className="size-3.5" />}>
        <TreeSection title="Domains" icon={<Box className="size-3.5" />} depth={1} activeGuide={domainsActive}>
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
        <TreeSection title="Tables" icon={<Table2 className="size-3.5" />} depth={1} activeGuide={tablesActive}>
          {project.schema.tables.map((table) => {
            const tableActive = selection?.kind === 'table'
              && selection.id === table.id
              && (selection.sourceView === 'model' || selection.sourceView === 'erd');
            const tableFieldActive = selection?.kind === 'field'
              && selection.parentId === table.id
              && (selection.sourceView === 'model' || selection.sourceView === 'erd');

            return (
              <TreeBranch
                key={table.id}
                depth={2}
                icon={<Table2 className="size-3.5" />}
                label={table.name}
                meta={table.fields.length}
                active={tableActive}
                activeGuide={tableActive || tableFieldActive}
                collapsed={collapsedTableIds.has(table.id)}
                onClick={() => onSelectionChange({ kind: 'table', id: table.id, sourceView: 'model' })}
                onToggle={() => setCollapsedTableIds((current) => {
                  const next = new Set(current);
                  if (next.has(table.id)) next.delete(table.id);
                  else next.add(table.id);
                  return next;
                })}
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
          <TreeSection title="Entities" icon={<Box className="size-3.5" />} depth={1} activeGuide={entitiesActive}>
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
        <TreeSection title="Enums" icon={<FileJson className="size-3.5" />} depth={1} activeGuide={enumsActive}>
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
        <TreeSection title="JSON Schemas" icon={<FileText className="size-3.5" />} depth={1} activeGuide={jsonSchemasActive}>
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
        <TreeSection title="Diagrams" icon={<GitBranch className="size-3.5" />} depth={1} activeGuide={diagramsActive}>
          {diagrams.map((document) => (
            <TreeRow
              key={document.id}
              depth={2}
              icon={getDiagramIcon(document.type)}
              label={document.name}
              meta={document.type}
              active={selectionMatches(selection, { kind: 'diagram', id: document.id, sourceView: 'diagrams' })}
              onClick={() => onSelectionChange({ kind: 'diagram', id: document.id, sourceView: 'diagrams' })}
            />
          ))}
        </TreeSection>
      </TreeSection>
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
  children,
}: {
  title: string;
  icon: ReactNode;
  depth?: number;
  activeGuide?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
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
      <button
        type="button"
        className={cn(
          'relative z-10 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left font-semibold transition-colors hover:bg-white/70',
          activeGuide ? 'text-slate-800' : 'text-slate-600',
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => setCollapsed((current) => !current)}
      >
        <ChevronDown className={cn('size-3.5 transition-transform', activeGuide ? 'text-blue-500' : 'text-slate-400', collapsed && '-rotate-90')} />
        <span className="text-slate-400">{icon}</span>
        <span className="min-w-0 truncate" style={{ fontSize, lineHeight: '18px' }}>{title}</span>
      </button>
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
  meta,
  active,
  onClick,
}: {
  depth: number;
  icon?: ReactNode;
  label: string;
  meta?: string | number;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left font-medium transition-colors',
    active ? 'bg-[#eeeff0] text-slate-950' : 'text-slate-500 hover:bg-white hover:text-slate-800',
    !onClick && 'cursor-default hover:bg-transparent',
  );

  return (
    <button
      type="button"
      className={className}
      style={{ paddingLeft: 26 + depth * 14, fontSize: getTreeFontSize(depth), lineHeight: '18px' }}
      onClick={onClick}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta !== undefined ? <span className="shrink-0 text-[10px] text-slate-400">{meta}</span> : null}
    </button>
  );
}
