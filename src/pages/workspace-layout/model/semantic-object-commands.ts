import {
  createObjectInViewCommand,
  createSemanticModelObject,
  deleteObjectFromViewCommand,
  moveViewNodeCommand,
  updateObjectCommand,
} from '@/shared/api/semantic-model';
import type {
  ProjectSemanticObjectBinding,
  ProjectSemanticViewBinding,
} from '@/shared/types/project';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function objectMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function metadataName(metadata: Record<string, unknown>): string | undefined {
  return typeof metadata.name === 'string' ? metadata.name : undefined;
}

export function metadataDescription(metadata: Record<string, unknown>): string | undefined {
  return typeof metadata.description === 'string' ? metadata.description : undefined;
}

export function metadataDomainId(metadata: Record<string, unknown>): string | undefined {
  return typeof metadata.domainId === 'string' ? metadata.domainId : undefined;
}

export function createSemanticObjectProjection({
  projectId,
  viewId,
  type,
  name,
  description,
  domainId,
  parentId,
  metadata,
  position,
}: {
  projectId: string;
  viewId?: string;
  type: string;
  name: string;
  description?: string;
  domainId?: string;
  parentId?: string;
  metadata: Record<string, unknown>;
  position?: { x: number; y: number };
}): Promise<ProjectSemanticObjectBinding> {
  if (viewId && position) {
    return createObjectInViewCommand(projectId, {
      viewId,
      type,
      name,
      description,
      domainId,
      parentId,
      metadata,
      position,
    }).then(({ object, node }) => ({
      objectId: object.id,
      viewNodeId: node.id,
      metadata: object.metadata,
    }));
  }

  return createSemanticModelObject(projectId, {
    type,
    name,
    description,
    domainId,
    parentId,
    metadata,
  }).then((object) => ({
    objectId: object.id,
    metadata: object.metadata,
  }));
}

export function updateSemanticObjectProjection({
  projectId,
  binding,
  metadata,
  name = metadataName(metadata),
  description = metadataDescription(metadata),
  domainId = metadataDomainId(metadata),
  parentId,
}: {
  projectId: string;
  binding?: ProjectSemanticObjectBinding;
  metadata: Record<string, unknown>;
  name?: string;
  description?: string;
  domainId?: string;
  parentId?: string;
}) {
  if (!binding) return;

  void updateObjectCommand(projectId, {
    objectId: binding.objectId,
    name,
    description,
    domainId,
    parentId,
    metadata,
  }).catch((error) => {
    console.error('[workspace] Failed to update semantic object', error);
  });
}

export function moveSemanticObjectProjection({
  projectId,
  semanticBinding,
  binding,
  position,
}: {
  projectId: string;
  semanticBinding?: ProjectSemanticViewBinding;
  binding?: ProjectSemanticObjectBinding;
  position: { x: number; y: number };
}) {
  if (!semanticBinding?.viewId || !binding?.viewNodeId) return;

  void moveViewNodeCommand(projectId, {
    viewId: semanticBinding.viewId,
    nodeId: binding.viewNodeId,
    ...position,
  }).catch((error) => {
    console.error('[workspace] Failed to move semantic object', error);
  });
}

export function deleteSemanticObjectProjection({
  projectId,
  semanticBinding,
  binding,
}: {
  projectId: string;
  semanticBinding?: ProjectSemanticViewBinding;
  binding?: ProjectSemanticObjectBinding;
}) {
  if (!binding) return;

  void deleteObjectFromViewCommand(projectId, {
    objectId: binding.objectId,
    viewId: semanticBinding?.viewId,
  }).catch((error) => {
    console.error('[workspace] Failed to delete semantic object', error);
  });
}
