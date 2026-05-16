import { createPortal } from 'react-dom';
import { actionMenuClasses } from './action-menu-styles';
import type { ContextMenuState } from './context-menu-types';
import { cn } from './utils';

function getMenuPosition(menu: ContextMenuState) {
  const minWidth = menu.minWidth ?? 220;
  const estimatedHeight = 12 + menu.actions.length * 38 + menu.actions.filter((action) => action.separatorBefore).length * 9;
  const pad = 8;
  const bottomSafe = 24;
  let left = menu.x;
  let top = menu.y;

  if (typeof window !== 'undefined') {
    if (left + minWidth > window.innerWidth - pad) left = window.innerWidth - minWidth - pad;
    if (top + estimatedHeight > window.innerHeight - bottomSafe) top = Math.max(pad, menu.y - estimatedHeight);
  }

  return {
    left: Math.max(pad, left),
    top: Math.max(pad, top),
    minWidth,
  };
}

export function ContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState | null;
  onClose: () => void;
}) {
  if (!menu) return null;

  const position = getMenuPosition(menu);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} onContextMenu={(event) => event.preventDefault()} />
      <div
        className={cn('fixed z-[9999] select-none', actionMenuClasses.content)}
        style={position}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {menu.actions.map((action) => (
          <div key={action.id}>
            {action.separatorBefore ? <div className={cn('h-px mx-2', actionMenuClasses.separator)} /> : null}
            <button
              type="button"
              disabled={action.disabled}
              className={cn(
                'w-full text-left flex items-center transition-colors',
                action.destructive ? actionMenuClasses.dangerItem : actionMenuClasses.item,
                action.disabled && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => {
                if (action.disabled) return;
                onClose();
                action.onSelect();
              }}
            >
              {action.icon ? <span className="shrink-0">{action.icon}</span> : null}
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              {action.shortcut ? <span className={actionMenuClasses.shortcut}>{action.shortcut}</span> : null}
            </button>
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
