import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignDriverDto {
  @ApiProperty({ description: 'Driver UUID to assign to the truck' })
  @IsUUID()
  driverId!: string;
}
