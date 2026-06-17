import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class QueryMessagesDto {
  @ApiPropertyOptional({
    description: 'Cursor: traer mensajes antes de este ID',
  })
  @IsUUID()
  @IsOptional()
  before?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit: number = 50;
}

export class QueryConversationsDto {
  @ApiPropertyOptional({ enum: ['direct', 'group', 'shipment'] })
  @IsIn(['direct', 'group', 'shipment'])
  @IsOptional()
  type?: 'direct' | 'group' | 'shipment';

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shipmentId?: string;
}
