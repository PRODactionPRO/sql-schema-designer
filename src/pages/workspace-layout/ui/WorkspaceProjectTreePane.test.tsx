import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyProject } from '@/shared/types/project';
import { ProjectTreePane } from './WorkspaceProjectTreePane';

describe('ProjectTreePane', () => {
  it('creates a process model from the Processes header action', () => {
    const project = createEmptyProject('Product Analytics Demo');
    const onProjectChange = vi.fn();
    const onSelectionChange = vi.fn();
    const onCloseDocument = vi.fn();
    const onOpenDocument = vi.fn();

    render(
      <ProjectTreePane
        project={project}
        selection={null}
        collapsedSectionIds={new Set()}
        collapsedTableIds={new Set()}
        onToggleSectionCollapse={vi.fn()}
        onToggleTableCollapse={vi.fn()}
        onProjectChange={onProjectChange}
        onSelectionChange={onSelectionChange}
        onCloseDocument={onCloseDocument}
        onOpenDocument={onOpenDocument}
      />,
    );

    expect(screen.queryByText('Create process model')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create process model' }));

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    const nextProject = onProjectChange.mock.calls[0][0];
    expect(nextProject.documents).toHaveLength(1);
    expect(nextProject.documents[0].type).toBe('idef0');
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: 'diagram',
      id: nextProject.documents[0].id,
      sourceView: 'diagrams',
    });
    expect(onOpenDocument).toHaveBeenCalledWith(
      nextProject.documents[0].id,
      { type: 'idef0', title: nextProject.documents[0].name },
    );
  });
});
