import { useMemo, useRef, useState } from 'react';
import { useOutsidePointerDown } from '@/shared/ui/useOutsidePointerDown';
import { groupCatalogItemsWithIcons } from './catalog-icons';
import { getAddMenuPosition, getSearchFilterMenuPosition } from './floating-position';
import type { AddMenuState, SearchFilterMenuState, WorkspaceWindowId } from './types';

export function useWorkspaceMenus() {
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [projectSearchActive, setProjectSearchActive] = useState(false);
  const [searchFilterMenu, setSearchFilterMenu] = useState<SearchFilterMenuState | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const searchFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const catalogGroups = useMemo(() => groupCatalogItemsWithIcons(), []);

  useOutsidePointerDown({
    enabled: Boolean(addMenu),
    refs: [addMenuRef],
    ignoredSelectors: ['[data-add-tab-trigger="true"]'],
    onOutsidePointerDown: () => setAddMenu(null),
  });

  useOutsidePointerDown({
    enabled: Boolean(searchFilterMenu),
    refs: [searchFilterMenuRef],
    ignoredSelectors: ['[data-search-filter-trigger="true"]'],
    onOutsidePointerDown: () => setSearchFilterMenu(null),
  });

  const closeAddMenu = () => {
    setAddMenu(null);
  };

  const openAddMenu = (windowId: WorkspaceWindowId, trigger: HTMLElement) => {
    setAddMenu((current) => {
      if (current?.windowId === windowId) return null;
      return {
        windowId,
        ...getAddMenuPosition(trigger),
      };
    });
  };

  const openProjectSearch = () => {
    setProjectSearchActive(true);
    setSearchFilterMenu(null);
  };

  const closeProjectSearch = () => {
    setProjectSearchActive(false);
    setSearchFilterMenu(null);
  };

  const toggleSearchFilterMenu = (trigger: HTMLElement) => {
    setSearchFilterMenu((current) => (
      current ? null : getSearchFilterMenuPosition(trigger)
    ));
  };

  return {
    addMenu,
    projectSearchActive,
    searchFilterMenu,
    addMenuRef,
    searchFilterMenuRef,
    catalogGroups,
    closeAddMenu,
    openAddMenu,
    openProjectSearch,
    closeProjectSearch,
    toggleSearchFilterMenu,
  };
}
