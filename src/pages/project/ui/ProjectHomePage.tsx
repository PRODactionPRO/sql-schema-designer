import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  FileJson,
  FileText,
  GitBranch,
  Grid2X2,
  MoreVertical,
  Network,
  Plus,
  Share2,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkspaceSidebar, type WorkspaceView } from '@/pages/projects/ui/ProjectsPage';
import { useProjectsStore } from '@/pages/projects/model/useProjectsStore';
import { SchemaPreview } from '@/pages/projects/ui/SchemaPreview';
import { createProjectDocument, deleteProjectDocument, updateProjectDocument } from '@/shared/api/project-documents';
import { getProjectById } from '@/shared/api/projects';
import {
  createClassDiagramProjectDocument,
  createErdProjectDocument,
  createIdef0ProjectDocument,
  getDocumentBadge,
  getDocumentTypeLabel,
  type ClassDiagramProjectDocument,
  type ProjectDocument,
  type ProjectDocumentType,
} from '@/shared/types/project';
import { useRequireAuth } from '@/shared/auth/guard';
import { useAuthStore } from '@/shared/auth/store';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';

function getDocumentIcon(type: ProjectDocumentType) {
  switch (type) {
    case 'erd':
      return <DatabaseIcon />;
    case 'class-diagram':
      return <Grid2X2 className="size-5 text-gray-400" />;
    case 'idef0':
      return <Workflow className="size-5 text-gray-400" />;
    case 'bpmn':
      return <Workflow className="size-5 text-gray-400" />;
    case 'openapi':
      return <FileJson className="size-5 text-gray-400" />;
    case 'sequence':
      return <GitBranch className="size-5 text-gray-400" />;
    default:
      return <FileText className="size-5 text-gray-400" />;
  }
}

function DatabaseIcon() {
  return <Network className="size-5 text-gray-400" />;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNextDocumentName(type: ProjectDocumentType, documents: ProjectDocument[]): string {
  const base = getDocumentTypeLabel(type);
  const count = documents.filter((document) => document.type === type).length;
  return count === 0 ? base : `${base} ${count + 1}`;
}

function ClassDiagramPreview({ document }: { document: ClassDiagramProjectDocument }) {
  const classes = document.classDiagram.classes.slice(0, 4);

  if (classes.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-gray-50">
        <Grid2X2 className="size-6 text-gray-300" />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 220 130" className="size-full bg-gray-50">
      <rect width="220" height="130" fill="#f9fafb" />
      {classes.map((entity, index) => {
        const x = 16 + (index % 2) * 100;
        const y = 18 + Math.floor(index / 2) * 54;
        const color = entity.color || '#6366f1';
        return (
          <g key={entity.id}>
            <rect x={x} y={y} width="84" height="38" rx="4" fill="#fff" stroke="#e5e7eb" />
            <rect x={x} y={y} width="84" height="11" rx="4" fill={color} />
            <rect x={x + 9} y={y + 19} width="42" height="3" rx="1.5" fill="#d1d5db" />
            <rect x={x + 9} y={y + 28} width="58" height="3" rx="1.5" fill="#e5e7eb" />
          </g>
        );
      })}
      {classes.length > 1 && (
        <path d="M 100 37 C 128 37, 110 74, 132 74" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
      )}
    </svg>
  );
}

function DocumentPreview({ document }: { document: ProjectDocument }) {
  if (document.snapshot) {
    return <img src={document.snapshot} alt="" className="size-full object-cover" />;
  }

  if (document.type === 'erd') {
    return <SchemaPreview tables={document.erd.tables} relations={document.erd.relations} width={260} height={150} />;
  }

  if (document.type === 'class-diagram') {
    return <ClassDiagramPreview document={document} />;
  }

  return (
    <div className="flex size-full items-center justify-center bg-gray-50">
      {getDocumentIcon(document.type)}
    </div>
  );
}

function DocumentCard({
  document,
  isEditing,
  editName,
  onOpen,
  onStartRename,
  onEditNameChange,
  onConfirmRename,
  onCancelRename,
  onDelete,
}: {
  document: ProjectDocument;
  isEditing: boolean;
  editName: string;
  onOpen: () => void;
  onStartRename: (event: React.MouseEvent) => void;
  onEditNameChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onDelete: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="group relative min-h-[246px] cursor-pointer rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-md"
    >
      <div className="h-[162px] overflow-hidden rounded-t-xl border-b border-gray-100 p-4">
        <div className="relative size-full overflow-hidden rounded-md border border-gray-200 bg-white">
          <DocumentPreview document={document} />
          <span className="absolute bottom-2 right-2 rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
            {getDocumentBadge(document.type)}
          </span>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 px-5 py-4">
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
            </div>
          ) : (
            <h3 className="truncate text-sm font-semibold text-gray-900">{document.name}</h3>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>{getDocumentTypeLabel(document.type)}</span>
            <span>·</span>
            <span>{formatDate(document.updatedAt)}</span>
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
              Rename
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

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] p-0">
        <DialogHeader className="border-b border-gray-200 px-5 py-4">
          <DialogTitle className="text-sm font-semibold">Import</DialogTitle>
        </DialogHeader>
        <div className="px-7 py-7">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".sql,.ddl,.mmd,.mermaid,.json,.drawsql,.puml,.plantuml"
            className="hidden"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex h-[280px] w-full flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-white text-center hover:bg-gray-50"
          >
            <Upload className="mb-4 size-7 text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">Bring system documents into this project</span>
            <span className="mt-2 text-sm text-gray-500">DDL, Mermaid, PlantUML, JSON and .drawsql files</span>
            <span className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Import from computer</span>
          </button>
          {files.length > 0 && (
            <div className="mt-4 rounded-md border border-gray-200">
              {files.map((file) => (
                <div key={`${file.name}-${file.size}`} className="flex items-center justify-between border-b border-gray-100 px-3 py-2 last:border-b-0">
                  <span className="truncate text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-400">{Math.ceil(file.size / 1024)} KB</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-gray-200 px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            disabled={files.length === 0}
            onClick={() => {
              toast.info('Import queue is ready. Format-specific parsers will be connected in the next step.');
              onOpenChange(false);
              setFiles([]);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectHomePage() {
  const { isAuthenticated } = useRequireAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const { projects, toggleProjectPinned } = useProjectsStore();
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return getProjectById(projectId);
    },
    enabled: Boolean(projectId) && isAuthenticated,
  });

  const project = projectQuery.data ?? null;

  const filteredDocuments = useMemo(() => {
    if (!project) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return project.documents;
    return project.documents.filter((document) => document.name.toLowerCase().includes(normalizedQuery));
  }, [project, query]);

	  const handleCreateDocument = async (type: 'erd' | 'class-diagram' | 'idef0') => {
	    if (!project) return;

    const document = type === 'erd'
      ? createErdProjectDocument(getNextDocumentName('erd', project.documents), {
          ...project.schema,
          domains: project.domains,
        })
      : type === 'class-diagram'
      ? createClassDiagramProjectDocument(getNextDocumentName('class-diagram', project.documents), project.domains)
      : createIdef0ProjectDocument(getNextDocumentName('idef0', project.documents), project.domains);

	    await createProjectDocument(project.id, document);
	    await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
	    await queryClient.invalidateQueries({ queryKey: ['projects'] });
	    navigate(`/project/${project.id}/document/${document.id}`);
	  };

	  const handleWorkspaceViewChange = (view: WorkspaceView) => {
	    navigate(view === 'all' ? '/' : `/?view=${view}`);
	  };

  const handleRenameDocument = async () => {
    if (!project || !editingDocumentId || !editName.trim()) {
      setEditingDocumentId(null);
      return;
    }

    await updateProjectDocument(project.id, editingDocumentId, { name: editName.trim() });
    await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    setEditingDocumentId(null);
  };

  const handleDeleteDocument = async () => {
    if (!project || !deleteDocumentId) return;
    await deleteProjectDocument(project.id, deleteDocumentId);
    await queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    setDeleteDocumentId(null);
    toast.success('Document deleted');
  };

  if (!isAuthenticated) return null;

  if (projectQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500">
        Project not found
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white text-gray-900">
      <WorkspaceSidebar
        projects={projects}
        activeProjectId={project.id}
        query={query}
        onQueryChange={setQuery}
        onProjectClick={(id) => navigate(`/project/${id}`)}
        onViewChange={handleWorkspaceViewChange}
        onLogout={() => {
          queryClient.clear();
          clearSession();
          navigate('/auth', { replace: true });
        }}
      />

      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-9 py-7">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{project.name}</h1>
            <ChevronDown className="size-4 text-gray-500" />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                <Plus className="size-4" />
                Create
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
	                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleCreateDocument('erd'); }}>
	                  <Network className="size-4" />
	                  ERD diagram
	                </DropdownMenuItem>
	                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleCreateDocument('class-diagram'); }}>
	                  <Grid2X2 className="size-4" />
	                  Class diagram
	                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleCreateDocument('idef0'); }}>
                  <Workflow className="size-4" />
                  IDEF0 functional model
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Workflow className="size-4" />
                  BPMN process
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <FileJson className="size-4" />
                  OpenAPI contract
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <GitBranch className="size-4" />
                  Sequence diagram
                </DropdownMenuItem>
                <DropdownMenuSeparator />
	                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setImportOpen(true); }}>
                  <Upload className="size-4" />
                  Import
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline">
              <Share2 className="size-4" />
              Share
            </Button>
            <Button variant="outline" size="icon" className="size-9">
              <SlidersHorizontal className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={`size-9 ${project.pinned ? 'text-yellow-500' : 'text-gray-500'}`}
              onClick={() => { void toggleProjectPinned(project.id); }}
            >
              <Star className={`size-4 ${project.pinned ? 'fill-current' : ''}`} />
            </Button>
          </div>
        </header>

        <div className="flex items-center justify-end gap-2 px-9">
          <Button variant="outline" size="sm">All files</Button>
          <Button variant="outline" size="sm">Last modified</Button>
          <Button variant="ghost" size="icon" className="size-8 text-gray-500">
            <Grid2X2 className="size-4" />
          </Button>
        </div>

        <section className="px-9 py-6">
          {project.documents.length === 0 ? (
            <div className="flex h-[520px] flex-col items-center justify-center text-center">
              <p className="text-sm text-gray-500">This project doesn't have any files.</p>
              <p className="mt-2 text-sm text-gray-400">Create a class diagram or ERD to start describing the future system.</p>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" />
                  Import
                </Button>
                <Button onClick={() => { void handleCreateDocument('class-diagram'); }} className="bg-blue-600 hover:bg-blue-700">
                  <Grid2X2 className="size-4" />
                  Class diagram
                </Button>
                <Button onClick={() => { void handleCreateDocument('erd'); }} variant="outline">
                  <Network className="size-4" />
                  ERD
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  isEditing={editingDocumentId === document.id}
                  editName={editName}
                  onOpen={() => editingDocumentId !== document.id && navigate(`/project/${project.id}/document/${document.id}`)}
                  onStartRename={(event) => {
                    event.stopPropagation();
                    setEditingDocumentId(document.id);
                    setEditName(document.name);
                  }}
                  onEditNameChange={setEditName}
                  onConfirmRename={() => { void handleRenameDocument(); }}
                  onCancelRename={() => setEditingDocumentId(null)}
                  onDelete={(event) => {
                    event.stopPropagation();
                    setDeleteDocumentId(document.id);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {deleteDocumentId && (
        <Dialog open onOpenChange={(open) => !open && setDeleteDocumentId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete document?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">This removes the document from the project.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDocumentId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { void handleDeleteDocument(); }}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
