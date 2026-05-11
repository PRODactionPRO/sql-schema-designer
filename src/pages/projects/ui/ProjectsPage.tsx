import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  Download,
  FileText,
  Folder,
  Grid2X2,
  LayoutGrid,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectsStore } from '../model/useProjectsStore';
import { SchemaPreview } from './SchemaPreview';
import type { ProjectData } from '../model/types';
import {
  getDocumentBadge,
  getDocumentTypeLabel,
  type ProjectDocument,
} from '@/shared/types/project';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
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

function getProjectFileCount(project: ProjectData): number {
  return project.documents.length;
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

function ProjectPreviewMosaic({ project }: { project: ProjectData }) {
  const documents = project.documents.slice(0, 4);
  const placeholders = Array.from({ length: Math.max(0, 4 - documents.length) });

  return (
    <div className="grid h-[172px] grid-cols-2 gap-3 p-5 pb-3">
      {documents.map((document, index) => (
        <div key={document.id} className="overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          {document.snapshot ? (
            <img src={document.snapshot} alt="" className="size-full object-cover" />
          ) : document.type === 'erd' && index === 0 ? (
            <SchemaPreview tables={document.erd.tables} relations={document.erd.relations} width={150} height={76} />
          ) : (
            <div className="flex size-full items-center justify-center bg-white">
              {document.type === 'class-diagram' ? (
                <Grid2X2 className="size-5 text-gray-300" />
              ) : (
                <FileText className="size-5 text-gray-300" />
              )}
            </div>
          )}
        </div>
      ))}
      {placeholders.map((_, index) => (
        <div key={`placeholder-${index}`} className="rounded-md border border-gray-200 bg-white" />
      ))}
    </div>
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
  onTogglePinned,
}: {
  project: ProjectData;
  isEditing: boolean;
  editName: string;
  onOpen: () => void;
  onStartRename: (event: React.MouseEvent) => void;
  onEditNameChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onDuplicate: (event: React.MouseEvent) => void;
  onExport: (event: React.MouseEvent) => void;
  onDelete: (event: React.MouseEvent) => void;
  onTogglePinned: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group relative min-h-[292px] cursor-pointer rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-md"
    >
      <button
        onClick={onTogglePinned}
        className={`absolute right-5 top-5 z-10 flex size-7 items-center justify-center rounded-md border transition ${
          project.pinned
            ? 'border-yellow-200 bg-yellow-50 text-yellow-500'
            : 'border-transparent bg-white/80 text-gray-300 opacity-0 hover:text-yellow-500 group-hover:opacity-100'
        }`}
        aria-label={project.pinned ? 'Unpin project' : 'Pin project'}
      >
        <Star className={`size-4 ${project.pinned ? 'fill-current' : ''}`} />
      </button>

      <ProjectPreviewMosaic project={project} />

      <div className="flex items-start justify-between gap-3 px-6 pb-5 pt-3">
        <div className="min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
              <Input
                value={editName}
                onChange={(event) => onEditNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onConfirmRename();
                  if (event.key === 'Escape') onCancelRename();
                }}
                autoFocus
                className="h-8"
              />
              <button onClick={onConfirmRename} className="rounded p-1 text-green-600 hover:bg-green-50">
                <Check className="size-4" />
              </button>
              <button onClick={onCancelRename} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <h3 className="truncate text-sm font-semibold text-gray-900">{project.name}</h3>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>{getProjectFileCount(project)} file{getProjectFileCount(project) === 1 ? '' : 's'}</span>
            <span>·</span>
            <span>{formatDate(project.updatedAt)}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(event) => onStartRename(event as unknown as React.MouseEvent)}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(event) => onDuplicate(event as unknown as React.MouseEvent)}>
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(event) => onExport(event as unknown as React.MouseEvent)}>
              <Download className="size-4" />
              Export .drawsql
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(event) => onDelete(event as unknown as React.MouseEvent)} className="text-red-600">
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function EmptyWorkspaceView({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-[420px] flex-col items-center justify-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{description}</p>
    </div>
  );
}

function RecentDocumentCard({
  project,
  document,
  onOpen,
}: {
  project: ProjectData;
  document: ProjectDocument;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[92px] w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:shadow-sm"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
        {document.type === 'erd' ? <Database className="size-5" /> : document.type === 'class-diagram' ? <Grid2X2 className="size-5" /> : <FileText className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">{document.name}</span>
          <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {getDocumentBadge(document.type)}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-gray-500">
          <span className="truncate">{project.name}</span>
          <span>·</span>
          <span>{getDocumentTypeLabel(document.type)}</span>
          <span>·</span>
          <span>{formatDate(document.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

export function ProjectsPage() {
  const { isAuthenticated } = useRequireAuth();
  const clearSession = useAuthStore((state) => state.clearSession);
  const {
    projects,
    createProject,
    deleteProject,
    duplicateProject,
    renameProject,
    toggleProjectPinned,
    exportProjectFile,
    importProjectFile,
  } = useProjectsStore();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const activeView = useMemo<WorkspaceView>(() => {
    const value = searchParams.get('view');
    if (value === 'drafts' || value === 'recents' || value === 'trash' || value === 'admin') return value;
    return 'all';
  }, [searchParams]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(normalizedQuery));
  }, [projects, query]);

  const recentDocuments = useMemo(() => (
    projects
      .flatMap((project) => project.documents.map((document) => ({ project, document })))
      .sort((a, b) => new Date(b.document.updatedAt).getTime() - new Date(a.document.updatedAt).getTime())
  ), [projects]);

  const handleViewChange = (view: WorkspaceView) => {
    setQuery('');
    setSearchParams(view === 'all' ? {} : { view });
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim() || `Untitled Project ${projects.length + 1}`;
    const project = await createProject(name);
    setCreateOpen(false);
    setNewProjectName('');
    navigate(`/project/${project.id}`);
  };

  const confirmRename = async () => {
    if (editingId && editName.trim()) {
      await renameProject(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleExportProject = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
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

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-white text-gray-900">
	      <WorkspaceSidebar
	        projects={projects}
	        activeView={activeView}
	        query={query}
	        onQueryChange={setQuery}
	        onProjectClick={(id) => navigate(`/project/${id}`)}
	        onViewChange={handleViewChange}
	        onLogout={() => {
          clearSession();
          navigate('/auth', { replace: true });
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".drawsql,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-9 py-7">
          <div className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-md bg-fuchsia-500 text-lg font-semibold text-white">G</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-normal">Gigonom</h1>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">Professional</span>
                <ChevronDown className="size-4 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="size-4" />
              Project
            </Button>
            <Button variant="outline">
              <Share2 className="size-4" />
              Share
            </Button>
          </div>
        </header>

        <div className="flex items-center justify-end gap-2 px-9">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            Last modified
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-gray-500">
            <Grid2X2 className="size-4" />
          </Button>
        </div>

	        <section className="px-9 py-6">
	          {activeView === 'drafts' ? (
	            <EmptyWorkspaceView
	              icon={<FileText className="size-7 text-gray-400" />}
	              title="No drafts yet"
	              description="Drafts will hold documents created outside a project until they are attached to a real project."
	            />
	          ) : activeView === 'recents' ? (
	            recentDocuments.length === 0 ? (
	              <EmptyWorkspaceView
	                icon={<Clock3 className="size-7 text-gray-400" />}
	                title="No recent files"
	                description="Recently opened or changed documents will appear here across all projects."
	              />
	            ) : (
	              <div className="max-w-4xl space-y-3">
	                {recentDocuments.map(({ project, document }) => (
	                  <RecentDocumentCard
	                    key={`${project.id}:${document.id}`}
	                    project={project}
	                    document={document}
	                    onOpen={() => navigate(`/project/${project.id}/document/${document.id}`)}
	                  />
	                ))}
	              </div>
	            )
	          ) : activeView === 'trash' ? (
	            <EmptyWorkspaceView
	              icon={<Trash2 className="size-7 text-gray-400" />}
	              title="Trash is empty"
	              description="Deleted projects and documents will be collected here when soft delete is connected."
	            />
	          ) : activeView === 'admin' ? (
	            <EmptyWorkspaceView
	              icon={<Settings className="size-7 text-gray-400" />}
	              title="Admin tools are not connected"
	              description="Workspace-level controls will live here after we define the admin surface."
	            />
	          ) : projects.length === 0 ? (
	            <div className="flex h-[420px] flex-col items-center justify-center text-center">
	              <div className="mb-4 flex size-14 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
	                <Database className="size-7 text-gray-400" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">No projects yet</h2>
              <p className="mt-2 max-w-sm text-sm text-gray-500">Create a project container, then add ERD and class diagram documents inside it.</p>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" />
                  Import
                </Button>
                <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="size-4" />
                  Project
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isEditing={editingId === project.id}
                    editName={editName}
                    onOpen={() => editingId !== project.id && navigate(`/project/${project.id}`)}
                    onStartRename={(event) => {
                      event.stopPropagation();
                      setEditingId(project.id);
                      setEditName(project.name);
                    }}
                    onEditNameChange={setEditName}
                    onConfirmRename={() => { void confirmRename(); }}
                    onCancelRename={() => setEditingId(null)}
                    onDuplicate={(event) => {
                      event.stopPropagation();
                      duplicateProject(project.id)
                        .then((copy) => copy && toast.success(`Duplicated as "${copy.name}"`))
                        .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to duplicate project'));
                    }}
                    onExport={(event) => handleExportProject(project.id, event)}
                    onDelete={(event) => {
                      event.stopPropagation();
                      setDeleteConfirmId(project.id);
                    }}
                    onTogglePinned={(event) => {
                      event.stopPropagation();
                      void toggleProjectPinned(project.id);
                    }}
                  />
                ))}
              </div>

              {filteredProjects.length === 0 && (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <Search className="mb-3 size-8 text-gray-300" />
                  <p className="text-sm text-gray-500">No projects matching "{query}"</p>
                  <button onClick={() => setQuery('')} className="mt-2 text-sm text-blue-600 hover:text-blue-700">
                    Clear search
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[520px] p-0">
          <DialogHeader className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="text-sm font-semibold">Create project</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4">
            <label className="mb-2 block text-sm font-medium text-gray-800">Name</label>
            <Input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCreateProject();
              }}
              placeholder="Ex. System Architect"
              autoFocus
            />
          </div>
          <DialogFooter className="border-t border-gray-200 px-5 py-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => { void handleCreateProject(); }} className="bg-blue-600 hover:bg-blue-700">Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteConfirmId && (
        <Dialog open onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete project?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">This will permanently delete the project and all documents inside it.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void deleteProject(deleteConfirmId).then(() => {
                    setDeleteConfirmId(null);
                    toast.success('Project deleted');
                  });
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
