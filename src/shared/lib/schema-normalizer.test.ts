import { describe, expect, it } from 'vitest';

import { normalizeProjectData } from './schema-normalizer';

describe('normalizeProjectData IDEF0 documents', () => {
  it('normalizes IDEF0 functions, concepts, and ICOM arrows', () => {
    const project = normalizeProjectData({
      id: 'project-1',
      name: 'Functional model',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
      domains: [{ id: 'domain-1', name: 'Customer', color: '#ef4444' }],
      schema: {
        schemaVersion: 2,
        tables: [],
        relations: [],
        domains: [],
        enums: [],
        jsonSchemas: [],
      },
      documents: [
        {
          id: 'doc-idef0',
          type: 'idef0',
          name: 'IDEF0',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
          idef0: {
            domains: [],
            functions: [
              {
                id: 'fn-1',
                name: 'Verify customer',
                status: 'active',
                position: { x: 120, y: 160 },
                domainId: 'domain-1',
              },
            ],
            concepts: [
              {
                id: 'concept-1',
                name: 'Email',
                kind: 'information_object',
                status: 'active',
              },
            ],
            arrows: [
              {
                id: 'arrow-1',
                role: 'input',
                source: { kind: 'concept', id: 'concept-1' },
                target: { kind: 'function', id: 'fn-1' },
                status: 'required',
              },
            ],
          },
        },
      ],
    });

    const document = project?.documents[0];

    expect(document?.type).toBe('idef0');
    if (document?.type !== 'idef0') throw new Error('Expected IDEF0 document');
    expect(document.idef0.functions[0]).toMatchObject({
      id: 'fn-1',
      name: 'Verify customer',
      status: 'active',
      domainId: 'domain-1',
    });
    expect(document.idef0.concepts[0]).toMatchObject({
      id: 'concept-1',
      kind: 'information_object',
      status: 'active',
    });
    expect(document.idef0.arrows[0]).toMatchObject({
      id: 'arrow-1',
      role: 'input',
      status: 'required',
    });
  });

  it('drops IDEF0 arrows with missing endpoints', () => {
    const project = normalizeProjectData({
      id: 'project-1',
      name: 'Functional model',
      createdAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
      schema: {
        schemaVersion: 2,
        tables: [],
        relations: [],
        domains: [],
        enums: [],
        jsonSchemas: [],
      },
      documents: [
        {
          id: 'doc-idef0',
          type: 'idef0',
          name: 'IDEF0',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
          idef0: {
            functions: [],
            concepts: [],
            arrows: [
              {
                id: 'arrow-1',
                role: 'output',
                source: { kind: 'function', id: 'missing-fn' },
                target: { kind: 'boundary' },
                status: 'required',
              },
            ],
          },
        },
      ],
    });

    const document = project?.documents[0];

    expect(document?.type).toBe('idef0');
    if (document?.type !== 'idef0') throw new Error('Expected IDEF0 document');
    expect(document.idef0.arrows).toEqual([]);
  });
});
