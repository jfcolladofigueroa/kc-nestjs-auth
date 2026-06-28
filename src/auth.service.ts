import { Injectable, Inject, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KC_EMAIL_SERVICE, KcAuthConfig, KcEmailService } from './config/auth.config';
import { AuthDatabaseAdapter } from './adapters/adapter.interface';
import { KcTokenService, parsePermissions } from './tokens/jwt.service';
import { KcPasswordService } from './password/password.service';

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
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (!user.isActive) throw new UnauthorizedException('Usuário inativo');

    const valid = await this.passwordService.verify(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

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
    if (!this.config.enableRegistration) throw new BadRequestException('Registro não habilitado');
    const existing = await this.adapter.findUserByEmail(email.toLowerCase().trim());
    if (existing) throw new ConflictException('Email já cadastrado');
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
    if (!result) throw new UnauthorizedException('Token inválido ou expirado');
    return result;
  }

  async logout(refreshToken: string) {
    await this.tokenService.revokeToken(refreshToken);
  }

  async getMe(userId: number | string) {
    const user = await this.adapter.findUserById(userId);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId ?? null, permissions: parsePermissions(user) };
  }

  async changePassword(userId: number | string, currentPassword: string, newPassword: string) {
    const user = await this.adapter.findUserById(userId);
    if (!user) throw new UnauthorizedException();
    const valid = await this.passwordService.verify(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Senha atual incorreta');
    const validation = this.passwordService.validate(newPassword);
    if (!validation.valid) throw new BadRequestException(validation.message);
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.adapter.updateUser(userId, { passwordHash });
    await this.tokenService.revokeAllUserTokens(userId);
  }

  async forgotPassword(email: string) {
    const user = await this.adapter.findUserByEmail(email.toLowerCase().trim());
    if (!user) return;
    const code = this.passwordService.generateCode(this.config.verificationCodeLength || 6);
    const expMinutes = parseInt(this.config.verificationCodeExpiration || '60') || 60;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expMinutes);
    await this.adapter.createVerificationCode({ userId: user.id, code, type: 'password_recovery', expiresAt });
    if (this.emailService) await this.emailService.sendPasswordRecoveryEmail(user.email, code, user.name);
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const result = await this.adapter.findVerificationCode(email.toLowerCase().trim(), code, 'password_recovery');
    if (!result || result.code.used || result.code.expiresAt < new Date()) throw new BadRequestException('Código inválido ou expirado');
    const validation = this.passwordService.validate(newPassword);
    if (!validation.valid) throw new BadRequestException(validation.message);
    const passwordHash = await this.passwordService.hash(newPassword);
    await this.adapter.updateUser(result.user.id, { passwordHash });
    await this.adapter.markCodeUsed(result.code.id);
    await this.tokenService.revokeAllUserTokens(result.user.id);
  }
}
