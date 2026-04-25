import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  it('logs the request after handler completes', async () => {
    const ic = new LoggingInterceptor();
    const logSpy = jest
      .spyOn((ic as any).logger, 'log')
      .mockImplementation(() => {});
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/x',
          ip: '1.1.1.1',
          get: () => 'jest',
        }),
        getResponse: () => ({ statusCode: 200, get: () => 100 }),
      }),
    };
    await lastValueFrom(ic.intercept(ctx, { handle: () => of('ok') } as never));
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain('GET /x 200');
  });
});
