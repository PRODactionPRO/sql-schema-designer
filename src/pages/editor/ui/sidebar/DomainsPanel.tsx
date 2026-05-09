import { useMemo } from 'react';
import { MoreVertical, Plus, Pencil, Trash2 } from 'lucide-react';
import { DOMAIN_COLORS } from '../../model/types';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { ProTooltip } from '@/shared/ui/pro-tooltip';
import { ActionMenuContent, ActionMenuItem } from '@/shared/ui/action-menu';
import { GhostActionButton } from '@/shared/ui/ghost-action-button';
import { SidebarListRow } from './SidebarListRow';
import type { DomainsPanelViewModel } from './useDomainsPanelViewModel';

interface DomainsPanelProps {
  viewModel: DomainsPanelViewModel;
}

export function DomainsPanel({
  viewModel,
}: DomainsPanelProps) {
  const {
    domains,
    tables,
    isAddingDomain,
    newDomainName,
    editingDomainId,
    renamingDomainId,
    renamingDomainName,
    hasMultiSelection,
    selectedTableIds,
    onStartAddDomain,
    onCancelAddDomain,
    onConfirmAddDomain,
    onChangeNewDomainName,
    onSetEditingDomainId,
    onSetRenamingDomainId,
    onSetRenamingDomainName,
    onAssignDomain,
    onUpdateDomain,
    onDeleteDomain,
  } = viewModel;

  const domainTableCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const table of tables) {
      if (!table.domainId) continue;
      counts.set(table.domainId, (counts.get(table.domainId) ?? 0) + 1);
    }
    return counts;
  }, [tables]);

  return (
    <div className="flex-1 overflow-y-auto panel-scroll pb-12">
      {domains.map(domain => {
        const domainTableCount = domainTableCounts.get(domain.id) ?? 0;
        return (
          <SidebarListRow
            key={domain.id}
            className="hover:bg-gray-50 group relative"
            left={(
              <div className="relative mr-2">
                <button
                  onClick={() => onSetEditingDomainId(editingDomainId === domain.id ? null : domain.id)}
                  className="size-5 rounded-full border-2 border-white shadow-sm flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: domain.color }}
                />
                {editingDomainId === domain.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => onSetEditingDomainId(null)} />
                    <div className="absolute left-0 top-full z-50 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-[200px]">
                      <div className="text-xs text-gray-400 mb-2 font-medium">Pick a color</div>
                      <div className="grid grid-cols-7 gap-2">
                        {DOMAIN_COLORS.map(c => (
                          <button
                            key={c}
                            className={`size-6 rounded-full border-2 transition-all hover:scale-125 ${domain.color === c ? 'border-white shadow-lg' : 'border-transparent hover:border-gray-500'}`}
                            style={{ backgroundColor: c }}
                            onClick={() => { onUpdateDomain(domain.id, { color: c }); onSetEditingDomainId(null); }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            main={renamingDomainId === domain.id ? (
              <input
                type="text"
                value={renamingDomainName}
                onChange={(e) => onSetRenamingDomainName(e.target.value)}
                onBlur={() => {
                  if (renamingDomainName.trim()) {
                    onUpdateDomain(domain.id, { name: renamingDomainName.trim() });
                  }
                  onSetRenamingDomainId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (renamingDomainName.trim()) {
                      onUpdateDomain(domain.id, { name: renamingDomainName.trim() });
                    }
                    onSetRenamingDomainId(null);
                  }
                  if (e.key === 'Escape') {
                    onSetRenamingDomainId(null);
                  }
                }}
                onFocus={(e) => e.currentTarget.select()}
                autoFocus
                className="min-w-0 text-sm bg-transparent border border-blue-400 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
              />
            ) : (
              <span
                className="text-sm truncate cursor-default"
                onDoubleClick={() => {
                  onSetRenamingDomainId(domain.id);
                  onSetRenamingDomainName(domain.name);
                }}
              >
                {domain.name}
              </span>
            )}
            right={(
              <>
                <span className="text-xs text-gray-400 tabular-nums mr-1">{domainTableCount}</span>
                {hasMultiSelection && (
                  <ProTooltip
                    label={`Add ${selectedTableIds.size} selected table${selectedTableIds.size > 1 ? 's' : ''} to ${domain.name}`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onAssignDomain(domain.id, Array.from(selectedTableIds)); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-all flex-shrink-0 mr-1"
                    >
                      <Plus className="size-3" />
                    </button>
                  </ProTooltip>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <GhostActionButton
                      Icon={MoreVertical}
                      size="xs"
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                      aria-label={`Domain actions for ${domain.name}`}
                    />
                  </DropdownMenuTrigger>
                  <ActionMenuContent align="end">
                    <ActionMenuItem onClick={() => {
                      onSetRenamingDomainId(domain.id);
                      onSetRenamingDomainName(domain.name);
                    }}>
                      <Pencil className="size-3.5" />
                      Rename
                    </ActionMenuItem>
                    <ActionMenuItem danger onClick={() => onDeleteDomain(domain.id)}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </ActionMenuItem>
                  </ActionMenuContent>
                </DropdownMenu>
              </>
            )}
          />
        );
      })}

      {isAddingDomain ? (
        <div className="px-3 py-2 border-t border-gray-200">
          <Input type="text" placeholder="Domain name..." value={newDomainName} onChange={(e) => onChangeNewDomainName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConfirmAddDomain(); if (e.key === 'Escape') onCancelAddDomain(); }} autoFocus className="mb-2 h-8 text-sm" />
          <div className="flex gap-2">
            <Button onClick={onConfirmAddDomain} size="sm" className="flex-1 h-7">Add</Button>
            <Button onClick={onCancelAddDomain} variant="outline" size="sm" className="flex-1 h-7">Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={onStartAddDomain} className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-200">
          <Plus className="size-3.5" /> Add Domain
        </button>
      )}
      {domains.length === 0 && !isAddingDomain && (
        <div className="px-3 py-6 text-center text-xs text-gray-400">Domains help organize tables<br />into logical groups</div>
      )}
    </div>
  );
}
