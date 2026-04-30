import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateRevisionDto } from './dto/create-revision.dto';
import { RevisionsService } from './revisions.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/revisions')
export class RevisionsController {
  constructor(private readonly revisionsService: RevisionsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.revisionsService.list(projectId, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateRevisionDto,
  ) {
    return this.revisionsService.create(
      projectId,
      user.userId,
      user.userId,
      dto,
    );
  }

  @Post(':revision/restore')
  restore(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    return this.revisionsService.restore(
      projectId,
      revision,
      user.userId,
      user.userId,
    );
  }

  @Delete(':revisionId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.revisionsService.remove(projectId, revisionId, user.userId);
  }
}
