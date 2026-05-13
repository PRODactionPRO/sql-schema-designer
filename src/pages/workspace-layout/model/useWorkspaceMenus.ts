import { useEffect, useMemo, useRef, useState } from 'react';
import { groupCatalogItems } from './catalog';
import { getAddMenuPosition, getSearchFilterMenuPosition } from './floating-position';
import type { AddMenuState, SearchFilterMenuState, WorkspaceWindowId } from './types';

export function useWorkspaceMenus() {
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [projectSearchActive, setProjectSearchActive] = useState(false);
  const [searchFilterMenu, setSearchFilterMenu] = useState<SearchFilterMenuState | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const searchFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const catalogGroups = useMemo(() => groupCatalogItems(), []);

  useEffect(() => {
    if (!addMenu && !searchFilterMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        addMenu &&
        !addMenuRef.current?.contains(target) &&
        !target.closest('[data-add-tab-trigger="true"]')
      ) {
        setAddMenu(null);
      }
      if (
        searchFilterMenu &&
        !searchFilterMenuRef.current?.contains(target) &&
        !target.closest('[data-search-filter-trigger="true"]')
      ) {
        setSearchFilterMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [addMenu, searchFilterMenu]);

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
