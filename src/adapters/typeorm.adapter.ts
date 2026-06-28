import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuthDatabaseAdapter } from './adapter.interface';
import { KcAuthUser, KcRefreshToken, KcVerificationCode } from '../config/auth.config';
import { KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity } from './typeorm.entities';

@Injectable()
export class TypeOrmAuthAdapter implements AuthDatabaseAdapter {
  constructor(
    @InjectRepository(KcUserEntity) private readonly userRepo: Repository<KcUserEntity>,
    @InjectRepository(KcRefreshTokenEntity) private readonly tokenRepo: Repository<KcRefreshTokenEntity>,
    @InjectRepository(KcVerificationCodeEntity) private readonly codeRepo: Repository<KcVerificationCodeEntity>,
  ) {}

  async findUserByEmail(email: string): Promise<KcAuthUser | null> {
    return this.userRepo.findOne({ where: { email } }) as any;
  }

  async findUserById(id: number | string): Promise<KcAuthUser | null> {
    return this.userRepo.findOne({ where: { id: Number(id) } }) as any;
  }

  async findAllUsers(): Promise<KcAuthUser[]> {
    return this.userRepo.find({ order: { createdAt: 'DESC' } }) as any;
  }

  async createUser(data: { email: string; passwordHash: string; name: string; role: string }): Promise<KcAuthUser> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user) as any;
  }

  async updateUser(id: number | string, data: Partial<any>): Promise<KcAuthUser> {
    await this.userRepo.update(Number(id), data);
    return this.findUserById(id) as any;
  }

  async deleteUser(id: number | string): Promise<void> {
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
    } catch {}
    await this.userRepo.delete(uid);
  }

  async createRefreshToken(data: { userId: number | string; token: string; expiresAt: Date }): Promise<KcRefreshToken> {
    const entity = this.tokenRepo.create({ userId: Number(data.userId), token: data.token, expiresAt: data.expiresAt });
    return this.tokenRepo.save(entity) as any;
  }

  async findRefreshToken(token: string): Promise<KcRefreshToken | null> {
    return this.tokenRepo.findOne({ where: { token } }) as any;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.tokenRepo.update({ token }, { revoked: true });
  }

  async revokeAllUserTokens(userId: number | string): Promise<void> {
    await this.tokenRepo.update({ userId: Number(userId), revoked: false }, { revoked: true });
  }

  async cleanExpiredTokens(): Promise<void> {
    await this.tokenRepo.delete({ expiresAt: LessThan(new Date()) });
  }

  async createVerificationCode(data: { userId: number | string; code: string; type: string; expiresAt: Date }): Promise<KcVerificationCode> {
    const entity = this.codeRepo.create({ userId: Number(data.userId), code: data.code, type: data.type, expiresAt: data.expiresAt });
    return this.codeRepo.save(entity) as any;
  }

  async findVerificationCode(email: string, code: string, type: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return null;

    const codeEntity = await this.codeRepo.findOne({
      where: { userId: Number(user.id), code, type, used: false },
      order: { createdAt: 'DESC' },
    });

    if (!codeEntity) return null;
    return { code: codeEntity as any as KcVerificationCode, user };
  }

  async markCodeUsed(id: number | string): Promise<void> {
    await this.codeRepo.update(Number(id), { used: true });
  }
}
