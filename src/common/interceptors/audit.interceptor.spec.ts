import { lastValueFrom, of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor';

describe('AuditInterceptor', () => {
  const mkCtx = (req: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    }) as never;

  it('skips audit when no decorator metadata', async () => {
    const refl = new Reflector();
    jest.spyOn(refl, 'getAllAndOverride').mockReturnValue(undefined);
    const ic = new AuditInterceptor(refl);
    const out = await lastValueFrom(
      ic.intercept(mkCtx({}), { handle: () => of('R') } as never),
    );
    expect(out).toBe('R');
  });
  it('logs audit when decorator present', async () => {
    const refl = new Reflector();
    jest
      .spyOn(refl, 'getAllAndOverride')
      .mockReturnValue({ action: 'CREATE', resource: 'X' });
    const ic = new AuditInterceptor(refl);
    const dbg = jest
      .spyOn((ic as any).logger, 'debug')
      .mockImplementation(() => {});
    const out = await lastValueFrom(
      ic.intercept(mkCtx({ user: { sub: 'u1' } }), {
        handle: () => of('R'),
      } as never),
    );
    expect(out).toBe('R');
    expect(dbg).toHaveBeenCalled();
    expect(dbg.mock.calls[0][0]).toContain('CREATE on X by user u1');
  });
  it('logs anonymous when no user', async () => {
    const refl = new Reflector();
    jest
      .spyOn(refl, 'getAllAndOverride')
      .mockReturnValue({ action: 'A', resource: 'B' });
    const ic = new AuditInterceptor(refl);
    const dbg = jest
      .spyOn((ic as any).logger, 'debug')
      .mockImplementation(() => {});
    await lastValueFrom(
      ic.intercept(mkCtx({}), { handle: () => of('R') } as never),
    );
    expect(dbg.mock.calls[0][0]).toContain('anonymous');
  });
});
