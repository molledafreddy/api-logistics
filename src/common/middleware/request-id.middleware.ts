import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const HEADER = 'x-request-id';

/**
 * Asigna un identificador único a cada request:
 *  - Respeta `X-Request-ID` entrante si lo trae el cliente / API gateway.
 *  - Si no, genera un UUIDv4.
 *  - Lo expone en `req.id` y lo refleja en la respuesta para correlación.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const incoming = req.headers[HEADER];
    const id =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim().slice(0, 128)
        : randomUUID();

    req.id = id;
    res.setHeader('X-Request-ID', id);
    next();
  }
}
