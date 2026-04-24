import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateTrackingPointDto } from './create-tracking-point.dto';

export class BulkTrackingPointsDto {
  @ApiProperty({
    type: [CreateTrackingPointDto],
    description: 'Hasta 500 puntos por batch',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateTrackingPointDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  points!: CreateTrackingPointDto[];
}
