import { lastValueFrom, of } from 'rxjs';
import { EmptyStringToUndefinedInterceptor } from './empty-string-to-undefined.interceptor';

describe('EmptyStringToUndefinedInterceptor', () => {
  const ic = new EmptyStringToUndefinedInterceptor();

  const mkCtx = (req: any) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;

  it('replaces "" with undefined in body', async () => {
    const req: any = { body: { a: '', b: 'x', c: 1 } };
    await lastValueFrom(
      ic.intercept(mkCtx(req), { handle: () => of('ok') } as never),
    );
    expect(req.body.a).toBeUndefined();
    expect(req.body.b).toBe('x');
    expect(req.body.c).toBe(1);
  });
  it('recurses into nested objects (skips arrays)', async () => {
    const req: any = {
      body: { user: { name: '' }, list: ['', 'x'] },
    };
    await lastValueFrom(
      ic.intercept(mkCtx(req), { handle: () => of('ok') } as never),
    );
    expect(req.body.user.name).toBeUndefined();
    expect(req.body.list).toEqual(['', 'x']); // arrays untouched
  });
  it('sanitizes query as well', async () => {
    const req: any = { query: { q: '' } };
    await lastValueFrom(
      ic.intercept(mkCtx(req), { handle: () => of('ok') } as never),
    );
    expect(req.query.q).toBeUndefined();
  });
  it('handles missing body/query', async () => {
    const req: any = {};
    await expect(
      lastValueFrom(
        ic.intercept(mkCtx(req), { handle: () => of('ok') } as never),
      ),
    ).resolves.toBe('ok');
  });
});
