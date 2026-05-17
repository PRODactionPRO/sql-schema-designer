import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasViewport {
  pan: CanvasPoint;
  zoom: number;
}

export type CanvasResizeAnchor = 'center' | 'document' | 'none';

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width?: number;
  height?: number;
}

interface UseCanvasNavigationOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomSensitivity?: number;
  scrollPanSpeed?: number;
  maxFitZoom?: number;
  initialPan?: CanvasPoint;
  initialZoom?: number;
  restoreKey?: string | number;
  preserveViewportCenterOnResize?: boolean;
  resizeAnchor?: CanvasResizeAnchor;
  onViewportChange?: (viewport: CanvasViewport) => void;
}

const DEFAULT_MIN_ZOOM = 0.2;
const DEFAULT_MAX_ZOOM = 3;
const DEFAULT_ZOOM_SENSITIVITY = 0.001;
const DEFAULT_SCROLL_PAN_SPEED = 1.5;
const DEFAULT_MAX_FIT_ZOOM = 1.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveStateAction<T>(action: SetStateAction<T>, current: T): T {
  return typeof action === 'function' ? (action as (value: T) => T)(current) : action;
}

interface MiddlePanState {
  active: boolean;
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  startPan: CanvasPoint;
}

export function useCanvasNavigation({
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  zoomSensitivity = DEFAULT_ZOOM_SENSITIVITY,
  scrollPanSpeed = DEFAULT_SCROLL_PAN_SPEED,
  maxFitZoom = DEFAULT_MAX_FIT_ZOOM,
  initialPan = { x: 0, y: 0 },
  initialZoom = 1,
  restoreKey,
  preserveViewportCenterOnResize = true,
  resizeAnchor = 'center',
  onViewportChange,
}: UseCanvasNavigationOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPanState] = useState<CanvasPoint>(initialPan);
  const [zoom, setZoomState] = useState(() => clamp(initialZoom, minZoom, maxZoom));
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const onViewportChangeRef = useRef(onViewportChange);
  const appliedRestoreKeyRef = useRef(restoreKey);
  const middlePanRef = useRef<MiddlePanState>({
    active: false,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startPan: initialPan,
  });

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  const notifyViewportChange = useCallback((nextPan: CanvasPoint, nextZoom: number) => {
    onViewportChangeRef.current?.({
      pan: nextPan,
      zoom: nextZoom,
    });
  }, []);

  const setPan = useCallback((action: SetStateAction<CanvasPoint>) => {
    const nextPan = resolveStateAction(action, panRef.current);
    panRef.current = nextPan;
    setPanState(nextPan);
    notifyViewportChange(nextPan, zoomRef.current);
  }, [notifyViewportChange]);

  const setZoom = useCallback((action: SetStateAction<number>) => {
    const nextZoom = clamp(resolveStateAction(action, zoomRef.current), minZoom, maxZoom);
    zoomRef.current = nextZoom;
    setZoomState(nextZoom);
    notifyViewportChange(panRef.current, nextZoom);
  }, [maxZoom, minZoom, notifyViewportChange]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (restoreKey === undefined || appliedRestoreKeyRef.current === restoreKey) return;

    const nextZoom = clamp(initialZoom, minZoom, maxZoom);
    appliedRestoreKeyRef.current = restoreKey;
    panRef.current = initialPan;
    zoomRef.current = nextZoom;
    setPanState(initialPan);
    setZoomState(nextZoom);
    notifyViewportChange(initialPan, nextZoom);
  }, [initialPan, initialZoom, maxZoom, minZoom, notifyViewportChange, restoreKey]);

  useEffect(() => {
    const effectiveResizeAnchor = preserveViewportCenterOnResize ? resizeAnchor : 'none';
    if (effectiveResizeAnchor === 'none') return undefined;

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    let previousRect = container.getBoundingClientRect();
    const observer = new ResizeObserver(() => {
      const nextRect = container.getBoundingClientRect();
      const deltaLeft = nextRect.left - previousRect.left;
      const deltaTop = nextRect.top - previousRect.top;
      const deltaWidth = nextRect.width - previousRect.width;
      const deltaHeight = nextRect.height - previousRect.height;
      previousRect = nextRect;

      if (middlePanRef.current.active) return;
      if (
        Math.abs(deltaLeft) < 0.5
        && Math.abs(deltaTop) < 0.5
        && Math.abs(deltaWidth) < 0.5
        && Math.abs(deltaHeight) < 0.5
      ) return;

      if (effectiveResizeAnchor === 'document') {
        if (Math.abs(deltaLeft) < 0.5 && Math.abs(deltaTop) < 0.5) return;

        setPan((current) => ({
          x: current.x - deltaLeft,
          y: current.y - deltaTop,
        }));
        return;
      }

      setPan((current) => ({
        x: current.x + deltaWidth / 2,
        y: current.y + deltaHeight / 2,
      }));
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [preserveViewportCenterOnResize, resizeAnchor, setPan]);

  const screenToWorld = useCallback((point: Pick<MouseEvent | PointerEvent, 'clientX' | 'clientY'>) => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: (point.clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (point.clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const centerOnBounds = useCallback((bounds: CanvasBounds, targetZoom = zoomRef.current) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const contentWidth = Math.max(1, bounds.width ?? bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.height ?? bounds.maxY - bounds.minY);
    const nextZoom = clamp(targetZoom, minZoom, maxZoom);

    setZoom(nextZoom);
    setPan({
      x: (rect.width - contentWidth * nextZoom) / 2 - bounds.minX * nextZoom,
      y: (rect.height - contentHeight * nextZoom) / 2 - bounds.minY * nextZoom,
    });
  }, [maxZoom, minZoom, setPan, setZoom]);

  const zoomToBounds = useCallback((bounds: CanvasBounds, padding = 80, fitZoom = maxFitZoom) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const contentWidth = Math.max(1, bounds.width ?? bounds.maxX - bounds.minX);
    const contentHeight = Math.max(1, bounds.height ?? bounds.maxY - bounds.minY);
    const nextZoom = clamp(
      Math.min(
        (rect.width - padding * 2) / contentWidth,
        (rect.height - padding * 2) / contentHeight,
        fitZoom,
      ),
      minZoom,
      maxZoom,
    );

    centerOnBounds(bounds, nextZoom);
  }, [centerOnBounds, maxFitZoom, maxZoom, minZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const stopPanning = (event?: PointerEvent) => {
      const state = middlePanRef.current;
      if (!state.active) return;

      if (event && state.pointerId !== event.pointerId) return;
      event?.preventDefault();
      event?.stopPropagation();

      if (state.pointerId !== null && container.hasPointerCapture(state.pointerId)) {
        container.releasePointerCapture(state.pointerId);
      }

      middlePanRef.current = {
        active: false,
        pointerId: null,
        startClientX: 0,
        startClientY: 0,
        startPan: panRef.current,
      };
      setIsPanning(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();

      middlePanRef.current = {
        active: true,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPan: panRef.current,
      };
      container.setPointerCapture(event.pointerId);
      setIsPanning(true);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const state = middlePanRef.current;
      if (!state.active || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();

      setPan({
        x: state.startPan.x + event.clientX - state.startClientX,
        y: state.startPan.y + event.clientY - state.startClientY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      stopPanning(event);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      stopPanning(event);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      if (middlePanRef.current.active) return;

      if (event.ctrlKey || event.metaKey) {
        const rect = container.getBoundingClientRect();
        const currentZoom = zoomRef.current;
        const nextZoom = clamp(currentZoom * (1 - event.deltaY * zoomSensitivity), minZoom, maxZoom);
        const worldX = (event.clientX - rect.left - panRef.current.x) / currentZoom;
        const worldY = (event.clientY - rect.top - panRef.current.y) / currentZoom;

        setZoom(nextZoom);
        setPan({
          x: event.clientX - rect.left - worldX * nextZoom,
          y: event.clientY - rect.top - worldY * nextZoom,
        });
        return;
      }

      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const dx = (event.deltaX !== 0 ? event.deltaX : event.deltaY) * scrollPanSpeed;
        setPan((current) => ({ ...current, x: current.x - dx }));
        return;
      }

      setPan((current) => ({ ...current, y: current.y - event.deltaY * scrollPanSpeed }));
    };

    const handleAuxClick = (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
    };

    container.addEventListener('pointerdown', handlePointerDown, true);
    container.addEventListener('pointermove', handlePointerMove, true);
    container.addEventListener('pointerup', handlePointerUp, true);
    container.addEventListener('pointercancel', handlePointerCancel, true);
    container.addEventListener('lostpointercapture', stopPanning);
    container.addEventListener('mousedown', handleMouseDown, true);
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('auxclick', handleAuxClick, true);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true);
      container.removeEventListener('pointermove', handlePointerMove, true);
      container.removeEventListener('pointerup', handlePointerUp, true);
      container.removeEventListener('pointercancel', handlePointerCancel, true);
      container.removeEventListener('lostpointercapture', stopPanning);
      container.removeEventListener('mousedown', handleMouseDown, true);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('auxclick', handleAuxClick, true);
    };
  }, [maxZoom, minZoom, scrollPanSpeed, setPan, setZoom, zoomSensitivity]);

  return {
    containerRef,
    pan,
    zoom,
    isPanning,
    panRef,
    zoomRef,
    setPan,
    setZoom,
    screenToWorld,
    centerOnBounds,
    zoomToBounds,
  };
}
