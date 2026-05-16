import { useCallback, useMemo, useState } from 'react';
import { createSemanticModelObject, deleteSemanticModelObject } from '@/shared/api/semantic-model';
import { DomainsPanel } from '@/pages/editor/ui/sidebar/DomainsPanel';
import { useDomainsPanelViewModel } from '@/pages/editor/ui/sidebar/useDomainsPanelViewModel';
import type { ProjectData } from '@/shared/types/project';
import type { Domain } from '@/shared/types/schema';
import { DOMAIN_COLORS } from '@/shared/types/schema';
import type { WorkspaceSelection } from '../model/types';
import {
  getClassDiagramDocument,
  getObjectBinding,
  getProjectDomains,
  nextWorkspaceId,
  saveObjectMetadata,
  updateProjectBinding,
  withClassDiagram,
  withSchema,
} from '../model/workspace-project-utils';

export function WorkspaceDomainsPane({
  project,
  selection,
  onProjectChange,
}: {
  project?: ProjectData;
  selection: WorkspaceSelection | null;
  onProjectChange: (project: ProjectData) => void;
}) {
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [renamingDomainId, setRenamingDomainId] = useState<string | null>(null);
  const [renamingDomainName, setRenamingDomainName] = useState('');

  const selectedTableIds = useMemo(() => {
    if (selection?.kind === 'table') return new Set([selection.id]);
    return new Set<string>();
  }, [selection]);

  const updateDomains = useCallback((domains: Domain[]) => {
    if (!project) return;
    const schema = { ...project.schema, domains };
    const nextProject = withClassDiagram(
      withSchema(project, schema),
      {
        ...(getClassDiagramDocument(project)?.classDiagram ?? { classes: [], relations: [], domains }),
        domains,
      },
    );
    onProjectChange(nextProject);
  }, [onProjectChange, project]);

  const handleAddDomain = useCallback(() => {
    if (!project) return;
    const name = newDomainName.trim();
    if (!name) return;

    const domain: Domain = {
      id: nextWorkspaceId('domain'),
      name,
      color: DOMAIN_COLORS[getProjectDomains(project).length % DOMAIN_COLORS.length] ?? '#6366f1',
    };
    const domains = [...getProjectDomains(project), domain];
    const schema = { ...project.schema, domains };
    const nextProject = withClassDiagram(
      withSchema(project, schema),
      {
        ...(getClassDiagramDocument(project)?.classDiagram ?? { classes: [], relations: [], domains }),
        domains,
      },
    );

    onProjectChange(nextProject);
    setNewDomainName('');
    setIsAddingDomain(false);

    void createSemanticModelObject(project.id, {
      type: 'domain',
      name: domain.name,
      metadata: { ...domain },
    }).then((object) => {
      onProjectChange(updateProjectBinding(nextProject, domain.id, object.id, domain));
    }).catch((error) => {
      console.error('[workspace] Failed to create domain object', error);
    });
  }, [newDomainName, onProjectChange, project]);

  const handleUpdateDomain = useCallback((id: string, updates: Partial<Omit<Domain, 'id'>>) => {
    if (!project) return;
    const nextDomains = getProjectDomains(project).map((domain) => (
      domain.id === id ? { ...domain, ...updates } : domain
    ));
    updateDomains(nextDomains);
    const nextDomain = nextDomains.find((domain) => domain.id === id);
    if (nextDomain) saveObjectMetadata(project, id, nextDomain);
  }, [project, updateDomains]);

  const handleDeleteDomain = useCallback((id: string) => {
    if (!project) return;
    const nextDomains = getProjectDomains(project).filter((domain) => domain.id !== id);
    const nextTables = project.schema.tables.map((table) => table.domainId === id ? { ...table, domainId: undefined } : table);
    const schema = { ...project.schema, domains: nextDomains, tables: nextTables };
    onProjectChange(withSchema(project, schema));

    const binding = getObjectBinding(project, id);
    if (binding) {
      void deleteSemanticModelObject(project.id, binding.objectId).catch((error) => {
        console.error('[workspace] Failed to delete domain object', error);
      });
    }
    for (const table of nextTables) {
      saveObjectMetadata(project, table.id, table);
    }
  }, [onProjectChange, project]);

  const handleAssignDomain = useCallback((domainId: string, tableIds: string[]) => {
    if (!project) return;
    const targetIds = new Set(tableIds);
    const nextTables = project.schema.tables.map((table) => (
      targetIds.has(table.id) ? { ...table, domainId } : table
    ));
    const schema = { ...project.schema, tables: nextTables };
    onProjectChange(withSchema(project, schema));
    nextTables.filter((table) => targetIds.has(table.id)).forEach((table) => saveObjectMetadata(project, table.id, table));
  }, [onProjectChange, project]);

  const handleReorderDomains = useCallback((orderedIds: string[]) => {
    if (!project) return;
    const currentDomains = getProjectDomains(project);
    const domainById = new Map(currentDomains.map((domain) => [domain.id, domain]));
    const orderedDomains = orderedIds
      .map((id) => domainById.get(id))
      .filter((domain): domain is Domain => Boolean(domain));
    const missingDomains = currentDomains.filter((domain) => !orderedIds.includes(domain.id));
    updateDomains([...orderedDomains, ...missingDomains]);
  }, [project, updateDomains]);

  const viewModel = useDomainsPanelViewModel({
    domains: project ? getProjectDomains(project) : [],
    tables: project?.schema.tables ?? [],
    isAddingDomain,
    setIsAddingDomain,
    newDomainName,
    setNewDomainName,
    editingDomainId,
    setEditingDomainId,
    renamingDomainId,
    setRenamingDomainId,
    renamingDomainName,
    setRenamingDomainName,
    hasMultiSelection: selectedTableIds.size > 0,
    selectedTableIds,
    onAssignDomain: handleAssignDomain,
    onUpdateDomain: handleUpdateDomain,
    onDeleteDomain: handleDeleteDomain,
    onReorderDomains: handleReorderDomains,
    handleAddDomain,
  });

  if (!project) {
    return (
      <div className="h-full overflow-auto p-3">
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
          Domains will appear after loading
        </div>
      </div>
    );
  }

  return <DomainsPanel viewModel={viewModel} />;
}
