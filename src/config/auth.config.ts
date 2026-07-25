import { Provider } from '@nestjs/common';

export const KC_AUTH_CONFIG = 'KC_AUTH_CONFIG';
export const KC_AUTH_ADAPTER = 'KC_AUTH_ADAPTER';
export const KC_EMAIL_SERVICE = 'KC_EMAIL_SERVICE';
export const KC_TENANT_SCOPE = 'KC_TENANT_SCOPE';

/**
 * Optional multi-tenancy resolver. When the app provides it (KC_TENANT_SCOPE
 * token), findAllUsers/createUser respect the current tenant. Without it, the
 * behavior is single-tenant (no scoping) — backwards compatible.
 */
export interface KcTenantScope {
  getTenantId(): number | null;
  isSuperadmin(): boolean;
}

export interface KcAuthConfig {
  /**
   * Database adapter. 'typeorm' (default) uses the built-in TypeORM adapter and
   * requires TypeOrmModule.forRoot() in the host app. 'custom' plugs in your own
   * AuthDatabaseAdapter implementation via `adapterProvider`.
   */
  adapter?: 'typeorm' | 'custom';
  /**
   * Required when adapter is 'custom'. Either an AuthDatabaseAdapter class, or a
   * full provider for the KC_AUTH_ADAPTER token, e.g.
   * `{ provide: KC_AUTH_ADAPTER, useClass: MyAdapter }`.
   */
  adapterProvider?: Provider;
  /**
   * Optional KcEmailService implementation used to send password recovery
   * emails. Either a class, or a full provider for the KC_EMAIL_SERVICE token.
   * Without it, recovery codes are stored but no email is sent.
   */
  emailProvider?: Provider;

  jwtSecret: string;
  /** Duration with unit (s/m/h/d). Default '15m'. */
  accessTokenExpiration?: string;
  /** Duration with unit (s/m/h/d). Default '7d'. */
  refreshTokenExpiration?: string;

  bcryptRounds?: number;           // default 10
  passwordMinLength?: number;      // default 6

  enableRegistration?: boolean;    // default false (admin creates users)
  enablePasswordRecovery?: boolean; // default true
  /** Duration with unit (s/m/h/d). Default '1h'. */
  verificationCodeExpiration?: string;
  verificationCodeLength?: number; // default 6
  /** Failed attempts before a recovery code is invalidated. Default 5. */
  verificationCodeMaxAttempts?: number;

  defaultRole?: string;            // default 'user'

  loginRateLimit?: { ttl: number; limit: number }; // default { ttl: 60, limit: 5 }
}

export interface KcEmailService {
  sendPasswordRecoveryEmail(email: string, code: string, userName?: string): Promise<void>;
}

export interface KcAuthUser {
  id: number | string;
  email: string;
  name: string;
  role: string;
  /** Optional multi-tenancy: id of the tenant the user belongs to (null = single-tenant). */
  tenantId?: number | null;
  /** Stored as a JSON string by the TypeORM adapter; custom adapters may return an array. */
  permissions?: string | string[];
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
  /** Failed match attempts registered against this code. */
  attempts: number;
  createdAt: Date;
}
