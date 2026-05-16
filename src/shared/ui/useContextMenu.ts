import { useCallback, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ContextMenuAction, ContextMenuState } from './context-menu-types';

interface OpenContextMenuOptions {
  minWidth?: number;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const closeContextMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const openContextMenu = useCallback((
    event: Pick<ReactMouseEvent, 'clientX' | 'clientY' | 'preventDefault' | 'stopPropagation'>,
    actions: ContextMenuAction[],
    options: OpenContextMenuOptions = {},
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      actions,
      minWidth: options.minWidth,
    });
  }, []);

  return {
    menu,
    openContextMenu,
    closeContextMenu,
  };
}
