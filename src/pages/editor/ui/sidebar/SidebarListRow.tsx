import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/shared/ui/utils';

interface SidebarListRowProps {
  left: ReactNode;
  main: ReactNode;
  right?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
}

export function SidebarListRow({
  left,
  main,
  right,
  className,
  style,
  onClick,
  onDoubleClick,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onContextMenu,
}: SidebarListRowProps) {
  return (
    <div
      className={cn('h-10 px-3 flex items-center justify-between select-none', className)}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
    >
      <div className="min-w-0 flex-1 flex items-center">{left}{main}</div>
      {right ? <div className="flex items-center flex-shrink-0">{right}</div> : null}
    </div>
  );
}
