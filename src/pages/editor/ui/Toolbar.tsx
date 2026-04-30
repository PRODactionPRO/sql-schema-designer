import { useState } from 'react';
import { FileDown, FileUp, Save, Settings, Database, ArrowLeft, Pencil, Check, X, History } from 'lucide-react';
import { Button } from '@/shared/ui/button';

interface ToolbarProps {
  onExport: () => void;
  onImport: () => void;
  onSave: () => void;
  onSettings: () => void;
  onVersions: () => void;
  onBack?: () => void;
  projectName?: string;
  onRename?: (name: string) => void;
  darkMode?: boolean;
}

export function Toolbar({ onExport, onImport, onSave, onSettings, onVersions, onBack, projectName, onRename, darkMode }: ToolbarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const startEditing = () => {
    setEditValue(projectName || '');
    setIsEditing(true);
  };

  const confirmEdit = () => {
    if (editValue.trim() && onRename) {
      onRename(editValue.trim());
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  return (
    <div className={`h-14 border-b px-4 flex items-center justify-between transition-colors ${
      darkMode ? 'bg-[#181825] border-[#313244]' : 'bg-white border-gray-200'
    }`}>
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              className={`flex items-center gap-2 transition-colors -ml-1 px-2 py-1 rounded-lg ${
                darkMode ? 'text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="size-4" />
              <Database className={`size-5 ${darkMode ? 'text-[#89b4fa]' : 'text-indigo-600'}`} />
            </button>
          ) : (
            <Database className={`size-5 ${darkMode ? 'text-[#89b4fa]' : 'text-indigo-600'}`} />
          )}
          <span className={`font-semibold text-lg ${darkMode ? 'text-[#cdd6f4]' : ''}`}>drawSQL</span>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
        <Button variant="ghost" size="sm" onClick={onSettings} className={darkMode ? 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]' : ''}>
          <Settings className="size-4 mr-1" />
          Settings
        </Button>
        <Button variant="ghost" size="sm" onClick={onVersions} className={darkMode ? 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]' : ''}>
          <History className="size-4 mr-1" />
          История версий
        </Button>
      </div>
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-2">
        {projectName !== undefined ? (
          isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
                className={`text-sm border rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 min-w-[200px] ${
                  darkMode
                    ? 'bg-[#313244] border-[#89b4fa] text-[#cdd6f4] focus:ring-[#89b4fa]'
                    : 'border-indigo-300 focus:ring-indigo-500'
                }`}
                style={{ fontWeight: 500 }}
              />
              <button onClick={confirmEdit} className={`p-1 rounded ${darkMode ? 'hover:bg-[#313244] text-[#a6e3a1]' : 'hover:bg-green-50 text-green-600'}`}>
                <Check className="size-4" />
              </button>
              <button onClick={cancelEdit} className={`p-1 rounded ${darkMode ? 'hover:bg-[#313244] text-[#6c7086]' : 'hover:bg-gray-100 text-gray-400'}`}>
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className={`text-sm ${darkMode ? 'text-[#cdd6f4]' : 'text-gray-900'}`} style={{ fontWeight: 500 }}>{projectName}</span>
              {onRename && (
                <button
                  onClick={startEditing}
                  className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    darkMode ? 'hover:bg-[#313244] text-[#6c7086] hover:text-[#a6adc8]' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Pencil className="size-3" />
                </button>
              )}
              <span className={`text-[10px] rounded px-1.5 py-0.5 ${darkMode ? 'text-[#585b70] bg-[#313244]' : 'text-gray-400 bg-gray-100'}`}>auto-saved</span>
            </div>
          )
        ) : (
          <span className={`text-sm ${darkMode ? 'text-[#6c7086]' : 'text-gray-600'}`}>Standalone Mode</span>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <Button onClick={onImport} variant="outline" size="sm" className={darkMode ? 'border-[#45475a] text-[#a6adc8] hover:bg-[#313244] hover:text-[#cdd6f4]' : ''}>
          <FileUp className="size-4 mr-1" />
          Import
        </Button>
        <Button onClick={onSave} variant="outline" size="sm" className={darkMode ? 'border-[#45475a] text-[#a6adc8] hover:bg-[#313244] hover:text-[#cdd6f4]' : ''}>
          <Save className="size-4 mr-1" />
          Save
        </Button>
        <Button onClick={onExport} variant="default" size="sm" className={darkMode ? 'bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#b4befe]' : ''}>
          <FileDown className="size-4 mr-1" />
          Export
        </Button>
      </div>
    </div>
  );
}
