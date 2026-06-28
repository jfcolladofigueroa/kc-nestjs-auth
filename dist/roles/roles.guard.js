"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KcRolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_decorator_1 = require("./roles.decorator");
const permissions_decorator_1 = require("./permissions.decorator");
let KcRolesGuard = class KcRolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const requiredRoles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [
            context.getHandler(), context.getClass(),
        ]);
        const requiredPermissions = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [
            context.getHandler(), context.getClass(),
        ]);
        // No roles ni permissions requeridos = acceso libre (solo auth)
        if (!requiredRoles?.length && !requiredPermissions?.length)
            return true;
        const { user } = context.switchToHttp().getRequest();
        if (!user)
            throw new common_1.ForbiddenException('Acesso negado');
        // Admin tiene acceso a todo
        if (user.role === 'admin')
            return true;
        // Check roles
        if (requiredRoles?.length) {
            if (!requiredRoles.includes(user.role)) {
                throw new common_1.ForbiddenException('Acesso negado: perfil insuficiente');
            }
        }
        // Check permissions
        if (requiredPermissions?.length) {
            const userPerms = user.permissions || [];
            const hasAllPerms = requiredPermissions.every((p) => userPerms.includes(p));
            if (!hasAllPerms) {
                throw new common_1.ForbiddenException('Acesso negado: permissão insuficiente');
            }
        }
        return true;
    }
};
exports.KcRolesGuard = KcRolesGuard;
exports.KcRolesGuard = KcRolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], KcRolesGuard);
