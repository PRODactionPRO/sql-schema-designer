import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateModelObjectDto } from './dto/create-model-object.dto';
import { UpdateModelObjectMetadataDto } from './dto/update-model-object-metadata.dto';
import { UpdateViewNodePositionDto } from './dto/update-view-node-position.dto';
import { SemanticModelService } from './semantic-model.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/semantic')
export class SemanticModelController {
  constructor(private readonly semanticModelService: SemanticModelService) {}

  @Get('views/primary-erd')
  getPrimaryErdView(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.semanticModelService.getPrimaryErdView(projectId, user.userId);
  }

  @Get('views/primary-class-diagram')
  getPrimaryClassDiagramView(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ) {
    return this.semanticModelService.getPrimaryClassDiagramView(
      projectId,
      user.userId,
    );
  }

  @Patch('views/:viewId/nodes/:nodeId/position')
  updateViewNodePosition(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateViewNodePositionDto,
  ) {
    return this.semanticModelService.updateViewNodePosition(
      projectId,
      user.userId,
      viewId,
      nodeId,
      dto,
    );
  }

  @Patch('objects/:objectId/metadata')
  updateModelObjectMetadata(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('objectId') objectId: string,
    @Body() dto: UpdateModelObjectMetadataDto,
  ) {
    return this.semanticModelService.updateModelObjectMetadata(
      projectId,
      user.userId,
      objectId,
      dto,
    );
  }

  @Post('objects')
  createModelObject(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateModelObjectDto,
  ) {
    return this.semanticModelService.createModelObject(
      projectId,
      user.userId,
      dto,
    );
  }

  @Delete('objects/:objectId')
  deleteModelObject(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('objectId') objectId: string,
  ) {
    return this.semanticModelService.deleteModelObject(
      projectId,
      user.userId,
      objectId,
    );
  }
}
