import { TableKind, TABLE_KIND_TOGGLES } from './constants';

interface TypeToggleGroupProps {
  visibleKinds: Record<TableKind, boolean>;
  onToggle: (kind: TableKind) => void;
}

export function TypeToggleGroup({ visibleKinds, onToggle }: TypeToggleGroupProps) {
  return (
    <>
      {TABLE_KIND_TOGGLES.map((item) => (
        <button
          key={item.kind}
          type="button"
          onClick={() => onToggle(item.kind)}
          className={`h-7 px-2.5 rounded-full text-xs transition-colors ${
            visibleKinds[item.kind] ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </>
  );
}
