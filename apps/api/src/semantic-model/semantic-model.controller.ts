import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateModelObjectDto } from './dto/create-model-object.dto';
import {
  CreateRelationCommandDto,
  CreateObjectInViewCommandDto,
  CreateRelationInViewCommandDto,
  CreateSemanticViewCommandDto,
  DeleteObjectFromViewCommandDto,
  DeleteRelationFromViewCommandDto,
  MoveViewNodeCommandDto,
  UpdateObjectCommandDto,
  UpdateRelationCommandDto,
} from './dto/semantic-command.dto';
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

  @Post('commands/create-view')
  createViewCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateSemanticViewCommandDto,
  ) {
    return this.semanticModelService.createViewCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/create-object-in-view')
  createObjectInViewCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateObjectInViewCommandDto,
  ) {
    return this.semanticModelService.createObjectInViewCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/update-object')
  updateObjectCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateObjectCommandDto,
  ) {
    return this.semanticModelService.updateObjectCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/move-view-node')
  moveViewNodeCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: MoveViewNodeCommandDto,
  ) {
    return this.semanticModelService.moveViewNodeCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/delete-object-from-view')
  deleteObjectFromViewCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: DeleteObjectFromViewCommandDto,
  ) {
    return this.semanticModelService.deleteObjectFromViewCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/create-relation-in-view')
  createRelationInViewCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateRelationInViewCommandDto,
  ) {
    return this.semanticModelService.createRelationInViewCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/create-relation')
  createRelationCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateRelationCommandDto,
  ) {
    return this.semanticModelService.createRelationCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/update-relation')
  updateRelationCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateRelationCommandDto,
  ) {
    return this.semanticModelService.updateRelationCommand(
      projectId,
      user.userId,
      dto,
    );
  }

  @Post('commands/delete-relation-from-view')
  deleteRelationFromViewCommand(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body() dto: DeleteRelationFromViewCommandDto,
  ) {
    return this.semanticModelService.deleteRelationFromViewCommand(
      projectId,
      user.userId,
      dto,
    );
  }
}
