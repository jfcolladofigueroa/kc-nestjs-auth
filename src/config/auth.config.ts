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

  /**
   * Roles an `admin` may grant through `POST /users` and `PUT /users/:id`.
   * Default `['user', 'admin']`. Any other role (e.g. `'superadmin'`) can only
   * be granted by a caller for whom `KcTenantScope.isSuperadmin()` is true, or
   * by the host app calling `KcUsersService` directly. An admin can neither
   * change its own role nor edit a user whose current role is outside this
   * list. Without it, any admin could promote itself to a platform role.
   */
  assignableRoles?: string[];

  loginRateLimit?: { ttl: number; limit: number }; // default { ttl: 60, limit: 5 }

  /**
   * Verbs used when flattening a profile's permission matrix into the
   * `resource:verb` strings the guard consumes. Defaults to the Portuguese
   * verbs required by Brazilian public-sector tenders
   * (`incluir`/`alterar`/`consultar`/`excluir`).
   */
  permissionVerbs?: KcPermissionVerbs;

  /**
   * Seconds a profile's resolved permissions stay cached in memory.
   * Writes through the library's own profile endpoints invalidate the entry
   * immediately; the TTL only bounds staleness when the rows are changed from
   * outside (another instance, a SQL script). Default 300. Use 0 to disable.
   */
  profileCacheTtl?: number;

  /**
   * When true, changing a profile (or a user's profile assignment) revokes the
   * refresh tokens of every affected user, so the new permissions apply at the
   * next refresh instead of waiting for the access token to expire.
   * Default false. See "Profiles and the permission matrix" in the README.
   */
  revokeTokensOnProfileChange?: boolean;

  /**
   * How `DELETE /users/:id` behaves. `'deactivate'` (default) sets
   * `isActive = false` and keeps the row, which is the guarantee documented in
   * the README: user ids are stable and never reused, so business tables can
   * reference `auth_users.id` forever. `'hard'` restores the pre-0.3.0
   * behaviour of physically deleting the row.
   */
  userDeletionMode?: 'deactivate' | 'hard';

  /**
   * When true, a user whose password was set by someone else must choose a new
   * one before using the API. Users created through `POST /users`, and users
   * whose password an admin resets through `PUT /users/:id`, get
   * `mustChangePassword = true`; until they call `POST /auth/change-password`
   * every route behind `KcJwtAuthGuard` answers
   * `403 { code: 'PASSWORD_CHANGE_REQUIRED' }`, except the ones marked with
   * `@AllowPendingPasswordChange()` (`/auth/me`, `/auth/logout`,
   * `/auth/change-password`). Self-registered users and passwords reset with a
   * recovery code are never flagged. Default false: the flag is neither set
   * nor enforced.
   */
  forcePasswordChangeOnFirstLogin?: boolean;
}

export interface KcPermissionVerbs {
  create: string;
  update: string;
  read: string;
  delete: string;
}

/** Default verbs: `material:incluir`, `material:alterar`, ... */
export const KC_DEFAULT_PERMISSION_VERBS: KcPermissionVerbs = {
  create: 'incluir',
  update: 'alterar',
  read: 'consultar',
  delete: 'excluir',
};

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
  /**
   * Optional profile the user inherits permissions from. `null` (the default
   * for every user created before 0.3.0) means the user only has its own
   * `permissions`.
   */
  profileId?: number | string | null;
  /** Stored as a JSON string by the TypeORM adapter; custom adapters may return an array. */
  permissions?: string | string[];
  passwordHash: string;
  isActive: boolean;
  /**
   * The user must change its password before using the API. Only enforced with
   * `forcePasswordChangeOnFirstLogin`. Optional so custom adapters written
   * before 0.4.0 keep compiling; an adapter that does not persist it never
   * forces a change.
   */
  mustChangePassword?: boolean;
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

/** A named group of permissions users can be assigned to. */
export interface KcProfile {
  id: number | string;
  /** Optional multi-tenancy, consistent with KcAuthUser. */
  tenantId?: number | null;
  /** Unique per tenant. */
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One row of a profile's permission matrix: a resource by the four verbs a
 * public-sector tender asks for (include / change / query / delete).
 */
export interface KcProfilePermission {
  id: number | string;
  profileId: number | string;
  resource: string;
  canCreate: boolean;
  canUpdate: boolean;
  canRead: boolean;
  canDelete: boolean;
}

/** A matrix row as accepted when writing a profile's permissions. */
export interface KcProfilePermissionInput {
  resource: string;
  canCreate?: boolean;
  canUpdate?: boolean;
  canRead?: boolean;
  canDelete?: boolean;
}
