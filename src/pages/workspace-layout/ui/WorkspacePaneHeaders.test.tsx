import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DraggableTab } from './WorkspacePaneHeaders';

describe('DraggableTab context menu', () => {
  it('opens duplicate and close actions from the tab context menu', () => {
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const onDuplicate = vi.fn();
    const onStartDrag = vi.fn();

    render(
      <DraggableTab
        tab={{ id: 'tab-1', type: 'idef0', title: 'New process model', documentId: 'doc-1' }}
        windowId="canvas"
        active={false}
        dragging={false}
        held={false}
        onActivate={onActivate}
        onClose={onClose}
        onDuplicate={onDuplicate}
        onStartDrag={onStartDrag}
      />,
    );

    const tab = screen.getByTestId('workspace-tab-tab-1');
    fireEvent.pointerDown(tab, { button: 2 });
    fireEvent.contextMenu(tab);

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(onDuplicate).toHaveBeenCalledWith('canvas', 'tab-1');
    expect(onStartDrag).not.toHaveBeenCalled();

    fireEvent.contextMenu(tab);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith('canvas', 'tab-1');
  });
});
