import { PartialType, PickType } from '@nestjs/swagger';
import { InviteUserDto } from './invite-user.dto';

export class UpdateUserDto extends PartialType(
  PickType(InviteUserDto, ['firstName', 'lastName', 'phone'] as const),
) {}
