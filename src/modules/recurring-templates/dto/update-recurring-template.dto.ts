import { PartialType } from '@nestjs/swagger';
import { CreateRecurringTemplateDto } from './create-recurring-template.dto';

/**
 * RT-003 — Modificar `shipmentTemplates` solo afecta runs futuros (los ya
 * generados conservan su snapshot vía recurringTemplateId pero NO se reescriben).
 */
export class UpdateRecurringTemplateDto extends PartialType(
  CreateRecurringTemplateDto,
) {}
