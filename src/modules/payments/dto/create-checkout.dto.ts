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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BackUrlsDto {
  @ApiPropertyOptional({
    description: 'URL de retorno tras pago exitoso (deep link o HTTPS).',
    example: 'logistics://payment/success',
  })
  @IsString()
  @IsOptional()
  success?: string;

  @ApiPropertyOptional({
    description: 'URL de retorno tras pago fallido.',
    example: 'logistics://payment/failure',
  })
  @IsString()
  @IsOptional()
  failure?: string;

  @ApiPropertyOptional({
    description: 'URL de retorno cuando el pago queda pendiente.',
    example: 'logistics://payment/pending',
  })
  @IsString()
  @IsOptional()
  pending?: string;
}

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

  @ApiPropertyOptional({
    description:
      'URLs de retorno tras el pago (snake_case — mobile). Si se omiten, se usan las configuradas en el servidor.',
    type: BackUrlsDto,
  })
  @ValidateNested()
  @Type(() => BackUrlsDto)
  @IsOptional()
  back_urls?: BackUrlsDto;

  @ApiPropertyOptional({
    description: 'Comportamiento de retorno automático de MercadoPago.',
    enum: ['approved'],
  })
  @IsIn(['approved'])
  @IsOptional()
  auto_return?: 'approved';
}
