import { IsObject } from 'class-validator';

export class UpdateWorkspaceLayoutDto {
  @IsObject()
  state!: Record<string, unknown>;
}
