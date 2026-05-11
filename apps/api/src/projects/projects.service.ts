import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type Project, type ProjectDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDocumentDto } from './dto/create-project-document.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDocumentDto } from './dto/update-project-document.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

type LegacyDocument = Record<string, unknown>;
type ProjectWithDocuments = Project & {
  documents?: ProjectDocument[];
  _count?: Record<string, number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string') return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private toSchemaJsonRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? { ...value } : {};
  }

  private extractDocuments(schemaJson: unknown): LegacyDocument[] {
    const record = this.toSchemaJsonRecord(schemaJson);
    return Array.isArray(record.documents)
      ? record.documents.filter(isRecord)
      : [];
  }

  private hasDocumentsList(schemaJson: unknown): boolean {
    const record = this.toSchemaJsonRecord(schemaJson);
    return Array.isArray(record.documents);
  }

  private stripDocuments(schemaJson: unknown): Record<string, unknown> {
    const record = this.toSchemaJsonRecord(schemaJson);
    delete record.documents;
    return record;
  }

  private getDocumentPayload(document: LegacyDocument): unknown {
    const type = asString(document.type, 'erd');
    if (type === 'erd') return isRecord(document.erd) ? document.erd : {};
    if (type === 'class-diagram') {
      return isRecord(document.classDiagram) ? document.classDiagram : {};
    }
    return document.payload ?? document;
  }

  private toLegacyDocument(document: ProjectDocument): LegacyDocument {
    const base: LegacyDocument = {
      id: document.id,
      name: document.name,
      type: document.type,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };

    if (document.description) base.description = document.description;
    if (document.snapshot) base.snapshot = document.snapshot;
    if (document.type === 'erd') base.erd = document.payload;
    else if (document.type === 'class-diagram') {
      base.classDiagram = document.payload;
    } else {
      base.payload = document.payload;
    }

    return base;
  }

  private attachDocuments(project: ProjectWithDocuments) {
    const { documents = [], ...projectData } = project;
    const schemaJson = this.toSchemaJsonRecord(project.schemaJson);
    const rowDocuments = documents.map((document) =>
      this.toLegacyDocument(document),
    );
    const fallbackDocuments = this.extractDocuments(schemaJson);

    return {
      ...projectData,
      schemaJson: {
        ...schemaJson,
        documents:
          rowDocuments.length > 0 ? rowDocuments : fallbackDocuments,
      },
    };
  }

  private async syncDocumentsFromSchemaJson(
    tx: Prisma.TransactionClient,
    projectId: string,
    ownerId: string,
    schemaJson: unknown,
  ) {
    if (!this.hasDocumentsList(schemaJson)) return;
    const incomingDocuments = this.extractDocuments(schemaJson);

    const now = new Date();
    const incomingIds: string[] = [];

    for (const document of incomingDocuments) {
      const id = asString(document.id, `doc_${randomUUID()}`);
      const type = asString(document.type, 'erd');
      const createdAt = asDate(document.createdAt, now);
      const updatedAt = asDate(document.updatedAt, now);
      incomingIds.push(id);

      await tx.projectDocument.upsert({
        where: { id },
        create: {
          id,
          projectId,
          ownerId,
          type,
          name: asString(document.name, 'Untitled document'),
          description: asOptionalString(document.description),
          payload: this.toInputJson(this.getDocumentPayload(document)),
          snapshot: asOptionalString(document.snapshot),
          createdAt,
          updatedAt,
          deletedAt: null,
        },
        update: {
          projectId,
          ownerId,
          type,
          name: asString(document.name, 'Untitled document'),
          description: asOptionalString(document.description),
          payload: this.toInputJson(this.getDocumentPayload(document)),
          snapshot: asOptionalString(document.snapshot),
          updatedAt,
          deletedAt: null,
        },
      });
    }

    await tx.projectDocument.updateMany({
      where: {
        projectId,
        deletedAt: null,
        id: { notIn: incomingIds },
      },
      data: { deletedAt: now },
    });
  }

  async listByOwner(ownerId: string) {
    const projects = await this.prisma.project.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        documents: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
        },
        _count: {
          select: { revisions: true },
        },
      },
    });

    return projects.map((project) => this.attachDocuments(project));
  }

  async create(ownerId: string, dto: CreateProjectDto) {
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          ownerId,
          name: dto.name,
          description: dto.description,
          schemaJson: this.toInputJson(this.stripDocuments(dto.schemaJson)),
        },
      });

      await this.syncDocumentsFromSchemaJson(
        tx,
        created.id,
        ownerId,
        dto.schemaJson,
      );

      return tx.project.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { updatedAt: 'desc' },
          },
        },
      });
    });

    return this.attachDocuments(project);
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

  private async findOwnedProjectWithDocumentsOrThrow(
    projectId: string,
    ownerId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId,
        deletedAt: null,
      },
      include: {
        documents: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
        },
        _count: {
          select: { revisions: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async getById(projectId: string, ownerId: string) {
    const project = await this.findOwnedProjectWithDocumentsOrThrow(
      projectId,
      ownerId,
    );
    return this.attachDocuments(project);
  }

  async update(projectId: string, ownerId: string, dto: UpdateProjectDto) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);

    const project = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          name: dto.name,
          description: dto.description,
          schemaJson: dto.schemaJson
            ? this.toInputJson(this.stripDocuments(dto.schemaJson))
            : undefined,
        },
      });

      if (dto.schemaJson) {
        await this.syncDocumentsFromSchemaJson(
          tx,
          projectId,
          ownerId,
          dto.schemaJson,
        );
      }

      return tx.project.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { updatedAt: 'desc' },
          },
        },
      });
    });

    return this.attachDocuments(project);
  }

  async updateProjectSchemaJsonInTransaction(
    tx: Prisma.TransactionClient,
    projectId: string,
    ownerId: string,
    schemaJson: unknown,
  ) {
    await tx.project.update({
      where: { id: projectId },
      data: {
        schemaJson: this.toInputJson(this.stripDocuments(schemaJson)),
      },
    });

    await this.syncDocumentsFromSchemaJson(
      tx,
      projectId,
      ownerId,
      schemaJson,
    );
  }

  async listDocuments(projectId: string, ownerId: string) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);

    const documents = await this.prisma.projectDocument.findMany({
      where: { projectId, ownerId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    return documents.map((document) => this.toLegacyDocument(document));
  }

  async createDocument(
    projectId: string,
    ownerId: string,
    dto: CreateProjectDocumentDto,
  ) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);
    const now = new Date();

    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectDocument.create({
        data: {
          id: dto.id || `doc_${randomUUID()}`,
          projectId,
          ownerId,
          type: dto.type,
          name: dto.name,
          description: dto.description,
          payload: this.toInputJson(dto.payload),
          snapshot: dto.snapshot,
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { updatedAt: now },
      });

      return created;
    });

    return this.toLegacyDocument(document);
  }

  async updateDocument(
    projectId: string,
    documentId: string,
    ownerId: string,
    dto: UpdateProjectDocumentDto,
  ) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);
    const now = new Date();

    const document = await this.prisma.$transaction(async (tx) => {
      const current = await tx.projectDocument.findFirst({
        where: { id: documentId, projectId, ownerId, deletedAt: null },
      });

      if (!current) {
        throw new NotFoundException('Document not found');
      }

      const updated = await tx.projectDocument.update({
        where: { id: documentId },
        data: {
          type: dto.type,
          name: dto.name,
          description: dto.description,
          payload: dto.payload ? this.toInputJson(dto.payload) : undefined,
          snapshot: dto.snapshot,
          updatedAt: now,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { updatedAt: now },
      });

      return updated;
    });

    return this.toLegacyDocument(document);
  }

  async deleteDocument(
    projectId: string,
    documentId: string,
    ownerId: string,
  ) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.projectDocument.findFirst({
        where: { id: documentId, projectId, ownerId, deletedAt: null },
        select: { id: true },
      });

      if (!current) {
        throw new NotFoundException('Document not found');
      }

      await tx.projectDocument.update({
        where: { id: documentId },
        data: { deletedAt: now, updatedAt: now },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { updatedAt: now },
      });
    });

    return { success: true };
  }

  async softDelete(projectId: string, ownerId: string) {
    await this.findOwnedProjectOrThrow(projectId, ownerId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }
}
