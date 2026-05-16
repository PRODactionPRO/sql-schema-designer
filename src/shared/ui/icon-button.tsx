import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  activeClassName?: string;
  children: ReactNode;
  inactiveClassName?: string;
  label: string;
}

export function IconButton({
  active,
  activeClassName = 'bg-[#030213] text-white',
  children,
  className,
  inactiveClassName = 'text-slate-500 hover:bg-[#eeeff0] hover:text-slate-900',
  label,
  title,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-lg transition-colors',
        active ? activeClassName : inactiveClassName,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
