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
exports.KcTokenService = void 0;
exports.parsePermissions = parsePermissions;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const auth_config_1 = require("../config/auth.config");
let KcTokenService = class KcTokenService {
    constructor(jwtService, config, adapter) {
        this.jwtService = jwtService;
        this.config = config;
        this.adapter = adapter;
    }
    generateAccessToken(payload) {
        return this.jwtService.sign(payload, {
            expiresIn: (this.config.accessTokenExpiration || '15m'),
        });
    }
    async generateRefreshToken(userId) {
        const token = (0, crypto_1.randomBytes)(40).toString('hex');
        const days = parseInt(this.config.refreshTokenExpiration || '7d') || 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        await this.adapter.createRefreshToken({ userId, token, expiresAt });
        return token;
    }
    async refreshAccessToken(refreshToken) {
        const stored = await this.adapter.findRefreshToken(refreshToken);
        if (!stored || stored.revoked || stored.expiresAt < new Date())
            return null;
        const user = await this.adapter.findUserById(stored.userId);
        if (!user || !user.isActive)
            return null;
        await this.adapter.revokeRefreshToken(refreshToken);
        const newRefreshToken = await this.generateRefreshToken(user.id);
        const permissions = parsePermissions(user);
        const accessToken = this.generateAccessToken({
            sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? null, permissions,
        });
        return {
            accessToken, refreshToken: newRefreshToken,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId ?? null, permissions },
        };
    }
    async revokeToken(refreshToken) {
        await this.adapter.revokeRefreshToken(refreshToken);
    }
    async revokeAllUserTokens(userId) {
        await this.adapter.revokeAllUserTokens(userId);
    }
};
exports.KcTokenService = KcTokenService;
exports.KcTokenService = KcTokenService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(auth_config_1.KC_AUTH_CONFIG)),
    __param(2, (0, common_1.Inject)(auth_config_1.KC_AUTH_ADAPTER)),
    __metadata("design:paramtypes", [jwt_1.JwtService, Object, Object])
], KcTokenService);
function parsePermissions(user) {
    try {
        if (Array.isArray(user.permissions))
            return user.permissions;
        if (typeof user.permissions === 'string')
            return JSON.parse(user.permissions);
    }
    catch { }
    return [];
}
