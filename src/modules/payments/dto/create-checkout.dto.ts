import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'UUID de la subscription a pagar.',
    example: 'b3c1f1d2-1234-4567-89ab-cdef01234567',
  })
  @IsUUID()
  subscriptionId!: string;

  @ApiProperty({
    description:
      'Monto en la unidad menor de la moneda (CLP no usa decimales).',
    example: 12990,
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({ enum: ['CLP', 'USD'], default: 'CLP' })
  @IsString()
  @IsIn(['CLP', 'USD'])
  @IsOptional()
  currency?: 'CLP' | 'USD';

  @ApiProperty({
    description: 'Texto que verá el usuario en la pasarela.',
    example: 'Plan Pro Mensual — Carrier',
  })
  @IsString()
  @Length(3, 120)
  itemTitle!: string;

  @ApiPropertyOptional({
    description: 'Email del payer (mejora conversion en MercadoPago).',
  })
  @IsEmail()
  @IsOptional()
  payerEmail?: string;
}
