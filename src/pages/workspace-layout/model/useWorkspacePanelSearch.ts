import { useCallback, useMemo, useState } from 'react';

export interface WorkspacePanelSearchState {
  isOpen: boolean;
  query: string;
  hasQuery: boolean;
  isActive: boolean;
  setQuery: (query: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  clearSearch: () => void;
}

export function useWorkspacePanelSearch({
  initialOpen = false,
  initialQuery = '',
  clearOnClose = true,
}: {
  initialOpen?: boolean;
  initialQuery?: string;
  clearOnClose?: boolean;
} = {}): WorkspacePanelSearchState {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [query, setQuery] = useState(initialQuery);
  const hasQuery = query.trim().length > 0;

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    if (clearOnClose) setQuery('');
  }, [clearOnClose]);

  const toggleSearch = useCallback(() => {
    setIsOpen((current) => {
      const next = !current;
      if (!next && clearOnClose) setQuery('');
      return next;
    });
  }, [clearOnClose]);

  return useMemo(() => ({
    isOpen,
    query,
    hasQuery,
    isActive: isOpen || hasQuery,
    setQuery,
    openSearch,
    closeSearch,
    toggleSearch,
    clearSearch,
  }), [clearSearch, closeSearch, hasQuery, isOpen, openSearch, query, toggleSearch]);
}
