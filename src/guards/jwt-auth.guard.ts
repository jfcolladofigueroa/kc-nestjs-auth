import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { isObservable, lastValueFrom } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from './allow-pending-password-change.decorator';

/** `code` of the 403 returned while a password change is pending. */
export const KC_PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

@Injectable()
export class KcJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) return true;

    const result = super.canActivate(context);
    const ok = isObservable(result) ? await lastValueFrom(result) : await result;
    if (!ok) return false;

    // The claim is only issued with `forcePasswordChangeOnFirstLogin`, so this
    // costs nothing (and changes nothing) for apps that did not opt in.
    const user = context.switchToHttp().getRequest()?.user;
    if (user?.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, targets);
      if (!allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: KC_PASSWORD_CHANGE_REQUIRED,
          message: 'Password change required',
        });
      }
    }
    return true;
  }
}
