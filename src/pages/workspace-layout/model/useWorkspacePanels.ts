import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ImperativePanelGroupHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { PANEL_ANIMATION_MS } from './layout-constants';
import type { CollapsiblePanelKey, LayoutVisibility } from './types';

export function useWorkspacePanels() {
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>({
    left: true,
    right: true,
    bottom: true,
    canvasMaximized: false,
  });
  const [layoutAnimating, setLayoutAnimating] = useState(false);
  const layoutAnimationTimerRef = useRef<number | null>(null);
  const centerGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);
  const behaviorPanelRef = useRef<ImperativePanelHandle | null>(null);
  const resizingPanelRef = useRef<CollapsiblePanelKey | null>(null);
  const pendingPanelVisibilityRef = useRef<Partial<Record<CollapsiblePanelKey, boolean>>>({});

  useEffect(() => () => {
    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current);
    }
  }, []);

  const applyLayoutVisibility = (next: LayoutVisibility) => {
    setLayoutVisibility(next);
    setLayoutAnimating(true);

    window.requestAnimationFrame(() => {
      if (next.left) {
        leftPanelRef.current?.expand(13);
      } else {
        leftPanelRef.current?.collapse();
      }

      if (next.right) {
        rightPanelRef.current?.expand(18);
      } else {
        rightPanelRef.current?.collapse();
      }

      if (next.bottom) {
        behaviorPanelRef.current?.expand(19);
      } else {
        behaviorPanelRef.current?.collapse();
      }
    });

    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current);
    }
    layoutAnimationTimerRef.current = window.setTimeout(() => {
      setLayoutAnimating(false);
      layoutAnimationTimerRef.current = null;
    }, PANEL_ANIMATION_MS);
  };

  const getPanelVisibility = (key: CollapsiblePanelKey) => {
    const panel =
      key === 'left'
        ? leftPanelRef.current
        : key === 'right'
          ? rightPanelRef.current
          : behaviorPanelRef.current;

    return panel ? !panel.isCollapsed() : layoutVisibility[key];
  };

  const syncPanelVisibility = (key: CollapsiblePanelKey, visible: boolean) => {
    if (resizingPanelRef.current === key) {
      pendingPanelVisibilityRef.current[key] = visible;
      return;
    }

    setLayoutVisibility((current) => (
      current[key] === visible
        ? current
        : {
          ...current,
          [key]: visible,
        }
    ));
  };

  const handleResizeDragging = (key: CollapsiblePanelKey, isDragging: boolean) => {
    if (isDragging) {
      resizingPanelRef.current = key;
      pendingPanelVisibilityRef.current[key] = layoutVisibility[key];
      return;
    }

    resizingPanelRef.current = null;
    pendingPanelVisibilityRef.current[key] = getPanelVisibility(key);
    syncPanelVisibility(key, pendingPanelVisibilityRef.current[key] ?? layoutVisibility[key]);
    delete pendingPanelVisibilityRef.current[key];
  };

  const toggleLeftColumn = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      left: !layoutVisibility.left,
      canvasMaximized: false,
    });
  };

  const toggleRightColumn = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      right: !layoutVisibility.right,
      canvasMaximized: false,
    });
  };

  const toggleBottomPanel = () => {
    applyLayoutVisibility({
      ...layoutVisibility,
      bottom: !layoutVisibility.bottom,
      canvasMaximized: false,
    });
  };

  const toggleCanvasMaximized = () => {
    applyLayoutVisibility(
      layoutVisibility.canvasMaximized
        ? { left: true, right: true, bottom: true, canvasMaximized: false }
        : { left: false, right: false, bottom: false, canvasMaximized: true },
    );
  };

  const startBottomHeaderResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !layoutVisibility.bottom) return;

    const target = event.target as HTMLElement;
    if (target.closest('[data-tab-id], button')) return;

    const groupElement = document.getElementById('workspace-layout-center-group');
    const startLayout = centerGroupRef.current?.getLayout();
    if (!groupElement || !startLayout || startLayout.length < 2) return;

    event.preventDefault();

    const groupRect = groupElement.getBoundingClientRect();
    const startY = event.clientY;
    const startBottomSize = startLayout[1] ?? 30;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaPercent = ((startY - moveEvent.clientY) / groupRect.height) * 100;
      const nextBottomSize = Math.max(19, Math.min(68, startBottomSize + deltaPercent));
      centerGroupRef.current?.setLayout([100 - nextBottomSize, nextBottomSize]);
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return {
    layoutVisibility,
    layoutAnimating,
    centerGroupRef,
    leftPanelRef,
    rightPanelRef,
    behaviorPanelRef,
    syncPanelVisibility,
    handleResizeDragging,
    toggleLeftColumn,
    toggleRightColumn,
    toggleBottomPanel,
    toggleCanvasMaximized,
    startBottomHeaderResize,
  };
}
