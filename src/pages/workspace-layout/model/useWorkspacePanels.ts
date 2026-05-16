import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ImperativePanelGroupHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { PANEL_ANIMATION_MS } from './layout-constants';
import type { CollapsiblePanelKey, LayoutVisibility, WorkspacePanelGroupId, WorkspacePanelLayouts } from './types';
import { startWorkspaceBottomHeaderResize } from './workspace-panel-resize';
import { DEFAULT_LAYOUT_VISIBILITY, DEFAULT_PANEL_LAYOUTS } from './workspace-layout-preferences';

const PANEL_EXPAND_SIZES: Record<CollapsiblePanelKey, number> = {
  left: 13,
  right: 18,
  bottom: 19,
};

function clonePanelLayouts(layouts: WorkspacePanelLayouts): WorkspacePanelLayouts {
  return {
    root: [...layouts.root],
    left: [...layouts.left],
    center: [...layouts.center],
  };
}

function samePanelLayout(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => Math.abs(value - (right[index] ?? 0)) < 0.01);
}

export function useWorkspacePanels({
  initialVisibility,
  initialPanelLayouts,
}: {
  initialVisibility?: LayoutVisibility | null;
  initialPanelLayouts?: WorkspacePanelLayouts | null;
} = {}) {
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>(initialVisibility ?? DEFAULT_LAYOUT_VISIBILITY);
  const [panelLayouts, setPanelLayouts] = useState<WorkspacePanelLayouts>(() => (
    clonePanelLayouts(initialPanelLayouts ?? DEFAULT_PANEL_LAYOUTS)
  ));
  const layoutVisibilityRef = useRef(layoutVisibility);
  const panelLayoutsRef = useRef(panelLayouts);
  const [layoutAnimating, setLayoutAnimating] = useState(false);
  const layoutAnimationTimerRef = useRef<number | null>(null);
  const rootGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const leftGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const centerGroupRef = useRef<ImperativePanelGroupHandle | null>(null);
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null);
  const behaviorPanelRef = useRef<ImperativePanelHandle | null>(null);
  const resizingPanelRef = useRef<CollapsiblePanelKey | null>(null);
  const pendingPanelVisibilityRef = useRef<Partial<Record<CollapsiblePanelKey, boolean>>>({});
  const appliedInitialRef = useRef<{
    visibility?: LayoutVisibility | null;
    panelLayouts?: WorkspacePanelLayouts | null;
  }>({
    visibility: initialVisibility,
    panelLayouts: initialPanelLayouts,
  });

  useEffect(() => () => {
    if (layoutAnimationTimerRef.current) {
      window.clearTimeout(layoutAnimationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    panelLayoutsRef.current = panelLayouts;
  }, [panelLayouts]);

  const commitLayoutVisibility = (
    updater: LayoutVisibility | ((current: LayoutVisibility) => LayoutVisibility),
  ) => {
    if (typeof updater !== 'function') {
      layoutVisibilityRef.current = updater;
      setLayoutVisibility(updater);
      return;
    }

    setLayoutVisibility((current) => {
      const next = updater(current);
      layoutVisibilityRef.current = next;
      return next;
    });
  };

  const commitPanelLayout = (groupId: WorkspacePanelGroupId, layout: number[]) => {
    setPanelLayouts((current) => {
      if (samePanelLayout(current[groupId], layout)) return current;

      const next = {
        ...current,
        [groupId]: [...layout],
      };
      panelLayoutsRef.current = next;
      return next;
    });
  };

  const getPanelHandle = useCallback((key: CollapsiblePanelKey) => {
    if (key === 'left') return leftPanelRef.current;
    if (key === 'right') return rightPanelRef.current;
    return behaviorPanelRef.current;
  }, []);

  const applyPanelHandleVisibility = useCallback((key: CollapsiblePanelKey, visible: boolean) => {
    const panel = getPanelHandle(key);
    if (!panel) return;

    if (visible) {
      if (panel.isCollapsed()) {
        panel.expand(PANEL_EXPAND_SIZES[key]);
      }
      return;
    }

    if (!panel.isCollapsed()) {
      panel.collapse();
    }
  }, [getPanelHandle]);

  useEffect(() => {
    if (
      appliedInitialRef.current.visibility === initialVisibility &&
      appliedInitialRef.current.panelLayouts === initialPanelLayouts
    ) {
      return;
    }

    appliedInitialRef.current = {
      visibility: initialVisibility,
      panelLayouts: initialPanelLayouts,
    };

    const nextVisibility = initialVisibility ?? DEFAULT_LAYOUT_VISIBILITY;
    const nextPanelLayouts = clonePanelLayouts(initialPanelLayouts ?? DEFAULT_PANEL_LAYOUTS);
    layoutVisibilityRef.current = nextVisibility;
    panelLayoutsRef.current = nextPanelLayouts;
    setLayoutVisibility(nextVisibility);
    setPanelLayouts(nextPanelLayouts);

    window.requestAnimationFrame(() => {
      rootGroupRef.current?.setLayout(nextPanelLayouts.root);
      leftGroupRef.current?.setLayout(nextPanelLayouts.left);
      centerGroupRef.current?.setLayout(nextPanelLayouts.center);
      applyPanelHandleVisibility('left', nextVisibility.left);
      applyPanelHandleVisibility('right', nextVisibility.right);
      applyPanelHandleVisibility('bottom', nextVisibility.bottom);
    });
  }, [applyPanelHandleVisibility, initialPanelLayouts, initialVisibility]);

  const restorePanelToCommittedVisibility = (key: CollapsiblePanelKey) => {
    const expectedVisible = layoutVisibilityRef.current[key];
    window.requestAnimationFrame(() => {
      applyPanelHandleVisibility(key, expectedVisible);
    });
  };

  const applyLayoutVisibility = (next: LayoutVisibility) => {
    commitLayoutVisibility(next);
    setLayoutAnimating(true);

    window.requestAnimationFrame(() => {
      applyPanelHandleVisibility('left', next.left);
      applyPanelHandleVisibility('right', next.right);
      applyPanelHandleVisibility('bottom', next.bottom);
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

    return panel ? !panel.isCollapsed() : layoutVisibilityRef.current[key];
  };

  const syncPanelVisibility = (key: CollapsiblePanelKey, visible: boolean) => {
    const resizingPanel = resizingPanelRef.current;

    if (resizingPanel && resizingPanel !== key) {
      pendingPanelVisibilityRef.current[key] = layoutVisibilityRef.current[key];
      return;
    }

    if (resizingPanel === key) {
      pendingPanelVisibilityRef.current[key] = visible;
      return;
    }

    commitLayoutVisibility((current) => (
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
      pendingPanelVisibilityRef.current = {
        [key]: layoutVisibilityRef.current[key],
      };
      return;
    }

    const resizedPanel = resizingPanelRef.current ?? key;
    const visible = getPanelVisibility(resizedPanel);

    resizingPanelRef.current = null;
    pendingPanelVisibilityRef.current = {};
    commitLayoutVisibility((current) => (
      current[resizedPanel] === visible
        ? current
        : {
          ...current,
          [resizedPanel]: visible,
        }
    ));

    (['left', 'right', 'bottom'] as CollapsiblePanelKey[])
      .filter((key) => key !== resizedPanel)
      .forEach(restorePanelToCommittedVisibility);
  };

  const toggleLeftColumn = () => {
    const current = layoutVisibilityRef.current;
    applyLayoutVisibility({
      ...current,
      left: !current.left,
      canvasMaximized: false,
    });
  };

  const toggleRightColumn = () => {
    const current = layoutVisibilityRef.current;
    applyLayoutVisibility({
      ...current,
      right: !current.right,
      canvasMaximized: false,
    });
  };

  const toggleBottomPanel = () => {
    const current = layoutVisibilityRef.current;
    applyLayoutVisibility({
      ...current,
      bottom: !current.bottom,
      canvasMaximized: false,
    });
  };

  const toggleCanvasMaximized = () => {
    const current = layoutVisibilityRef.current;
    applyLayoutVisibility(
      current.canvasMaximized
        ? { left: true, right: true, bottom: true, canvasMaximized: false }
        : { left: false, right: false, bottom: false, canvasMaximized: true },
    );
  };

  const startBottomHeaderResize = (event: ReactPointerEvent<HTMLElement>) => {
    startWorkspaceBottomHeaderResize({
      event,
      centerGroupRef,
      visible: layoutVisibility.bottom,
    });
  };

  return {
    layoutVisibility,
    panelLayouts,
    layoutAnimating,
    rootGroupRef,
    leftGroupRef,
    centerGroupRef,
    leftPanelRef,
    rightPanelRef,
    behaviorPanelRef,
    commitPanelLayout,
    syncPanelVisibility,
    handleResizeDragging,
    toggleLeftColumn,
    toggleRightColumn,
    toggleBottomPanel,
    toggleCanvasMaximized,
    startBottomHeaderResize,
  };
}
