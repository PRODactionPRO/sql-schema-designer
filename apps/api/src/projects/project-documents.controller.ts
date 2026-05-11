import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDocumentDto } from './dto/create-project-document.dto';
import { UpdateProjectDocumentDto } from './dto/update-project-document.dto';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/documents')
export class ProjectDocumentsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.listDocuments(projectId, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectDocumentDto,
  ) {
    return this.projectsService.createDocument(projectId, user.userId, dto);
  }

  @Put(':documentId')
  update(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateProjectDocumentDto,
  ) {
    return this.projectsService.updateDocument(
      projectId,
      documentId,
      user.userId,
      dto,
    );
  }

  @Delete(':documentId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.projectsService.deleteDocument(
      projectId,
      documentId,
      user.userId,
    );
  }
}
