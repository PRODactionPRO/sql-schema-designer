import { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import type { ProjectData } from '@/shared/types/project';
import { STORAGE_PROJECT_PREFIX } from '@/shared/config/storage';

function saveProjectToStorage(project: ProjectData) {
  localStorage.setItem(`${STORAGE_PROJECT_PREFIX}${project.id}`, JSON.stringify(project));
}

interface UseSnapshotCaptureOptions {
  projectId: string | null;
  projectDataRef: React.MutableRefObject<ProjectData | null>;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  setRightCollapsed: (v: boolean) => void;
  onDone?: () => void;
}

export function useSnapshotCapture({
  projectId,
  projectDataRef,
  leftCollapsed,
  rightCollapsed,
  setLeftCollapsed,
  setRightCollapsed,
  onDone,
}: UseSnapshotCaptureOptions) {
  const [snapshotCaptureMode, setSnapshotCaptureMode] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<string | undefined>(
    projectDataRef.current?.snapshot,
  );
  const preCaptureState = useRef<{ left: boolean; right: boolean } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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

    // Use the visible container size, not the internal 10000×10000 SVG
    const rect = container.getBoundingClientRect();
    const captureWidth = Math.min(rect.width, 1920);
    const captureHeight = Math.min(rect.height, 1080);

    // Delay to let the UI show "Capturing..." before the heavy work
    requestAnimationFrame(() => {
      toPng(container, {
        cacheBust: true,
        pixelRatio: 1,
        width: captureWidth,
        height: captureHeight,
        canvasWidth: captureWidth,
        canvasHeight: captureHeight,
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
        .then((dataUrl) => {
          setCurrentSnapshot(dataUrl);
          if (projectId) {
            const current = projectDataRef.current;
            if (current) {
              const updated = { ...current, snapshot: dataUrl, updatedAt: new Date().toISOString() };
              saveProjectToStorage(updated);
              projectDataRef.current = updated;
            }
          }
          restorePanels();
          setSnapshotCaptureMode(false);
          setIsCapturing(false);
          toast.success('Snapshot saved');
          onDone?.();
        })
        .catch(() => {
          toast.error('Failed to capture snapshot');
          restorePanels();
          setSnapshotCaptureMode(false);
          setIsCapturing(false);
        });
    });
  }, [projectId, projectDataRef, restorePanels, onDone]);

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
