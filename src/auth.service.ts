import { Injectable, Inject, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KC_EMAIL_SERVICE, KcAuthConfig, KcEmailService } from './config/auth.config';
import { AuthDatabaseAdapter } from './adapters/adapter.interface';
import { KcTokenService } from './tokens/jwt.service';
import { KcPasswordService } from './password/password.service';
import { parsePermissions } from './utils/permissions.util';
import { parseDuration } from './utils/duration.util';
import { safeEqual } from './utils/safe-equal.util';

@Injectable()
export class KcAuthService {
  constructor(
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
    @Inject(KC_EMAIL_SERVICE) private readonly emailService: KcEmailService | null,
    private readonly tokenService: KcTokenService,
    private readonly passwordService: KcPasswordService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.adapter.findUserByEmail(email.toLowerCase().trim());
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('User is inactive');

    const valid = await this.passwordService.verify(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.adapter.updateUser(user.id, { lastLoginAt: new Date() });

    const permissions = parsePermissions(user);
    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? null, permissions,
    });
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

    return {
      accessToken, refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId ?? null, permissions },
    };
  }

  async register(email: string, password: string, name: string) {
    if (!this.config.enableRegistration) throw new BadRequestException('Registration is not enabled');
    const existing = await this.adapter.findUserByEmail(email.toLowerCase().trim());
    if (existing) throw new ConflictException('Email already registered');
    const validation = this.passwordService.validate(password);
    if (!validation.valid) throw new BadRequestException(validation.message);
    const passwordHash = await this.passwordService.hash(password);
    const user = await this.adapter.createUser({
      email: email.toLowerCase().trim(), passwordHash, name,
      role: this.config.defaultRole || 'user',
    });
    return { id: user.id, email: user.email, name: user.name, role: user.role, permissions: [] };
  }

  async refresh(refreshToken: string) {
    const result = await this.tokenService.refreshAccessToken(refreshToken);
    if (!result) throw new UnauthorizedException('Invalid or expired token');
    return result;
  }

  async logout(refreshToken: string) {
    await this.tokenService.revokeToken(refreshToken);
  }

  async getMe(userId: number | string) {
    const user = await this.adapter.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId ?? null, permissions: parsePermissions(user) };
  }

  async changePassword(userId: number | string, currentPassword: string, newPassword: string) {
    const user = await this.adapter.findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const valid = await this.passwordService.verify(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    const validation = this.passwordService.validate(newPassword);
    if (!validation.valid) throw new BadRequestException(validation.message);
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.adapter.updateUser(userId, { passwordHash });
    await this.tokenService.revokeAllUserTokens(userId);
  }

  async forgotPassword(email: string) {
    if (!this.config.enablePasswordRecovery) throw new NotFoundException();
    const user = await this.adapter.findUserByEmail(email.toLowerCase().trim());
    if (!user) return;
    const code = this.passwordService.generateCode(this.config.verificationCodeLength || 6);
    const ttlMs = parseDuration(this.config.verificationCodeExpiration || '1h', 'verificationCodeExpiration');
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.adapter.createVerificationCode({ userId: user.id, code, type: 'password_recovery', expiresAt });
    if (this.emailService) await this.emailService.sendPasswordRecoveryEmail(user.email, code, user.name);
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    if (!this.config.enablePasswordRecovery) throw new NotFoundException();
    const result = await this.adapter.findLatestActiveCode(email.toLowerCase().trim(), 'password_recovery');
    if (!result || result.code.used || result.code.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }

    if (!safeEqual(result.code.code, code)) {
      const attempts = await this.adapter.incrementCodeAttempts(result.code.id);
      const maxAttempts = this.config.verificationCodeMaxAttempts || 5;
      if (attempts >= maxAttempts) await this.adapter.markCodeUsed(result.code.id);
      throw new BadRequestException('Invalid or expired code');
    }

    const validation = this.passwordService.validate(newPassword);
    if (!validation.valid) throw new BadRequestException(validation.message);
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.adapter.updateUser(result.user.id, { passwordHash });
    await this.adapter.markCodeUsed(result.code.id);
    await this.tokenService.revokeAllUserTokens(result.user.id);
  }
}
