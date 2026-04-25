import { lastValueFrom, of, throwError, TimeoutError } from 'rxjs';
import { RequestTimeoutException } from '@nestjs/common';
import { TimeoutInterceptor } from './timeout.interceptor';

describe('TimeoutInterceptor', () => {
  it('passes through normal responses', async () => {
    const ic = new TimeoutInterceptor(1000);
    const out = await lastValueFrom(
      ic.intercept({} as never, { handle: () => of('ok') } as never),
    );
    expect(out).toBe('ok');
  });
  it('converts TimeoutError to RequestTimeoutException', async () => {
    const ic = new TimeoutInterceptor(1000);
    await expect(
      lastValueFrom(
        ic.intercept(
          {} as never,
          { handle: () => throwError(() => new TimeoutError()) } as never,
        ),
      ),
    ).rejects.toBeInstanceOf(RequestTimeoutException);
  });
  it('rethrows other errors as-is', async () => {
    const ic = new TimeoutInterceptor(1000);
    const err = new Error('boom');
    await expect(
      lastValueFrom(
        ic.intercept(
          {} as never,
          { handle: () => throwError(() => err) } as never,
        ),
      ),
    ).rejects.toBe(err);
  });
});
