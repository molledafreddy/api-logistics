import { SetMetadata } from '@nestjs/common';

export const PLAN_LIMIT_KEY = 'planLimit';
export const PlanLimit = (resource: string) =>
  SetMetadata(PLAN_LIMIT_KEY, resource);
