import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ERROR_CODES } from '../constants/error-codes';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  const mkHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/x' }),
      }),
    };
    return { host, status, json };
  };

  it('formats HttpException with string response', () => {
    const { host, status, json } = mkHost();
    filter.catch(new BadRequestException('Bad'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json.mock.calls[0][0]).toMatchObject({
      success: false,
      statusCode: 400,
    });
  });
  it('formats HttpException with object response and errorCode', () => {
    const { host, json } = mkHost();
    const exc = new HttpException(
      { message: 'msg', errorCode: 'CUSTOM', errors: { f: ['e'] } },
      418,
    );
    filter.catch(exc, host);
    expect(json.mock.calls[0][0]).toMatchObject({
      message: 'msg',
      errorCode: 'CUSTOM',
      errors: { f: ['e'] },
    });
  });
  it('handles class-validator array messages', () => {
    const { host, json } = mkHost();
    const exc = new HttpException(
      { message: ['x must be string', 'y is required'] },
      400,
    );
    filter.catch(exc, host);
    expect(json.mock.calls[0][0]).toMatchObject({
      message: 'Validation failed',
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      errors: { validation: ['x must be string', 'y is required'] },
    });
  });
  it('formats unknown Error as 500', () => {
    const { host, status, json } = mkHost();
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({
      message: 'boom',
      errorCode: ERROR_CODES.INTERNAL_ERROR,
    });
  });
  it('formats unknown non-Error as 500 default message', () => {
    const { host, json } = mkHost();
    filter.catch('weird', host);
    expect(json.mock.calls[0][0].statusCode).toBe(500);
    expect(json.mock.calls[0][0].message).toBe('Internal server error');
  });
});
