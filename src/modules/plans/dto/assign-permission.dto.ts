import { IsUUID } from 'class-validator';

export class AssignPermissionDto {
  @IsUUID()
  planId: string;

  @IsUUID()
  permissionId: string;
}
