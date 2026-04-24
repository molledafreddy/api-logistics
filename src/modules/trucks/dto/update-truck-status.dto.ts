import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TruckStatus } from '../../../common/enums/truck-status.enum';

export class UpdateTruckStatusDto {
  @ApiProperty({ enum: TruckStatus })
  @IsEnum(TruckStatus)
  status!: TruckStatus;
}
