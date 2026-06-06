import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Mi Empresa de Transporte' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la empresa es requerido' })
  @MinLength(2, { message: 'Mínimo 2 caracteres' })
  @MaxLength(100, { message: 'Máximo 100 caracteres' })
  companyName!: string;

  @ApiProperty({
    example: 'carrier',
    enum: ['carrier', 'broker', 'shipper', 'owner_operator'],
  })
  @IsEnum(['carrier', 'broker', 'shipper', 'owner_operator'], {
    message: 'Tipo de empresa inválido',
  })
  companyType!: string;

  @ApiPropertyOptional({ example: 'J-12345678-9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxId?: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ example: 'juan@empresa.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @ApiProperty({ example: 'MyP@ssw0rd!' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'La contraseña debe incluir mayúscula, minúscula, número y carácter especial',
  })
  password!: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Token de link de referido (opcional)' })
  @IsOptional()
  @IsString()
  referralToken?: string;
}
