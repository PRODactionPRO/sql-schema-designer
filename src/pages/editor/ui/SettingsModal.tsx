import { useState, useEffect, useRef } from 'react';
import type { ProjectSettings, LineType, FieldType } from '../model/types';
import { ALL_FIELD_TYPES } from '../model/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import {
  Spline, CornerDownRight, Minus, Check,
  Hash, Type, ToggleLeft, Calendar, Clock, Braces, Binary, Globe,
  MapPin, Circle, FileCode, List, Tag, Fingerprint, DollarSign,
  Network, Hexagon, Ruler, Box, Database, Camera, ImageIcon,
  Zap,
} from 'lucide-react';

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  uuid: <Fingerprint className="size-4" />,
  bigint: <Hash className="size-4" />,
  integer: <Hash className="size-4" />,
  smallint: <Hash className="size-4" />,
  serial: <Hash className="size-4" />,
  bigserial: <Hash className="size-4" />,
  varchar: <Type className="size-4" />,
  text: <Type className="size-4" />,
  citext: <Type className="size-4" />,
  boolean: <ToggleLeft className="size-4" />,
  timestamp: <Calendar className="size-4" />,
  timestamptz: <Calendar className="size-4" />,
  date: <Calendar className="size-4" />,
  time: <Clock className="size-4" />,
  interval: <Clock className="size-4" />,
  json: <Braces className="size-4" />,
  jsonb: <Braces className="size-4" />,
  decimal: <DollarSign className="size-4" />,
  numeric: <Hash className="size-4" />,
  real: <Hash className="size-4" />,
  'double precision': <Hash className="size-4" />,
  money: <DollarSign className="size-4" />,
  bytea: <Binary className="size-4" />,
  inet: <Globe className="size-4" />,
  cidr: <Network className="size-4" />,
  macaddr: <Hexagon className="size-4" />,
  point: <MapPin className="size-4" />,
  line: <Ruler className="size-4" />,
  polygon: <Box className="size-4" />,
  circle: <Circle className="size-4" />,
  xml: <FileCode className="size-4" />,
  array: <List className="size-4" />,
  enum: <Tag className="size-4" />,
  vector: <Zap className="size-4" />,
};

const TYPE_CATEGORIES: { label: string; types: FieldType[] }[] = [
  { label: 'Identifiers', types: ['uuid', 'serial', 'bigserial'] },
  { label: 'Numeric', types: ['integer', 'bigint', 'smallint', 'decimal', 'numeric', 'real', 'double precision', 'money'] },
  { label: 'Text', types: ['varchar', 'text', 'citext'] },
  { label: 'Boolean', types: ['boolean'] },
  { label: 'Date & Time', types: ['timestamp', 'timestamptz', 'date', 'time', 'interval'] },
  { label: 'JSON', types: ['json', 'jsonb'] },
  { label: 'Binary & Network', types: ['bytea', 'inet', 'cidr', 'macaddr'] },
  { label: 'Geometry', types: ['point', 'line', 'polygon', 'circle'] },
  { label: 'Other', types: ['xml', 'array', 'vector', 'enum'] },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  onUpdateSettings: (settings: ProjectSettings) => void;
  // Project info props (optional — only available in project mode)
  projectName?: string;
  projectDescription?: string;
  projectSnapshot?: string;
  onRenameProject?: (name: string) => void;
  onUpdateProjectDescription?: (desc: string) => void;
  onCaptureSnapshot?: () => void;
}

type TabType = 'project' | 'lines' | 'types';

const LINE_TYPES: { id: LineType; label: string; description: string; icon: React.ReactNode; preview: React.ReactNode }[] = [
  {
    id: 'curved',
    label: 'Curved (Bezier)',
    description: 'Smooth curved lines between nodes',
    icon: <Spline className="size-5" />,
    preview: (
      <svg width="120" height="50" viewBox="0 0 120 50">
        <path d="M 10 25 C 40 25, 80 10, 110 25" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="25" r="3" fill="currentColor" />
        <circle cx="110" cy="25" r="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'orthogonal',
    label: 'Orthogonal',
    description: 'Lines with right-angle bends only',
    icon: <CornerDownRight className="size-5" />,
    preview: (
      <svg width="120" height="50" viewBox="0 0 120 50">
        <path d="M 10 15 H 60 V 35 H 110" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="15" r="3" fill="currentColor" />
        <circle cx="110" cy="35" r="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'straight',
    label: 'Straight',
    description: 'Direct point-to-point lines',
    icon: <Minus className="size-5" />,
    preview: (
      <svg width="120" height="50" viewBox="0 0 120 50">
        <line x1="10" y1="15" x2="110" y2="35" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="15" r="3" fill="currentColor" />
        <circle cx="110" cy="35" r="3" fill="currentColor" />
      </svg>
    ),
  },
];

export function SettingsModal({
  isOpen, onClose, settings, onUpdateSettings,
  projectName, projectDescription, projectSnapshot,
  onRenameProject, onUpdateProjectDescription, onCaptureSnapshot,
}: SettingsModalProps) {
  const hasProjectTab = onRenameProject !== undefined;
  const [activeTab, setActiveTab] = useState<TabType>(hasProjectTab ? 'project' : 'lines');
  const [localSettings, setLocalSettings] = useState<ProjectSettings>(settings);
  const [localName, setLocalName] = useState(projectName || '');
  const [localDesc, setLocalDesc] = useState(projectDescription || '');
  const prevOpenRef = useRef(false);

  // Sync only when modal first opens (closed → open transition)
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setLocalSettings(settings);
      setLocalName(projectName || '');
      setLocalDesc(projectDescription || '');
      if (hasProjectTab) setActiveTab('project');
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, settings, projectName, projectDescription, hasProjectTab]);

  const handleLineTypeChange = (lineType: LineType) => {
    const updated = { ...localSettings, lineType };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const toggleFieldType = (type: FieldType) => {
    const enabled = new Set(localSettings.enabledFieldTypes);
    if (enabled.has(type)) {
      if (enabled.size <= 1) return;
      enabled.delete(type);
    } else {
      enabled.add(type);
    }
    const updated = { ...localSettings, enabledFieldTypes: ALL_FIELD_TYPES.filter(t => enabled.has(t)) };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const enableAll = () => {
    const updated = { ...localSettings, enabledFieldTypes: [...ALL_FIELD_TYPES] };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const enableOnlyCommon = () => {
    const common: FieldType[] = ['uuid', 'integer', 'bigint', 'serial', 'varchar', 'text', 'boolean', 'timestamp', 'timestamptz', 'date', 'json', 'jsonb', 'decimal'];
    const updated = { ...localSettings, enabledFieldTypes: common };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const handleNameBlur = () => {
    if (localName.trim() && localName !== projectName && onRenameProject) {
      onRenameProject(localName.trim());
    }
  };

  const handleDescBlur = () => {
    if (localDesc !== projectDescription && onUpdateProjectDescription) {
      onUpdateProjectDescription(localDesc);
    }
  };

  const handleAutoSaveIntervalBlur = (value: number) => {
    const normalized = Number.isFinite(value) ? Math.max(15, Math.min(value, 3600)) : 60;
    const updated = { ...localSettings, autoSaveIntervalSec: normalized };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-gray-900 border-gray-700 text-white flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Project Settings</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-gray-700 mt-2 flex-shrink-0">
          {hasProjectTab && (
            <button
              onClick={() => setActiveTab('project')}
              className={`px-4 py-2 text-sm transition-colors border-b-2 ${activeTab === 'project' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Project
            </button>
          )}
          <button
            onClick={() => setActiveTab('lines')}
            className={`px-4 py-2 text-sm transition-colors border-b-2 ${activeTab === 'lines' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            Connection Lines
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`px-4 py-2 text-sm transition-colors border-b-2 ${activeTab === 'types' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            Field Types
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto min-h-0 pr-1" style={{ scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
          {activeTab === 'project' && hasProjectTab && (
            <div className="space-y-6">
              {/* Snapshot */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Preview Snapshot</label>
                <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
                  {projectSnapshot ? (
                    <img
                      src={projectSnapshot}
                      alt="Schema snapshot"
                      className="w-full h-[200px] object-cover"
                    />
                  ) : (
                    <div className="w-full h-[200px] flex flex-col items-center justify-center text-gray-500">
                      <ImageIcon className="size-10 mb-2 text-gray-600" />
                      <span className="text-sm">No snapshot yet</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      onClose();
                      // Small delay to let the modal close, then trigger capture
                      setTimeout(() => onCaptureSnapshot?.(), 200);
                    }}
                    className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-2 bg-gray-900/90 backdrop-blur border border-gray-600 rounded-lg text-sm text-gray-200 hover:bg-gray-800 hover:border-gray-500 transition-all"
                  >
                    <Camera className="size-4" />
                    {projectSnapshot ? 'Retake Snapshot' : 'Take Snapshot'}
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Project Name</label>
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Project name..."
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Autosave interval (seconds)</label>
                <input
                  type="number"
                  min={15}
                  max={3600}
                  step={5}
                  value={localSettings.autoSaveIntervalSec}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setLocalSettings((prev) => ({
                      ...prev,
                      autoSaveIntervalSec: Number.isFinite(next) ? next : prev.autoSaveIntervalSec,
                    }));
                  }}
                  onBlur={(e) => handleAutoSaveIntervalBlur(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Range: 15-3600 sec. Used for periodic revision snapshots.</p>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Description</label>
                <textarea
                  value={localDesc}
                  onChange={(e) => setLocalDesc(e.target.value)}
                  onBlur={handleDescBlur}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Optional project description..."
                  style={{ scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
                />
              </div>
            </div>
          )}

          {activeTab === 'lines' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">Choose how relationship lines are drawn between tables.</p>
              {LINE_TYPES.map(lt => (
                <button
                  key={lt.id}
                  onClick={() => handleLineTypeChange(lt.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                    localSettings.lineType === lt.id
                      ? 'border-blue-500 bg-blue-900/30 ring-1 ring-blue-500/40'
                      : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                  }`}
                >
                  <div className={`size-10 flex items-center justify-center rounded-lg ${localSettings.lineType === lt.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    {lt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white">{lt.label}</div>
                    <div className="text-xs text-gray-500">{lt.description}</div>
                  </div>
                  <div className={`text-gray-500 ${localSettings.lineType === lt.id ? 'text-blue-400' : ''}`}>
                    {lt.preview}
                  </div>
                  {localSettings.lineType === lt.id && (
                    <div className="size-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Check className="size-3.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'types' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">Select which field types are available in your project.</p>
                <div className="flex gap-2">
                  <button onClick={enableOnlyCommon} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-800">Common only</button>
                  <button onClick={enableAll} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-gray-800">Enable all</button>
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-2">
                {localSettings.enabledFieldTypes.length} of {ALL_FIELD_TYPES.length} types enabled
              </div>

              {TYPE_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">{cat.label}</h4>
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {cat.types.map(type => {
                      const enabled = localSettings.enabledFieldTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleFieldType(type)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            enabled
                              ? 'bg-gray-800 text-white border border-gray-600 hover:border-gray-500'
                              : 'bg-gray-900 text-gray-600 border border-gray-800 hover:border-gray-700 hover:text-gray-500'
                          }`}
                        >
                          <span className={enabled ? 'text-blue-400' : 'text-gray-700'}>
                            {FIELD_TYPE_ICONS[type] || <Database className="size-4" />}
                          </span>
                          <span className="truncate">{type}</span>
                          {enabled && <Check className="size-3 text-green-400 ml-auto flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
