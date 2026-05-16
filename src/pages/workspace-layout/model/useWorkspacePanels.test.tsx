import { act, renderHook } from '@testing-library/react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWorkspacePanels } from './useWorkspacePanels';

function createPanelHandle(initialCollapsed = false) {
  let collapsed = initialCollapsed;

  return {
    handle: {
      isCollapsed: vi.fn(() => collapsed),
      collapse: vi.fn(() => {
        collapsed = true;
      }),
      expand: vi.fn(() => {
        collapsed = false;
      }),
    } as unknown as ImperativePanelHandle,
    setCollapsed(value: boolean) {
      collapsed = value;
    },
  };
}

describe('useWorkspacePanels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps hidden panels locked while another panel is being resized', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const { result } = renderHook(() => useWorkspacePanels());
    const leftPanel = createPanelHandle();
    const rightPanel = createPanelHandle();

    act(() => {
      result.current.leftPanelRef.current = leftPanel.handle;
      result.current.rightPanelRef.current = rightPanel.handle;
      result.current.toggleLeftColumn();
    });

    expect(result.current.layoutVisibility.left).toBe(false);

    act(() => {
      result.current.handleResizeDragging('right', true);
      leftPanel.setCollapsed(false);
      result.current.syncPanelVisibility('left', true);
    });

    expect(result.current.layoutVisibility.left).toBe(false);
    expect(leftPanel.handle.collapse).toHaveBeenCalled();

    act(() => {
      result.current.handleResizeDragging('right', false);
    });

    expect(result.current.layoutVisibility.left).toBe(false);
  });

  it('syncs the resized panel visibility after dragging stops', () => {
    const { result } = renderHook(() => useWorkspacePanels());
    const rightPanel = createPanelHandle();

    act(() => {
      result.current.rightPanelRef.current = rightPanel.handle;
      result.current.handleResizeDragging('right', true);
      rightPanel.setCollapsed(true);
      result.current.syncPanelVisibility('right', false);
    });

    expect(result.current.layoutVisibility.right).toBe(true);

    act(() => {
      result.current.handleResizeDragging('right', false);
    });

    expect(result.current.layoutVisibility.right).toBe(false);
  });
});
