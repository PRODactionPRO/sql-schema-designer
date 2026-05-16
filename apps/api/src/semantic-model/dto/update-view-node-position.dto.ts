import { IsNumber } from 'class-validator';

export class UpdateViewNodePositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}
