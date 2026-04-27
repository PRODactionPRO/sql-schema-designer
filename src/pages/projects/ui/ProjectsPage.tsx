import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, Database, Trash2, Copy, Pencil, Check, X,
  MoreVertical, Table2, Search, Download, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectsStore } from '../model/useProjectsStore';
import { SchemaPreview } from './SchemaPreview';
import type { ProjectData } from '../model/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { useRequireAuth } from '@/shared/auth/guard';
import { useAuthStore } from '@/shared/auth/store';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function ProjectsPage() {
  const { isAuthenticated } = useRequireAuth();
  const clearSession = useAuthStore((s) => s.clearSession);
  const user = useAuthStore((s) => s.user);
  const {
    projects,
    createProject,
    deleteProject,
    duplicateProject,
    renameProject,
    exportProjectFile,
    importProjectFile,
  } = useProjectsStore();

  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reload projects when navigating back to this page
  // The hook already loads on mount

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const handleCreate = async () => {
    const name = `Untitled Schema ${projects.length + 1}`;
    const project = await createProject(name);
    navigate(`/project/${project.id}`);
  };

  const handleOpen = (id: string) => {
    if (editingId === id) return;
    navigate(`/project/${id}`);
  };

  const startRename = (p: ProjectData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditName(p.name);
  };

  const confirmRename = async () => {
    if (editingId && editName.trim()) {
      await renameProject(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = await duplicateProject(id);
    if (copy) toast.success(`Duplicated as "${copy.name}"`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteProject(deleteConfirmId);
      setDeleteConfirmId(null);
      toast.success('Project deleted');
    }
  };

  const handleExportProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = exportProjectFile(id);
    if (!result) return;
    const blob = new Blob([result.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Project exported');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        importProjectFile(content)
          .then((project) => {
            toast.success(`Imported "${project.name}"`);
          })
          .catch((err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to import project');
          });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to import project');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const toggleSearch = () => {
    if (searchVisible) {
      setSearchQuery('');
      setSearchVisible(false);
    } else {
      setSearchVisible(true);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Database className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl text-gray-900" style={{ fontWeight: 600 }}>Schema Designer</h1>
              <p className="text-xs text-gray-500">Visual database modeling tool{user?.email ? ` • ${user.email}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearSession();
                navigate('/auth', { replace: true });
              }}
              className="px-3 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              style={{ fontWeight: 500 }}
            >
              Logout
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              style={{ fontWeight: 500 }}
            >
              <Upload className="size-4" />
              Import .drawsql
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              style={{ fontWeight: 500 }}
            >
              <Plus className="size-4" />
              New Project
            </button>
          </div>
        </div>
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".drawsql,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="size-16 rounded-2xl bg-gray-200 flex items-center justify-center mb-4">
              <Table2 className="size-8 text-gray-400" />
            </div>
            <h2 className="text-lg text-gray-700 mb-1" style={{ fontWeight: 500 }}>No projects yet</h2>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
              Create your first database schema project or import an existing <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">.drawsql</code> file.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleImportClick}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                style={{ fontWeight: 500 }}
              >
                <Upload className="size-4" />
                Import File
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                style={{ fontWeight: 500 }}
              >
                <Plus className="size-4" />
                Create First Project
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-sm text-gray-500" style={{ fontWeight: 500 }}>
                  {searchQuery
                    ? `${filteredProjects.length} of ${projects.length} projects`
                    : `${projects.length} project${projects.length !== 1 ? 's' : ''}`
                  }
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {searchVisible && (
                  <div className="relative">
                    <Search className="size-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="text-sm border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <button
                  onClick={toggleSearch}
                  className={`p-2 rounded-lg transition-colors ${searchVisible ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <Search className="size-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* New project card */}
              <button
                onClick={handleCreate}
                className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer py-12"
              >
                <div className="size-12 rounded-xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center mb-3 transition-colors">
                  <Plus className="size-6 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <span className="text-sm text-gray-500 group-hover:text-indigo-600 transition-colors" style={{ fontWeight: 500 }}>New Project</span>
              </button>

              {/* Project cards */}
              {filteredProjects.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleOpen(p.id)}
                  className="group relative bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                >
                  {/* Preview: PNG snapshot if available, otherwise SVG fallback */}
                  <div className="border-b border-gray-100">
                    {p.snapshot ? (
                      <img
                        src={p.snapshot}
                        alt={`${p.name} preview`}
                        className="w-full h-[160px] object-cover rounded-t-xl"
                        style={{ imageRendering: 'auto' }}
                      />
                    ) : (
                      <div className="p-3 pb-2">
                        <SchemaPreview
                          tables={p.schema.tables}
                          relations={p.schema.relations}
                          width={280}
                          height={140}
                        />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="flex-1 min-w-0 text-sm border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          style={{ fontWeight: 600 }}
                        />
                        <button onClick={confirmRename} className="p-1 hover:bg-green-50 rounded text-green-600">
                          <Check className="size-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-sm text-gray-900 truncate mb-1" style={{ fontWeight: 600 }}>{p.name}</h3>
                    )}
                    {p.description && (
                      <p className="text-xs text-gray-500 truncate mb-1">{p.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Table2 className="size-3" />
                        {p.schema.tables.length} table{p.schema.tables.length !== 1 ? 's' : ''}
                      </span>
                      <span>{formatDate(p.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Actions menu */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1.5 rounded-lg bg-white/90 backdrop-blur border border-gray-200 shadow-sm hover:bg-gray-50">
                        <MoreVertical className="size-4 text-gray-500" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => startRename(p, e as any)} className="text-sm">
                          <Pencil className="size-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleDuplicate(p.id, e as any)} className="text-sm">
                          <Copy className="size-3.5 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleExportProject(p.id, e as any)} className="text-sm">
                          <Download className="size-3.5 mr-2" />
                          Export .drawsql
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => handleDelete(p.id, e as any)} className="text-sm text-red-600">
                          <Trash2 className="size-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>

            {/* No results */}
            {filteredProjects.length === 0 && searchQuery && (
              <div className="text-center py-12">
                <Search className="size-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No projects matching "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="text-sm text-indigo-600 hover:text-indigo-700 mt-2">
                  Clear search
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-gray-900 mb-2" style={{ fontWeight: 600 }}>Delete Project?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete this project and all its data. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
