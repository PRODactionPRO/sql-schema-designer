import { CanvasGridBackground } from '@/shared/ui/canvas-navigation-ui';
import { cn } from '@/shared/ui/utils';
import { CLASS_DIAGRAM_GROUPS, DIAGRAM_ENTITIES, DIAGRAM_LINK_PATHS } from '../model/workspace-mock-data';
import { WorkspaceFloatingCanvasToolbar } from './WorkspaceFloatingCanvasToolbar';

export function DiagramCanvas() {
  return (
    <div className="canvas-surface relative h-full overflow-hidden">
      <CanvasGridBackground pan={{ x: 0, y: 0 }} zoom={1} />
      <svg className="absolute inset-0 size-full text-[#bcc7d5]" viewBox="0 0 1280 760" preserveAspectRatio="none" aria-hidden="true">
        {DIAGRAM_LINK_PATHS.map((path) => (
          <path key={path} d={path} fill="none" stroke="currentColor" strokeWidth="2" />
        ))}
      </svg>
      {DIAGRAM_ENTITIES.map((entity) => (
        <MockEntityCard
          key={entity.title}
          title={entity.title}
          accent={entity.accent}
          className={entity.positionClassName}
          rows={entity.rows}
          selected={entity.selected}
        />
      ))}
      <WorkspaceFloatingCanvasToolbar />
    </div>
  );
}

export function MockClassDiagramCanvas() {
  return (
    <div className="canvas-surface relative h-full overflow-hidden">
      <CanvasGridBackground pan={{ x: 0, y: 0 }} zoom={1} />
      <div className="grid h-full grid-cols-3 gap-5 p-8">
        {CLASS_DIAGRAM_GROUPS.map(([title, ...items]) => (
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

function MockEntityCard({
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
