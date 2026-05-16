import type { ReactNode } from 'react';

export interface ContextMenuAction {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  minWidth?: number;
}
