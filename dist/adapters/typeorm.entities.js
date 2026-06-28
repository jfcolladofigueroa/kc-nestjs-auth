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
exports.KcVerificationCodeEntity = exports.KcRefreshTokenEntity = exports.KcUserEntity = void 0;
const typeorm_1 = require("typeorm");
let KcUserEntity = class KcUserEntity {
};
exports.KcUserEntity = KcUserEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], KcUserEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], KcUserEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'password_hash' }),
    __metadata("design:type", String)
], KcUserEntity.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KcUserEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'user' }),
    __metadata("design:type", String)
], KcUserEntity.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tenant_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], KcUserEntity.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '[]', type: 'text' }),
    __metadata("design:type", String)
], KcUserEntity.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', default: true }),
    __metadata("design:type", Boolean)
], KcUserEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_login_at', nullable: true, type: 'timestamp' }),
    __metadata("design:type", Date)
], KcUserEntity.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], KcUserEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], KcUserEntity.prototype, "updatedAt", void 0);
exports.KcUserEntity = KcUserEntity = __decorate([
    (0, typeorm_1.Entity)('users')
], KcUserEntity);
let KcRefreshTokenEntity = class KcRefreshTokenEntity {
};
exports.KcRefreshTokenEntity = KcRefreshTokenEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], KcRefreshTokenEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", Number)
], KcRefreshTokenEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], KcRefreshTokenEntity.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], KcRefreshTokenEntity.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], KcRefreshTokenEntity.prototype, "revoked", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], KcRefreshTokenEntity.prototype, "createdAt", void 0);
exports.KcRefreshTokenEntity = KcRefreshTokenEntity = __decorate([
    (0, typeorm_1.Entity)('auth_refresh_tokens')
], KcRefreshTokenEntity);
let KcVerificationCodeEntity = class KcVerificationCodeEntity {
};
exports.KcVerificationCodeEntity = KcVerificationCodeEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], KcVerificationCodeEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", Number)
], KcVerificationCodeEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KcVerificationCodeEntity.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], KcVerificationCodeEntity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], KcVerificationCodeEntity.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], KcVerificationCodeEntity.prototype, "used", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], KcVerificationCodeEntity.prototype, "createdAt", void 0);
exports.KcVerificationCodeEntity = KcVerificationCodeEntity = __decorate([
    (0, typeorm_1.Entity)('auth_verification_codes')
], KcVerificationCodeEntity);
