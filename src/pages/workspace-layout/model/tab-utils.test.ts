import { describe, expect, it } from 'vitest';
import type { WorkspaceWindow, WorkspaceWindowId } from './types';
import { finalizeTabPreview, relocateTabPreview } from './tab-utils';

function windows(): Record<WorkspaceWindowId, WorkspaceWindow> {
  return {
    project: {
      id: 'project',
      activeTabId: 'file',
      tabs: [
        { id: 'file', type: 'file', title: 'File' },
        { id: 'domains', type: 'domains', title: 'Domains' },
      ],
    },
    library: {
      id: 'library',
      activeTabId: 'entities',
      tabs: [
        { id: 'entities', type: 'entities', title: 'Entities' },
      ],
    },
    canvas: {
      id: 'canvas',
      activeTabId: 'er',
      tabs: [
        { id: 'er', type: 'erDiagram', title: 'ER diagram' },
      ],
    },
    behavior: {
      id: 'behavior',
      activeTabId: 'events',
      tabs: [
        { id: 'events', type: 'events', title: 'Events' },
      ],
    },
    inspector: {
      id: 'inspector',
      activeTabId: 'properties',
      tabs: [
        { id: 'properties', type: 'properties', title: 'Properties' },
        { id: 'ai', type: 'aiAssistant', title: 'AI Assistant' },
      ],
    },
  };
}

describe('tab utils', () => {
  it('keeps the target active tab when dropping another tab into the window', () => {
    const preview = relocateTabPreview(windows(), 'project', 'domains', 'inspector', 1);
    const finalized = finalizeTabPreview(preview, 'domains', { windowId: 'project', index: 1 });

    expect(finalized.inspector.tabs.map((tab) => tab.id)).toEqual(['properties', 'domains', 'ai']);
    expect(finalized.inspector.activeTabId).toBe('properties');
    expect(finalized.project.activeTabId).toBe('file');
  });

  it('selects the moved tab only when the target window has no active tab left', () => {
    const source = windows();
    source.library = {
      id: 'library',
      activeTabId: null,
      tabs: [],
    };

    const preview = relocateTabPreview(source, 'project', 'domains', 'library', 0);
    const finalized = finalizeTabPreview(preview, 'domains', { windowId: 'project', index: 1 });

    expect(finalized.library.activeTabId).toBe('domains');
  });
});
