import { Injectable, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuthDatabaseAdapter } from './adapter.interface';
import { KcAuthUser, KcRefreshToken, KcVerificationCode, KC_TENANT_SCOPE, KcTenantScope } from '../config/auth.config';
import { KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity } from './typeorm.entities';

@Injectable()
export class TypeOrmAuthAdapter implements AuthDatabaseAdapter {
  constructor(
    @InjectRepository(KcUserEntity) private readonly userRepo: Repository<KcUserEntity>,
    @InjectRepository(KcRefreshTokenEntity) private readonly tokenRepo: Repository<KcRefreshTokenEntity>,
    @InjectRepository(KcVerificationCodeEntity) private readonly codeRepo: Repository<KcVerificationCodeEntity>,
    @Optional() @Inject(KC_TENANT_SCOPE) private readonly tenantScope?: KcTenantScope,
  ) {}

  /** Tenant to apply (null = no scoping: single-tenant or superadmin). */
  private get scopedTenantId(): number | null {
    if (!this.tenantScope || this.tenantScope.isSuperadmin()) return null;
    return this.tenantScope.getTenantId();
  }

  /** Adds tenantId to the filter when a tenant is active (not superadmin). */
  private scopedWhere<T extends Record<string, any>>(where: T): T {
    const tid = this.scopedTenantId;
    return (tid != null ? { ...where, tenantId: tid } : where) as T;
  }

  async findUserByEmail(email: string): Promise<KcAuthUser | null> {
    // NOT tenant-scoped: login must find the user by email without tenant context.
    return this.userRepo.findOne({ where: { email } }) as any;
  }

  async findUserById(id: number | string): Promise<KcAuthUser | null> {
    return this.userRepo.findOne({ where: this.scopedWhere({ id: Number(id) }) }) as any;
  }

  async findAllUsers(): Promise<KcAuthUser[]> {
    const tid = this.scopedTenantId;
    const where = tid != null ? { tenantId: tid } : {};
    return this.userRepo.find({ where, order: { createdAt: 'DESC' } }) as any;
  }

  async createUser(data: { email: string; passwordHash: string; name: string; role: string; tenantId?: number | null }): Promise<KcAuthUser> {
    const tid = this.scopedTenantId;
    // With an active tenant the target tenant is forced and the one in the body
    // is ignored; only a superadmin (null scope) can choose the target tenant.
    const tenantId = tid != null ? tid : (data.tenantId ?? null);
    const user = this.userRepo.create({ ...data, tenantId });
    return this.userRepo.save(user) as any;
  }

  async updateUser(id: number | string, data: Partial<any>): Promise<KcAuthUser | null> {
    const result = await this.userRepo.update(this.scopedWhere({ id: Number(id) }), data);
    if (!result.affected) return null;
    return this.findUserById(id);
  }

  async deleteUser(id: number | string): Promise<void> {
    const uid = Number(id);
    // Membership in the active tenant is checked here because the token/code
    // tables have no tenantId of their own.
    const user = await this.userRepo.findOne({ where: this.scopedWhere({ id: uid }) });
    if (!user) return;
    // Only clean up the library's own dependencies. Business tables owned by the
    // consuming app must cascade through their own FK (ON DELETE CASCADE).
    await this.userRepo.manager.transaction(async em => {
      await em.delete(KcRefreshTokenEntity, { userId: uid });
      await em.delete(KcVerificationCodeEntity, { userId: uid });
      await em.delete(KcUserEntity, uid);
    });
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

  async findLatestActiveCode(email: string, type: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return null;

    const codeEntity = await this.codeRepo.findOne({
      where: { userId: Number(user.id), type, used: false },
      order: { id: 'DESC' },
    });

    if (!codeEntity) return null;
    return { code: codeEntity as any as KcVerificationCode, user };
  }

  async incrementCodeAttempts(id: number | string): Promise<number> {
    await this.codeRepo.increment({ id: Number(id) }, 'attempts', 1);
    const entity = await this.codeRepo.findOne({ where: { id: Number(id) } });
    return entity?.attempts ?? 0;
  }

  async markCodeUsed(id: number | string): Promise<void> {
    await this.codeRepo.update(Number(id), { used: true });
  }
}
