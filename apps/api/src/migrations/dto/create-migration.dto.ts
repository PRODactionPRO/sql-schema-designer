import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateMigrationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

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

  @IsString()
  @IsNotEmpty()
  upSql!: string;

  @IsOptional()
  @IsString()
  downSql?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
