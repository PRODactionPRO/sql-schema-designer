import { asPropertyValue } from '../model/workspace-project-utils';
import { PropertyField, PropertyTextArea } from './WorkspacePropertyControls';

export function ObjectSummaryPane({
  title,
  subtitle,
  rows,
  editableName,
  editableDescription,
  onNameChange,
  onDescriptionChange,
}: {
  title: string;
  subtitle: string;
  rows: Array<[string, unknown]>;
  editableName?: string;
  editableDescription?: string;
  onNameChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
}) {
  return (
    <div className="h-full overflow-auto bg-white p-4">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-[11px] font-medium text-slate-400">{subtitle}</div>
      <div className="mt-4 space-y-3">
        {editableName !== undefined && onNameChange ? <PropertyField label="Name" value={editableName} onChange={onNameChange} /> : null}
        {editableDescription !== undefined && onDescriptionChange ? <PropertyTextArea label="Description" value={editableDescription} onChange={onDescriptionChange} /> : null}
      </div>
      <div className="mt-4 grid gap-3 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
            <span className="text-slate-400">{label}</span>
            <span className="min-w-0 text-right font-medium text-slate-700">{asPropertyValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
