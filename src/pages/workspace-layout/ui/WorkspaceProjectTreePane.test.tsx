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

  it('opens the diagrams menu and creates an ERD document from it', () => {
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Create diagram' }).at(-1)!);
    expect(screen.getByRole('button', { name: 'ERD diagram' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'ERD diagram' }).at(-1)!);

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    const nextProject = onProjectChange.mock.calls[0][0];
    expect(nextProject.documents).toHaveLength(1);
    expect(nextProject.documents[0].type).toBe('erd');
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: 'diagram',
      id: nextProject.documents[0].id,
      sourceView: 'diagrams',
    });
    expect(onOpenDocument).toHaveBeenCalledWith(
      nextProject.documents[0].id,
      { type: 'erDiagram', title: nextProject.documents[0].name },
    );
  });

  it('creates an enum from the Enums header action', () => {
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Create enum' }).at(-1)!);

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    const nextProject = onProjectChange.mock.calls[0][0];
    expect(nextProject.schema.enums).toHaveLength(1);
    expect(nextProject.schema.enums[0]).toMatchObject({
      name: 'NewEnum',
      values: ['value_1', 'value_2'],
      storageStrategy: 'postgres_enum',
    });
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: 'enum',
      id: nextProject.schema.enums[0].id,
      sourceView: 'model',
    });
  });

  it('creates a table from the Tables header action', () => {
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Create table' }).at(-1)!);

    expect(onProjectChange).toHaveBeenCalledTimes(1);
    const nextProject = onProjectChange.mock.calls[0][0];
    expect(nextProject.schema.tables).toHaveLength(1);
    expect(nextProject.schema.tables[0]).toMatchObject({
      name: 'Table',
      fields: [],
      color: '#64748b',
      sidebarOrder: 0,
    });
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: 'table',
      id: nextProject.schema.tables[0].id,
      sourceView: 'model',
    });
  });
});
