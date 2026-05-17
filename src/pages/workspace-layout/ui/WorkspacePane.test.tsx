import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyProject } from '@/shared/types/project';
import { WorkspacePane } from './WorkspacePane';

describe('WorkspacePane project filters', () => {
  it('opens filters and collapses the project tree', () => {
    const project = createEmptyProject('Product Analytics Demo');
    project.domains = [{ id: 'domain-1', name: 'Core', color: '#f97316' }];
    project.schema.domains = project.domains;
    project.schema.tables = [
      {
        id: 'table-1',
        name: 'users',
        fields: [
          {
            id: 'field-1',
            name: 'id',
            type: 'uuid',
            isPrimaryKey: true,
            isNullable: false,
            isForeignKey: false,
          },
        ],
        position: { x: 0, y: 0 },
      },
    ];

    render(
      <WorkspacePane
        windowState={{
          id: 'project',
          activeTabId: 'project-file',
          tabs: [
            { id: 'project-file', type: 'file', title: 'File' },
            { id: 'project-assets', type: 'assets', title: 'Assets' },
          ],
        }}
        project={project}
        selection={null}
        canvasViewports={{}}
        viewportRestoreKey="test"
        draggingTabId={null}
        heldTabId={null}
        isCanvasMaximized={false}
        searchActive={false}
        searchQuery=""
        onActivate={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onCloseTab={vi.fn()}
        onDuplicateTab={vi.fn()}
        onCollapseLeft={vi.fn()}
        onMaximizeCanvas={vi.fn()}
        onOpenSearch={vi.fn()}
        onOpenAddMenu={vi.fn()}
        onToggleSearchFilterMenu={vi.fn()}
        onStartTabDrag={vi.fn()}
        onProjectChange={vi.fn()}
        onSelectionChange={vi.fn()}
        onCloseDocument={vi.fn()}
        onOpenDocument={vi.fn()}
        onCanvasViewportChange={vi.fn()}
      />,
    );

    expect(screen.getByText('users')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    expect(screen.getByText('Tree Display')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));

    expect(screen.queryByText('users')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeInTheDocument();
  });
});
