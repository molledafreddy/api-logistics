import { HttpStatus } from '@nestjs/common';
import {
  ValidationException,
  ValidationExceptionFilter,
} from './validation-exception.filter';
import { ERROR_CODES } from '../constants/error-codes';

describe('ValidationExceptionFilter', () => {
  it('formats response as 422 with errors map', () => {
    const filter = new ValidationExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/x' }),
      }),
    };
    const exc = new ValidationException({ name: ['required'] });
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json.mock.calls[0][0]).toMatchObject({
      success: false,
      statusCode: 422,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      errors: { name: ['required'] },
    });
  });
});
