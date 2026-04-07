import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes.js';

export class ValidationException extends Error {
  constructor(public readonly errors: Record<string, string[]>) {
    super('Validation failed');
  }
}

@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = {
      success: false,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      errors: exception.errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json(errorResponse);
  }
}
