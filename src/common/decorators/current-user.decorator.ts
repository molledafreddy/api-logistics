import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IUserPayload } from '../interfaces/user-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof IUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as IUserPayload;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
