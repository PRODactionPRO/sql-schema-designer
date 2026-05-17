import { useCallback, useEffect, useRef, useState } from 'react';
import { deepClone } from '@/shared/lib/json';

const MAX_COMMAND_HISTORY = 80;

interface CommandHistoryState<T> {
  value: T | undefined;
  past: T[];
  future: T[];
}

export function useWorkspaceCommandHistory<T>(sourceValue: T | undefined) {
  const [state, setState] = useState<CommandHistoryState<T>>({
    value: sourceValue ? deepClone(sourceValue) : undefined,
    past: [],
    future: [],
  });
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setState({
      value: sourceValue ? deepClone(sourceValue) : undefined,
      past: [],
      future: [],
    });
  }, [sourceValue]);

  const commit = useCallback((nextValue: T) => {
    setState((current) => {
      const past = current.value
        ? [...current.past.slice(-(MAX_COMMAND_HISTORY - 1)), deepClone(current.value)]
        : current.past;
      return {
        value: deepClone(nextValue),
        past,
        future: [],
      };
    });
  }, []);

  const replace = useCallback((nextValue: T | undefined) => {
    setState((current) => ({
      ...current,
      value: nextValue ? deepClone(nextValue) : undefined,
    }));
  }, []);

  const undo = useCallback(() => {
    const previous = stateRef.current.past.at(-1);
    if (!previous) return undefined;

    setState((current) => {
      const currentValue = current.value;
      return {
        value: deepClone(previous),
        past: current.past.slice(0, -1),
        future: currentValue ? [deepClone(currentValue), ...current.future].slice(0, MAX_COMMAND_HISTORY) : current.future,
      };
    });
    return deepClone(previous);
  }, []);

  const redo = useCallback(() => {
    const next = stateRef.current.future[0];
    if (!next) return undefined;

    setState((current) => {
      const currentValue = current.value;
      return {
        value: deepClone(next),
        past: currentValue ? [...current.past.slice(-(MAX_COMMAND_HISTORY - 1)), deepClone(currentValue)] : current.past,
        future: current.future.slice(1),
      };
    });
    return deepClone(next);
  }, []);

  return {
    value: state.value,
    commit,
    replace,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
