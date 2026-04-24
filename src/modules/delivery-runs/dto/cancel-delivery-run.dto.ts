import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelDeliveryRunDto {
  @ApiProperty({ example: 'Lluvia intensa, sin condiciones', maxLength: 500 })
  @IsString()
  @Length(3, 500)
  reason!: string;
}
