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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KcAuthService = void 0;
const common_1 = require("@nestjs/common");
const auth_config_1 = require("./config/auth.config");
const jwt_service_1 = require("./tokens/jwt.service");
const password_service_1 = require("./password/password.service");
let KcAuthService = class KcAuthService {
    constructor(config, adapter, emailService, tokenService, passwordService) {
        this.config = config;
        this.adapter = adapter;
        this.emailService = emailService;
        this.tokenService = tokenService;
        this.passwordService = passwordService;
    }
    async login(email, password) {
        const user = await this.adapter.findUserByEmail(email.toLowerCase().trim());
        if (!user)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        if (!user.isActive)
            throw new common_1.UnauthorizedException('Usuário inativo');
        const valid = await this.passwordService.verify(password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        await this.adapter.updateUser(user.id, { lastLoginAt: new Date() });
        const permissions = (0, jwt_service_1.parsePermissions)(user);
        const accessToken = this.tokenService.generateAccessToken({
            sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? null, permissions,
        });
        const refreshToken = await this.tokenService.generateRefreshToken(user.id);
        return {
            accessToken, refreshToken,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId ?? null, permissions },
        };
    }
    async register(email, password, name) {
        if (!this.config.enableRegistration)
            throw new common_1.BadRequestException('Registro não habilitado');
        const existing = await this.adapter.findUserByEmail(email.toLowerCase().trim());
        if (existing)
            throw new common_1.ConflictException('Email já cadastrado');
        const validation = this.passwordService.validate(password);
        if (!validation.valid)
            throw new common_1.BadRequestException(validation.message);
        const passwordHash = await this.passwordService.hash(password);
        const user = await this.adapter.createUser({
            email: email.toLowerCase().trim(), passwordHash, name,
            role: this.config.defaultRole || 'user',
        });
        return { id: user.id, email: user.email, name: user.name, role: user.role, permissions: [] };
    }
    async refresh(refreshToken) {
        const result = await this.tokenService.refreshAccessToken(refreshToken);
        if (!result)
            throw new common_1.UnauthorizedException('Token inválido ou expirado');
        return result;
    }
    async logout(refreshToken) {
        await this.tokenService.revokeToken(refreshToken);
    }
    async getMe(userId) {
        const user = await this.adapter.findUserById(userId);
        if (!user)
            throw new common_1.UnauthorizedException('Usuário não encontrado');
        return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId ?? null, permissions: (0, jwt_service_1.parsePermissions)(user) };
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.adapter.findUserById(userId);
        if (!user)
            throw new common_1.UnauthorizedException();
        const valid = await this.passwordService.verify(currentPassword, user.passwordHash);
        if (!valid)
            throw new common_1.BadRequestException('Senha atual incorreta');
        const validation = this.passwordService.validate(newPassword);
        if (!validation.valid)
            throw new common_1.BadRequestException(validation.message);
        const passwordHash = await this.passwordService.hash(newPassword);
        await this.adapter.updateUser(userId, { passwordHash });
        await this.tokenService.revokeAllUserTokens(userId);
    }
    async forgotPassword(email) {
        const user = await this.adapter.findUserByEmail(email.toLowerCase().trim());
        if (!user)
            return;
        const code = this.passwordService.generateCode(this.config.verificationCodeLength || 6);
        const expMinutes = parseInt(this.config.verificationCodeExpiration || '60') || 60;
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + expMinutes);
        await this.adapter.createVerificationCode({ userId: user.id, code, type: 'password_recovery', expiresAt });
        if (this.emailService)
            await this.emailService.sendPasswordRecoveryEmail(user.email, code, user.name);
    }
    async resetPassword(email, code, newPassword) {
        const result = await this.adapter.findVerificationCode(email.toLowerCase().trim(), code, 'password_recovery');
        if (!result || result.code.used || result.code.expiresAt < new Date())
            throw new common_1.BadRequestException('Código inválido ou expirado');
        const validation = this.passwordService.validate(newPassword);
        if (!validation.valid)
            throw new common_1.BadRequestException(validation.message);
        const passwordHash = await this.passwordService.hash(newPassword);
        await this.adapter.updateUser(result.user.id, { passwordHash });
        await this.adapter.markCodeUsed(result.code.id);
        await this.tokenService.revokeAllUserTokens(result.user.id);
    }
};
exports.KcAuthService = KcAuthService;
exports.KcAuthService = KcAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_config_1.KC_AUTH_CONFIG)),
    __param(1, (0, common_1.Inject)(auth_config_1.KC_AUTH_ADAPTER)),
    __param(2, (0, common_1.Inject)(auth_config_1.KC_EMAIL_SERVICE)),
    __metadata("design:paramtypes", [Object, Object, Object, jwt_service_1.KcTokenService,
        password_service_1.KcPasswordService])
], KcAuthService);
