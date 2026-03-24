import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type CurrentUserData = string | undefined;
type RequestWithUser = Request & { user?: unknown };

export const CurrentUser = createParamDecorator(
  (data: CurrentUserData, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (data) {
      if (typeof user === 'object' && user !== null) {
        return (user as Record<string, unknown>)[data];
      }

      return undefined;
    }

    return user;
  },
);
