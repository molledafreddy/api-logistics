import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min, Max, IsString } from 'class-validator';

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
  @ApiPropertyOptional({ description: 'direct | group | shipment' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shipmentId?: string;
}
