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
import { CreateMigrationDto } from './dto/create-migration.dto';
import { MigrationsService } from './migrations.service';
import { UpdateMigrationDto } from './dto/update-migration.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/migrations')
export class MigrationsController {
  constructor(private readonly migrationsService: MigrationsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.migrationsService.list(projectId, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateMigrationDto,
  ) {
    return this.migrationsService.create(
      projectId,
      user.userId,
      user.userId,
      dto,
    );
  }

  @Put(':migrationId')
  update(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('migrationId') migrationId: string,
    @Body() dto: UpdateMigrationDto,
  ) {
    return this.migrationsService.update(
      projectId,
      migrationId,
      user.userId,
      dto,
    );
  }

  @Delete(':migrationId')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('migrationId') migrationId: string,
  ) {
    return this.migrationsService.remove(projectId, migrationId, user.userId);
  }
}
