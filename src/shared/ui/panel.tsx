import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ProTooltip } from './pro-tooltip';
import { cn } from './utils';

interface PanelHeaderProps {
  children: ReactNode;
  className?: string;
  darkMode?: boolean;
}

export function PanelHeader({ children, className, darkMode }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-[46px] shrink-0 items-center justify-between border-b px-3',
        darkMode ? 'border-[#313244]' : 'border-gray-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PanelTabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  darkMode?: boolean;
  icon?: ReactNode;
}

export function PanelTabButton({
  active,
  darkMode,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: PanelTabButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
        active
          ? darkMode
            ? 'bg-[#313244] text-[#cdd6f4]'
            : 'bg-gray-100 text-gray-900'
          : darkMode
            ? 'text-[#a6adc8] hover:bg-[#313244]/70 hover:text-[#cdd6f4]'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

interface PanelIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  darkMode?: boolean;
  tooltipSide?: 'top' | 'bottom';
}

export function PanelIconButton({
  label,
  active,
  darkMode,
  tooltipSide = 'bottom',
  className,
  children,
  type = 'button',
  ...props
}: PanelIconButtonProps) {
  return (
    <ProTooltip label={label} side={tooltipSide}>
      <button
        type={type}
        aria-label={label}
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md transition-colors',
          active
            ? darkMode
              ? 'bg-[#313244] text-[#cdd6f4]'
              : 'bg-gray-100 text-gray-700'
            : darkMode
              ? 'text-[#6c7086] hover:bg-[#313244] hover:text-[#a6adc8]'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </ProTooltip>
  );
}

interface PanelPillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function PanelPillButton({
  active,
  className,
  children,
  type = 'button',
  ...props
}: PanelPillButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
        active
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
