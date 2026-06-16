import { ForbiddenException } from '@nestjs/common';
import { IUserPayload } from '../interfaces/user-payload.interface';

export function requireCompanyId(user: IUserPayload): string {
  if (!user.companyId) {
    throw new ForbiddenException('User has no company associated');
  }
  return user.companyId;
}
