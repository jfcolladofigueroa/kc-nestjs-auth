import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class KcRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(), context.getClass(),
    ]);

    // No roles or permissions required = open access (auth only)
    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Access denied');

    // Admin has access to everything
    if (user.role === 'admin') return true;

    // Check roles
    if (requiredRoles?.length) {
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException('Access denied: insufficient role');
      }
    }

    // Check permissions
    if (requiredPermissions?.length) {
      const userPerms: string[] = user.permissions || [];
      const hasAllPerms = requiredPermissions.every((p: string) => userPerms.includes(p));
      if (!hasAllPerms) {
        throw new ForbiddenException('Access denied: insufficient permissions');
      }
    }

    return true;
  }
}
