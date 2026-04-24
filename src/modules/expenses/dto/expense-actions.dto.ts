import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectExpenseDto {
  @ApiProperty({ description: 'Motivo del rechazo' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ReimburseExpenseDto {
  @ApiProperty({ description: 'Referencia de pago / transacción' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;
}
