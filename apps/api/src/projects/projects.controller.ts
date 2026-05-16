import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateWorkspaceLayoutDto } from './dto/update-workspace-layout.dto';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projectsService.listByOwner(user.userId);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.userId, dto);
  }

  @Get(':projectId')
  getById(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.getById(projectId, user.userId);
  }

  @Put(':projectId')
  update(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, user.userId, dto);
  }

  @Get(':projectId/workspace-layout')
  getWorkspaceLayout(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.getWorkspaceLayout(projectId, user.userId);
  }

  @Patch(':projectId/workspace-layout')
  updateWorkspaceLayout(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateWorkspaceLayoutDto,
  ) {
    return this.projectsService.updateWorkspaceLayout(projectId, user.userId, dto);
  }

  @Delete(':projectId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.softDelete(projectId, user.userId);
  }
}
