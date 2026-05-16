import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Check,
  Clock3,
  Copy,
  Database,
  Download,
  FileText,
  Folder,
  LayoutGrid,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectsStore } from '../model/useProjectsStore';
import { SchemaPreview } from './SchemaPreview';
import type { ProjectData } from '../model/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
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
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getProjectTableCount(project: ProjectData): number {
  return project.schema.tables.length;
}

export type WorkspaceView = 'all' | 'drafts' | 'recents' | 'trash' | 'admin';

export function WorkspaceSidebar({
  projects,
  activeProjectId,
  activeView = 'all',
  query,
  onQueryChange,
  onProjectClick,
  onViewChange,
  onLogout,
}: {
  projects: ProjectData[];
  activeProjectId?: string;
  activeView?: WorkspaceView;
  query: string;
  onQueryChange: (value: string) => void;
  onProjectClick: (id: string) => void;
  onViewChange?: (view: WorkspaceView) => void;
  onLogout: () => void;
}) {
  const pinnedProjects = projects.filter((project) => project.pinned).slice(0, 8);
  const viewButtonClassName = (view: WorkspaceView) => (
    `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
      activeView === view ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-700 hover:bg-gray-100'
    }`
  );

  return (
    <aside className="flex min-h-screen w-[264px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="px-4 pb-3 pt-4">
        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-fuchsia-500 text-xs font-semibold text-white">G</div>
            <span className="text-sm font-semibold text-gray-800">Gigonom</span>
          </div>
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">Professional</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search"
            className="h-9 rounded-md border-gray-200 bg-gray-100 pl-9 text-sm"
          />
        </div>
      </div>

      <nav className="space-y-1 px-3 pb-4 text-sm">
        <button className={viewButtonClassName('recents')} onClick={() => onViewChange?.('recents')}>
          <Clock3 className="size-4 text-gray-500" />
          Recents
        </button>
      </nav>

      <div className="border-y border-gray-200 px-3 py-4">
        <nav className="space-y-1 text-sm">
          <button className={viewButtonClassName('drafts')} onClick={() => onViewChange?.('drafts')}>
            <FileText className="size-4 text-gray-500" />
            Drafts
          </button>
          <button className={viewButtonClassName('all')} onClick={() => onViewChange?.('all')}>
            <LayoutGrid className="size-4" />
            All projects
          </button>
          <button className={viewButtonClassName('trash')} onClick={() => onViewChange?.('trash')}>
            <Trash2 className="size-4 text-gray-500" />
            Trash
          </button>
          <button className={viewButtonClassName('admin')} onClick={() => onViewChange?.('admin')}>
            <Settings className="size-4 text-gray-500" />
            Admin
          </button>
        </nav>
      </div>

      <div className="px-3 py-4">
        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Starred</div>
        <div className="space-y-1">
          {pinnedProjects.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No pinned projects</div>
          ) : (
            pinnedProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => onProjectClick(project.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${
                  activeProjectId === project.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Folder className="size-4 text-gray-500" />
                <span className="truncate">{project.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-gray-200 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

function ProjectCard({
  project,
  isEditing,
  editName,
  onOpen,
  onStartRename,
  onEditNameChange,
  onConfirmRename,
  onCancelRename,
  onDuplicate,
  onExport,
  onDelete,
}: {
  project: ProjectData;
  isEditing: boolean;
  editName: string;
  onOpen: () => void;
  onStartRename: () => void;
  onEditNameChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const tableCount = getProjectTableCount(project);

  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-gray-300 hover:shadow-lg"
    >
      <div className="border-b border-gray-100">
        {project.snapshot ? (
          <img
            src={project.snapshot}
            alt={`${project.name} preview`}
            className="h-[160px] w-full rounded-t-xl object-cover"
          />
        ) : (
          <div className="p-3 pb-2">
            <SchemaPreview
              tables={project.schema.tables}
              relations={project.schema.relations}
              width={280}
              height={140}
            />
          </div>
        )}
      </div>

      <div className="p-4">
        {isEditing ? (
          <div className="mb-1 flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <input
              value={editName}
              onChange={(event) => onEditNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onConfirmRename();
                if (event.key === 'Escape') onCancelRename();
              }}
              autoFocus
              className="min-w-0 flex-1 rounded border border-indigo-300 px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={onConfirmRename} className="rounded p-1 text-green-600 hover:bg-green-50">
              <Check className="size-4" />
            </button>
            <button onClick={onCancelRename} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <h3 className="mb-1 truncate text-sm font-semibold text-gray-900">{project.name}</h3>
        )}
        {project.description ? (
          <p className="mb-1 truncate text-xs text-gray-500">{project.description}</p>
        ) : null}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Table2 className="size-3" />
            {tableCount} table{tableCount === 1 ? '' : 's'}
          </span>
          <span>{formatDate(project.updatedAt)}</span>
        </div>
      </div>

      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-lg border border-gray-200 bg-white/90 p-1.5 shadow-sm backdrop-blur hover:bg-gray-50">
            <MoreVertical className="size-4 text-gray-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onStartRename}>
              <Pencil className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="size-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExport}>
              <Download className="size-3.5" />
              Export .drawsql
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-red-600">
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const { isAuthenticated } = useRequireAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const {
    projects,
    createProject,
    deleteProject,
    duplicateProject,
    renameProject,
    exportProjectFile,
    importProjectFile,
    isLoading,
  } = useProjectsStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(normalizedQuery));
  }, [projects, searchQuery]);

  const handleCreate = async () => {
    const project = await createProject(`Untitled Schema ${projects.length + 1}`);
    navigate(`/project/${project.id}`);
  };

  const handleOpen = (id: string) => {
    if (editingId === id) return;
    navigate(`/project/${id}`);
  };

  const confirmRename = async () => {
    if (editingId && editName.trim()) {
      await renameProject(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleExportProject = (id: string) => {
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

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      importProjectFile(content)
        .then((project) => toast.success(`Imported "${project.name}"`))
        .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to import project'));
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const toggleSearch = () => {
    if (searchVisible) {
      setSearchQuery('');
      setSearchVisible(false);
      return;
    }
    setSearchVisible(true);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600">
              <Database className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Schema Designer</h1>
              <p className="text-xs text-gray-500">
                Visual database modeling tool · {user?.email ?? 'demo@localhost'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearSession();
                navigate('/auth', { replace: true });
              }}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <LogOut className="size-4" />
              Logout
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Upload className="size-4" />
              Import .drawsql
            </button>
            <button
              onClick={() => {
                void handleCreate();
              }}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              New Project
            </button>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".drawsql,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-500">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gray-200">
              <Table2 className="size-8 text-gray-400" />
            </div>
            <h2 className="mb-1 text-lg font-medium text-gray-700">No projects yet</h2>
            <p className="mb-6 max-w-sm text-center text-sm text-gray-500">
              Create your first database schema project or import an existing <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">.drawsql</code> file.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Upload className="size-4" />
                Import File
              </button>
              <button
                onClick={() => {
                  void handleCreate();
                }}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <Plus className="size-4" />
                Create First Project
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-500">
                {searchQuery
                  ? `${filteredProjects.length} of ${projects.length} projects`
                  : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
              </h2>
              <div className="flex items-center gap-2">
                {searchVisible ? (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search projects..."
                      autoFocus
                      className="w-56 rounded-lg border border-gray-300 py-1.5 pl-8 pr-8 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                    {searchQuery ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <button
                  onClick={toggleSearch}
                  aria-label="Search projects"
                  className={`rounded-lg p-2 transition-colors ${searchVisible ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <Search className="size-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <button
                onClick={() => {
                  void handleCreate();
                }}
                className="group flex min-h-[222px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-12 transition-all hover:border-indigo-400 hover:bg-indigo-50/50"
              >
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-gray-100 transition-colors group-hover:bg-indigo-100">
                  <Plus className="size-6 text-gray-400 transition-colors group-hover:text-indigo-500" />
                </div>
                <span className="text-sm font-medium text-gray-500 transition-colors group-hover:text-indigo-600">New Project</span>
              </button>

              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isEditing={editingId === project.id}
                  editName={editName}
                  onOpen={() => handleOpen(project.id)}
                  onStartRename={() => {
                    setEditingId(project.id);
                    setEditName(project.name);
                  }}
                  onEditNameChange={setEditName}
                  onConfirmRename={() => {
                    void confirmRename();
                  }}
                  onCancelRename={() => setEditingId(null)}
                  onDuplicate={() => {
                    duplicateProject(project.id)
                      .then((copy) => copy && toast.success(`Duplicated as "${copy.name}"`))
                      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to duplicate project'));
                  }}
                  onExport={() => handleExportProject(project.id)}
                  onDelete={() => setDeleteConfirmId(project.id)}
                />
              ))}
            </div>

            {filteredProjects.length === 0 && searchQuery ? (
              <div className="py-12 text-center">
                <Search className="mx-auto mb-3 size-8 text-gray-300" />
                <p className="text-sm text-gray-500">No projects matching "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="mt-2 text-sm text-indigo-600 hover:text-indigo-700">
                  Clear search
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>

      {deleteConfirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirmId(null)}>
          <div className="mx-4 max-w-sm rounded-xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-2 font-semibold text-gray-900">Delete Project?</h3>
            <p className="mb-4 text-sm text-gray-600">
              This will permanently delete this project and all its data. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                onClick={() => {
                  void deleteProject(deleteConfirmId).then(() => {
                    setDeleteConfirmId(null);
                    toast.success('Project deleted');
                  });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
