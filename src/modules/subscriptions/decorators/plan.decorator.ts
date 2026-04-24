import { SetMetadata } from '@nestjs/common';

export const PLAN_KEY = 'plan';
export const Plan = (plan: string) => SetMetadata(PLAN_KEY, plan);
