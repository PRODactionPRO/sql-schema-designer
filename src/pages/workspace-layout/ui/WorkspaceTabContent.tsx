import type { ReactNode } from 'react';
import {
  ArrowUp,
  Blocks,
  Code2,
  Mic,
  Plus,
  Sparkles,
  Table2,
} from 'lucide-react';
import { CanvasToolbar } from '@/pages/editor/ui/CanvasToolbar';
import { cn } from '@/shared/ui/utils';
import { GENERIC_ROWS_BY_TYPE } from '../model/catalog';
import type { WorkspaceTab, WorkspaceWindowId } from '../model/types';

export function TabContent({ tab, windowId }: { tab: WorkspaceTab; windowId: WorkspaceWindowId }) {
  if (tab.type === 'erDiagram') return <DiagramCanvas />;
  if (tab.type === 'classDiagram') return <ClassDiagramCanvas />;
  if (tab.type === 'aiAssistant') return <AiAssistantPane />;
  if (tab.type === 'codeMode') return <CodeModePane />;
  if (tab.type === 'tables') return <TablesPane />;
  if (tab.type === 'properties') return <PropertiesPane />;
  if (tab.type === 'events') return <EventsPane />;
  if (tab.type === 'schemas' || tab.type === 'domains' || tab.type === 'entities') return <SemanticList type={tab.type} />;

  return <GenericPane tab={tab} windowId={windowId} />;
}

function DiagramCanvas() {
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <div className="absolute inset-0 diagram-grid opacity-80" />
      <svg className="absolute inset-0 size-full text-[#bcc7d5]" viewBox="0 0 1280 760" preserveAspectRatio="none" aria-hidden="true">
        <path d="M140 130 C260 120 320 190 420 180" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M220 445 C350 405 430 420 560 350" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M560 270 C730 260 820 220 1010 150" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M700 430 C830 440 920 510 1080 500" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <EntityCard title="ProductAudienceFit" accent="#d5a176" className="left-[7%] top-[5%]" rows={['id', 'publicId', 'brandId', 'productId', 'audienceSegmentId', 'status', 'metadata']} />
      <EntityCard title="AlternateSolution" accent="#d49c73" className="left-[32%] top-[7%]" rows={['id', 'publicId', 'productAudienceFitId', 'competitorProductId', 'name', 'type']} />
      <EntityCard title="CustomerJourney" accent="#d4af69" className="left-[27%] top-[47%]" rows={['id', 'publicId', 'brandId', 'audienceSegmentId', 'name', 'description']} />
      <EntityCard title="JourneyStage" accent="#f39b12" selected className="left-[50%] top-[39%]" rows={['id', 'publicId', 'customerJourneyId', 'name', 'stageType', 'customerTriggers', 'sortOrder']} />
      <EntityCard title="ContextPreset" accent="#8a82c8" className="right-[4%] top-[22%]" rows={['id', 'publicId', 'brandId', 'key', 'name', 'taskType', 'rules']} />
      <EntityCard title="JourneyStageType" accent="#d7ba77" className="right-[20%] bottom-[17%]" rows={['unaware', 'problem_aware', 'solution_aware', 'trial', 'purchase']} />
      <FloatingCanvasToolbar />
    </div>
  );
}

function EntityCard({
  title,
  rows,
  accent,
  selected,
  className,
}: {
  title: string;
  rows: string[];
  accent: string;
  selected?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'absolute w-[178px] overflow-hidden rounded-md border bg-white text-[10px] shadow-[0_2px_12px_rgba(15,23,42,0.08)]',
        selected ? 'border-[#f39b12] ring-1 ring-[#f39b12]' : 'border-slate-200',
        className,
      )}
    >
      <div className="flex h-7 items-center px-2 text-[11px] font-semibold text-white" style={{ backgroundColor: accent }}>
        {title}
      </div>
      <div>
        {rows.map((row, index) => (
          <div key={row} className="flex h-6 items-center justify-between border-t border-slate-100 px-2 text-slate-500">
            <span className={index < 4 ? 'text-blue-500' : undefined}>{row}</span>
            <span className="text-[9px] text-slate-400">{index % 3 === 0 ? 'bigint' : index % 3 === 1 ? 'uuid' : 'text'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FloatingCanvasToolbar() {
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
      <CanvasToolbar
        canRedo
        canUndo
        highlightRelations
        onAutoLayout={() => undefined}
        onOpenDiff={() => undefined}
        onOpenValidation={() => undefined}
        onRedo={() => undefined}
        onToggleHighlightRelations={() => undefined}
        onUndo={() => undefined}
        onZoomToFit={() => undefined}
        showCodeModeButton={false}
      />
    </div>
  );
}

function ClassDiagramCanvas() {
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <div className="absolute inset-0 diagram-grid opacity-70" />
      <div className="grid h-full grid-cols-3 gap-5 p-8">
        {[
          ['Domain Model', 'Entity', 'Value Object', 'Aggregate'],
          ['Application', 'Command', 'Query', 'Use Case'],
          ['Infrastructure', 'Repository', 'Adapter', 'Mapper'],
        ].map(([title, ...items]) => (
          <div key={title} className="self-start rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">{title}</div>
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item} className="px-4 py-3 text-xs text-slate-500">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiAssistantPane() {
  return (
    <div className="flex h-full flex-col bg-[#f8f8f9]">
      <div className="min-h-0 flex-1 p-6">
        <div className="grid gap-3">
          {['Schema consistency', 'Relation naming', 'Missing lifecycle events'].map((item, index) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Sparkles className="size-3.5 text-[#5d3df5]" />
                {item}
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#5d3df5]" style={{ width: `${70 - index * 15}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 pb-3">
        <div className="rounded-2xl border border-white bg-white/90 p-3 shadow-[0_2px_15px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.05)]">
          <div className="inline-flex rounded-full border border-white bg-[#fcfcfc] px-3 py-1 text-xs text-slate-600">
            live-db-schema.json
          </div>
          <div className="flex h-14 items-start pt-3 text-sm text-[#bdc3ce]">Enter your query text</div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <RoundButton label="Attach">
                <Plus className="size-4" />
              </RoundButton>
              <RoundButton label="Blocks">
                <Blocks className="size-4" />
              </RoundButton>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="flex h-9 items-center gap-1.5 rounded-full bg-[#eeeff0] px-3 text-xs font-medium text-[#828293]">
                GPT-4o
              </button>
              <RoundButton label="Voice" muted>
                <Mic className="size-4" />
              </RoundButton>
              <RoundButton label="Send" strong>
                <ArrowUp className="size-4" />
              </RoundButton>
            </div>
          </div>
        </div>
        <div className="py-2 text-center text-[11px] text-[#8f98a8]">The AI assistant sometimes makes mistakes. Check its results.</div>
      </div>
    </div>
  );
}

function RoundButton({ label, children, muted, strong }: { label: string; children: ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-full',
        strong ? 'bg-[#cacad2] text-white' : muted ? 'bg-[#eeeff0] text-slate-500' : 'text-slate-500 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
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
{`entity("JourneyStage", {
  id: bigint().primary(),
  customerJourneyId: relation("CustomerJourney"),
  name: text().required(),
  stageType: enumRef("JourneyStageType"),
  sortOrder: integer()
})`}
      </pre>
    </div>
  );
}

function TablesPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {['ProductAudienceFit', 'AlternateSolution', 'CustomerJourney', 'JourneyStage', 'ContextPreset'].map((table, index) => (
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

function PropertiesPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="rounded-lg border border-[#f39b12]/50 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-800">JourneyStage</div>
        <div className="mt-4 grid gap-3 text-xs">
          {[
            ['Domain', 'Customer Journey'],
            ['Primary key', 'id'],
            ['Status', 'active'],
            ['Relations', '2 inbound / 1 outbound'],
          ].map(([label, value]) => (
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

function EventsPane() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-2">
        {[
          ['AudienceMatched', 'ProductAudienceFit'],
          ['JourneyStageCreated', 'CustomerJourney'],
          ['CompetitorLinked', 'AlternateSolution'],
        ].map(([event, source]) => (
          <div key={event} className="grid grid-cols-[1fr_auto] items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-slate-700">{event}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">{source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticList({ type }: { type: 'schemas' | 'domains' | 'entities' }) {
  const items = {
    schemas: ['Data Design Schema', 'Live DB Schema', 'Public API Schema', 'Analytics Schema'],
    domains: ['Brand', 'Audience', 'Journey', 'Context', 'Competitor'],
    entities: ['ProductAudienceFit', 'AlternateSolution', 'CustomerJourney', 'JourneyStage'],
  }[type];

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

function GenericPane({ tab, windowId }: { tab: WorkspaceTab; windowId: WorkspaceWindowId }) {
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

export function EmptyPane() {
  return (
    <div className="flex h-full items-center justify-center text-xs font-medium text-slate-300">
      Empty workspace pane
    </div>
  );
}
