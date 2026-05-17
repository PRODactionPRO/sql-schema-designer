import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSemanticViewCommandDto {
  @IsString()
  type!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class SemanticNodePositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class SemanticNodeOptionsDto {
  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsBoolean()
  collapsed?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class CreateObjectInViewCommandDto {
  @IsString()
  viewId!: string;

  @IsString()
  type!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsObject()
  position!: SemanticNodePositionDto;

  @IsOptional()
  @IsObject()
  node?: SemanticNodeOptionsDto;
}

export class UpdateObjectCommandDto {
  @IsString()
  objectId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainId?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class MoveViewNodeCommandDto {
  @IsString()
  viewId!: string;

  @IsString()
  nodeId!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class DeleteObjectFromViewCommandDto {
  @IsString()
  objectId!: string;

  @IsOptional()
  @IsString()
  viewId?: string;

  @IsOptional()
  @IsBoolean()
  deleteObject?: boolean;
}

export class SemanticEdgeOptionsDto {
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsObject()
  routing?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;
}

export class CreateRelationInViewCommandDto {
  @IsString()
  viewId!: string;

  @IsString()
  sourceViewNodeId!: string;

  @IsString()
  targetViewNodeId!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsString()
  cardinalitySource?: string;

  @IsOptional()
  @IsString()
  cardinalityTarget?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  edge?: SemanticEdgeOptionsDto;
}

export class CreateRelationCommandDto {
  @IsString()
  sourceObjectId!: string;

  @IsString()
  targetObjectId!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsString()
  cardinalitySource?: string;

  @IsOptional()
  @IsString()
  cardinalityTarget?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateRelationCommandDto {
  @IsOptional()
  @IsString()
  relationId?: string;

  @IsOptional()
  @IsString()
  legacyRelationId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsString()
  cardinalitySource?: string;

  @IsOptional()
  @IsString()
  cardinalityTarget?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class DeleteRelationFromViewCommandDto {
  @IsOptional()
  @IsString()
  relationId?: string;

  @IsOptional()
  @IsString()
  legacyRelationId?: string;

  @IsOptional()
  @IsString()
  viewId?: string;

  @IsOptional()
  @IsBoolean()
  deleteRelation?: boolean;
}
