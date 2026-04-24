import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CompanyType } from '../../../common/enums/company-type.enum';
import { ServiceType } from '../../../common/enums/service-type.enum';
import { BusinessModel } from '../../../common/enums/business-model.enum';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Logistics', maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'Acme Logistics LLC', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  legalName?: string;

  @ApiProperty({ enum: CompanyType, example: CompanyType.CARRIER })
  @IsEnum(CompanyType)
  type!: CompanyType;

  // ─── Multi-vertical (PARTE 7, Sprint 0) ──
  @ApiPropertyOptional({
    enum: ServiceType,
    default: ServiceType.FREIGHT,
    description:
      'Vertical de servicio: freight (carga) | passenger (personas) | mixed. Default: freight.',
  })
  @IsEnum(ServiceType)
  @IsOptional()
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    enum: BusinessModel,
    default: BusinessModel.SMALL_FLEET,
    description:
      'Modelo de negocio: independent | small_fleet | enterprise. Default: small_fleet.',
  })
  @IsEnum(BusinessModel)
  @IsOptional()
  businessModel?: BusinessModel;

  // ─── Identificadores ───────────────────
  @ApiPropertyOptional({ example: '12-3456789', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional({ example: 'MC-123456', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  mcNumber?: string;

  @ApiPropertyOptional({ example: '1234567', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  dotNumber?: string;

  @ApiPropertyOptional({ example: 'ACME', maxLength: 10 })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  scacCode?: string;

  // ─── Contacto ──────────────────────────
  @ApiPropertyOptional({ example: 'info@acmelogistics.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-123-4567', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acmelogistics.com', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  website?: string;

  // ─── Dirección ─────────────────────────
  @ApiPropertyOptional({ example: '123 Main St', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Suite 100', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  addressLine2?: string;

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

  // ─── Config ────────────────────────────
  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  timezone?: string;
}
