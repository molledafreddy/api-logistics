import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ enum: ['direct', 'group', 'shipment'], default: 'direct' })
  @IsIn(['direct', 'group', 'shipment'])
  type!: 'direct' | 'group' | 'shipment';

  @ApiPropertyOptional({ maxLength: 150 })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Shipment vinculado si type = shipment' })
  @IsUUID()
  @IsOptional()
  shipmentId?: string;

  @ApiProperty({
    type: [String],
    description: 'UUIDs de los participantes (incluyendo el creador)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  participantIds!: string[];
}
