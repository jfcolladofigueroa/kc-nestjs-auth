import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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
