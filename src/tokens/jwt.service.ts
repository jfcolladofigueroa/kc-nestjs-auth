import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KcAuthConfig } from '../config/auth.config';
import { AuthDatabaseAdapter } from '../adapters/adapter.interface';
import { parseDuration } from '../utils/duration.util';
import { KcPermissionsService } from '../permissions/permissions.service';

export interface JwtPayload {
  sub: number | string;
  email: string;
  role: string;
  /** Optional multi-tenancy: the user's tenant (absent in single-tenant projects). */
  tenantId?: number | null;
  /** Profile the permissions below were inherited from (null = flat permissions only). */
  profileId?: number | string | null;
  /** Effective permissions: profile ∪ own, resolved when the token was issued. */
  permissions: string[];
}

@Injectable()
export class KcTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
    private readonly permissionsService: KcPermissionsService,
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
    // Recomputed on every refresh: this is where a profile change reaches a
    // live session.
    const permissions = await this.permissionsService.getEffectivePermissions(user);
    const profileId = user.profileId ?? null;
    const accessToken = this.generateAccessToken({
      sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? null, profileId, permissions,
    });

    return {
      accessToken, refreshToken: newRefreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId ?? null, profileId, permissions },
    };
  }

  async revokeToken(refreshToken: string) {
    await this.adapter.revokeRefreshToken(refreshToken);
  }

  async revokeAllUserTokens(userId: number | string) {
    await this.adapter.revokeAllUserTokens(userId);
  }
}
