import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanLimitGuard } from './plan-limit.guard';

describe('PlanLimitGuard', () => {
  let guard: PlanLimitGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new PlanLimitGuard(reflector);
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

  it('permite si el límite es -1 (ilimitado)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('max_trucks');
    const context = mockContext({
      company: { planLimits: { max_trucks: -1 }, usage: { max_trucks: 100 } },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite si el uso es menor al límite', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('max_trucks');
    const context = mockContext({
      company: { planLimits: { max_trucks: 5 }, usage: { max_trucks: 3 } },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('deniega si el uso es igual al límite', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('max_trucks');
    const context = mockContext({
      company: { planLimits: { max_trucks: 2 }, usage: { max_trucks: 2 } },
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('deniega si no hay empresa', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue('max_trucks');
    const context = mockContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });
});
