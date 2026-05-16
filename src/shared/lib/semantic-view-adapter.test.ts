import { describe, expect, it } from 'vitest';
import {
  applySemanticClassViewToProject,
  applySemanticErdViewToProject,
  semanticClassViewToClassDiagram,
  semanticErdViewToProjectSchema,
} from './semantic-view-adapter';
import type { ClassDiagramModel, ProjectData, ProjectSchemaModel } from '@/shared/types/project';
import type { Field, Table } from '@/shared/types/schema';
import { DEFAULT_PROJECT_SETTINGS } from '@/shared/types/schema';
import type { SemanticErdViewPayload, SemanticModelObject, SemanticViewNode } from '@/shared/types/semantic-model';

const now = '2026-05-13T18:00:00.000Z';

function field(id: string, name: string): Field {
  return {
    id,
    name,
    type: 'uuid',
    isPrimaryKey: name === 'id',
    isNullable: false,
    isForeignKey: false,
  };
}

function modelObject(partial: Partial<SemanticModelObject> & Pick<SemanticModelObject, 'id' | 'type' | 'name'>): SemanticModelObject {
  return {
    projectId: 'project-1',
    slug: null,
    description: null,
    domainId: null,
    parentId: null,
    status: 'active',
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

function viewNode(object: SemanticModelObject, x: number, y: number): SemanticViewNode {
  return {
    id: `node-${object.id}`,
    viewId: 'view-1',
    objectId: object.id,
    x,
    y,
    width: null,
    height: null,
    collapsed: false,
    visible: true,
    style: {},
    settings: {},
    object,
  };
}

const fallbackSchema: ProjectSchemaModel = {
  schemaVersion: 2,
  tables: [],
  relations: [],
  domains: [],
  enums: [],
  jsonSchemas: [],
};

describe('semantic view adapter', () => {
  it('maps semantic ERD view nodes and edges back to the existing canvas schema', () => {
    const usersTable: Table = {
      id: 'table-users',
      name: 'users',
      fields: [field('users-id', 'id')],
      position: { x: 10, y: 20 },
      domainId: 'domain-core',
    };
    const postsTable: Table = {
      id: 'table-posts',
      name: 'posts',
      fields: [field('posts-id', 'id'), field('posts-user-id', 'user_id')],
      position: { x: 30, y: 40 },
      domainId: 'domain-core',
    };
    const domain = modelObject({
      id: 'model:project-1:domain:domain-core',
      type: 'domain',
      name: 'Core',
      metadata: { id: 'domain-core', name: 'Core', color: '#ef4444' },
    });
    const usersObject = modelObject({
      id: 'model:project-1:table:table-users',
      type: 'table',
      name: 'users',
      metadata: usersTable,
    });
    const postsObject = modelObject({
      id: 'model:project-1:table:table-posts',
      type: 'table',
      name: 'posts',
      metadata: postsTable,
    });
    const usersNode = viewNode(usersObject, 120, 160);
    const postsNode = viewNode(postsObject, 440, 160);
    const payload: SemanticErdViewPayload = {
      view: {
        id: 'view-1',
        projectId: 'project-1',
        type: 'erd',
        name: 'Primary ERD',
        description: null,
        scope: {},
        filters: {},
        settings: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        nodes: [usersNode, postsNode],
        edges: [{
          id: 'edge-1',
          viewId: 'view-1',
          relationId: 'relation-1',
          sourceViewNodeId: postsNode.id,
          targetViewNodeId: usersNode.id,
          isModelRelation: true,
          routing: null,
          visible: true,
          style: {},
          sourceViewNode: postsNode,
          targetViewNode: usersNode,
          relation: {
            id: 'relation-1',
            projectId: 'project-1',
            sourceObjectId: postsObject.id,
            targetObjectId: usersObject.id,
            type: 'references',
            direction: 'directed',
            cardinalitySource: null,
            cardinalityTarget: null,
            required: false,
            metadata: {
              id: 'relation-posts-users',
              fromTableId: 'table-posts',
              fromFieldId: 'posts-user-id',
              toTableId: 'table-users',
              toFieldId: 'users-id',
              type: '1:N',
            },
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        }],
      },
      context: {
        objects: [domain],
      },
    };

    const schema = semanticErdViewToProjectSchema(payload, fallbackSchema);

    expect(schema.domains).toEqual([{ id: 'domain-core', name: 'Core', color: '#ef4444' }]);
    expect(schema.tables.map((table) => [table.id, table.position])).toEqual([
      ['table-users', { x: 120, y: 160 }],
      ['table-posts', { x: 440, y: 160 }],
    ]);
    expect(schema.relations).toEqual([{
      id: 'relation-posts-users',
      fromTableId: 'table-posts',
      fromFieldId: 'posts-user-id',
      toTableId: 'table-users',
      toFieldId: 'users-id',
      type: '1:N',
    }]);
  });

  it('applies the semantic schema to the workspace project without dropping documents', () => {
    const project: ProjectData = {
      id: 'project-1',
      name: 'Project',
      createdAt: now,
      updatedAt: now,
      domains: [],
      schema: fallbackSchema,
      documents: [{
        id: 'doc-1',
        name: 'ERD',
        type: 'erd',
        createdAt: now,
        updatedAt: now,
        erd: fallbackSchema,
      }],
      settings: DEFAULT_PROJECT_SETTINGS,
    };
    const tableObject = modelObject({
      id: 'model:project-1:table:table-users',
      type: 'table',
      name: 'users',
      metadata: {
        id: 'table-users',
        name: 'users',
        fields: [field('users-id', 'id')],
      },
    });
    const payload: SemanticErdViewPayload = {
      view: {
        id: 'view-1',
        projectId: 'project-1',
        type: 'erd',
        name: 'Primary ERD',
        description: null,
        scope: {},
        filters: {},
        settings: {},
        createdAt: now,
        updatedAt: '2026-05-13T19:00:00.000Z',
        deletedAt: null,
        nodes: [viewNode(tableObject, 10, 20)],
        edges: [],
      },
      context: { objects: [] },
    };

    const adapted = applySemanticErdViewToProject(project, payload);

    expect(adapted?.schema.tables).toHaveLength(1);
    expect(adapted?.documents).toHaveLength(1);
    expect(adapted?.documents[0]?.updatedAt).toBe('2026-05-13T19:00:00.000Z');
    expect(adapted?.semantic?.erd).toEqual({
      viewId: 'view-1',
      objectsByLegacyId: {
        'table-users': {
          objectId: 'model:project-1:table:table-users',
          viewNodeId: 'node-model:project-1:table:table-users',
          metadata: {
            id: 'table-users',
            name: 'users',
            fields: [field('users-id', 'id')],
          },
        },
      },
    });
  });

  it('maps semantic class diagram views back to class diagram documents', () => {
    const fallbackDiagram: ClassDiagramModel = {
      classes: [],
      relations: [],
      domains: [],
    };
    const sourceClass = modelObject({
      id: 'model:project-1:class:class-order',
      type: 'entity',
      name: 'Order',
      metadata: {
        id: 'class-order',
        name: 'Order',
        kind: 'class',
        attributes: [{ id: 'attribute-id', name: 'id', type: 'string', visibility: 'public' }],
        methods: [{ id: 'method-create', name: 'create', returnType: 'void', visibility: 'public' }],
      },
    });
    const targetClass = modelObject({
      id: 'model:project-1:class:class-customer',
      type: 'entity',
      name: 'Customer',
      metadata: {
        id: 'class-customer',
        name: 'Customer',
        kind: 'class',
        attributes: [],
        methods: [],
      },
    });
    const sourceNode = viewNode(sourceClass, 20, 40);
    const targetNode = viewNode(targetClass, 360, 40);
    const payload = {
      view: {
        id: 'view-class',
        projectId: 'project-1',
        type: 'class_diagram',
        name: 'Class Diagram',
        description: null,
        scope: {},
        filters: {},
        settings: {},
        createdAt: now,
        updatedAt: '2026-05-13T20:00:00.000Z',
        deletedAt: null,
        nodes: [sourceNode, targetNode],
        edges: [{
          id: 'edge-class',
          viewId: 'view-class',
          relationId: 'relation-class',
          sourceViewNodeId: sourceNode.id,
          targetViewNodeId: targetNode.id,
          isModelRelation: true,
          routing: null,
          visible: true,
          style: {},
          sourceViewNode: sourceNode,
          targetViewNode: targetNode,
          relation: {
            id: 'relation-class',
            projectId: 'project-1',
            sourceObjectId: sourceClass.id,
            targetObjectId: targetClass.id,
            type: 'association',
            direction: 'directed',
            cardinalitySource: null,
            cardinalityTarget: null,
            required: false,
            metadata: {
              id: 'class-relation-order-customer',
              fromClassId: 'class-order',
              toClassId: 'class-customer',
              type: 'association',
              label: 'belongs to',
            },
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        }],
      },
      context: {
        objects: [],
      },
    };

    const diagram = semanticClassViewToClassDiagram(payload, fallbackDiagram);

    expect(diagram.classes.map((entity) => [entity.id, entity.position])).toEqual([
      ['class-order', { x: 20, y: 40 }],
      ['class-customer', { x: 360, y: 40 }],
    ]);
    expect(diagram.relations).toEqual([{
      id: 'class-relation-order-customer',
      fromClassId: 'class-order',
      toClassId: 'class-customer',
      type: 'association',
      label: 'belongs to',
      description: undefined,
      fromRole: undefined,
      toRole: undefined,
      fromMultiplicity: undefined,
      toMultiplicity: undefined,
    }]);

    const project: ProjectData = {
      id: 'project-1',
      name: 'Project',
      createdAt: now,
      updatedAt: now,
      domains: [],
      schema: fallbackSchema,
      documents: [{
        id: 'doc-class',
        name: 'Class Diagram',
        type: 'class-diagram',
        createdAt: now,
        updatedAt: now,
        classDiagram: fallbackDiagram,
      }],
      settings: DEFAULT_PROJECT_SETTINGS,
    };

    const adapted = applySemanticClassViewToProject(project, payload);
    expect(adapted?.documents[0]?.updatedAt).toBe('2026-05-13T20:00:00.000Z');
    expect(adapted?.semantic?.classDiagram?.viewId).toBe('view-class');
    expect(adapted?.semantic?.classDiagram?.objectsByLegacyId['class-order']).toMatchObject({
      objectId: 'model:project-1:class:class-order',
      viewNodeId: 'node-model:project-1:class:class-order',
    });
    expect(adapted?.semantic?.classDiagram?.relationsByLegacyId?.['class-relation-order-customer']).toMatchObject({
      relationId: 'relation-class',
      viewEdgeId: 'edge-class',
    });
  });
});
