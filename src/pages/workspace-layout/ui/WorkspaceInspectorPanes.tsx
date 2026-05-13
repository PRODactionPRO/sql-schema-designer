import { Table2 } from 'lucide-react';
import { cn } from '@/shared/ui/utils';
import {
  EVENT_ROWS,
  GENERIC_ROWS_BY_TYPE,
  PROPERTY_ROWS,
  SEMANTIC_LISTS,
  TABLE_ITEMS,
} from '../model/workspace-mock-data';
import type { WorkspaceTab, WorkspaceWindowId } from '../model/types';

export function TablesPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {TABLE_ITEMS.map((table, index) => (
          <div key={table} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <Table2 className="size-3.5 text-slate-400" />
              {table}
            </div>
            <span className="text-[11px] text-slate-400">{8 + index} fields</span>
          </div>
        ))}
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

export function SemanticList({ type }: { type: 'schemas' | 'domains' | 'entities' }) {
  const items = SEMANTIC_LISTS[type];

  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid gap-1.5">
        {items.map((item, index) => (
          <button
            key={item}
            type="button"
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors',
              index === 0 ? 'bg-[#eeeff0] text-slate-900' : 'text-slate-500 hover:bg-white hover:text-slate-800',
            )}
          >
            {item}
            <span className="text-[10px] text-slate-400">{index + 1}</span>
          </button>
        ))}
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
