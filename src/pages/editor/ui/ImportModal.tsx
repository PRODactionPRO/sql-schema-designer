import { useState, useRef } from 'react';
import { Upload, FileJson, Database, Shield, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { getImportSerializers } from '../lib/serializers';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (formatId: string, content: string) => void;
}

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  json: <FileJson className="size-6" />,
  postgresql: <Database className="size-6" />,
  'supabase-rls': <Shield className="size-6" />,
  mermaid: <Database className="size-6" />,
};

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importSerializers = getImportSerializers();

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setContent(text);
      setError(null);
      if (file.name.endsWith('.json')) setSelectedFormat('json');
      else if (file.name.endsWith('.md') || file.name.endsWith('.mmd') || file.name.endsWith('.mermaid')) setSelectedFormat('mermaid');
      else if (file.name.endsWith('.sql')) {
        if (text.includes('enable row level security') || text.includes('create policy')) setSelectedFormat('supabase-rls');
        else setSelectedFormat('postgresql');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleImport = () => {
    if (!selectedFormat || !content.trim()) { setError('Please select a format and provide content'); return; }
    try { onImport(selectedFormat, content); setContent(''); setSelectedFormat(null); setError(null); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to import schema'); }
  };

  const handleClose = () => { setContent(''); setSelectedFormat(null); setError(null); onClose(); };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Import schema</DialogTitle>
          <p className="text-gray-400 mt-2">Import a database schema from code, SQL, or JSON format.</p>
        </DialogHeader>

        {/* Format selection */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Select format</h3>
          <div className="grid grid-cols-4 gap-3">
            {importSerializers.map((serializer) => (
              <button
                key={serializer.id}
                onClick={() => { setSelectedFormat(serializer.id); setError(null); }}
                className={`p-3 border rounded-lg transition-colors text-center group ${
                  selectedFormat === serializer.id
                    ? 'border-blue-500 bg-blue-900/30 ring-2 ring-blue-500/30'
                    : 'border-gray-700 hover:border-blue-500 hover:bg-gray-800'
                }`}
              >
                <div className={`size-10 mx-auto mb-2 flex items-center justify-center rounded-lg ${
                  selectedFormat === serializer.id ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-400 group-hover:text-blue-400'
                }`}>
                  {FORMAT_ICONS[serializer.id] || <Database className="size-6" />}
                </div>
                <h4 className="font-semibold text-sm text-white mb-0.5">{serializer.name}</h4>
                <p className="text-xs text-gray-500">{serializer.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="mt-4 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-400">Content</h3>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".json,.sql,.txt,.md,.mmd,.mermaid" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800">
                <Upload className="size-3.5 mr-1.5" /> Upload file
              </Button>
            </div>
          </div>
          <div
            className={`flex-1 min-h-[200px] relative rounded-lg border-2 transition-colors ${isDragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-700'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {!content && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 pointer-events-none">
                <Upload className="size-8 mb-2" />
                <p className="text-sm">Drag & drop a file here or paste content below</p>
              </div>
            )}
            <textarea
              className="absolute inset-0 w-full h-full p-3 font-mono text-sm bg-transparent text-gray-300 resize-none outline-none rounded-lg placeholder-gray-600"
              placeholder="Paste your SQL, JSON, or other schema content here..."
              value={content}
              onChange={(e) => { setContent(e.target.value); setError(null); }}
            />
          </div>
          {error && (
            <div className="mt-2 flex items-center gap-2 text-red-400 text-sm bg-red-900/30 border border-red-800 px-3 py-2 rounded-lg">
              <AlertCircle className="size-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800">Cancel</Button>
          <Button onClick={handleImport} disabled={!selectedFormat || !content.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500">
            <Upload className="size-4 mr-1.5" /> Import Schema
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}