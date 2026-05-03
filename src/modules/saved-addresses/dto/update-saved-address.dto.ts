import { PartialType } from '@nestjs/swagger';
import { CreateSavedAddressDto } from './create-saved-address.dto';

/**
 * PATCH /v1/saved-addresses/:id — todos los campos opcionales.
 * El `label` único se valida en service si cambia.
 */
export class UpdateSavedAddressDto extends PartialType(CreateSavedAddressDto) {}
