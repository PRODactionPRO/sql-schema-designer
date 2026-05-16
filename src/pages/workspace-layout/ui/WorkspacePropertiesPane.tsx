import {
  deleteObjectFromViewCommand,
  updateRelationCommand,
} from '@/shared/api/semantic-model';
import type {
  ClassEntity,
  ClassRelation,
  ProjectData,
  ProjectDocument,
} from '@/shared/types/project';
import type {
  Domain,
  EnumType,
  JsonSchemaDocument,
  Relation,
  Table,
} from '@/shared/types/schema';
import type { WorkspaceSelection } from '../model/types';
import { getSelectedProperties } from '../model/workspace-properties-utils';
import {
  getClassDiagram,
  getObjectBinding,
  getProjectDomains,
  getRelationBinding,
  saveObjectMetadata,
  updateClassInProject,
  withClassDiagram,
  withSchema,
} from '../model/workspace-project-utils';
import {
  createErdRelationInView,
  deleteRelationFromSemanticView,
} from '../model/semantic-relation-commands';
import { ClassRelationPropertiesPane } from './WorkspaceClassRelationPropertiesPane';
import { ClassModelPropertiesPane } from './WorkspaceClassPropertiesPane';
import { EnumProperties } from './WorkspaceEnumPropertiesPane';
import { JsonSchemaProperties } from './WorkspaceJsonSchemaPropertiesPane';
import { ObjectSummaryPane } from './WorkspaceObjectSummaryPane';
import { TableProperties } from './WorkspaceTablePropertiesPane';

export function PropertiesPane({
  project,
  selection,
  onProjectChange,
  onSelectionChange,
}: {
  project?: ProjectData;
  selection: WorkspaceSelection | null;
  onProjectChange: (project: ProjectData) => void;
  onSelectionChange?: (selection: WorkspaceSelection | null) => void;
}) {
  if (!project) {
    return (
      <div className="h-full overflow-auto p-4">
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
          Project properties will appear after loading
        </div>
      </div>
    );
  }

  const domains = getProjectDomains(project);
  const selectedTableId = selection?.kind === 'field' ? selection.parentId : selection?.kind === 'table' ? selection.id : undefined;
  const selectedTable = selectedTableId ? project.schema.tables.find((table) => table.id === selectedTableId) ?? null : null;
  const selectedEnum = selection?.kind === 'enum' ? project.schema.enums.find((enumType) => enumType.id === selection.id) ?? null : null;
  const selectedJsonSchema = selection?.kind === 'jsonSchema'
    ? (project.schema.jsonSchemas ?? []).find((doc) => doc.id === selection.id) ?? null
    : null;
  const classDiagram = getClassDiagram(project);
  const selectedClassId = selection?.kind === 'classAttribute' || selection?.kind === 'classMethod'
    ? selection.parentId
    : selection?.kind === 'class'
      ? selection.id
      : undefined;
  const selectedClass = classDiagram && selectedClassId
    ? classDiagram.classes.find((entity) => entity.id === selectedClassId) ?? null
    : null;
  const selectedClassRelation = selection?.kind === 'relation' && selection.sourceView === 'classDiagram' && classDiagram
    ? classDiagram.relations.find((relation) => relation.id === selection.id) ?? null
    : null;
  const selectedDomain = selection?.kind === 'domain'
    ? domains.find((domain) => domain.id === selection.id) ?? null
    : null;
  const selectedDiagram = selection?.kind === 'diagram'
    ? project.documents.find((document) => document.id === selection.id) ?? null
    : null;

  const applySchema = (schema: ProjectData['schema']) => {
    const nextProject = withSchema(project, schema);
    onProjectChange(nextProject);
    return nextProject;
  };

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    let updatedTable: Table | null = null;
    const schema = {
      ...project.schema,
      tables: project.schema.tables.map((table) => {
        if (table.id !== tableId) return table;
        updatedTable = { ...table, ...updates };
        return updatedTable;
      }),
    };
    applySchema(schema);
    if (updatedTable) saveObjectMetadata(project, tableId, updatedTable);
  };

  const createErdRelation = (relation: Relation) => {
    createErdRelationInView(project.id, project.semantic?.erd, relation);
  };

  const deleteRelation = (relationId: string, sourceView: 'erd' | 'classDiagram') => {
    const binding = sourceView === 'erd'
      ? project.semantic?.erd
      : project.semantic?.classDiagram;
    deleteRelationFromSemanticView(project.id, binding, relationId);
  };

  const updateRelations = (relations: Relation[]) => {
    const nextRelationIds = new Set(relations.map((relation) => relation.id));
    const currentRelationIds = new Set(project.schema.relations.map((relation) => relation.id));
    project.schema.relations
      .filter((relation) => !nextRelationIds.has(relation.id))
      .forEach((relation) => deleteRelation(relation.id, 'erd'));
    relations
      .filter((relation) => !currentRelationIds.has(relation.id))
      .forEach(createErdRelation);

    applySchema({ ...project.schema, relations });
  };

  const updateEnum = (enumId: string, updates: Partial<Omit<EnumType, 'id'>>) => {
    let updatedEnum: EnumType | null = null;
    const schema = {
      ...project.schema,
      enums: project.schema.enums.map((enumType) => {
        if (enumType.id !== enumId) return enumType;
        updatedEnum = { ...enumType, ...updates };
        return updatedEnum;
      }),
    };
    applySchema(schema);
    if (updatedEnum) saveObjectMetadata(project, enumId, updatedEnum);
  };

  const updateJsonSchema = (docId: string, updates: Partial<Omit<JsonSchemaDocument, 'id'>>) => {
    let updatedDocument: JsonSchemaDocument | null = null;
    const schema = {
      ...project.schema,
      jsonSchemas: (project.schema.jsonSchemas ?? []).map((doc) => {
        if (doc.id !== docId) return doc;
        updatedDocument = { ...doc, ...updates };
        return updatedDocument;
      }),
    };
    applySchema(schema);
    if (updatedDocument) saveObjectMetadata(project, docId, updatedDocument);
  };

  const updateClass = (classId: string, updates: Partial<ClassEntity>) => {
    const result = updateClassInProject(project, classId, updates);
    onProjectChange(result.project);
    if (result.entity) saveObjectMetadata(project, classId, result.entity);
  };

  const deleteClass = (classId: string) => {
    if (!classDiagram) return;
    const nextDiagram = {
      ...classDiagram,
      classes: classDiagram.classes.filter((entity) => entity.id !== classId),
      relations: classDiagram.relations.filter((relation) => relation.fromClassId !== classId && relation.toClassId !== classId),
    };
    onProjectChange(withClassDiagram(project, nextDiagram));
    onSelectionChange?.(null);

    const binding = getObjectBinding(project, classId);
    if (binding) {
      void deleteObjectFromViewCommand(project.id, {
        objectId: binding.objectId,
        viewId: project.semantic?.classDiagram?.viewId,
      }).catch((error) => {
        console.error('[workspace] Failed to delete class object', error);
      });
    }
  };

  const updateClassRelation = (relationId: string, updates: Partial<ClassRelation>) => {
    if (!classDiagram) return;
    const relations = classDiagram.relations.map((relation) => (
      relation.id === relationId ? { ...relation, ...updates } : relation
    ));
    const updatedRelation = relations.find((relation) => relation.id === relationId);
    onProjectChange(withClassDiagram(project, {
      ...classDiagram,
      relations,
    }));
    const binding = getRelationBinding(project, relationId, 'classDiagram');
    if (binding && updatedRelation) {
      void updateRelationCommand(project.id, {
        relationId: binding.relationId,
        legacyRelationId: updatedRelation.id,
        type: updatedRelation.type,
        metadata: { ...updatedRelation },
      }).catch((error) => {
        console.error('[workspace] Failed to update class relation', error);
      });
    } else if (updatedRelation) {
      void updateRelationCommand(project.id, {
        legacyRelationId: updatedRelation.id,
        type: updatedRelation.type,
        metadata: { ...updatedRelation },
      }).catch((error) => {
        console.error('[workspace] Failed to update class relation', error);
      });
    }
  };

  const deleteClassRelation = (relationId: string) => {
    if (!classDiagram) return;
    onProjectChange(withClassDiagram(project, {
      ...classDiagram,
      relations: classDiagram.relations.filter((relation) => relation.id !== relationId),
    }));
    onSelectionChange?.(null);
    deleteRelation(relationId, 'classDiagram');
  };

  const updateDomain = (domainId: string, updates: Partial<Omit<Domain, 'id'>>) => {
    const nextDomains = domains.map((domain) => domain.id === domainId ? { ...domain, ...updates } : domain);
    const schema = { ...project.schema, domains: nextDomains };
    onProjectChange(withSchema(project, schema));
    const updatedDomain = nextDomains.find((domain) => domain.id === domainId);
    if (updatedDomain) saveObjectMetadata(project, domainId, updatedDomain);
  };

  const updateDocument = (documentId: string, updates: Partial<ProjectDocument>) => {
    onProjectChange({
      ...project,
      documents: project.documents.map((document) => (
        document.id === documentId ? { ...document, ...updates, updatedAt: new Date().toISOString() } as ProjectDocument : document
      )),
    });
  };

  if (selectedTable) {
    return (
      <TableProperties
        project={project}
        table={selectedTable}
        domains={domains}
        onUpdateTable={updateTable}
        onUpdateRelations={updateRelations}
        onApplySchema={applySchema}
      />
    );
  }

  if (selectedEnum) {
    return (
      <EnumProperties
        project={project}
        enumType={selectedEnum}
        domains={domains}
        onUpdateEnum={updateEnum}
      />
    );
  }

  if (selectedJsonSchema) {
    return (
      <JsonSchemaProperties
        project={project}
        doc={selectedJsonSchema}
        domains={domains}
        onUpdateJsonSchema={updateJsonSchema}
      />
    );
  }

  if (selectedClass && classDiagram) {
    return (
      <ClassModelPropertiesPane
        entity={selectedClass}
        selectedMemberId={selection?.parentId === selectedClass.id ? selection.id : undefined}
        selectedMemberKind={selection?.parentId === selectedClass.id ? selection.kind : undefined}
        domains={classDiagram.domains.length > 0 ? classDiagram.domains : domains}
        tables={project.schema.tables}
        onUpdate={(updates) => updateClass(selectedClass.id, updates)}
        onDelete={() => deleteClass(selectedClass.id)}
      />
    );
  }

  if (selectedClassRelation && classDiagram) {
    return (
      <ClassRelationPropertiesPane
        relation={selectedClassRelation}
        classes={classDiagram.classes}
        onUpdate={(updates) => updateClassRelation(selectedClassRelation.id, updates)}
        onDelete={() => deleteClassRelation(selectedClassRelation.id)}
      />
    );
  }

  if (selectedDomain) {
    return (
      <ObjectSummaryPane
        title={selectedDomain.name}
        subtitle="Domain"
        rows={[
          ['ID', selectedDomain.id],
          ['Tables', project.schema.tables.filter((table) => table.domainId === selectedDomain.id).length],
          ['Color', selectedDomain.color],
        ]}
        editableName={selectedDomain.name}
        onNameChange={(name) => updateDomain(selectedDomain.id, { name })}
      />
    );
  }

  if (selectedDiagram) {
    return (
      <ObjectSummaryPane
        title={selectedDiagram.name}
        subtitle="Diagram view"
        rows={[
          ['Type', selectedDiagram.type],
          ['Created', selectedDiagram.createdAt],
          ['Updated', selectedDiagram.updatedAt],
        ]}
        editableName={selectedDiagram.name}
        editableDescription={selectedDiagram.description ?? ''}
        onNameChange={(name) => updateDocument(selectedDiagram.id, { name } as Partial<ProjectDocument>)}
        onDescriptionChange={(description) => updateDocument(selectedDiagram.id, { description } as Partial<ProjectDocument>)}
      />
    );
  }

  const selectedProperties = getSelectedProperties(project, selection);

  if (!selectedProperties) {
    return (
      <div className="h-full overflow-auto p-4">
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
          Select an object to inspect its properties
        </div>
      </div>
    );
  }

  return <ObjectSummaryPane title={selectedProperties.title} subtitle={selectedProperties.subtitle} rows={selectedProperties.rows} />;
}
