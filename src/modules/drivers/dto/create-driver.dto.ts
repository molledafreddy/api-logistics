import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DriverStatus } from '../../../common/enums/driver-status.enum';

export class CreateDriverDto {
  @ApiPropertyOptional({ description: 'User UUID linked (optional)' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ example: 'John', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Doe', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-987-6543', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '1985-03-15' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'D1234567', maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'CDL-A', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  licenseClass?: string;

  @ApiPropertyOptional({ example: 'FL', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  licenseState?: string;

  @ApiPropertyOptional({ example: '2028-12-31' })
  @IsDateString()
  @IsOptional()
  licenseExpiresAt?: string;

  @ApiPropertyOptional({ enum: DriverStatus, default: DriverStatus.AVAILABLE })
  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus;

  @ApiPropertyOptional({ example: '123 Main St', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Miami', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'FL', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: '33101', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  zipCode?: string;

  @ApiPropertyOptional({ example: 'US', maxLength: 3, default: 'US' })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  country?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
