import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateViewDto } from './dto/create-view.dto';
import { UpdateViewDto } from './dto/update-view.dto';

@Injectable()
export class ViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(projectId: string, ownerId: string) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.projectSqlView.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(
    projectId: string,
    ownerId: string,
    authorId: string,
    dto: CreateViewDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.projectSqlView.create({
      data: {
        projectId,
        authorId,
        name: dto.name,
        description: dto.description,
        sqlQuery: dto.sqlQuery,
        dialect: dto.dialect,
        tool: dto.tool,
      },
    });
  }

  async update(
    projectId: string,
    viewId: string,
    ownerId: string,
    dto: UpdateViewDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findOwnedViewOrThrow(projectId, viewId);

    return this.prisma.projectSqlView.update({
      where: { id: viewId },
      data: {
        name: dto.name,
        description: dto.description,
        sqlQuery: dto.sqlQuery,
        dialect: dto.dialect,
        tool: dto.tool,
      },
    });
  }

  async remove(projectId: string, viewId: string, ownerId: string) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findOwnedViewOrThrow(projectId, viewId);

    return this.prisma.projectSqlView.delete({ where: { id: viewId } });
  }

  private async findOwnedViewOrThrow(projectId: string, viewId: string) {
    const view = await this.prisma.projectSqlView.findFirst({
      where: {
        id: viewId,
        projectId,
      },
    });

    if (!view) {
      throw new NotFoundException('SQL view not found');
    }

    return view;
  }
}
