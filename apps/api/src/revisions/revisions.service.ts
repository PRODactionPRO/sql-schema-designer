import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateRevisionDto } from './dto/create-revision.dto';

@Injectable()
export class RevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  async list(projectId: string, ownerId: string) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.projectRevision.findMany({
      where: { projectId },
      orderBy: { revision: 'desc' },
    });
  }

  async create(
    projectId: string,
    ownerId: string,
    authorId: string,
    dto: CreateRevisionDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    const aggregate = await this.prisma.projectRevision.aggregate({
      where: { projectId },
      _max: { revision: true },
    });

    const nextRevision = (aggregate._max.revision ?? 0) + 1;

    const [revision] = await this.prisma.$transaction([
      this.prisma.projectRevision.create({
        data: {
          projectId,
          revision: nextRevision,
          schemaJson: this.toInputJson(dto.schemaJson),
          comment: dto.comment,
          authorId,
        },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: {
          schemaJson: this.toInputJson(dto.schemaJson),
        },
      }),
    ]);

    return revision;
  }

  async restore(
    projectId: string,
    revision: number,
    ownerId: string,
    authorId: string,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    const sourceRevision = await this.prisma.projectRevision.findUnique({
      where: {
        projectId_revision: {
          projectId,
          revision,
        },
      },
    });

    if (!sourceRevision) {
      throw new NotFoundException('Revision not found');
    }
    if (sourceRevision.schemaJson === null) {
      throw new NotFoundException('Revision has empty schema');
    }

    const aggregate = await this.prisma.projectRevision.aggregate({
      where: { projectId },
      _max: { revision: true },
    });

    const nextRevision = (aggregate._max.revision ?? 0) + 1;

    const [newRevision] = await this.prisma.$transaction([
      this.prisma.projectRevision.create({
        data: {
          projectId,
          revision: nextRevision,
          schemaJson: this.toInputJson(sourceRevision.schemaJson),
          comment: `Restore from r${revision}`,
          authorId,
        },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: {
          schemaJson: this.toInputJson(sourceRevision.schemaJson),
        },
      }),
    ]);

    return newRevision;
  }

  async remove(projectId: string, revisionId: string, ownerId: string) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    const revision = await this.prisma.projectRevision.findFirst({
      where: { id: revisionId, projectId },
      select: { id: true },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    await this.prisma.projectRevision.delete({
      where: { id: revisionId },
    });

    return { success: true };
  }
}
