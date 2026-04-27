import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateMigrationDto } from './dto/create-migration.dto';
import { UpdateMigrationDto } from './dto/update-migration.dto';

@Injectable()
export class MigrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(projectId: string, ownerId: string) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.projectMigration.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(
    projectId: string,
    ownerId: string,
    authorId: string,
    dto: CreateMigrationDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.projectMigration.create({
      data: {
        projectId,
        authorId,
        name: dto.name,
        description: dto.description,
        fromRevision: dto.fromRevision,
        toRevision: dto.toRevision,
        upSql: dto.upSql,
        downSql: dto.downSql,
        status: dto.status,
      },
    });
  }

  async update(
    projectId: string,
    migrationId: string,
    ownerId: string,
    dto: UpdateMigrationDto,
  ) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findOwnedMigrationOrThrow(projectId, migrationId);

    return this.prisma.projectMigration.update({
      where: { id: migrationId },
      data: {
        name: dto.name,
        description: dto.description,
        fromRevision: dto.fromRevision,
        toRevision: dto.toRevision,
        upSql: dto.upSql,
        downSql: dto.downSql,
        status: dto.status,
      },
    });
  }

  async remove(projectId: string, migrationId: string, ownerId: string) {
    await this.projectsService.findOwnedProjectOrThrow(projectId, ownerId);
    await this.findOwnedMigrationOrThrow(projectId, migrationId);

    return this.prisma.projectMigration.delete({ where: { id: migrationId } });
  }

  private async findOwnedMigrationOrThrow(
    projectId: string,
    migrationId: string,
  ) {
    const migration = await this.prisma.projectMigration.findFirst({
      where: {
        id: migrationId,
        projectId,
      },
    });

    if (!migration) {
      throw new NotFoundException('Migration not found');
    }

    return migration;
  }
}
