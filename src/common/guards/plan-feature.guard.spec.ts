import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanFeatureGuard } from './plan-feature.guard';

describe('PlanFeatureGuard', () => {
  let guard: PlanFeatureGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new PlanFeatureGuard(reflector);
  });

  function mockContext(userData: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: userData }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('permite si no hay metadata', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const context = mockContext({});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite si la feature está habilitada', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(
      'advanced_reports',
    );
    const context = mockContext({
      company: { planFeatures: ['advanced_reports', 'api'] },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('deniega si la feature no está habilitada', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('api');
    const context = mockContext({
      company: { planFeatures: ['advanced_reports'] },
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('deniega si no hay empresa', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('api');
    const context = mockContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });
});
