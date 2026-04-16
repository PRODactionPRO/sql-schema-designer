import { useState } from 'react';
import { Database, Image, FileJson, Shield, Copy, Download, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportJSON: () => void;
  onExportPostgreSQL: () => void;
  onExportSupabaseRLS: () => void;
  onExportMermaid: () => void;
  getPreview?: (formatId: string) => string;
}

export function ExportModal({
  isOpen, onClose, onExportJSON, onExportPostgreSQL, onExportSupabaseRLS, onExportMermaid, getPreview,
}: ExportModalProps) {
  const [previewFormat, setPreviewFormat] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [copied, setCopied] = useState(false);

  const handleExport = (type: string) => {
    if (type === 'json') onExportJSON();
    else if (type === 'postgresql') onExportPostgreSQL();
    else if (type === 'supabase-rls') onExportSupabaseRLS();
    else if (type === 'mermaid') onExportMermaid();
    onClose();
  };

  const handlePreview = (formatId: string) => {
    if (getPreview) {
      setPreviewContent(getPreview(formatId));
      setPreviewFormat(formatId);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(previewContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => { setPreviewFormat(null); setPreviewContent(''); onClose(); };

  if (previewFormat) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-white">
              <button onClick={() => { setPreviewFormat(null); setPreviewContent(''); }} className="text-gray-400 hover:text-white transition-colors">&larr;</button>
              Preview: {previewFormat === 'json' ? 'JSON' : previewFormat === 'postgresql' ? 'PostgreSQL DDL' : previewFormat === 'mermaid' ? 'Mermaid ER' : 'Supabase RLS'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4 relative">
            <div className="absolute top-2 right-2 z-10 flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800">
                {copied ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button size="sm" onClick={() => handleExport(previewFormat)} className="bg-blue-600 hover:bg-blue-700">
                <Download className="size-3.5 mr-1" /> Download
              </Button>
            </div>
            <pre className="size-full max-h-[60vh] overflow-auto bg-gray-950 border border-gray-700 rounded-lg p-4 font-mono text-xs text-gray-300 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-700">
              {previewContent}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">Export diagram</DialogTitle>
          <p className="text-gray-400 mt-2">Forward engineer your diagram as code, image, or framework-specific files.</p>
        </DialogHeader>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">General</h3>
          <div className="grid grid-cols-4 gap-4">
            <ExportCard icon={<Database className="size-6" />} title="PostgreSQL" description="Export DDL schema" onExport={() => handleExport('postgresql')} onPreview={getPreview ? () => handlePreview('postgresql') : undefined} />
            <ExportCard icon={<Shield className="size-6" />} title="Supabase RLS" description="Export RLS policies" onExport={() => handleExport('supabase-rls')} onPreview={getPreview ? () => handlePreview('supabase-rls') : undefined} />
            <ExportCard icon={<FileJson className="size-6" />} title="JSON" description="Export JSON schema" onExport={() => handleExport('json')} onPreview={getPreview ? () => handlePreview('json') : undefined} />
            <ExportCard icon={<Database className="size-6" />} title="Mermaid ER" description="Export erDiagram" onExport={() => handleExport('mermaid')} onPreview={getPreview ? () => handlePreview('mermaid') : undefined} />
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Coming soon</h3>
          <div className="grid grid-cols-3 gap-4 opacity-40">
            <DisabledCard icon={<Image className="size-6" />} title="Image" description="Export as image" />
            <DisabledCard icon={<Database className="size-6" />} title="Laravel" description="Generate migrations" />
            <DisabledCard icon={<Database className="size-6" />} title="Prisma" description="Generate schema" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportCard({ icon, title, description, onExport, onPreview }: { icon: React.ReactNode; title: string; description: string; onExport: () => void; onPreview?: () => void; }) {
  return (
    <div className="p-4 border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-gray-800 transition-colors text-center group cursor-pointer">
      <div className="size-12 mx-auto mb-3 flex items-center justify-center bg-gray-800 rounded-lg group-hover:bg-blue-900/50 text-gray-400 group-hover:text-blue-400">
        {icon}
      </div>
      <h4 className="font-semibold text-white mb-1">{title}</h4>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      <div className="flex flex-col gap-2">
        <Button size="sm" className="text-xs h-7 w-full bg-blue-600 hover:bg-blue-700" onClick={onExport}>
          <Download className="size-3 mr-1" /> Export
        </Button>
        {onPreview && (
          <Button variant="outline" size="sm" className="text-xs h-7 w-full border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700" onClick={onPreview}>Preview</Button>
        )}
      </div>
    </div>
  );
}

function DisabledCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string; }) {
  return (
    <div className="p-4 border border-gray-700 rounded-lg text-center cursor-not-allowed">
      <div className="size-12 mx-auto mb-3 flex items-center justify-center bg-gray-800 rounded-lg text-gray-600">{icon}</div>
      <h4 className="font-semibold text-gray-400 mb-1">{title}</h4>
      <p className="text-xs text-gray-600">{description}</p>
    </div>
  );
}