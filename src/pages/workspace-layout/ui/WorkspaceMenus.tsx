import type { RefObject } from 'react';
import { Check, Layers3 } from 'lucide-react';
import type { TabCatalogDisplayItem } from '../model/catalog-icons';
import type { SearchFilterMenuState, TabType } from '../model/types';

export function AddTabMenu({
  groups,
  menuRef,
  position,
  onAdd,
}: {
  groups: Record<string, TabCatalogDisplayItem[]>;
  menuRef: RefObject<HTMLDivElement | null>;
  position: { left: number; top: number };
  onAdd: (type: TabType) => void;
}) {
  return (
    <div
      ref={menuRef}
      className="fixed z-[1000] w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.16)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="workspace-popup-scroll max-h-[420px] overflow-y-auto p-1.5">
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="py-0.5">
            <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {groupName}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
                  onClick={() => onAdd(item.type)}
                >
                  <span className="flex size-4 items-center justify-center text-slate-500">
                    {item.icon}
                  </span>
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchFilterMenu({
  groups,
  menuRef,
  position,
}: {
  groups: Record<string, TabCatalogDisplayItem[]>;
  menuRef: RefObject<HTMLDivElement | null>;
  position: SearchFilterMenuState;
}) {
  const allItems = Object.values(groups).flat();

  return (
    <div
      ref={menuRef}
      className="fixed z-[1001] w-[250px] overflow-hidden rounded-2xl bg-[#1f1f1f] py-2 text-white shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="border-b border-white/10 px-2 pb-2">
        {['Find', 'Replace'].map((item, index) => (
          <button
            key={item}
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-white hover:bg-white/10"
          >
            <span className="flex size-4 items-center justify-center">
              {index === 0 ? <Check className="size-3.5" /> : null}
            </span>
            {item}
          </button>
        ))}
      </div>
      <div className="workspace-dark-popup-scroll max-h-[250px] overflow-y-auto border-b border-white/10 px-2 py-2">
        <button
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-white hover:bg-white/10"
        >
          <Check className="size-3.5" />
          <Layers3 className="size-4 text-white/75" />
          All
        </button>
        {allItems.map((item) => (
          <button
            key={`filter-${item.type}`}
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-white hover:bg-white/10"
          >
            <span className="size-3.5" />
            <span className="flex size-4 items-center justify-center text-white/75">{item.icon}</span>
            {item.title}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2">
        {['Match case', 'Whole words'].map((item) => (
          <button
            key={item}
            type="button"
            className="flex h-8 w-full items-center rounded-md px-8 text-left text-xs font-semibold text-white hover:bg-white/10"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
