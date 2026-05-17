import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type { CreateModelObjectDto } from './dto/create-model-object.dto';
import type {
  CreateRelationCommandDto,
  CreateObjectInViewCommandDto,
  CreateRelationInViewCommandDto,
  CreateSemanticViewCommandDto,
  DeleteObjectFromViewCommandDto,
  DeleteRelationFromViewCommandDto,
  MoveViewNodeCommandDto,
  UpdateObjectCommandDto,
  UpdateRelationCommandDto,
} from './dto/semantic-command.dto';
import type { UpdateModelObjectMetadataDto } from './dto/update-model-object-metadata.dto';
import type { UpdateViewNodePositionDto } from './dto/update-view-node-position.dto';

const ERD_CONTEXT_OBJECT_TYPES = ['domain'];
const CLASS_DIAGRAM_CONTEXT_OBJECT_TYPES = ['domain', 'class_attribute'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

@Injectable()
export class SemanticModelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getPrimaryErdView(projectId: string, ownerId: string) {
    return this.getPrimaryView(
      projectId,
      ownerId,
      'erd',
      ERD_CONTEXT_OBJECT_TYPES,
    );
  }

  async getPrimaryClassDiagramView(projectId: string, ownerId: string) {
    return this.getPrimaryView(
      projectId,
      ownerId,
      'class_diagram',
      CLASS_DIAGRAM_CONTEXT_OBJECT_TYPES,
    );
  }

  async updateViewNodePosition(
    projectId: string,
    ownerId: string,
    viewId: string,
    nodeId: string,
    dto: UpdateViewNodePositionDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    const currentNode = await this.prisma.viewNode.findFirst({
      where: {
        id: nodeId,
        viewId,
        view: {
          is: {
            projectId,
            deletedAt: null,
          },
        },
      },
    });

    if (!currentNode) {
      throw new NotFoundException('View node not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedNode = await tx.viewNode.update({
        where: { id: nodeId },
        data: {
          x: dto.x,
          y: dto.y,
        },
        include: { object: true },
      });

      await tx.modelView.update({
        where: { id: viewId },
        data: { updatedAt: new Date() },
      });

      return updatedNode;
    });
  }

  async updateModelObjectMetadata(
    projectId: string,
    ownerId: string,
    objectId: string,
    dto: UpdateModelObjectMetadataDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    const currentObject = await this.prisma.modelObject.findFirst({
      where: {
        id: objectId,
        projectId,
        deletedAt: null,
      },
    });

    if (!currentObject) {
      throw new NotFoundException('Model object not found');
    }

    return this.prisma.modelObject.update({
      where: { id: objectId },
      data: {
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async createModelObject(
    projectId: string,
    ownerId: string,
    dto: CreateModelObjectDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.modelObject.create({
      data: {
        projectId,
        type: dto.type,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        domainId: dto.domainId,
        parentId: dto.parentId,
        status: dto.status ?? 'active',
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async deleteModelObject(
    projectId: string,
    ownerId: string,
    objectId: string,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    const currentObject = await this.prisma.modelObject.findFirst({
      where: {
        id: objectId,
        projectId,
        deletedAt: null,
      },
    });

    if (!currentObject) {
      throw new NotFoundException('Model object not found');
    }

    return this.prisma.modelObject.update({
      where: { id: objectId },
      data: { deletedAt: new Date() },
    });
  }

  async createViewCommand(
    projectId: string,
    ownerId: string,
    dto: CreateSemanticViewCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.modelView.create({
      data: {
        projectId,
        type: dto.type,
        name: dto.name,
        description: dto.description,
        scope: (dto.scope ?? {}) as Prisma.InputJsonValue,
        filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
        settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
      },
      include: {
        nodes: {
          include: { object: true },
        },
        edges: {
          include: {
            relation: true,
            sourceViewNode: { include: { object: true } },
            targetViewNode: { include: { object: true } },
          },
        },
      },
    });
  }

  async createObjectInViewCommand(
    projectId: string,
    ownerId: string,
    dto: CreateObjectInViewCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findProjectViewOrThrow(projectId, dto.viewId);

    return this.prisma.$transaction(async (tx) => {
      const object = await tx.modelObject.create({
        data: {
          projectId,
          type: dto.type,
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          domainId: dto.domainId,
          parentId: dto.parentId,
          status: dto.status ?? 'active',
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      const node = await tx.viewNode.create({
        data: {
          viewId: dto.viewId,
          objectId: object.id,
          x: dto.position.x,
          y: dto.position.y,
          width: dto.node?.width,
          height: dto.node?.height,
          collapsed: dto.node?.collapsed ?? false,
          visible: dto.node?.visible ?? true,
          style: (dto.node?.style ?? {}) as Prisma.InputJsonValue,
          settings: (dto.node?.settings ?? {}) as Prisma.InputJsonValue,
        },
        include: { object: true },
      });

      await this.touchView(tx, dto.viewId);

      return { object, node };
    });
  }

  async updateObjectCommand(
    projectId: string,
    ownerId: string,
    dto: UpdateObjectCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findProjectObjectOrThrow(projectId, dto.objectId);

    return this.prisma.modelObject.update({
      where: { id: dto.objectId },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        domainId: dto.domainId,
        parentId: dto.parentId,
        status: dto.status,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async moveViewNodeCommand(
    projectId: string,
    ownerId: string,
    dto: MoveViewNodeCommandDto,
  ) {
    return this.updateViewNodePosition(
      projectId,
      ownerId,
      dto.viewId,
      dto.nodeId,
      {
        x: dto.x,
        y: dto.y,
      },
    );
  }

  async deleteObjectFromViewCommand(
    projectId: string,
    ownerId: string,
    dto: DeleteObjectFromViewCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findProjectObjectOrThrow(projectId, dto.objectId);
    if (dto.viewId) await this.findProjectViewOrThrow(projectId, dto.viewId);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const nodeWhere = {
        objectId: dto.objectId,
        ...(dto.viewId ? { viewId: dto.viewId } : {}),
        view: {
          is: {
            projectId,
            deletedAt: null,
          },
        },
      };
      const nodes = await tx.viewNode.findMany({
        where: nodeWhere,
        select: { id: true, viewId: true },
      });
      const nodeIds = nodes.map((node) => node.id);

      if (nodeIds.length > 0) {
        await tx.viewEdge.updateMany({
          where: {
            OR: [
              { sourceViewNodeId: { in: nodeIds } },
              { targetViewNodeId: { in: nodeIds } },
            ],
          },
          data: { visible: false },
        });
        await tx.viewNode.updateMany({
          where: { id: { in: nodeIds } },
          data: { visible: false },
        });
      }

      let object = null;
      if (dto.deleteObject ?? true) {
        await tx.modelRelation.updateMany({
          where: {
            projectId,
            deletedAt: null,
            OR: [
              { sourceObjectId: dto.objectId },
              { targetObjectId: dto.objectId },
            ],
          },
          data: { deletedAt: now },
        });
        object = await tx.modelObject.update({
          where: { id: dto.objectId },
          data: { deletedAt: now },
        });
      }

      await Promise.all(
        [...new Set(nodes.map((node) => node.viewId))].map((viewId) =>
          this.touchView(tx, viewId),
        ),
      );

      return {
        object,
        hiddenNodeIds: nodeIds,
      };
    });
  }

  async createRelationInViewCommand(
    projectId: string,
    ownerId: string,
    dto: CreateRelationInViewCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findProjectViewOrThrow(projectId, dto.viewId);

    const [sourceNode, targetNode] = await Promise.all([
      this.findProjectViewNodeOrThrow(
        projectId,
        dto.viewId,
        dto.sourceViewNodeId,
      ),
      this.findProjectViewNodeOrThrow(
        projectId,
        dto.viewId,
        dto.targetViewNodeId,
      ),
    ]);

    return this.prisma.$transaction(async (tx) => {
      const legacyRelationId = this.getLegacyRelationId(dto.metadata);
      const existingRelationByLegacyId = legacyRelationId
        ? await this.findRelationByLegacyIdInTransaction(
            tx,
            projectId,
            legacyRelationId,
          )
        : null;
      const existingRelation =
        existingRelationByLegacyId ??
        (await this.findDuplicateRelationInTransaction(
          tx,
          projectId,
          sourceNode.objectId,
          targetNode.objectId,
          dto.type,
          dto.metadata,
        ));

      const relation = existingRelation
        ? await tx.modelRelation.update({
            where: { id: existingRelation.id },
            data: {
              sourceObjectId: sourceNode.objectId,
              targetObjectId: targetNode.objectId,
              type: dto.type,
              direction: dto.direction ?? existingRelation.direction,
              cardinalitySource: dto.cardinalitySource,
              cardinalityTarget: dto.cardinalityTarget,
              required: dto.required ?? existingRelation.required,
              metadata: (existingRelationByLegacyId
                ? (dto.metadata ?? existingRelation.metadata)
                : existingRelation.metadata) as Prisma.InputJsonValue,
            },
          })
        : await tx.modelRelation.create({
            data: {
              projectId,
              sourceObjectId: sourceNode.objectId,
              targetObjectId: targetNode.objectId,
              type: dto.type,
              direction: dto.direction ?? 'directed',
              cardinalitySource: dto.cardinalitySource,
              cardinalityTarget: dto.cardinalityTarget,
              required: dto.required ?? false,
              metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
            },
          });

      const existingEdge = await tx.viewEdge.findFirst({
        where: {
          viewId: dto.viewId,
          relationId: relation.id,
        },
      });

      const edge = existingEdge
        ? await tx.viewEdge.update({
            where: { id: existingEdge.id },
            data: {
              sourceViewNodeId: dto.sourceViewNodeId,
              targetViewNodeId: dto.targetViewNodeId,
              visible: dto.edge?.visible ?? true,
              routing: dto.edge?.routing as Prisma.InputJsonValue | undefined,
              style: dto.edge?.style
                ? (dto.edge.style as Prisma.InputJsonValue)
                : undefined,
            },
            include: {
              relation: true,
              sourceViewNode: { include: { object: true } },
              targetViewNode: { include: { object: true } },
            },
          })
        : await tx.viewEdge.create({
            data: {
              viewId: dto.viewId,
              relationId: relation.id,
              sourceViewNodeId: dto.sourceViewNodeId,
              targetViewNodeId: dto.targetViewNodeId,
              isModelRelation: true,
              visible: dto.edge?.visible ?? true,
              routing: dto.edge?.routing as Prisma.InputJsonValue | undefined,
              style: (dto.edge?.style ?? {}) as Prisma.InputJsonValue,
            },
            include: {
              relation: true,
              sourceViewNode: { include: { object: true } },
              targetViewNode: { include: { object: true } },
            },
          });

      await this.touchView(tx, dto.viewId);

      return { relation, edge };
    });
  }

  async createRelationCommand(
    projectId: string,
    ownerId: string,
    dto: CreateRelationCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await Promise.all([
      this.findProjectObjectOrThrow(projectId, dto.sourceObjectId),
      this.findProjectObjectOrThrow(projectId, dto.targetObjectId),
    ]);

    return this.prisma.$transaction(async (tx) => {
      const legacyRelationId = this.getLegacyRelationId(dto.metadata);
      const existingRelationByLegacyId = legacyRelationId
        ? await this.findRelationByLegacyIdInTransaction(
            tx,
            projectId,
            legacyRelationId,
          )
        : null;
      const existingRelation =
        existingRelationByLegacyId ??
        (await this.findDuplicateRelationInTransaction(
          tx,
          projectId,
          dto.sourceObjectId,
          dto.targetObjectId,
          dto.type,
          dto.metadata,
        ));

      if (existingRelation) {
        return tx.modelRelation.update({
          where: { id: existingRelation.id },
          data: {
            sourceObjectId: dto.sourceObjectId,
            targetObjectId: dto.targetObjectId,
            type: dto.type,
            direction: dto.direction ?? existingRelation.direction,
            cardinalitySource: dto.cardinalitySource,
            cardinalityTarget: dto.cardinalityTarget,
            required: dto.required ?? existingRelation.required,
            metadata: (existingRelationByLegacyId
              ? (dto.metadata ?? existingRelation.metadata)
              : existingRelation.metadata) as Prisma.InputJsonValue,
          },
        });
      }

      return tx.modelRelation.create({
        data: {
          projectId,
          sourceObjectId: dto.sourceObjectId,
          targetObjectId: dto.targetObjectId,
          type: dto.type,
          direction: dto.direction ?? 'directed',
          cardinalitySource: dto.cardinalitySource,
          cardinalityTarget: dto.cardinalityTarget,
          required: dto.required ?? false,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    });
  }

  async updateRelationCommand(
    projectId: string,
    ownerId: string,
    dto: UpdateRelationCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    const currentRelation = await this.findProjectRelationByReferenceOrThrow(
      projectId,
      dto.relationId,
      dto.legacyRelationId,
    );

    return this.prisma.$transaction(async (tx) => {
      const relation = await tx.modelRelation.update({
        where: { id: currentRelation.id },
        data: {
          type: dto.type,
          direction: dto.direction,
          cardinalitySource: dto.cardinalitySource,
          cardinalityTarget: dto.cardinalityTarget,
          required: dto.required,
          metadata: dto.metadata
            ? (dto.metadata as Prisma.InputJsonValue)
            : undefined,
        },
      });

      const edges = await tx.viewEdge.findMany({
        where: {
          relationId: currentRelation.id,
          view: {
            is: {
              projectId,
              deletedAt: null,
            },
          },
        },
        select: { viewId: true },
      });

      await Promise.all(
        [...new Set(edges.map((edge) => edge.viewId))].map((viewId) =>
          this.touchView(tx, viewId),
        ),
      );

      return relation;
    });
  }

  async deleteRelationFromViewCommand(
    projectId: string,
    ownerId: string,
    dto: DeleteRelationFromViewCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    const currentRelation = await this.findProjectRelationByReferenceOrThrow(
      projectId,
      dto.relationId,
      dto.legacyRelationId,
    );
    if (dto.viewId) await this.findProjectViewOrThrow(projectId, dto.viewId);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const edges = await tx.viewEdge.findMany({
        where: {
          relationId: currentRelation.id,
          ...(dto.viewId ? { viewId: dto.viewId } : {}),
          view: {
            is: {
              projectId,
              deletedAt: null,
            },
          },
        },
        select: { id: true, viewId: true },
      });
      const edgeIds = edges.map((edge) => edge.id);

      if (edgeIds.length > 0) {
        await tx.viewEdge.updateMany({
          where: { id: { in: edgeIds } },
          data: { visible: false },
        });
      }

      let relation = null;
      if (dto.deleteRelation ?? true) {
        relation = await tx.modelRelation.update({
          where: { id: currentRelation.id },
          data: { deletedAt: now },
        });
      }

      await Promise.all(
        [...new Set(edges.map((edge) => edge.viewId))].map((viewId) =>
          this.touchView(tx, viewId),
        ),
      );

      return {
        relation,
        hiddenEdgeIds: edgeIds,
      };
    });
  }

  private async getPrimaryView(
    projectId: string,
    ownerId: string,
    type: string,
    contextObjectTypes: string[],
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    const [view, contextObjects] = await Promise.all([
      this.prisma.modelView.findFirst({
        where: {
          projectId,
          type,
          deletedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          nodes: {
            where: { visible: true },
            orderBy: { id: 'asc' },
            include: { object: true },
          },
          edges: {
            where: { visible: true },
            orderBy: { id: 'asc' },
            include: {
              relation: true,
              sourceViewNode: {
                include: { object: true },
              },
              targetViewNode: {
                include: { object: true },
              },
            },
          },
        },
      }),
      this.prisma.modelObject.findMany({
        where: {
          projectId,
          deletedAt: null,
          type: { in: contextObjectTypes },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return {
      view,
      context: {
        objects: contextObjects,
      },
    };
  }

  private async findProjectViewOrThrow(projectId: string, viewId: string) {
    const view = await this.prisma.modelView.findFirst({
      where: {
        id: viewId,
        projectId,
        deletedAt: null,
      },
    });

    if (!view) {
      throw new NotFoundException('Semantic view not found');
    }

    return view;
  }

  private async findProjectObjectOrThrow(projectId: string, objectId: string) {
    const object = await this.prisma.modelObject.findFirst({
      where: {
        id: objectId,
        projectId,
        deletedAt: null,
      },
    });

    if (!object) {
      throw new NotFoundException('Model object not found');
    }

    return object;
  }

  private async findProjectRelationOrThrow(
    projectId: string,
    relationId: string,
  ) {
    const relation = await this.prisma.modelRelation.findFirst({
      where: {
        id: relationId,
        projectId,
        deletedAt: null,
      },
    });

    if (!relation) {
      throw new NotFoundException('Model relation not found');
    }

    return relation;
  }

  private async findProjectRelationByReferenceOrThrow(
    projectId: string,
    relationId?: string,
    legacyRelationId?: string,
  ) {
    if (relationId)
      return this.findProjectRelationOrThrow(projectId, relationId);

    if (!legacyRelationId) {
      throw new BadRequestException(
        'Relation id or legacy relation id is required',
      );
    }

    const relation = await this.findRelationByLegacyIdInTransaction(
      this.prisma,
      projectId,
      legacyRelationId,
    );

    if (!relation) {
      throw new NotFoundException('Model relation not found');
    }

    return relation;
  }

  private getLegacyRelationId(metadata: unknown) {
    if (!isRecord(metadata)) return undefined;
    return typeof metadata.id === 'string' && metadata.id.trim()
      ? metadata.id
      : undefined;
  }

  private getRelationDuplicateSignature(metadata: unknown) {
    if (!isRecord(metadata)) return '';

    const signatureKeys = [
      'fromTableId',
      'fromFieldId',
      'toTableId',
      'toFieldId',
      'fromClassId',
      'toClassId',
      'type',
    ];

    return signatureKeys
      .map(
        (key) =>
          `${key}:${typeof metadata[key] === 'string' ? metadata[key] : ''}`,
      )
      .join('|');
  }

  private async findRelationByLegacyIdInTransaction(
    tx: Pick<Prisma.TransactionClient, 'modelRelation'>,
    projectId: string,
    legacyRelationId: string,
  ) {
    const relations = await tx.modelRelation.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
    });

    return (
      relations.find(
        (relation) =>
          this.getLegacyRelationId(relation.metadata) === legacyRelationId,
      ) ?? null
    );
  }

  private async findDuplicateRelationInTransaction(
    tx: Pick<Prisma.TransactionClient, 'modelRelation'>,
    projectId: string,
    sourceObjectId: string,
    targetObjectId: string,
    type: string,
    metadata: unknown,
  ) {
    const requestedSignature = this.getRelationDuplicateSignature(metadata);
    const relations = await tx.modelRelation.findMany({
      where: {
        projectId,
        sourceObjectId,
        targetObjectId,
        type,
        deletedAt: null,
      },
    });

    return (
      relations.find(
        (relation) =>
          this.getRelationDuplicateSignature(relation.metadata) ===
          requestedSignature,
      ) ?? null
    );
  }

  private async findProjectViewNodeOrThrow(
    projectId: string,
    viewId: string,
    nodeId: string,
  ) {
    const node = await this.prisma.viewNode.findFirst({
      where: {
        id: nodeId,
        viewId,
        view: {
          is: {
            projectId,
            deletedAt: null,
          },
        },
        object: {
          is: {
            deletedAt: null,
          },
        },
      },
    });

    if (!node) {
      throw new NotFoundException('View node not found');
    }

    return node;
  }

  private touchView(tx: Prisma.TransactionClient, viewId: string) {
    return tx.modelView.update({
      where: { id: viewId },
      data: { updatedAt: new Date() },
    });
  }
}
