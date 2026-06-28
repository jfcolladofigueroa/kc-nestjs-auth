import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
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

  // Multi-tenancy opcional: nullable para não quebrar projetos single-tenant.
  @Column({ name: 'tenant_id', type: 'int', nullable: true })
  tenantId?: number | null;

  @Column({ default: '[]', type: 'text' })
  permissions!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamp' })
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

  @Column({ name: 'expires_at', type: 'timestamp' })
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

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
