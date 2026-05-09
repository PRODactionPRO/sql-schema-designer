import type React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FiltersBar } from './FiltersBar';
import {
  DEFAULT_GROUP_MODE,
  DEFAULT_SORT_MODE,
  DEFAULT_VISIBLE_KINDS,
} from './constants';
import { useDomainDnD } from './useDomainDnD';
import type { SidebarTableGroup } from './types';

function createMockDragEvent(initialData: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialData));
  const dataTransfer = {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (key: string, value: string) => {
      store.set(key, value);
    },
    getData: (key: string) => store.get(key) ?? '',
    setDragImage: vi.fn(),
  };

  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer,
  } as unknown as React.DragEvent;
}

const domains = [
  { id: 'd1', name: 'Domain 1', color: '#f00' },
  { id: 'd2', name: 'Domain 2', color: '#0f0' },
];

const displayGroups: SidebarTableGroup[] = [
  { domainId: 'd1', domain: domains[0], tables: [] },
  { domainId: 'd2', domain: domains[1], tables: [] },
];

describe('sidebar critical DnD and filter scenarios', () => {
  it('keeps domain reorder after drop', () => {
    const onReorderDomains = vi.fn();

    const { result } = renderHook(() =>
      useDomainDnD({
        tables: [],
        domains,
        displayGroups,
        groupMode: 'domain',
        onReorderDomains,
        collapsedGroupIds: new Set(),
        setCollapsedGroupIds: vi.fn(),
        collapsibleGroupIds: ['d1', 'd2'],
      }),
    );

    act(() => {
      result.current.handleDomainHeaderDragStart('d1', createMockDragEvent());
    });

    act(() => {
      result.current.handleDomainHeaderDragOver('d2', createMockDragEvent());
    });

    act(() => {
      result.current.handleDomainHeaderDrop('d2', createMockDragEvent());
    });

    expect(onReorderDomains).toHaveBeenCalledWith(['d2', 'd1']);
  });

  it('creates pending move for table drop to another domain and to No Domain', () => {
    const tables = [
      { id: 't1', name: 'Table 1', domainId: 'd1', fields: [], position: { x: 0, y: 0 } },
    ];

    const { result } = renderHook(() =>
      useDomainDnD({
        tables,
        domains,
        displayGroups,
        groupMode: 'domain',
        onReorderDomains: vi.fn(),
        collapsedGroupIds: new Set(),
        setCollapsedGroupIds: vi.fn(),
        collapsibleGroupIds: ['d1', 'd2'],
      }),
    );

    act(() => {
      result.current.handleTableDomainDragStart('t1', 'd1', createMockDragEvent());
      result.current.handleDomainHeaderDrop('d2', createMockDragEvent());
    });

    expect(result.current.pendingMove).toEqual({
      tableId: 't1',
      targetDomainId: 'd2',
      targetDomainName: 'Domain 2',
    });

    act(() => {
      result.current.setPendingMove(null);
      result.current.handleTableDomainDragStart('t1', 'd1', createMockDragEvent());
      result.current.handleDomainHeaderDrop(null, createMockDragEvent());
    });

    expect(result.current.pendingMove).toEqual({
      tableId: 't1',
      targetDomainId: null,
      targetDomainName: 'No Domain',
    });
  });

  it('resets filters to default state', () => {
    const setVisibleKinds = vi.fn();
    const setGroupMode = vi.fn();
    const setSortMode = vi.fn();
    const closeAllFilterPopups = vi.fn();

    const { container } = render(
      <FiltersBar
        visibleKinds={{ table: false, enum: true, json: false }}
        onToggleKind={vi.fn()}
        openFilterPopup="group"
        setOpenFilterPopup={vi.fn()}
        groupMode="type"
        setGroupMode={setGroupMode}
        setVisibleKinds={setVisibleKinds}
        setSortMode={setSortMode}
        closeAllFilterPopups={closeAllFilterPopups}
      />,
    );

    const resetButton = container.querySelector('svg.lucide-rotate-ccw')?.closest('button');
    expect(resetButton).toBeTruthy();
    fireEvent.click(resetButton as HTMLButtonElement);

    expect(setVisibleKinds).toHaveBeenCalledWith(DEFAULT_VISIBLE_KINDS);
    expect(setGroupMode).toHaveBeenCalledWith(DEFAULT_GROUP_MODE);
    expect(setSortMode).toHaveBeenCalledWith(DEFAULT_SORT_MODE);
    expect(closeAllFilterPopups).toHaveBeenCalledTimes(1);
  });
});
