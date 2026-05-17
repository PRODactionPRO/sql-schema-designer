import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceCatalogSortMode } from '../model/useWorkspaceCatalogOrdering';
import { useWorkspacePanelSearch } from '../model/useWorkspacePanelSearch';
import { WorkspaceCatalogPaneHeader } from './WorkspaceCatalogPaneHeader';

function WorkspaceCatalogPaneHeaderHarness() {
  const search = useWorkspacePanelSearch();

  return (
    <WorkspaceCatalogPaneHeader
      title="Entities"
      addLabel="Add entity"
      searchPlaceholder="Search entities..."
      searchOpen={search.isOpen}
      query={search.query}
      sortMode={'manual' as WorkspaceCatalogSortMode}
      areAllGroupsCollapsed={false}
      collapseDisabled={false}
      onAdd={vi.fn()}
      onQueryChange={search.setQuery}
      onToggleSearch={search.toggleSearch}
      onCloseSearch={search.closeSearch}
      onCycleSortMode={vi.fn()}
      onToggleGroupsCollapsed={vi.fn()}
    />
  );
}

describe('WorkspaceCatalogPaneHeader search', () => {
  it('opens optional search, tracks input, and clears it on Escape', () => {
    render(<WorkspaceCatalogPaneHeaderHarness />);

    expect(screen.queryByPlaceholderText('Search entities...')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Search entities' }));

    const input = screen.getByPlaceholderText('Search entities...');
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'brand' } });
    expect(input).toHaveValue('brand');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByPlaceholderText('Search entities...')).not.toBeInTheDocument();
  });
});
