import { PartialType } from '@nestjs/mapped-types';
import { CreatePermissionDefinitionDto } from './create-permission-definition.dto';

export class UpdatePermissionDefinitionDto extends PartialType(
  CreatePermissionDefinitionDto,
) {}
