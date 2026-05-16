import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type { CreateModelObjectDto } from './dto/create-model-object.dto';
import type {
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

const ERD_CONTEXT_OBJECT_TYPES = ['domain', 'enum', 'json_schema'];
const CLASS_DIAGRAM_CONTEXT_OBJECT_TYPES = ['domain', 'enum', 'json_schema'];

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
    return this.updateViewNodePosition(projectId, ownerId, dto.viewId, dto.nodeId, {
      x: dto.x,
      y: dto.y,
    });
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
      this.findProjectViewNodeOrThrow(projectId, dto.viewId, dto.sourceViewNodeId),
      this.findProjectViewNodeOrThrow(projectId, dto.viewId, dto.targetViewNodeId),
    ]);

    return this.prisma.$transaction(async (tx) => {
      const relation = await tx.modelRelation.create({
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

      const edge = await tx.viewEdge.create({
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

  async updateRelationCommand(
    projectId: string,
    ownerId: string,
    dto: UpdateRelationCommandDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findProjectRelationOrThrow(projectId, dto.relationId);

    return this.prisma.$transaction(async (tx) => {
      const relation = await tx.modelRelation.update({
        where: { id: dto.relationId },
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
          relationId: dto.relationId,
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
    await this.findProjectRelationOrThrow(projectId, dto.relationId);
    if (dto.viewId) await this.findProjectViewOrThrow(projectId, dto.viewId);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const edges = await tx.viewEdge.findMany({
        where: {
          relationId: dto.relationId,
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
          where: { id: dto.relationId },
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

  private async findProjectRelationOrThrow(projectId: string, relationId: string) {
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
