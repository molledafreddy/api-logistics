import { IsArray, ArrayUnique, ArrayNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DR-007: la secuencia debe contener exactamente los IDs de los shipments
 * cuyo deliveryRunId apunta a este run (mismo conjunto, distinto orden).
 * DR-008: solo permitido en estados `planned` o `ready`.
 */
export class ReorderDto {
  @ApiProperty({
    type: [String],
    description:
      'IDs de shipments en el orden deseado. Debe ser una permutación exacta de los shipments del run.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  sequence!: string[];
}
