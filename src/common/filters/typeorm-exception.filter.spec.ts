import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { TypeormExceptionFilter } from './typeorm-exception.filter';

describe('TypeormExceptionFilter', () => {
  const filter = new TypeormExceptionFilter();
  const mkHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({ url: '/x' }),
        }),
      } as never,
      status,
      json,
    };
  };

  it('maps EntityNotFoundError to 404', () => {
    const { host, status } = mkHost();
    const err = new EntityNotFoundError(class {} as never, {});
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(404);
  });
  it('maps unique_violation (23505) to 409', () => {
    const { host, status, json } = mkHost();
    const err = new QueryFailedError('q', [], new Error('e') as never);
    (err as any).driverError = { code: '23505', detail: 'dup' };
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].message).toContain('Duplicate');
  });
  it('maps fk_violation (23503) to 400', () => {
    const { host, status } = mkHost();
    const err = new QueryFailedError('q', [], new Error('e') as never);
    (err as any).driverError = { code: '23503' };
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(400);
  });
  it('maps not_null_violation (23502) to 400', () => {
    const { host, status } = mkHost();
    const err = new QueryFailedError('q', [], new Error('e') as never);
    (err as any).driverError = { code: '23502' };
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(400);
  });
  it('falls back to 500 on unknown driver code', () => {
    const { host, status } = mkHost();
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
    const err = new QueryFailedError('q', [], new Error('e') as never);
    (err as any).driverError = { code: '99999' };
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(500);
  });
});
