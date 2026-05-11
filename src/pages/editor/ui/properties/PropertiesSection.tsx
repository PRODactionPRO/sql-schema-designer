import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface PropertiesSectionProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  action?: ReactNode;
  contentClassName?: string;
  renderContent?: boolean;
  darkMode?: boolean;
}

export function PropertiesSection({
  title,
  collapsed,
  onToggle,
  children,
  action,
  contentClassName = 'pt-2',
  renderContent = true,
  darkMode,
}: PropertiesSectionProps) {
  return (
    <section className={`border-b ${darkMode ? 'border-[#313244]' : 'border-gray-200'}`}>
      <div
        className={`flex h-12 w-full items-center justify-between gap-3 px-4 transition-colors ${
          darkMode ? 'text-[#cdd6f4] hover:bg-[#313244]/60' : 'text-gray-900 hover:bg-gray-50'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium"
        >
          <span className="truncate">{title}</span>
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${darkMode ? 'text-[#a6adc8]' : 'text-gray-500'} ${
              collapsed ? '-rotate-90' : 'rotate-0'
            }`}
          />
        </button>
        {action && <div className="flex shrink-0 items-center">{action}</div>}
      </div>
      {!collapsed && renderContent && (
        <div className={`px-4 pb-4 ${contentClassName}`}>
          {children}
        </div>
      )}
    </section>
  );
}
