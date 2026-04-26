import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  listByOwner(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { revisions: true },
        },
      },
    });
  }

  async create(ownerId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        ownerId,
        name: dto.name,
        description: dto.description,
        schemaJson: this.toInputJson(dto.schemaJson),
      },
    });
  }

  async findOwnedProjectOrThrow(
    projectId: string,
    ownerId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async getById(projectId: string, ownerId: string) {
    return this.findOwnedProjectOrThrow(projectId, ownerId);
  }

  async update(projectId: string, ownerId: string, dto: UpdateProjectDto) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        schemaJson: dto.schemaJson
          ? this.toInputJson(dto.schemaJson)
          : undefined,
      },
    });
  }

  async softDelete(projectId: string, ownerId: string) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }
}
