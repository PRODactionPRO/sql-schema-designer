import {
  createRelationInViewCommand,
  deleteRelationFromViewCommand,
  updateRelationCommand,
} from '@/shared/api/semantic-model';
import type {
  ClassRelation,
  ProjectSemanticObjectBinding,
  ProjectSemanticRelationBinding,
  ProjectSemanticViewBinding,
} from '@/shared/types/project';
import type { Relation } from '@/shared/types/schema';

const relationBindingCache = new Map<string, ProjectSemanticRelationBinding>();
const pendingRelationCreates = new Map<string, Promise<ProjectSemanticRelationBinding | null>>();

function relationKey(projectId: string, viewId: string, legacyRelationId: string) {
  return `${projectId}:${viewId}:${legacyRelationId}`;
}

function relationSemanticKey(
  projectId: string,
  viewId: string,
  sourceViewNodeId: string,
  targetViewNodeId: string,
  type: string,
  signature: string,
) {
  return `${projectId}:${viewId}:${sourceViewNodeId}:${targetViewNodeId}:${type}:${signature}`;
}

function erdRelationSignature(relation: Relation) {
  return [
    relation.fromTableId,
    relation.fromFieldId,
    relation.toTableId,
    relation.toFieldId,
    relation.type,
  ].join(':');
}

function classRelationSignature(relation: ClassRelation) {
  return [
    relation.fromClassId,
    relation.toClassId,
    relation.type,
  ].join(':');
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

function deleteCachedRelationBinding(key: string, binding?: ProjectSemanticRelationBinding | null) {
  relationBindingCache.delete(key);
  if (!binding) return;

  for (const [cacheKey, cachedBinding] of relationBindingCache.entries()) {
    if (cachedBinding.relationId === binding.relationId) {
      relationBindingCache.delete(cacheKey);
    }
  }
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
  const semanticKey = relationSemanticKey(
    projectId,
    semanticBinding.viewId,
    sourceBinding.viewNodeId,
    targetBinding.viewNodeId,
    'references',
    erdRelationSignature(relation),
  );
  if (
    pendingRelationCreates.has(key)
    || pendingRelationCreates.has(semanticKey)
    || relationBindingCache.has(key)
    || relationBindingCache.has(semanticKey)
  ) return;

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
      relationBindingCache.set(semanticKey, binding);
      return binding;
    })
    .catch((error) => {
      console.error('[workspace] Failed to create ERD relation', error);
      return null;
    })
    .finally(() => {
      pendingRelationCreates.delete(key);
      pendingRelationCreates.delete(semanticKey);
    });

  pendingRelationCreates.set(key, pending);
  pendingRelationCreates.set(semanticKey, pending);
}

export function createClassRelationInView(
  projectId: string,
  semanticBinding: ProjectSemanticViewBinding | undefined,
  relation: ClassRelation,
  sourceBinding?: ProjectSemanticObjectBinding,
  targetBinding?: ProjectSemanticObjectBinding,
) {
  const resolvedSourceBinding = sourceBinding ?? semanticBinding?.objectsByLegacyId[relation.fromClassId];
  const resolvedTargetBinding = targetBinding ?? semanticBinding?.objectsByLegacyId[relation.toClassId];
  if (!semanticBinding?.viewId || !resolvedSourceBinding?.viewNodeId || !resolvedTargetBinding?.viewNodeId) return;

  const key = relationKey(projectId, semanticBinding.viewId, relation.id);
  const semanticKey = relationSemanticKey(
    projectId,
    semanticBinding.viewId,
    resolvedSourceBinding.viewNodeId,
    resolvedTargetBinding.viewNodeId,
    relation.type,
    classRelationSignature(relation),
  );
  if (
    pendingRelationCreates.has(key)
    || pendingRelationCreates.has(semanticKey)
    || relationBindingCache.has(key)
    || relationBindingCache.has(semanticKey)
  ) return;

  const pending = createRelationInViewCommand(projectId, {
    viewId: semanticBinding.viewId,
    sourceViewNodeId: resolvedSourceBinding.viewNodeId,
    targetViewNodeId: resolvedTargetBinding.viewNodeId,
    type: relation.type,
    direction: 'directed',
    cardinalitySource: relation.fromMultiplicity,
    cardinalityTarget: relation.toMultiplicity,
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
      relationBindingCache.set(semanticKey, binding);
      return binding;
    })
    .catch((error) => {
      console.error('[workspace] Failed to create class relation', error);
      return null;
    })
    .finally(() => {
      pendingRelationCreates.delete(key);
      pendingRelationCreates.delete(semanticKey);
    });

  pendingRelationCreates.set(key, pending);
  pendingRelationCreates.set(semanticKey, pending);
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
        deleteCachedRelationBinding(key, resolvedBinding);
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

export function updateErdRelationInView(
  projectId: string,
  semanticBinding: ProjectSemanticViewBinding | undefined,
  relation: Relation,
) {
  if (!semanticBinding?.viewId) return;

  const key = relationKey(projectId, semanticBinding.viewId, relation.id);
  const binding = getRelationBinding(projectId, semanticBinding, relation.id);

  const updateBinding = (resolvedBinding: ProjectSemanticRelationBinding | null | undefined) => {
    void updateRelationCommand(projectId, {
      relationId: resolvedBinding?.relationId,
      legacyRelationId: relation.id,
      type: 'references',
      cardinalitySource: relation.type === '1:1' ? 'one' : 'many',
      cardinalityTarget: 'one',
      required: false,
      metadata: { ...relation },
    })
      .then((modelRelation) => {
        const nextBinding: ProjectSemanticRelationBinding = {
          relationId: modelRelation.id,
          viewEdgeId: resolvedBinding?.viewEdgeId,
          metadata: modelRelation.metadata,
        };
        relationBindingCache.set(key, nextBinding);
      })
      .catch((error) => {
        console.error('[workspace] Failed to update ERD relation', error);
      });
  };

  if (binding) {
    updateBinding(binding);
    return;
  }

  const pendingCreate = pendingRelationCreates.get(key);
  if (pendingCreate) {
    void pendingCreate.then(updateBinding);
    return;
  }

  updateBinding(null);
}
