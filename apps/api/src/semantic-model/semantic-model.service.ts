import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type { CreateModelObjectDto } from './dto/create-model-object.dto';
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
}
