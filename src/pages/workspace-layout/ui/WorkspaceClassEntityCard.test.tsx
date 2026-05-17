import { fireEvent, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ClassEntity } from '@/shared/types/project';
import { ClassEntityCard } from './WorkspaceClassEntityCard';

const entity: ClassEntity = {
  id: 'class-1',
  name: 'User',
  kind: 'class',
  position: { x: 0, y: 0 },
  attributes: [
    {
      id: 'attr-1',
      name: 'id',
      type: 'string',
      visibility: 'public',
      multiplicity: 'one',
      required: true,
    },
  ],
  methods: [
    {
      id: 'method-1',
      name: 'create',
      returnType: 'void',
      visibility: 'public',
      parameters: '',
    },
  ],
};

function renderClassEntityCard(overrides: Partial<ComponentProps<typeof ClassEntityCard>> = {}) {
  return render(
    <ClassEntityCard
      entity={entity}
      accent="#ef4444"
      onStartDrag={vi.fn()}
      onSelectEntity={vi.fn()}
      onSelectAttribute={vi.fn()}
      onSelectMethod={vi.fn()}
      onEntityContextMenu={vi.fn()}
      onAttributeContextMenu={vi.fn()}
      onMethodContextMenu={vi.fn()}
      onAttributeNameChange={vi.fn()}
      onAttributeTypeChange={vi.fn()}
      onMethodNameChange={vi.fn()}
      onMethodReturnTypeChange={vi.fn()}
      onReorderAttributes={vi.fn()}
      onReorderMethods={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ClassEntityCard member rename', () => {
  it('opens attribute rename only when double-clicking the member name text', () => {
    const { container } = renderClassEntityCard();
    const attributeRow = container.querySelector('[data-class-member-row-id="attr-1"]') as HTMLElement | null;
    const attributeName = container.querySelector('[data-class-member-name-text]') as HTMLElement | null;

    expect(attributeRow).toBeTruthy();
    expect(attributeName).toBeTruthy();

    fireEvent.doubleClick(attributeRow as HTMLElement);
    expect(container.querySelector('input[value="id"]')).not.toBeInTheDocument();

    fireEvent.doubleClick(attributeName as HTMLElement);
    const input = container.querySelector('input[value="id"]') as HTMLInputElement | null;

    expect(input).toBeTruthy();
    expect(input).toHaveFocus();
    expect(input?.selectionStart).toBe(0);
    expect(input?.selectionEnd).toBe('id'.length);
  });

  it('commits attribute names through onAttributeNameChange', () => {
    const onAttributeNameChange = vi.fn();
    const { container } = renderClassEntityCard({ onAttributeNameChange });
    const attributeName = container.querySelector('[data-class-member-name-text]') as HTMLElement | null;

    fireEvent.doubleClick(attributeName as HTMLElement);
    const input = container.querySelector('input[value="id"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    fireEvent.change(input as HTMLInputElement, { target: { value: '  publicId  ' } });
    fireEvent.keyDown(input as HTMLInputElement, { key: 'Enter' });

    expect(onAttributeNameChange).toHaveBeenCalledWith('class-1', 'attr-1', 'publicId');
  });

  it('commits method names through onMethodNameChange without editing parameters', () => {
    const onMethodNameChange = vi.fn();
    const { container } = renderClassEntityCard({ onMethodNameChange });
    const methodName = Array.from(container.querySelectorAll('[data-class-member-name-text]'))
      .find((item) => item.textContent === 'create()') as HTMLElement | undefined;

    expect(methodName).toBeTruthy();
    fireEvent.doubleClick(methodName as HTMLElement);
    const input = container.querySelector('input[value="create"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();

    fireEvent.change(input as HTMLInputElement, { target: { value: '  build  ' } });
    fireEvent.keyDown(input as HTMLInputElement, { key: 'Enter' });

    expect(onMethodNameChange).toHaveBeenCalledWith('class-1', 'method-1', 'build');
  });
});
