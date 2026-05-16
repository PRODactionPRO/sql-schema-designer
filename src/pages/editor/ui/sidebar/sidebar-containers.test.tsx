import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_VISIBLE_KINDS } from './constants';
import { DomainsPanel } from './DomainsPanel';
import { SidebarHeader } from './SidebarHeader';
import { TablesPanel } from './TablesPanel';
import type { DomainsPanelViewModel } from './useDomainsPanelViewModel';
import type { TablesPanelViewModel } from './useTablesPanelViewModel';

function createTablesPanelViewModel(overrides: Partial<TablesPanelViewModel> = {}): TablesPanelViewModel {
  return {
    isAddingTable: false,
    newTableName: '',
    newTableKind: 'table',
    sortModeLabel: 'Manual',
    openFilterPopup: 'none',
    sortMode: 'none',
    areAllGroupsCollapsed: false,
    groupMode: 'domain',
    collapsibleGroupIds: ['d1'],
    renderedGroups: [
      {
        domainId: 'd1',
        domain: { id: 'd1', name: 'Workspace', color: '#ef4444' },
        tables: [],
      },
    ],
    domainDropTargetId: null,
    draggingDomainId: null,
    collapsedGroupIds: new Set(),
    draggingTableId: null,
    draggingTableSourceGroupId: null,
    onStartAddTable: vi.fn(),
    onCancelAddTable: vi.fn(),
    onChangeNewTableName: vi.fn(),
    onChangeNewTableKind: vi.fn(),
    onConfirmAddTable: vi.fn(),
    onSortMenuOpenChange: vi.fn(),
    onSortModeChange: vi.fn(),
    onToggleAllGroups: vi.fn(),
    onDomainHeaderDragStart: vi.fn(),
    onDomainHeaderDragOver: vi.fn(),
    onDomainHeaderDrop: vi.fn(),
    onDomainHeaderDragEnd: vi.fn(),
    onToggleGroupCollapsed: vi.fn(),
    onDomainListDragOver: vi.fn(),
    onDomainListDrop: vi.fn(),
    getGroupTablesForRender: () => [],
    renderTableRow: () => null,
    ...overrides,
  };
}

function DomainsPanelHarness({ onUpdateDomain }: { onUpdateDomain: DomainsPanelViewModel['onUpdateDomain'] }) {
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [renamingDomainId, setRenamingDomainId] = useState<string | null>(null);
  const [renamingDomainName, setRenamingDomainName] = useState('');

  const viewModel: DomainsPanelViewModel = {
    domains: [{ id: 'd1', name: 'Workspace', color: '#ef4444' }],
    tables: [],
    isAddingDomain,
    newDomainName,
    editingDomainId,
    renamingDomainId,
    renamingDomainName,
    hasMultiSelection: false,
    selectedTableIds: new Set(),
    onStartAddDomain: () => setIsAddingDomain(true),
    onCancelAddDomain: () => {
      setIsAddingDomain(false);
      setNewDomainName('');
    },
    onConfirmAddDomain: vi.fn(),
    onChangeNewDomainName: setNewDomainName,
    onSetEditingDomainId: setEditingDomainId,
    onSetRenamingDomainId: setRenamingDomainId,
    onSetRenamingDomainName: setRenamingDomainName,
    onAssignDomain: vi.fn(),
    onUpdateDomain,
    onDeleteDomain: vi.fn(),
    onReorderDomains: vi.fn(),
  };

  return <DomainsPanel viewModel={viewModel} />;
}

function SidebarHeaderHarness({ closeAllFilterPopups }: { closeAllFilterPopups: () => void }) {
  const [activeTab, setActiveTab] = useState<'tables' | 'domains'>('tables');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterPopup, setOpenFilterPopup] = useState<'none' | 'group' | 'sort'>('none');
  const [groupMode, setGroupMode] = useState<'none' | 'domain' | 'type'>('domain');
  const [visibleKinds, setVisibleKinds] = useState(DEFAULT_VISIBLE_KINDS);
  const [_sortMode, setSortMode] = useState<'none' | 'asc' | 'desc'>('none');

  return (
    <SidebarHeader
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      searchOpen={searchOpen}
      setSearchOpen={setSearchOpen}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      filtersOpen={filtersOpen}
      setFiltersOpen={setFiltersOpen}
      hasActiveFilters={false}
      visibleKinds={visibleKinds}
      toggleVisibleKind={(kind) => setVisibleKinds((prev) => ({ ...prev, [kind]: !prev[kind] }))}
      openFilterPopup={openFilterPopup}
      setOpenFilterPopup={setOpenFilterPopup}
      groupMode={groupMode}
      setGroupMode={setGroupMode}
      setVisibleKinds={setVisibleKinds}
      setSortMode={setSortMode}
      closeAllFilterPopups={closeAllFilterPopups}
      onToggleCollapse={vi.fn()}
    />
  );
}

describe('TablesPanel', () => {
  it('reflects collapse/expand states and toggles collapse all', () => {
    const onToggleAllGroups = vi.fn();
    const { container, rerender } = render(
      <TablesPanel viewModel={createTablesPanelViewModel({ onToggleAllGroups, areAllGroupsCollapsed: false })} />,
    );

    const collapseButton = container.querySelector('svg.lucide-minimize-2')?.closest('button');
    expect(collapseButton).toBeTruthy();
    fireEvent.click(collapseButton as HTMLButtonElement);
    expect(onToggleAllGroups).toHaveBeenCalledTimes(1);

    rerender(<TablesPanel viewModel={createTablesPanelViewModel({ areAllGroupsCollapsed: true })} />);
    expect(container.querySelector('svg.lucide-maximize-2')).toBeInTheDocument();
  });
});

describe('DomainsPanel', () => {
  it('supports rename flow via double-click and Enter', () => {
    const onUpdateDomain = vi.fn();
    const { container } = render(<DomainsPanelHarness onUpdateDomain={onUpdateDomain} />);

    const editableLabel = container.querySelector('span.text-sm.truncate.cursor-default') as HTMLElement | null;
    expect(editableLabel).toBeTruthy();
    fireEvent.doubleClick(editableLabel as HTMLElement);
    const input = container.querySelector('input[value="Workspace"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, { target: { value: '  New Name  ' } });
    fireEvent.keyDown(input as HTMLInputElement, { key: 'Enter' });

    expect(onUpdateDomain).toHaveBeenCalledWith('d1', { name: 'New Name' });
    expect(container.querySelector('input[value="  New Name  "]')).not.toBeInTheDocument();
  });

  it('cancels rename on Escape without update', () => {
    const onUpdateDomain = vi.fn();
    const { container } = render(<DomainsPanelHarness onUpdateDomain={onUpdateDomain} />);

    const editableLabel = container.querySelector('span.text-sm.truncate.cursor-default') as HTMLElement | null;
    expect(editableLabel).toBeTruthy();
    fireEvent.doubleClick(editableLabel as HTMLElement);
    const input = container.querySelector('input[value="Workspace"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, { target: { value: 'Will be canceled' } });
    fireEvent.keyDown(input as HTMLInputElement, { key: 'Escape' });

    expect(onUpdateDomain).not.toHaveBeenCalled();
    expect(container.querySelector('input[value="Will be canceled"]')).not.toBeInTheDocument();
  });
});

describe('SidebarHeader', () => {
  it('opens and closes search, clearing query on close', () => {
    const { container } = render(<SidebarHeaderHarness closeAllFilterPopups={vi.fn()} />);

    const searchButton = container.querySelector('button svg.lucide-search')?.closest('button');
    expect(searchButton).toBeTruthy();

    fireEvent.click(searchButton as HTMLButtonElement);
    const input = screen.getByPlaceholderText('Search tables...');
    fireEvent.change(input, { target: { value: 'Plan' } });

    fireEvent.click(searchButton as HTMLButtonElement);
    expect(screen.queryByPlaceholderText('Search tables...')).not.toBeInTheDocument();

    fireEvent.click(searchButton as HTMLButtonElement);
    expect(screen.getByPlaceholderText('Search tables...')).toHaveValue('');
  });

  it('opens and closes filters panel', () => {
    const closeAllFilterPopups = vi.fn();
    const { container } = render(<SidebarHeaderHarness closeAllFilterPopups={closeAllFilterPopups} />);

    const filtersButton = container.querySelector('button svg.lucide-sliders-horizontal')?.closest('button');
    expect(filtersButton).toBeTruthy();

    fireEvent.click(filtersButton as HTMLButtonElement);
    expect(screen.getByRole('button', { name: 'SQL' })).toBeInTheDocument();

    fireEvent.click(filtersButton as HTMLButtonElement);
    expect(screen.queryByRole('button', { name: 'SQL' })).not.toBeInTheDocument();
    expect(closeAllFilterPopups).toHaveBeenCalledTimes(1);
  });
});
