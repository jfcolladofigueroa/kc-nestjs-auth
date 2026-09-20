import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

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

  // No explicit column type: TypeORM picks the driver-appropriate date type
  // (timestamp on Postgres, datetime on MySQL/SQLite).
  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
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

  @Column({ name: 'expires_at' })
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  @CreateDateColumn({ name: 'created_at' })
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

  @Column({ name: 'expires_at' })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @Column({ default: 0 })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at' })
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
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
