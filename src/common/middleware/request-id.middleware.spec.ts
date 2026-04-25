import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  const mw = new RequestIdMiddleware();
  const mkRes = () => ({ setHeader: jest.fn() });

  it('generates UUID when no header is present', () => {
    const req: any = { headers: {} };
    const res = mkRes();
    const next = jest.fn();
    mw.use(req, res as never, next);
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
    expect(next).toHaveBeenCalled();
  });
  it('uses incoming X-Request-ID header trimmed', () => {
    const req: any = { headers: { 'x-request-id': '  custom-123  ' } };
    const res = mkRes();
    mw.use(req, res as never, jest.fn());
    expect(req.id).toBe('custom-123');
  });
  it('truncates incoming id to 128 chars', () => {
    const long = 'x'.repeat(200);
    const req: any = { headers: { 'x-request-id': long } };
    const res = mkRes();
    mw.use(req, res as never, jest.fn());
    expect(req.id).toHaveLength(128);
  });
  it('falls back to UUID when incoming is empty string', () => {
    const req: any = { headers: { 'x-request-id': '   ' } };
    const res = mkRes();
    mw.use(req, res as never, jest.fn());
    expect(req.id).toMatch(/-/);
  });
});
