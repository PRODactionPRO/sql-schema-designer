import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useWorkspacePanelSearch } from './useWorkspacePanelSearch';

describe('useWorkspacePanelSearch', () => {
  it('opens, tracks query, and clears query on close by default', () => {
    const { result } = renderHook(() => useWorkspacePanelSearch());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isActive).toBe(false);

    act(() => result.current.openSearch());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isActive).toBe(true);

    act(() => result.current.setQuery('brand'));
    expect(result.current.query).toBe('brand');
    expect(result.current.hasQuery).toBe(true);

    act(() => result.current.closeSearch());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.isActive).toBe(false);
  });

  it('can preserve query when configured not to clear on close', () => {
    const { result } = renderHook(() => useWorkspacePanelSearch({ initialOpen: true, clearOnClose: false }));

    act(() => result.current.setQuery('table'));
    act(() => result.current.closeSearch());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('table');
    expect(result.current.isActive).toBe(true);
  });
});
