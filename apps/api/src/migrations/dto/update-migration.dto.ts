import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMigrationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  fromRevision?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  toRevision?: number;

  @IsOptional()
  @IsString()
  upSql?: string;

  @IsOptional()
  @IsString()
  downSql?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
