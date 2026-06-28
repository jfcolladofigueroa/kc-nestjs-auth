export const KC_AUTH_CONFIG = 'KC_AUTH_CONFIG';
export const KC_AUTH_ADAPTER = 'KC_AUTH_ADAPTER';
export const KC_EMAIL_SERVICE = 'KC_EMAIL_SERVICE';
export const KC_TENANT_SCOPE = 'KC_TENANT_SCOPE';

/**
 * Resolver opcional de multi-tenancy. Se a app o prover (token KC_TENANT_SCOPE),
 * findAllUsers/createUser passam a respeitar o tenant em curso. Sem ele, o
 * comportamento é single-tenant (sem scoping) — retrocompatível.
 */
export interface KcTenantScope {
  getTenantId(): number | null;
  isSuperadmin(): boolean;
}

export interface KcAuthConfig {
  adapter: 'typeorm' | 'mongoose';

  jwtSecret: string;
  accessTokenExpiration?: string;  // default '15m'
  refreshTokenExpiration?: string; // default '7d'

  bcryptRounds?: number;           // default 10
  passwordMinLength?: number;      // default 6

  enableRegistration?: boolean;    // default false (admin creates users)
  enablePasswordRecovery?: boolean; // default true
  verificationCodeExpiration?: string; // default '1h'
  verificationCodeLength?: number; // default 6

  defaultRole?: string;            // default 'user'

  loginRateLimit?: { ttl: number; limit: number }; // default { ttl: 60, limit: 5 }

  tokenBlacklist?: 'memory' | 'redis'; // default 'memory'
  redisUrl?: string;

  routePrefix?: string;            // default 'auth'
  usersRoutePrefix?: string;       // default 'users'
}

export interface KcEmailService {
  sendPasswordRecoveryEmail(email: string, code: string, userName?: string): Promise<void>;
}

export interface KcAuthUser {
  id: number | string;
  email: string;
  name: string;
  role: string;
  /** Multi-tenancy opcional: id do tenant ao qual o usuário pertence (null = single-tenant). */
  tenantId?: number | null;
  passwordHash: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface KcRefreshToken {
  id: number | string;
  userId: number | string;
  token: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

export interface KcVerificationCode {
  id: number | string;
  userId: number | string;
  code: string;
  type: 'password_recovery' | 'email_verification';
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}
