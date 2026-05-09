import type React from 'react';
import { Plus, ArrowUpDown, Minimize2, Maximize2 } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { ProTooltip } from '@/shared/ui/pro-tooltip';
import { GhostActionButton } from '@/shared/ui/ghost-action-button';
import { SortMenu } from './SortMenu';
import { TableKindMenu } from './TableKindMenu';
import { GroupHeaderRow } from './GroupHeaderRow';
import type { TablesPanelViewModel } from './useTablesPanelViewModel';

interface TablesPanelProps {
  viewModel: TablesPanelViewModel;
}

export function TablesPanel({
  viewModel,
}: TablesPanelProps) {
  const {
    isAddingTable,
    newTableName,
    newTableKind,
    sortModeLabel,
    openFilterPopup,
    sortMode,
    areAllGroupsCollapsed,
    groupMode,
    collapsibleGroupIds,
    renderedGroups,
    domainDropTargetId,
    draggingDomainId,
    collapsedGroupIds,
    draggingTableId,
    draggingTableSourceGroupId,
    onStartAddTable,
    onCancelAddTable,
    onChangeNewTableName,
    onChangeNewTableKind,
    onConfirmAddTable,
    onSortMenuOpenChange,
    onSortModeChange,
    onToggleAllGroups,
    onDomainHeaderDragStart,
    onDomainHeaderDragOver,
    onDomainHeaderDrop,
    onDomainHeaderDragEnd,
    onToggleGroupCollapsed,
    onDomainListDragOver,
    onDomainListDrop,
    getGroupTablesForRender,
    renderTableRow,
  } = viewModel;

  return (
    <>
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur-sm px-3 py-2">
        {isAddingTable ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-600">Tables</span>
                <GhostActionButton Icon={Plus} tone="strong" disabled aria-label="Add table disabled" />
              </div>
              <div className="flex items-center gap-1">
                <SortMenu
                  open={openFilterPopup === 'sort'}
                  onOpenChange={onSortMenuOpenChange}
                  sortMode={sortMode}
                  onChange={onSortModeChange}
                  trigger={(
                    <GhostActionButton Icon={ArrowUpDown} tone="neutral" aria-label="Sort tables" />
                  )}
                />
                <ProTooltip label={areAllGroupsCollapsed ? 'Expand Groups' : 'Collapse Groups'}>
                  <GhostActionButton
                    Icon={areAllGroupsCollapsed ? Maximize2 : Minimize2}
                    onClick={onToggleAllGroups}
                    disabled={groupMode === 'none' || collapsibleGroupIds.length === 0}
                    tone="neutral"
                    aria-label={areAllGroupsCollapsed ? 'Expand groups' : 'Collapse groups'}
                  />
                </ProTooltip>
              </div>
            </div>
            <div className="flex gap-2 mb-2">
              <Input
                type="text"
                placeholder="Table name..."
                value={newTableName}
                onChange={(e) => onChangeNewTableName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirmAddTable();
                  if (e.key === 'Escape') onCancelAddTable();
                }}
                autoFocus
                className="h-8 text-sm"
              />
              <TableKindMenu value={newTableKind} onChange={onChangeNewTableKind} />
            </div>
            <div className="flex gap-2">
              <Button onClick={onConfirmAddTable} size="sm" className="flex-1 h-7">Add</Button>
              <Button onClick={onCancelAddTable} variant="outline" size="sm" className="flex-1 h-7">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-600">Tables</span>
              <ProTooltip label="Add Table">
                <GhostActionButton Icon={Plus} tone="strong" onClick={onStartAddTable} aria-label="Add table" />
              </ProTooltip>
            </div>
            <div className="flex items-center gap-1">
              <ProTooltip label={`Sort: ${sortModeLabel}`}>
                <div>
                  <SortMenu
                    open={openFilterPopup === 'sort'}
                    onOpenChange={onSortMenuOpenChange}
                    sortMode={sortMode}
                    onChange={onSortModeChange}
                    trigger={(
                      <GhostActionButton Icon={ArrowUpDown} tone="neutral" active={sortMode !== 'none'} aria-label="Sort tables" />
                    )}
                  />
                </div>
              </ProTooltip>
              <ProTooltip label={areAllGroupsCollapsed ? 'Expand Groups' : 'Collapse Groups'}>
                <GhostActionButton
                  Icon={areAllGroupsCollapsed ? Maximize2 : Minimize2}
                  onClick={onToggleAllGroups}
                  disabled={groupMode === 'none' || collapsibleGroupIds.length === 0}
                  tone="neutral"
                  aria-label={areAllGroupsCollapsed ? 'Expand groups' : 'Collapse groups'}
                />
              </ProTooltip>
            </div>
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto panel-scroll pb-12"
        onDragOver={onDomainListDragOver}
        onDrop={onDomainListDrop}
      >
        {renderedGroups.map((group) => (
          <div key={group.domainId || '__ungrouped__'}>
            {groupMode !== 'none' && (
              <GroupHeaderRow
                group={group}
                groupMode={groupMode}
                domainDropTargetId={domainDropTargetId}
                draggingDomainId={draggingDomainId}
                collapsedGroupIds={collapsedGroupIds}
                draggingTableId={draggingTableId}
                draggingTableSourceGroupId={draggingTableSourceGroupId}
                onDomainHeaderDragStart={onDomainHeaderDragStart}
                onDomainHeaderDragOver={onDomainHeaderDragOver}
                onDomainHeaderDrop={onDomainHeaderDrop}
                onDomainHeaderDragEnd={onDomainHeaderDragEnd}
                onToggleGroupCollapsed={onToggleGroupCollapsed}
              />
            )}
            {getGroupTablesForRender(group).map(renderTableRow)}
          </div>
        ))}
      </div>
    </>
  );
}
