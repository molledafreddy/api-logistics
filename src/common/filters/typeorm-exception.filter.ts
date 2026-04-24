import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { ERROR_CODES } from '../constants/error-codes';

@Catch(QueryFailedError, EntityNotFoundError)
export class TypeormExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TypeormExceptionFilter.name);

  catch(
    exception: QueryFailedError | EntityNotFoundError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';
    let errorCode: string = ERROR_CODES.INTERNAL_ERROR;

    if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
      errorCode = ERROR_CODES.RESOURCE_NOT_FOUND;
    } else if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as {
        code?: string;
        detail?: string;
      };

      switch (driverError?.code) {
        case '23505': // unique_violation
          status = HttpStatus.CONFLICT;
          message = `Duplicate entry: ${driverError.detail || 'Resource already exists'}`;
          break;
        case '23503': // foreign_key_violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Referenced resource does not exist';
          break;
        case '23502': // not_null_violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Required field is missing';
          break;
        default:
          this.logger.error(
            `Database error [${driverError?.code}]: ${exception.message}`,
            exception.stack,
          );
          break;
      }
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
