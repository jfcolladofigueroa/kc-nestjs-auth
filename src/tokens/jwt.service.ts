import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KcAuthConfig } from '../config/auth.config';
import { AuthDatabaseAdapter } from '../adapters/adapter.interface';
import { parsePermissions } from '../utils/permissions.util';
import { parseDuration } from '../utils/duration.util';

export interface JwtPayload {
  sub: number | string;
  email: string;
  role: string;
  /** Optional multi-tenancy: the user's tenant (absent in single-tenant projects). */
  tenantId?: number | null;
  permissions: string[];
}

@Injectable()
export class KcTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
  ) {}

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload as any, {
      expiresIn: (this.config.accessTokenExpiration || '15m') as any,
    });
  }

  async generateRefreshToken(userId: number | string): Promise<string> {
    const token = randomBytes(40).toString('hex');
    const ttlMs = parseDuration(this.config.refreshTokenExpiration || '7d', 'refreshTokenExpiration');
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.adapter.createRefreshToken({ userId, token, expiresAt });
    return token;
  }

  async refreshAccessToken(refreshToken: string) {
    const stored = await this.adapter.findRefreshToken(refreshToken);
    if (!stored || stored.revoked || stored.expiresAt < new Date()) return null;

    const user = await this.adapter.findUserById(stored.userId);
    if (!user || !user.isActive) return null;

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

  async revokeToken(refreshToken: string) {
    await this.adapter.revokeRefreshToken(refreshToken);
  }

  async revokeAllUserTokens(userId: number | string) {
    await this.adapter.revokeAllUserTokens(userId);
  }
}
