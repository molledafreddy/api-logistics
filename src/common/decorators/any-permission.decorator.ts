import { SetMetadata } from '@nestjs/common';

export const ANY_PERMISSION_KEY = 'anyPermission';
export const AnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSION_KEY, permissions);
