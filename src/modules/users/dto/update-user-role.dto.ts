import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';

export class UpdateUserRoleDto {
  @ApiPropertyOptional({
    enum: [
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.DISPATCHER,
      UserRole.ACCOUNTANT,
      UserRole.VIEWER,
    ],
    description: 'Nuevo rol del usuario',
  })
  @IsEnum(
    [
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.DISPATCHER,
      UserRole.ACCOUNTANT,
      UserRole.VIEWER,
    ],
    { message: 'Rol inválido' },
  )
  role!: UserRole;
}
