import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { AUDIT_KEY, AuditOptions } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<AuditOptions>(
      AUDIT_KEY,
      context.getHandler(),
    );
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap((result) => {
        this.auditService
          .log({
            companyId: user?.companyId || null,
            userId: user?.sub || null,
            action: options.action,
            entityType: options.resourceType,
            entityId: result?.id || request.params?.id || null,
            newValues: request.body || {},
            ipAddress: request.ip || null,
            userAgent: request.headers?.['user-agent'] || null,
          })
          .catch(() => {
            /* fire and forget */
          });
      }),
    );
  }
}
