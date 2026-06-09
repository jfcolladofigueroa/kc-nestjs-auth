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
exports.TypeOrmAuthAdapter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const typeorm_entities_1 = require("./typeorm.entities");
let TypeOrmAuthAdapter = class TypeOrmAuthAdapter {
    constructor(userRepo, tokenRepo, codeRepo) {
        this.userRepo = userRepo;
        this.tokenRepo = tokenRepo;
        this.codeRepo = codeRepo;
    }
    async findUserByEmail(email) {
        return this.userRepo.findOne({ where: { email } });
    }
    async findUserById(id) {
        return this.userRepo.findOne({ where: { id: Number(id) } });
    }
    async findAllUsers() {
        return this.userRepo.find({ order: { createdAt: 'DESC' } });
    }
    async createUser(data) {
        const user = this.userRepo.create(data);
        return this.userRepo.save(user);
    }
    async updateUser(id, data) {
        await this.userRepo.update(Number(id), data);
        return this.findUserById(id);
    }
    async deleteUser(id) {
        const uid = Number(id);
        // Limpiar dependencias
        await this.tokenRepo.delete({ userId: uid });
        await this.codeRepo.delete({ userId: uid });
        // Limpiar tablas del proyecto (si existen)
        try {
            await this.userRepo.query('DELETE FROM search_history WHERE user_id = $1', [uid]);
            await this.userRepo.query('DELETE FROM basket_item_observations WHERE basket_item_id IN (SELECT id FROM basket_items WHERE basket_id IN (SELECT id FROM baskets WHERE user_id = $1))', [uid]);
            await this.userRepo.query('DELETE FROM basket_items WHERE basket_id IN (SELECT id FROM baskets WHERE user_id = $1)', [uid]);
            await this.userRepo.query('DELETE FROM baskets WHERE user_id = $1', [uid]);
        }
        catch { }
        await this.userRepo.delete(uid);
    }
    async createRefreshToken(data) {
        const entity = this.tokenRepo.create({ userId: Number(data.userId), token: data.token, expiresAt: data.expiresAt });
        return this.tokenRepo.save(entity);
    }
    async findRefreshToken(token) {
        return this.tokenRepo.findOne({ where: { token } });
    }
    async revokeRefreshToken(token) {
        await this.tokenRepo.update({ token }, { revoked: true });
    }
    async revokeAllUserTokens(userId) {
        await this.tokenRepo.update({ userId: Number(userId), revoked: false }, { revoked: true });
    }
    async cleanExpiredTokens() {
        await this.tokenRepo.delete({ expiresAt: (0, typeorm_2.LessThan)(new Date()) });
    }
    async createVerificationCode(data) {
        const entity = this.codeRepo.create({ userId: Number(data.userId), code: data.code, type: data.type, expiresAt: data.expiresAt });
        return this.codeRepo.save(entity);
    }
    async findVerificationCode(email, code, type) {
        const user = await this.findUserByEmail(email);
        if (!user)
            return null;
        const codeEntity = await this.codeRepo.findOne({
            where: { userId: Number(user.id), code, type, used: false },
            order: { createdAt: 'DESC' },
        });
        if (!codeEntity)
            return null;
        return { code: codeEntity, user };
    }
    async markCodeUsed(id) {
        await this.codeRepo.update(Number(id), { used: true });
    }
};
exports.TypeOrmAuthAdapter = TypeOrmAuthAdapter;
exports.TypeOrmAuthAdapter = TypeOrmAuthAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(typeorm_entities_1.KcUserEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(typeorm_entities_1.KcRefreshTokenEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(typeorm_entities_1.KcVerificationCodeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TypeOrmAuthAdapter);
