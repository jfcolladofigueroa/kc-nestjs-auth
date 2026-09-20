import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

/**
 * Column type for every date column of the library, read once at import time.
 *
 * Unset, TypeORM picks the driver default (`timestamp` on PostgreSQL,
 * `datetime` on MySQL/SQLite) — which is what every install got before 0.3.0.
 *
 * On PostgreSQL that default is a *naive* `timestamp`: a Node process running
 * outside UTC writes its local wall clock, so a value computed in Node
 * (`expiresAt`) stops being comparable with one produced by the database
 * (`created_at` via `now()`, in UTC) and a recovery code can be born expired.
 * Set `KC_AUTH_DATE_TYPE=timestamptz` to store absolute instants instead, and
 * convert the existing columns with `ALTER TABLE ... TYPE timestamptz USING
 * col AT TIME ZONE 'UTC'`.
 *
 * It is an environment variable and not a `forRoot()` option because column
 * types are fixed when these decorators run, long before any module is
 * configured.
 */
const ALLOWED_DATE_TYPES = ['timestamptz', 'timestamp with time zone', 'timestamp', 'datetime'];
const rawDateType = process.env.KC_AUTH_DATE_TYPE?.trim();
if (rawDateType && !ALLOWED_DATE_TYPES.includes(rawDateType)) {
  throw new Error(
    `[kc-auth] KC_AUTH_DATE_TYPE="${rawDateType}" is not supported. Use one of: ${ALLOWED_DATE_TYPES.join(', ')}.`,
  );
}
// `undefined` leaves the decision to TypeORM's driver defaults.
const DATE_TYPE = (rawDateType || undefined) as any;


// Prefixed like the other library tables to avoid colliding with a host app's
// own `users` table. Migrating from <= 0.1.0: ALTER TABLE users RENAME TO auth_users;
@Entity('auth_users')
export class KcUserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column()
  name!: string;

  @Column({ default: 'user' })
  role!: string;

  // Optional multi-tenancy: nullable so single-tenant projects keep working.
  @Column({ name: 'tenant_id', type: 'int', nullable: true })
  tenantId?: number | null;

  @Column({ default: '[]', type: 'text' })
  permissions!: string;

  // Nullable on purpose: a user without a profile keeps working with its own
  // flat `permissions`, which is how every pre-0.3.0 user is stored.
  @Column({ name: 'profile_id', type: 'int', nullable: true })
  profileId?: number | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: DATE_TYPE, nullable: true })
  lastLoginAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: DATE_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATE_TYPE })
  updatedAt!: Date;
}

@Entity('auth_refresh_tokens')
export class KcRefreshTokenEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ unique: true })
  token!: string;

  @Column({ name: 'expires_at', type: DATE_TYPE })
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  @CreateDateColumn({ name: 'created_at', type: DATE_TYPE })
  createdAt!: Date;
}

@Entity('auth_verification_codes')
export class KcVerificationCodeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column()
  code!: string;

  @Column()
  type!: string;

  @Column({ name: 'expires_at', type: DATE_TYPE })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @Column({ default: 0 })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at', type: DATE_TYPE })
  createdAt!: Date;
}

// A named group of permissions. Users point at it through `auth_users.profile_id`.
@Entity('auth_profiles')
@Index('idx_auth_profiles_tenant', ['tenantId'])
export class KcProfileEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // Optional multi-tenancy, consistent with KcUserEntity.
  @Column({ name: 'tenant_id', type: 'int', nullable: true })
  tenantId?: number | null;

  // Unique per tenant. The index below cannot enforce that on Postgres when
  // tenant_id is NULL (NULL != NULL), so KcProfilesService also checks it.
  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: DATE_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATE_TYPE })
  updatedAt!: Date;
}

// One row of a profile's matrix: a resource by the four verbs a public-sector
// tender asks for. Booleans rather than a free-form array because the admin
// screen renders exactly this grid.
@Entity('auth_profile_permissions')
@Unique('uq_auth_profile_permissions', ['profileId', 'resource'])
export class KcProfilePermissionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'profile_id' })
  profileId!: number;

  @Column()
  resource!: string;

  @Column({ name: 'can_create', default: false })
  canCreate!: boolean;

  @Column({ name: 'can_update', default: false })
  canUpdate!: boolean;

  @Column({ name: 'can_read', default: false })
  canRead!: boolean;

  @Column({ name: 'can_delete', default: false })
  canDelete!: boolean;
}

/** Every entity the library owns, for the host app's TypeORM `entities` array. */
export const kcAuthEntities = [
  KcUserEntity,
  KcRefreshTokenEntity,
  KcVerificationCodeEntity,
  KcProfileEntity,
  KcProfilePermissionEntity,
];
