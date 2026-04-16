import { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import type { Table, Relation } from '../model/types';
import { validateSchema, type ValidationIssue, type ValidationSeverity } from '../lib/validation';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Table[];
  relations: Relation[];
  onSelectTable?: (tableId: string) => void;
}

const SEVERITY_CONFIG: Record<ValidationSeverity, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  error: { icon: <AlertCircle className="size-4" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Error' },
  warning: { icon: <AlertTriangle className="size-4" />, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Warning' },
  info: { icon: <Info className="size-4" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Info' },
};

export function ValidationModal({ isOpen, onClose, tables, relations, onSelectTable }: ValidationModalProps) {
  const issues = useMemo(() => validateSchema(tables, relations), [tables, relations]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ValidationSeverity | 'all'>('all');

  const filtered = filter === 'all' ? issues : issues.filter(i => i.severity === filter);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  // Group by category
  const grouped = new Map<string, ValidationIssue[]>();
  for (const issue of filtered) {
    const list = grouped.get(issue.category) || [];
    list.push(issue);
    grouped.set(issue.category, list);
  }

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <AlertTriangle className="size-5 text-yellow-400" />
            Schema Validation
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex items-center gap-3 mt-2">
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="size-5" />
              <span className="text-sm" style={{ fontWeight: 500 }}>No issues found! Your schema looks good.</span>
            </div>
          ) : (
            <>
              <button
                className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${filter === 'all' ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                onClick={() => setFilter('all')}
              >
                All ({issues.length})
              </button>
              {errorCount > 0 && (
                <button
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${filter === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'border-gray-700 text-gray-400 hover:text-red-400'}`}
                  onClick={() => setFilter('error')}
                >
                  <AlertCircle className="size-3" /> {errorCount} errors
                </button>
              )}
              {warningCount > 0 && (
                <button
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${filter === 'warning' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' : 'border-gray-700 text-gray-400 hover:text-yellow-400'}`}
                  onClick={() => setFilter('warning')}
                >
                  <AlertTriangle className="size-3" /> {warningCount} warnings
                </button>
              )}
              {infoCount > 0 && (
                <button
                  className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition-colors ${filter === 'info' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'border-gray-700 text-gray-400 hover:text-blue-400'}`}
                  onClick={() => setFilter('info')}
                >
                  <Info className="size-3" /> {infoCount} info
                </button>
              )}
            </>
          )}
        </div>

        {/* Issues list */}
        <div className="flex-1 min-h-0 overflow-auto mt-4 space-y-2 pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-700">
          {Array.from(grouped.entries()).map(([category, catIssues]) => {
            const isExpanded = expandedCategories.has(category) || grouped.size <= 3;
            const worstSeverity = catIssues.some(i => i.severity === 'error') ? 'error' : catIssues.some(i => i.severity === 'warning') ? 'warning' : 'info';
            const cfg = SEVERITY_CONFIG[worstSeverity];

            return (
              <div key={category} className="border border-gray-700 rounded-lg overflow-hidden">
                <button
                  className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-gray-800 transition-colors text-left"
                  onClick={() => toggleCategory(category)}
                >
                  {isExpanded ? <ChevronDown className="size-3.5 text-gray-500" /> : <ChevronRight className="size-3.5 text-gray-500" />}
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className="text-sm text-gray-200" style={{ fontWeight: 500 }}>{category}</span>
                  <span className="text-xs text-gray-500 ml-auto">{catIssues.length} issue{catIssues.length > 1 ? 's' : ''}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-700/50">
                    {catIssues.map(issue => {
                      const icfg = SEVERITY_CONFIG[issue.severity];
                      return (
                        <div key={issue.id} className={`px-4 py-3 border-b border-gray-800 last:border-b-0 ${icfg.bg} border-l-2`}>
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 ${icfg.color}`}>{icfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-xs text-gray-500 mt-1">{issue.suggestion}</p>
                              )}
                            </div>
                            {issue.tableId && onSelectTable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700 shrink-0"
                                onClick={() => { onSelectTable(issue.tableId!); onClose(); }}
                              >
                                <ExternalLink className="size-3 mr-1" /> Go to
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
