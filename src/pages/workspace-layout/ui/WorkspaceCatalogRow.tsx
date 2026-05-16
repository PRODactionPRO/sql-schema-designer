import type { DragEventHandler, ReactNode } from 'react';
import { GripVertical, Trash2, X } from 'lucide-react';
import { cn } from '@/shared/ui/utils';

export function WorkspaceCatalogRow({
  active,
  canReorder,
  dimmed,
  dragging,
  dragTarget,
  borderColor = 'transparent',
  icon,
  label,
  badge,
  showUnlink,
  unlinkLabel,
  deleteLabel,
  onSelect,
  onUnlink,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  active?: boolean;
  canReorder?: boolean;
  dimmed?: boolean;
  dragging?: boolean;
  dragTarget?: boolean;
  borderColor?: string;
  icon: ReactNode;
  label: string;
  badge: ReactNode;
  showUnlink?: boolean;
  unlinkLabel: string;
  deleteLabel: string;
  onSelect: () => void;
  onUnlink?: () => void;
  onDelete: () => void;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canReorder}
      className={cn(
        'group flex h-9 w-full cursor-pointer select-none items-center gap-2 border-l-[3px] py-1.5 pl-2.5 pr-2 text-left text-sm transition-colors',
        active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100',
        canReorder && 'cursor-grab active:cursor-grabbing',
        dimmed && 'opacity-60',
        dragging && 'bg-blue-50 opacity-60 ring-1 ring-inset ring-blue-300',
        dragTarget && 'ring-2 ring-inset ring-blue-300',
      )}
      style={{ borderLeftColor: borderColor }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <GripVertical className="size-3.5 shrink-0 text-gray-300" />
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
      {showUnlink ? (
        <button
          type="button"
          className="hidden size-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover:flex"
          aria-label={unlinkLabel}
          onClick={(event) => {
            event.stopPropagation();
            onUnlink?.();
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        className="hidden size-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 group-hover:flex"
        aria-label={deleteLabel}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
