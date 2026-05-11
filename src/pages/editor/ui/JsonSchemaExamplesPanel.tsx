import type { JsonSchemaDocument, JsonSchemaExample } from '../model/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Plus, Trash2 } from 'lucide-react';

interface JsonSchemaExamplesPanelProps {
  doc: JsonSchemaDocument;
  readOnly?: boolean;
  darkMode?: boolean;
  onUpdateDocument: (updates: Partial<Omit<JsonSchemaDocument, 'id'>>) => void;
}

export function JsonSchemaExamplesPanel({
  doc,
  readOnly = false,
  darkMode = false,
  onUpdateDocument,
}: JsonSchemaExamplesPanelProps) {
  const examples = doc.examples ?? [];
  const inputCls = darkMode
    ? 'bg-white text-gray-900 border-gray-200'
    : 'bg-white text-gray-900 border-gray-200';
  const panelText = darkMode ? 'text-[#cdd6f4]' : 'text-gray-900';
  const mutedText = darkMode ? 'text-[#a6adc8]' : 'text-gray-500';

  const updateExample = (id: string, updates: Partial<JsonSchemaExample>) => {
    onUpdateDocument({
      examples: examples.map((example) => (example.id === id ? { ...example, ...updates } : example)),
    });
  };

  const addExample = () => {
    onUpdateDocument({
      examples: [
        ...examples,
        {
          id: `json_example_${Date.now().toString(36)}`,
          name: `Example ${examples.length + 1}`,
          value: '{\n  \n}',
        },
      ],
    });
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 ${panelText}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Examples</h3>
          <p className={`text-xs ${mutedText}`}>Sample JSON payloads for this schema.</p>
        </div>
        <Button size="sm" variant="outline" onClick={addExample} disabled={readOnly} className="h-8 gap-1">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      <div className="space-y-4">
        {examples.map((example) => (
          <div key={example.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <Input
                value={example.name}
                onChange={(event) => updateExample(example.id, { name: event.target.value })}
                disabled={readOnly}
                className={`h-8 text-sm font-medium ${inputCls}`}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdateDocument({ examples: examples.filter((item) => item.id !== example.id) })}
                disabled={readOnly}
                className="h-8 px-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <Input
              value={example.description || ''}
              onChange={(event) => updateExample(example.id, { description: event.target.value || undefined })}
              disabled={readOnly}
              placeholder="Example purpose"
              className={`mb-2 h-8 text-sm ${inputCls}`}
            />
            <textarea
              value={example.value}
              onChange={(event) => updateExample(example.id, { value: event.target.value })}
              disabled={readOnly}
              spellCheck={false}
              className={`min-h-48 w-full rounded-md border px-3 py-2 font-mono text-xs leading-5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputCls}`}
            />
          </div>
        ))}

        {examples.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No examples yet.
          </div>
        )}
      </div>
    </div>
  );
}
