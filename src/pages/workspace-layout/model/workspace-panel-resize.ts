import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { ImperativePanelGroupHandle } from 'react-resizable-panels';

export function startWorkspaceBottomHeaderResize({
  event,
  centerGroupRef,
  visible,
  groupElementId = 'workspace-layout-center-group',
}: {
  event: ReactPointerEvent<HTMLElement>;
  centerGroupRef: RefObject<ImperativePanelGroupHandle | null>;
  visible: boolean;
  groupElementId?: string;
}) {
  if (event.button !== 0 || !visible) return;

  const target = event.target as HTMLElement;
  if (target.closest('[data-tab-id], button')) return;

  const groupElement = document.getElementById(groupElementId);
  const startLayout = centerGroupRef.current?.getLayout();
  if (!groupElement || !startLayout || startLayout.length < 2) return;

  event.preventDefault();

  const groupRect = groupElement.getBoundingClientRect();
  const startY = event.clientY;
  const startBottomSize = startLayout[1] ?? 30;

  const handlePointerMove = (moveEvent: PointerEvent) => {
    const deltaPercent = ((startY - moveEvent.clientY) / groupRect.height) * 100;
    const nextBottomSize = Math.max(19, Math.min(68, startBottomSize + deltaPercent));
    centerGroupRef.current?.setLayout([100 - nextBottomSize, nextBottomSize]);
  };

  const handlePointerUp = () => {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
  };

  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
}
