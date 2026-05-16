import type { ReactNode } from 'react';
import { cn } from './utils';

interface CanvasGridBackgroundProps {
  pan: {
    x: number;
    y: number;
  };
  zoom: number;
  darkMode?: boolean;
  className?: string;
}

function getCanvasGridBaseStep() {
  if (typeof window === 'undefined') return 20;

  const rawValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--canvas-grid-base-step')
    .trim();
  const value = Number.parseFloat(rawValue);
  return Number.isFinite(value) && value > 0 ? value : 20;
}

export function CanvasGridBackground({
  pan,
  zoom,
  darkMode = false,
  className,
}: CanvasGridBackgroundProps) {
  const baseStep = getCanvasGridBaseStep();
  const worldStep = zoom < 0.25 ? baseStep * 4 : zoom < 0.5 ? baseStep * 2 : baseStep;
  const screenStep = Math.max(4, worldStep * zoom);
  const dotRadius = zoom < 0.35 ? 0.5 : 1;
  const dotColor = darkMode ? 'var(--canvas-grid-dot-dark)' : 'var(--canvas-grid-dot)';

  return (
    <div
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `radial-gradient(circle, ${dotColor} ${dotRadius}px, transparent ${dotRadius}px)`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${screenStep}px ${screenStep}px`,
      }}
    />
  );
}

export function CanvasZoomIndicator({
  children,
  darkMode = false,
  className,
}: {
  children: ReactNode;
  darkMode?: boolean;
  className?: string;
}) {
  return (
    <div
      data-canvas-theme={darkMode ? 'dark' : 'light'}
      className={cn(
        'absolute bottom-3 right-3 z-30 select-none rounded-lg border px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm',
        'border-[var(--canvas-zoom-border)] bg-[var(--canvas-zoom-background)] text-[var(--canvas-zoom-foreground)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
