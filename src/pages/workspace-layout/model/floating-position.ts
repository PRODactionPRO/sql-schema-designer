import {
  ADD_MENU_MAX_HEIGHT,
  ADD_MENU_WIDTH,
  SEARCH_FILTER_MENU_MAX_HEIGHT,
  SEARCH_FILTER_MENU_WIDTH,
} from './layout-constants';
import type { AddMenuState, SearchFilterMenuState } from './types';

function getFloatingMenuPosition(
  button: HTMLElement,
  width: number,
  maxHeight: number,
): { left: number; top: number } {
  const rect = button.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(
    Math.max(rect.left, margin),
    Math.max(margin, window.innerWidth - width - margin),
  );
  const top = Math.min(
    Math.max(rect.bottom + margin, margin),
    Math.max(margin, window.innerHeight - maxHeight - margin),
  );

  return { left, top };
}

export function getAddMenuPosition(button: HTMLElement): Pick<AddMenuState, 'left' | 'top'> {
  return getFloatingMenuPosition(button, ADD_MENU_WIDTH, ADD_MENU_MAX_HEIGHT);
}

export function getSearchFilterMenuPosition(button: HTMLElement): SearchFilterMenuState {
  return getFloatingMenuPosition(button, SEARCH_FILTER_MENU_WIDTH, SEARCH_FILTER_MENU_MAX_HEIGHT);
}
