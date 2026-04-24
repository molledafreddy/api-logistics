import { IsArray, ArrayUnique, ArrayNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShipmentIdsDto {
  @ApiProperty({ type: [String], description: 'IDs de shipments' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  shipmentIds!: string[];
}
