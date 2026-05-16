import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MAX_HISTORY_LENGTH = 50;

export function useWorkspaceCanvasHistory<TSnapshot>({
  getSnapshot,
  applySnapshot,
  maxLength = DEFAULT_MAX_HISTORY_LENGTH,
}: {
  getSnapshot: () => TSnapshot;
  applySnapshot: (snapshot: TSnapshot) => void;
  maxLength?: number;
}) {
  const [historyPast, setHistoryPast] = useState<TSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<TSnapshot[]>([]);
  const historyPastRef = useRef(historyPast);
  const historyFutureRef = useRef(historyFuture);

  useEffect(() => {
    historyPastRef.current = historyPast;
  }, [historyPast]);

  useEffect(() => {
    historyFutureRef.current = historyFuture;
  }, [historyFuture]);

  const resetHistory = useCallback(() => {
    historyPastRef.current = [];
    historyFutureRef.current = [];
    setHistoryPast([]);
    setHistoryFuture([]);
  }, []);

  const pushHistory = useCallback(() => {
    const nextPast = [...historyPastRef.current.slice(-(maxLength - 1)), getSnapshot()];
    historyPastRef.current = nextPast;
    historyFutureRef.current = [];
    setHistoryPast(nextPast);
    setHistoryFuture([]);
  }, [getSnapshot, maxLength]);

  const undo = useCallback(() => {
    const previous = historyPastRef.current.at(-1);
    if (!previous) return;

    const nextPast = historyPastRef.current.slice(0, -1);
    const nextFuture = [getSnapshot(), ...historyFutureRef.current].slice(0, maxLength);
    historyPastRef.current = nextPast;
    historyFutureRef.current = nextFuture;
    setHistoryPast(nextPast);
    setHistoryFuture(nextFuture);
    applySnapshot(previous);
  }, [applySnapshot, getSnapshot, maxLength]);

  const redo = useCallback(() => {
    const next = historyFutureRef.current[0];
    if (!next) return;

    const nextPast = [...historyPastRef.current.slice(-(maxLength - 1)), getSnapshot()];
    const nextFuture = historyFutureRef.current.slice(1);
    historyPastRef.current = nextPast;
    historyFutureRef.current = nextFuture;
    setHistoryPast(nextPast);
    setHistoryFuture(nextFuture);
    applySnapshot(next);
  }, [applySnapshot, getSnapshot, maxLength]);

  return {
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    pushHistory,
    resetHistory,
    undo,
    redo,
  };
}
