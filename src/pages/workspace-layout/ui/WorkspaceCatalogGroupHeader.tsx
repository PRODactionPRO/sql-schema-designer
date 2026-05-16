import type { DragEventHandler } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/ui/utils';

export function WorkspaceCatalogGroupHeader({
  label,
  color,
  count,
  collapsed,
  active,
  onToggle,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  color: string;
  count: number;
  collapsed: boolean;
  active?: boolean;
  onToggle: () => void;
  onDragOver?: DragEventHandler<HTMLButtonElement>;
  onDragLeave?: DragEventHandler<HTMLButtonElement>;
  onDrop?: DragEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={cn(
        'sticky top-0 z-10 flex h-8 w-full items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 text-left',
        active && 'ring-2 ring-inset ring-blue-300',
      )}
      onClick={onToggle}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {collapsed ? <ChevronRight className="size-3.5 text-gray-500" /> : <ChevronDown className="size-3.5 text-gray-500" />}
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-600">{label}</span>
      <span className="text-xs tabular-nums text-gray-400">{count}</span>
    </button>
  );
}
