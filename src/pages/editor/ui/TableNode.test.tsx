import { fireEvent, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Table } from '../model/types';
import { TableNode } from './TableNode';

const table: Table = {
  id: 'table-1',
  name: 'Brand',
  position: { x: 0, y: 0 },
  fields: [
    {
      id: 'field-created-at',
      name: 'createdAt',
      type: 'timestamp',
      isPrimaryKey: false,
      isNullable: false,
      isForeignKey: false,
    },
  ],
};

function renderTableNode(overrides: Partial<ComponentProps<typeof TableNode>> = {}) {
  return render(
    <TableNode
      table={table}
      tableColor="#ef4444"
      isSelected={false}
      isMultiSelected={false}
      isFocused
      onSelect={vi.fn()}
      onPositionChange={vi.fn()}
      onDelete={vi.fn()}
      onFieldClick={vi.fn()}
      onUpdateField={vi.fn()}
      {...overrides}
    />,
  );
}

describe('TableNode field rename', () => {
  it('opens inline rename only when double-clicking the field name text', () => {
    const { container } = renderTableNode();
    const fieldRow = container.querySelector('[data-field-id="field-created-at"]') as HTMLElement | null;
    const fieldName = container.querySelector('[data-field-name-text]') as HTMLElement | null;

    expect(fieldRow).toBeTruthy();
    expect(fieldName).toBeTruthy();

    fireEvent.doubleClick(fieldRow as HTMLElement);
    expect(container.querySelector('input[value="createdAt"]')).not.toBeInTheDocument();

    fireEvent.doubleClick(fieldName as HTMLElement);
    const input = container.querySelector('input[value="createdAt"]') as HTMLInputElement | null;

    expect(input).toBeTruthy();
    expect(input).toHaveFocus();
    expect(input?.selectionStart).toBe(0);
    expect(input?.selectionEnd).toBe('createdAt'.length);
  });

  it('commits renamed field names through onUpdateField', () => {
    const onUpdateField = vi.fn();
    const { container } = renderTableNode({ onUpdateField });
    const fieldName = container.querySelector('[data-field-name-text]') as HTMLElement | null;

    fireEvent.doubleClick(fieldName as HTMLElement);
    const input = container.querySelector('input[value="createdAt"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    fireEvent.change(input as HTMLInputElement, { target: { value: '  publishedAt  ' } });
    fireEvent.keyDown(input as HTMLInputElement, { key: 'Enter' });

    expect(onUpdateField).toHaveBeenCalledWith('field-created-at', { name: 'publishedAt' });
  });
});
