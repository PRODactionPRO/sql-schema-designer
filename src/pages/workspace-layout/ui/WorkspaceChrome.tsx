import {
  PanelBottom,
  PanelBottomClose,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Sparkles,
} from 'lucide-react';
import { PanelResizeHandle } from 'react-resizable-panels';
import { IconButton } from '@/shared/ui/icon-button';
import { cn } from '@/shared/ui/utils';

export function TopApplicationBar({
  bottomVisible,
  leftVisible,
  rightVisible,
  onToggleBottom,
  onToggleLeft,
  onToggleRight,
}: {
  bottomVisible: boolean;
  leftVisible: boolean;
  rightVisible: boolean;
  onToggleBottom: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}) {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between px-3 text-sm">
      <div className="flex items-center gap-7">
        <div className="flex h-8 w-12 items-center justify-center text-[26px] font-semibold leading-none text-[#2f3338]">
          {'{A}'}
        </div>
        <nav className="flex items-center gap-5">
          {['File', 'Edit', 'View', 'Object', 'Object', 'Object'].map((item, index) => (
            <button
              key={`${item}-${index}`}
              type="button"
              className="text-xs font-medium leading-4 text-[#8a919c] underline-offset-2 transition-colors hover:text-black hover:underline"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <IconButton
          label="Left panel"
          active={!leftVisible}
          inactiveClassName="text-slate-500 hover:bg-white/70 hover:text-slate-800"
          onClick={onToggleLeft}
        >
          {leftVisible ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </IconButton>
        <IconButton
          label="Bottom panel"
          active={!bottomVisible}
          inactiveClassName="text-slate-500 hover:bg-white/70 hover:text-slate-800"
          onClick={onToggleBottom}
        >
          {bottomVisible ? <PanelBottom className="size-4" /> : <PanelBottomClose className="size-4" />}
        </IconButton>
        <IconButton
          label="Right panel"
          active={!rightVisible}
          inactiveClassName="text-slate-500 hover:bg-white/70 hover:text-slate-800"
          onClick={onToggleRight}
        >
          {rightVisible ? <PanelRight className="size-4" /> : <PanelRightClose className="size-4" />}
        </IconButton>
        <IconButton label="AI mode" active>
          <Sparkles className="size-4" />
        </IconButton>
        <div className="ml-1 size-8 overflow-hidden rounded-full border border-white bg-gradient-to-br from-slate-200 via-slate-100 to-slate-400 shadow-sm">
          <div className="flex size-full items-end justify-center text-[10px] font-semibold text-slate-600">MP</div>
        </div>
      </div>
    </header>
  );
}

export function ResizeHandle({
  orientation,
  onDragging,
}: {
  orientation: 'horizontal' | 'vertical';
  onDragging?: (isDragging: boolean) => void;
}) {
  return (
    <PanelResizeHandle
      onDragging={onDragging}
      className={cn(
        'group relative shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400',
        orientation === 'horizontal' ? 'w-2.5 cursor-col-resize px-[4px]' : 'h-2.5 cursor-row-resize py-[4px]',
      )}
    >
      <span
        className={cn(
          'block rounded-full bg-transparent transition-colors group-hover:bg-slate-300 group-data-[resize-handle-active]:bg-slate-400',
          orientation === 'horizontal' ? 'h-full w-px' : 'h-px w-full',
        )}
      />
    </PanelResizeHandle>
  );
}
