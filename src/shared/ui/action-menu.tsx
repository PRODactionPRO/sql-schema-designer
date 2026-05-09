import * as React from 'react';

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from './dropdown-menu';
import { cn } from './utils';
import { actionMenuClasses } from './action-menu-styles';

export function ActionMenuContent({ className, ...props }: React.ComponentProps<typeof DropdownMenuContent>) {
  return <DropdownMenuContent className={cn(actionMenuClasses.content, className)} {...props} />;
}

interface ActionMenuItemProps extends React.ComponentProps<typeof DropdownMenuItem> {
  danger?: boolean;
}

export function ActionMenuItem({ className, danger = false, ...props }: ActionMenuItemProps) {
  return (
    <DropdownMenuItem
      className={cn(danger ? actionMenuClasses.dangerItem : actionMenuClasses.item, className)}
      {...props}
    />
  );
}

export function ActionMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return <DropdownMenuSeparator className={cn(actionMenuClasses.separator, className)} {...props} />;
}

export function ActionMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuLabel>) {
  return <DropdownMenuLabel className={cn(actionMenuClasses.label, className)} {...props} />;
}

export function ActionMenuShortcut({ className, ...props }: React.ComponentProps<typeof DropdownMenuShortcut>) {
  return <DropdownMenuShortcut className={cn(actionMenuClasses.shortcut, className)} {...props} />;
}
