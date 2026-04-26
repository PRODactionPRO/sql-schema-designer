import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateViewDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  sqlQuery!: string;

  @IsOptional()
  @IsString()
  dialect?: string;

  @IsOptional()
  @IsString()
  tool?: string;
}
