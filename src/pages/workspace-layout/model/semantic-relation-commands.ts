import {
  createRelationInViewCommand,
  deleteRelationFromViewCommand,
} from '@/shared/api/semantic-model';
import type {
  ProjectSemanticRelationBinding,
  ProjectSemanticViewBinding,
} from '@/shared/types/project';
import type { Relation } from '@/shared/types/schema';

const relationBindingCache = new Map<string, ProjectSemanticRelationBinding>();
const pendingRelationCreates = new Map<string, Promise<ProjectSemanticRelationBinding | null>>();

function relationKey(projectId: string, viewId: string, legacyRelationId: string) {
  return `${projectId}:${viewId}:${legacyRelationId}`;
}

function getRelationBinding(
  projectId: string,
  semanticBinding: ProjectSemanticViewBinding | undefined,
  legacyRelationId: string,
) {
  if (!semanticBinding?.viewId) return undefined;
  return semanticBinding.relationsByLegacyId?.[legacyRelationId]
    ?? relationBindingCache.get(relationKey(projectId, semanticBinding.viewId, legacyRelationId));
}

export function createErdRelationInView(
  projectId: string,
  semanticBinding: ProjectSemanticViewBinding | undefined,
  relation: Relation,
) {
  const sourceBinding = semanticBinding?.objectsByLegacyId[relation.fromTableId];
  const targetBinding = semanticBinding?.objectsByLegacyId[relation.toTableId];
  if (!semanticBinding?.viewId || !sourceBinding?.viewNodeId || !targetBinding?.viewNodeId) return;

  const key = relationKey(projectId, semanticBinding.viewId, relation.id);
  if (pendingRelationCreates.has(key) || relationBindingCache.has(key)) return;

  const pending = createRelationInViewCommand(projectId, {
    viewId: semanticBinding.viewId,
    sourceViewNodeId: sourceBinding.viewNodeId,
    targetViewNodeId: targetBinding.viewNodeId,
    type: 'references',
    direction: 'directed',
    cardinalitySource: relation.type === '1:1' ? 'one' : 'many',
    cardinalityTarget: 'one',
    required: false,
    metadata: { ...relation },
  })
    .then(({ relation: modelRelation, edge }) => {
      const binding: ProjectSemanticRelationBinding = {
        relationId: modelRelation.id,
        viewEdgeId: edge.id,
        metadata: modelRelation.metadata,
      };
      relationBindingCache.set(key, binding);
      return binding;
    })
    .catch((error) => {
      console.error('[workspace] Failed to create ERD relation', error);
      return null;
    })
    .finally(() => {
      pendingRelationCreates.delete(key);
    });

  pendingRelationCreates.set(key, pending);
}

export function deleteRelationFromSemanticView(
  projectId: string,
  semanticBinding: ProjectSemanticViewBinding | undefined,
  legacyRelationId: string,
) {
  if (!semanticBinding?.viewId) return;

  const key = relationKey(projectId, semanticBinding.viewId, legacyRelationId);
  const binding = getRelationBinding(projectId, semanticBinding, legacyRelationId);

  const deleteBinding = (resolvedBinding: ProjectSemanticRelationBinding | null | undefined) => {
    void deleteRelationFromViewCommand(projectId, {
      relationId: resolvedBinding?.relationId,
      legacyRelationId,
      viewId: semanticBinding.viewId,
    })
      .then(() => {
        relationBindingCache.delete(key);
      })
      .catch((error) => {
        console.error('[workspace] Failed to delete relation', error);
      });
  };

  if (binding) {
    deleteBinding(binding);
    return;
  }

  const pendingCreate = pendingRelationCreates.get(key);
  if (pendingCreate) {
    void pendingCreate.then(deleteBinding);
    return;
  }

  deleteBinding(null);
}
