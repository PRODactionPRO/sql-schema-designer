import { useState, useRef, useCallback } from 'react';
import { toCanvas, toJpeg } from 'html-to-image';
import { toast } from 'sonner';

interface UseSnapshotCaptureOptions {
  initialSnapshot?: string;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  setRightCollapsed: (v: boolean) => void;
  onDone?: () => void;
}

export function useSnapshotCapture({
  initialSnapshot,
  leftCollapsed,
  rightCollapsed,
  setLeftCollapsed,
  setRightCollapsed,
  onDone,
}: UseSnapshotCaptureOptions) {
  const [snapshotCaptureMode, setSnapshotCaptureMode] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<string | undefined>(initialSnapshot);
  const preCaptureState = useRef<{ left: boolean; right: boolean } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const resizeCanvasForSnapshot = (source: HTMLCanvasElement): HTMLCanvasElement => {
    const maxW = 1280;
    const maxH = 720;
    const srcW = source.width;
    const srcH = source.height;
    if (srcW <= 0 || srcH <= 0) return source;

    const scale = Math.min(maxW / srcW, maxH / srcH, 1);
    if (scale >= 1) return source;

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(srcW * scale));
    out.height = Math.max(1, Math.round(srcH * scale));
    const ctx = out.getContext('2d');
    if (!ctx) return source;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, out.width, out.height);
    return out;
  };

  const startCapture = useCallback(() => {
    preCaptureState.current = { left: leftCollapsed, right: rightCollapsed };
    setLeftCollapsed(true);
    setRightCollapsed(true);
    setSnapshotCaptureMode(true);
  }, [leftCollapsed, rightCollapsed, setLeftCollapsed, setRightCollapsed]);

  const restorePanels = useCallback(() => {
    if (preCaptureState.current) {
      setLeftCollapsed(preCaptureState.current.left);
      setRightCollapsed(preCaptureState.current.right);
      preCaptureState.current = null;
    }
  }, [setLeftCollapsed, setRightCollapsed]);

  const saveSnapshot = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) {
      toast.error('Canvas not found');
      return;
    }

    setIsCapturing(true);

    const rect = container.getBoundingClientRect();
    const captureStartedAt = performance.now();
    console.info('[snapshot:start]', {
      rectWidth: Math.round(rect.width),
      rectHeight: Math.round(rect.height),
      startedAt: new Date().toISOString(),
    });

    // Delay to let the UI show "Capturing..." before the heavy work
    requestAnimationFrame(() => {
      // Exit capture mode immediately so the editor stays interactive while encoding runs.
      restorePanels();
      setSnapshotCaptureMode(false);
      onDone?.();

      toCanvas(container, {
        cacheBust: true,
        // Capture exactly what the user currently sees in the viewport.
        pixelRatio: 1,
        filter: (node: HTMLElement) => {
          if (node.nodeType !== 1) return true;
          const el = node as HTMLElement;
          if (el.getAttribute?.('data-snapshot-exclude') === 'true') return false;
          return true;
        },
        style: {
          // Ensure container isn't stretched by its children during capture
          overflow: 'hidden',
        },
      })
        .then((canvas) => {
          const optimizedCanvas = resizeCanvasForSnapshot(canvas);
          let dataUrl = optimizedCanvas.toDataURL('image/webp', 0.72);
          // Fallback for rare environments without WebP encoding support
          if (!dataUrl.startsWith('data:image/webp')) {
            return toJpeg(container, {
              cacheBust: true,
              pixelRatio: 1,
              quality: 0.74,
              filter: (node: HTMLElement) => {
                if (node.nodeType !== 1) return true;
                const el = node as HTMLElement;
                if (el.getAttribute?.('data-snapshot-exclude') === 'true') return false;
                return true;
              },
              style: {
                overflow: 'hidden',
              },
            });
          }
          return dataUrl;
        })
        .then((dataUrl) => {
          console.info('[snapshot:done]', {
            mime: dataUrl.slice(5, dataUrl.indexOf(';')),
            dataUrlLength: dataUrl.length,
            durationMs: Math.round(performance.now() - captureStartedAt),
          });
          setCurrentSnapshot(dataUrl);
          setIsCapturing(false);
          toast.success('Snapshot saved (WebP optimized)');
        })
        .catch((error) => {
          console.error('[snapshot:error]', error);
          toast.error('Failed to capture snapshot');
          setIsCapturing(false);
        });
    });
  }, [restorePanels, onDone]);

  const cancelCapture = useCallback(() => {
    restorePanels();
    setSnapshotCaptureMode(false);
  }, [restorePanels]);

  return {
    snapshotCaptureMode,
    isCapturing,
    currentSnapshot,
    setCurrentSnapshot,
    canvasContainerRef,
    startCapture,
    saveSnapshot,
    cancelCapture,
  };
}
