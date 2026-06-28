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
exports.KcUsersService = void 0;
const common_1 = require("@nestjs/common");
const auth_config_1 = require("../config/auth.config");
const password_service_1 = require("../password/password.service");
let KcUsersService = class KcUsersService {
    constructor(config, adapter, passwordService) {
        this.config = config;
        this.adapter = adapter;
        this.passwordService = passwordService;
    }
    async findAll() {
        const users = await this.adapter.findAllUsers();
        return users.map(u => ({
            id: u.id, email: u.email, name: u.name, role: u.role,
            tenantId: u.tenantId ?? null,
            permissions: this.parsePermissions(u),
            isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
        }));
    }
    async create(email, password, name, role, permissions, tenantId) {
        const existing = await this.adapter.findUserByEmail(email.toLowerCase().trim());
        if (existing)
            throw new common_1.ConflictException('Email já cadastrado');
        const validation = this.passwordService.validate(password);
        if (!validation.valid)
            throw new common_1.BadRequestException(validation.message);
        const passwordHash = await this.passwordService.hash(password);
        const user = await this.adapter.createUser({
            email: email.toLowerCase().trim(),
            passwordHash,
            name,
            role: role || this.config.defaultRole || 'user',
            tenantId: tenantId ?? null,
        });
        if (permissions?.length) {
            await this.adapter.updateUser(user.id, { permissions: JSON.stringify(permissions) });
        }
        return { id: user.id, email: user.email, name: user.name, role: user.role, permissions: permissions || [] };
    }
    async update(id, data) {
        const user = await this.adapter.findUserById(id);
        if (!user)
            throw new common_1.NotFoundException('Usuário não encontrado');
        const updateData = {};
        if (data.email)
            updateData.email = data.email.toLowerCase().trim();
        if (data.name)
            updateData.name = data.name;
        if (data.role)
            updateData.role = data.role;
        if (data.isActive !== undefined)
            updateData.isActive = data.isActive;
        if (data.permissions)
            updateData.permissions = JSON.stringify(data.permissions);
        if (data.password) {
            updateData.passwordHash = await this.passwordService.hash(data.password);
        }
        const updated = await this.adapter.updateUser(id, updateData);
        return { id: updated.id, email: updated.email, name: updated.name, role: updated.role, permissions: this.parsePermissions(updated), isActive: updated.isActive };
    }
    parsePermissions(user) {
        try {
            if (Array.isArray(user.permissions))
                return user.permissions;
            if (typeof user.permissions === 'string')
                return JSON.parse(user.permissions);
        }
        catch { }
        return [];
    }
    async remove(id, currentUserId) {
        if (String(id) === String(currentUserId)) {
            throw new common_1.BadRequestException('Não é possível excluir seu próprio usuário');
        }
        const user = await this.adapter.findUserById(id);
        if (!user)
            throw new common_1.NotFoundException('Usuário não encontrado');
        await this.adapter.deleteUser(id);
    }
};
exports.KcUsersService = KcUsersService;
exports.KcUsersService = KcUsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_config_1.KC_AUTH_CONFIG)),
    __param(1, (0, common_1.Inject)(auth_config_1.KC_AUTH_ADAPTER)),
    __metadata("design:paramtypes", [Object, Object, password_service_1.KcPasswordService])
], KcUsersService);
