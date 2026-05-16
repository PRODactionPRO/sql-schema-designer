import { describe, expect, it } from 'vitest';
import type { ClassDiagramModel } from '@/shared/types/project';
import type { Table } from '@/shared/types/schema';
import { moveArrayItem, reorderClassMembers, reorderTableFields } from './workspace-canvas-utils';

describe('workspace canvas utils', () => {
  it('moves an array item without mutating the source array', () => {
    const source = ['id', 'name', 'email'];

    expect(moveArrayItem(source, 0, 2)).toEqual(['name', 'email', 'id']);
    expect(source).toEqual(['id', 'name', 'email']);
  });

  it('reorders table fields inside the requested table only', () => {
    const tables: Table[] = [
      {
        id: 'users',
        name: 'users',
        fields: [
          { id: 'id', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isForeignKey: false },
          { id: 'email', name: 'email', type: 'text', isPrimaryKey: false, isNullable: false, isForeignKey: false },
          { id: 'name', name: 'name', type: 'text', isPrimaryKey: false, isNullable: true, isForeignKey: false },
        ],
        position: { x: 0, y: 0 },
      },
      {
        id: 'posts',
        name: 'posts',
        fields: [
          { id: 'post-id', name: 'id', type: 'uuid', isPrimaryKey: true, isNullable: false, isForeignKey: false },
        ],
        position: { x: 200, y: 0 },
      },
    ];

    const next = reorderTableFields(tables, 'users', 2, 1);

    expect(next[0]?.fields.map((field) => field.id)).toEqual(['id', 'name', 'email']);
    expect(next[1]?.fields.map((field) => field.id)).toEqual(['post-id']);
    expect(tables[0]?.fields.map((field) => field.id)).toEqual(['id', 'email', 'name']);
  });

  it('reorders class attributes and leaves methods untouched', () => {
    const diagram: ClassDiagramModel = {
      domains: [],
      classes: [{
        id: 'class-user',
        name: 'User',
        kind: 'class',
        position: { x: 10, y: 20 },
        attributes: [
          { id: 'attr-id', name: 'id', type: 'string', visibility: 'public' },
          { id: 'attr-email', name: 'email', type: 'string', visibility: 'public' },
        ],
        methods: [
          { id: 'method-create', name: 'create', returnType: 'void', visibility: 'public' },
        ],
      }],
      relations: [],
    };

    const next = reorderClassMembers(diagram, 'class-user', 'attributes', 0, 1);

    expect(next.classes[0]?.attributes.map((attribute) => attribute.id)).toEqual(['attr-email', 'attr-id']);
    expect(next.classes[0]?.methods.map((method) => method.id)).toEqual(['method-create']);
    expect(diagram.classes[0]?.attributes.map((attribute) => attribute.id)).toEqual(['attr-id', 'attr-email']);
  });
});
