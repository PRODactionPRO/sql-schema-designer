import { Table2 } from 'lucide-react';
import type { ProjectData } from '@/shared/types/project';
import { cn } from '@/shared/ui/utils';
import {
  EVENT_ROWS,
  GENERIC_ROWS_BY_TYPE,
  PROPERTY_ROWS,
  SEMANTIC_LISTS,
  TABLE_ITEMS,
} from '../model/workspace-mock-data';
import type { WorkspaceTab, WorkspaceWindowId } from '../model/types';

function getProjectDomains(project: ProjectData) {
  return project.domains.length > 0 ? project.domains : project.schema.domains;
}

function getSemanticItems(type: 'schemas' | 'domains' | 'entities', project?: ProjectData): Array<{ id: string; label: string; count?: number; color?: string }> {
  if (!project) {
    return SEMANTIC_LISTS[type].map((item, index) => ({ id: `${type}-${index}`, label: item, count: index + 1 }));
  }

  if (type === 'domains') {
    return getProjectDomains(project).map((domain) => ({
      id: domain.id,
      label: domain.name,
      count: project.schema.tables.filter((table) => table.domainId === domain.id).length,
      color: domain.color,
    }));
  }

  if (type === 'entities') {
    return [
      ...project.schema.tables.map((table) => ({ id: table.id, label: table.name, count: table.fields.length, color: table.color })),
      ...project.schema.enums.map((enumType) => ({ id: enumType.id, label: enumType.name, count: enumType.values.length, color: enumType.domainId ? getProjectDomains(project).find((domain) => domain.id === enumType.domainId)?.color : undefined })),
    ];
  }

  const schemas = Array.from(new Set(project.schema.tables.map((table) => table.schema || 'public')));
  return [
    ...schemas.map((schemaName) => ({
      id: `schema-${schemaName}`,
      label: schemaName,
      count: project.schema.tables.filter((table) => (table.schema || 'public') === schemaName).length,
    })),
    ...(project.schema.jsonSchemas ?? []).map((schema) => ({ id: schema.id, label: schema.name, count: schema.nodes.length })),
  ];
}

export function TablesPane({ project }: { project?: ProjectData }) {
  const tables = project?.schema.tables;

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {(tables ?? TABLE_ITEMS).map((table, index) => {
          const tableName = typeof table === 'string' ? table : table.name;
          const fieldCount = typeof table === 'string' ? 8 + index : table.fields.length;

          return (
          <div key={typeof table === 'string' ? table : table.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Table2 className="size-3.5 text-slate-400" />
              {tableName}
            </div>
            <span className="text-[11px] text-slate-400">{fieldCount} fields</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function PropertiesPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="rounded-lg border border-[#f39b12]/50 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-800">JourneyStage</div>
        <div className="mt-4 grid gap-3 text-xs">
          {PROPERTY_ROWS.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
              <span className="text-slate-400">{label}</span>
              <span className="font-medium text-slate-700">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EventsPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {EVENT_ROWS.map(([event, source]) => (
          <div key={event} className="grid grid-cols-[1fr_auto] items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-slate-700">{event}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">{source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SemanticList({ type, project }: { type: 'schemas' | 'domains' | 'entities'; project?: ProjectData }) {
  const items = getSemanticItems(type, project);

  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid gap-1.5">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors',
              index === 0 ? 'bg-[#eeeff0] text-slate-900' : 'text-slate-500 hover:bg-white hover:text-slate-800',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {item.color ? <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /> : null}
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-[10px] text-slate-400">{item.count ?? index + 1}</span>
          </button>
        ))}
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
            No {type} yet
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GenericPane({ tab, windowId }: { tab: WorkspaceTab; windowId: WorkspaceWindowId }) {
  const rows = GENERIC_ROWS_BY_TYPE[tab.type] ?? ['Semantic object', 'Projection', 'Relation', 'Action'];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={row} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">{row}</span>
            <span className="text-[11px] text-slate-400">{windowId}.{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
