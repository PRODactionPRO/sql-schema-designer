import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  schemaJson!: Record<string, unknown>;
}
