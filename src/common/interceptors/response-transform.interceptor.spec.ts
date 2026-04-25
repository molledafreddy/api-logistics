import { lastValueFrom, of } from 'rxjs';
import { ResponseTransformInterceptor } from './response-transform.interceptor';

describe('ResponseTransformInterceptor', () => {
  it('wraps response with success/data/timestamp', async () => {
    const ic = new ResponseTransformInterceptor();
    const ctx: any = {};
    const next: any = { handle: () => of({ id: 1 }) };
    const out = await lastValueFrom(ic.intercept(ctx, next));
    expect(out.success).toBe(true);
    expect(out.data).toEqual({ id: 1 });
    expect(typeof out.timestamp).toBe('string');
    expect(new Date(out.timestamp).toString()).not.toBe('Invalid Date');
  });
});
