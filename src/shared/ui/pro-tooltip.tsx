import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ProTooltipProps {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  side?: 'top' | 'bottom';
  offset?: number;
}

interface Pos {
  top: number;
  left: number;
}

export function ProTooltip({ children, label, shortcut, side = 'top', offset = 8 }: ProTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const top = side === 'top'
      ? triggerRect.top - tooltipRect.height - offset
      : triggerRect.bottom + offset;
    const left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    setPos({ top: Math.max(8, top), left: Math.max(8, left) });
  }, [open, label, shortcut, side, offset]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => setOpen(false);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[200] px-2.5 py-1.5 bg-[#111827] text-white text-xs rounded-lg whitespace-nowrap pointer-events-none shadow-lg flex items-center gap-2"
          style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
        >
          <span>{label}</span>
          {shortcut && <kbd className="text-[10px] text-gray-300 bg-[#374151] px-1.5 py-0.5 rounded">{shortcut}</kbd>}
        </div>,
        document.body,
      )}
    </span>
  );
}

