import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Convierte strings vacíos ("") a `undefined` en `body` y `query`
 * antes de que ValidationPipe valide los DTOs.
 *
 * Motivo: `@IsOptional()` de class-validator solo omite la validación
 * cuando el valor es `null` o `undefined`. Sin embargo, herramientas
 * como Swagger UI suelen enviar campos vacíos como "" en lugar de omitirlos,
 * lo que rompe validadores como `@IsUUID()`, `@IsDateString()`, `@IsEnum()`, etc.
 */
@Injectable()
export class EmptyStringToUndefinedInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      body?: unknown;
      query?: unknown;
    }>();

    if (req.body && typeof req.body === 'object') {
      this.sanitize(req.body as Record<string, unknown>);
    }
    if (req.query && typeof req.query === 'object') {
      this.sanitize(req.query as Record<string, unknown>);
    }
    return next.handle();
  }

  private sanitize(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value === '') {
        obj[key] = undefined;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.sanitize(value as Record<string, unknown>);
      }
    }
  }
}
