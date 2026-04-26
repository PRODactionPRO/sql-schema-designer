import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRevisionDto {
  @IsObject()
  schemaJson!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  comment?: string;
}
