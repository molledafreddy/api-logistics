import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumberString,
  IsDateString,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  truckId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiProperty({
    enum: [
      'fuel',
      'toll',
      'maintenance',
      'parking',
      'meal',
      'lodging',
      'repair',
      'other',
    ],
  })
  @IsIn([
    'fuel',
    'toll',
    'maintenance',
    'parking',
    'meal',
    'lodging',
    'repair',
    'other',
  ])
  category!: string;

  @ApiProperty({ example: 'Diesel fuel - Pilot truck stop', maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  description!: string;

  @ApiProperty({ example: '125.50' })
  @IsNumberString()
  amount!: string;

  @ApiPropertyOptional({ example: 'USD', maxLength: 3 })
  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: '2026-04-20' })
  @IsDateString()
  expenseDate!: string;

  @ApiPropertyOptional({ description: 'URL del recibo en S3' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  receiptUrl?: string;

  @ApiPropertyOptional({ example: 'Pilot Travel Centers', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  vendorName?: string;

  @ApiPropertyOptional({ example: 'company_card' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
