import { useState, useMemo } from 'react';
import { GitCompare, Plus, Minus, Pencil, Copy, Check, Download, ArrowRight, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { toast } from 'sonner';
import type { Table, Relation } from '../model/types';
import { diffSchemas, generateMigration, type SchemaDiff, type TableDiff, type FieldDiff } from '../lib/schema-diff';
import { downloadFile } from '@/shared/lib/download';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Table[];
  relations: Relation[];
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  added: <Plus className="size-3.5" />,
  removed: <Minus className="size-3.5" />,
  modified: <Pencil className="size-3.5" />,
};
const ACTION_COLORS: Record<string, string> = {
  added: 'text-green-400',
  removed: 'text-red-400',
  modified: 'text-yellow-400',
};
const ACTION_BG: Record<string, string> = {
  added: 'bg-green-500/10 border-l-green-500',
  removed: 'bg-red-500/10 border-l-red-500',
  modified: 'bg-yellow-500/10 border-l-yellow-500',
};

type Tab = 'diff' | 'migration';

export function DiffModal({ isOpen, onClose, tables, relations }: DiffModalProps) {
  const [baselineJson, setBaselineJson] = useState<string>('');
  const [baselineLoaded, setBaselineLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('diff');
  const [copied, setCopied] = useState(false);

  const baseline = useMemo(() => {
    if (!baselineJson) return null;
    try {
      const data = JSON.parse(baselineJson);
      return {
        tables: (data.tables || data.schema?.tables || []) as Table[],
        relations: (data.relations || data.schema?.relations || []) as Relation[],
      };
    } catch {
      return null;
    }
  }, [baselineJson]);

  const diff: SchemaDiff | null = useMemo(() => {
    if (!baseline) return null;
    return diffSchemas(baseline.tables, baseline.relations, tables, relations);
  }, [baseline, tables, relations]);

  const migration = useMemo(() => {
    if (!diff) return '';
    return generateMigration(diff);
  }, [diff]);

  const handleLoadBaseline = () => {
    if (!baselineJson.trim()) {
      toast.error('Please paste a JSON schema to compare against.');
      return;
    }
    if (!baseline) {
      toast.error('Invalid JSON schema format.');
      return;
    }
    setBaselineLoaded(true);
  };

  const handleSnapshotCurrent = () => {
    const snapshot = JSON.stringify({ tables, relations }, null, 2);
    setBaselineJson(snapshot);
    toast.success('Current schema captured as baseline.');
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMigration = () => {
    downloadFile(migration, `migration_${Date.now()}.sql`, 'text/plain');
    toast.success('Migration file downloaded.');
  };

  const handleReset = () => {
    setBaselineLoaded(false);
    setBaselineJson('');
    setTab('diff');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <GitCompare className="size-5 text-blue-400" />
            Schema Diff & Migration Generator
          </DialogTitle>
        </DialogHeader>

        {!baselineLoaded ? (
          /* Step 1: Load baseline */
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-400">
              Compare your current schema against a baseline to see what changed and generate migration SQL.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800"
                onClick={handleSnapshotCurrent}
              >
                <ArrowRight className="size-3.5 mr-1" /> Snapshot current as baseline
              </Button>
              <label className="cursor-pointer">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800 pointer-events-none"
                  tabIndex={-1}
                >
                  <Upload className="size-3.5 mr-1" /> Load JSON file
                </Button>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setBaselineJson(reader.result as string);
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
            <textarea
              value={baselineJson}
              onChange={e => setBaselineJson(e.target.value)}
              placeholder='Paste a JSON schema here (e.g. exported from "Export > JSON")...'
              className="w-full h-48 bg-gray-950 border border-gray-700 rounded-lg p-3 font-mono text-xs text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleLoadBaseline}
                disabled={!baselineJson.trim()}
              >
                Compare schemas
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: Show diff & migration */
          <>
            <div className="flex items-center gap-2 mt-2">
              <button
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${tab === 'diff' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                onClick={() => setTab('diff')}
              >
                Diff View
              </button>
              <button
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${tab === 'migration' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                onClick={() => setTab('migration')}
              >
                Migration SQL
              </button>
              <div className="flex-1" />
              <span className="text-xs text-gray-500">{diff?.summary}</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400 hover:text-white" onClick={handleReset}>
                New comparison
              </Button>
            </div>

            {tab === 'diff' && diff && (
              <div className="flex-1 min-h-0 overflow-auto mt-3 space-y-2 pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-700">
                {!diff.hasChanges ? (
                  <div className="text-center py-12 text-gray-500">
                    <GitCompare className="size-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No differences found between schemas.</p>
                  </div>
                ) : (
                  <>
                    {diff.tableDiffs.map((td, i) => (
                      <TableDiffCard key={i} diff={td} />
                    ))}
                    {diff.relationDiffs.length > 0 && (
                      <div className="border border-gray-700 rounded-lg p-4">
                        <h4 className="text-sm text-gray-300 mb-2" style={{ fontWeight: 500 }}>Relations</h4>
                        {diff.relationDiffs.map((rd, i) => (
                          <div key={i} className={`px-3 py-2 text-xs border-l-2 rounded-r mb-1 ${ACTION_BG[rd.action]}`}>
                            <span className={ACTION_COLORS[rd.action]}>{ACTION_ICONS[rd.action]}</span>
                            <span className="text-gray-300 ml-2">{rd.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'migration' && (
              <div className="flex-1 min-h-0 mt-3 relative">
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(migration)} className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800">
                    {copied ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button size="sm" onClick={handleDownloadMigration} className="bg-blue-600 hover:bg-blue-700">
                    <Download className="size-3.5 mr-1" /> Download .sql
                  </Button>
                </div>
                <pre className="size-full max-h-[55vh] overflow-auto bg-gray-950 border border-gray-700 rounded-lg p-4 font-mono text-xs text-gray-300 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-700">
                  {migration || '-- No migration needed (schemas are identical)'}
                </pre>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TableDiffCard({ diff }: { diff: TableDiff }) {
  const color = ACTION_COLORS[diff.action];
  const bg = ACTION_BG[diff.action];

  return (
    <div className={`border border-gray-700 rounded-lg overflow-hidden`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 border-l-2 ${bg}`}>
        <span className={color}>{ACTION_ICONS[diff.action]}</span>
        <span className="text-sm text-gray-200" style={{ fontWeight: 500 }}>
          {diff.action === 'added' ? 'New table: ' : diff.action === 'removed' ? 'Dropped table: ' : 'Modified table: '}
          <span className="font-mono text-white">{diff.tableName}</span>
        </span>
      </div>
      {diff.fieldDiffs && diff.fieldDiffs.length > 0 && (
        <div className="border-t border-gray-700/50 px-4 py-2 space-y-1">
          {diff.fieldDiffs.map((fd, i) => (
            <FieldDiffRow key={i} diff={fd} />
          ))}
        </div>
      )}
      {diff.action === 'added' && diff.newTable && (
        <div className="border-t border-gray-700/50 px-4 py-2 space-y-1">
          {diff.newTable.fields.map(f => (
            <div key={f.id} className="text-xs text-green-400/80 flex items-center gap-1.5">
              <Plus className="size-3" />
              <span className="font-mono">{f.name}</span>
              <span className="text-gray-500">{f.type}</span>
              {f.isPrimaryKey && <span className="text-yellow-500 text-[10px]">PK</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldDiffRow({ diff }: { diff: FieldDiff }) {
  const color = ACTION_COLORS[diff.action];
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <span className={`mt-0.5 ${color}`}>{ACTION_ICONS[diff.action]}</span>
      <span className="font-mono text-gray-200">{diff.fieldName}</span>
      {diff.changes && (
        <span className="text-gray-500 ml-1">({diff.changes.join(', ')})</span>
      )}
    </div>
  );
}
