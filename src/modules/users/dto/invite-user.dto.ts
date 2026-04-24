import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * Roles that can be assigned via invitation.
 * owner and super_admin cannot be invited.
 */
const INVITABLE_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.DISPATCHER,
  UserRole.ACCOUNTANT,
  UserRole.VIEWER,
] as const;

export class InviteUserDto {
  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @ApiProperty({
    enum: INVITABLE_ROLES,
    example: UserRole.DISPATCHER,
    description: 'Rol a asignar al usuario invitado',
  })
  @IsEnum(INVITABLE_ROLES, {
    message: 'Rol inválido. No se puede invitar como owner ni super_admin',
  })
  role!: UserRole;

  @ApiPropertyOptional({ example: 'María', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'García', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '+1234567890', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  phone?: string;
}
