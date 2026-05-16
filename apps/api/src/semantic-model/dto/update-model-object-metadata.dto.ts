import { IsObject } from 'class-validator';

export class UpdateModelObjectMetadataDto {
  @IsObject()
  metadata!: Record<string, unknown>;
}
