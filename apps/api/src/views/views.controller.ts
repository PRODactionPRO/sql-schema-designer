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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateViewDto } from './dto/create-view.dto';
import { UpdateViewDto } from './dto/update-view.dto';
import { ViewsService } from './views.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/views')
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.viewsService.list(projectId, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateViewDto,
  ) {
    return this.viewsService.create(projectId, user.userId, user.userId, dto);
  }

  @Put(':viewId')
  update(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
    @Body() dto: UpdateViewDto,
  ) {
    return this.viewsService.update(projectId, viewId, user.userId, dto);
  }

  @Delete(':viewId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
  ) {
    return this.viewsService.remove(projectId, viewId, user.userId);
  }
}
