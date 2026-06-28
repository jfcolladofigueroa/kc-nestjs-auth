import { KcAuthUser, KcRefreshToken, KcVerificationCode } from '../config/auth.config';

export interface AuthDatabaseAdapter {
  // Users
  findUserByEmail(email: string): Promise<KcAuthUser | null>;
  findUserById(id: number | string): Promise<KcAuthUser | null>;
  findAllUsers(): Promise<KcAuthUser[]>;
  createUser(data: { email: string; passwordHash: string; name: string; role: string; tenantId?: number | null }): Promise<KcAuthUser>;
  updateUser(id: number | string, data: Partial<Pick<KcAuthUser, 'email' | 'name' | 'role' | 'passwordHash' | 'isActive' | 'lastLoginAt' | 'tenantId'>>): Promise<KcAuthUser>;
  deleteUser(id: number | string): Promise<void>;

  // Refresh Tokens
  createRefreshToken(data: { userId: number | string; token: string; expiresAt: Date }): Promise<KcRefreshToken>;
  findRefreshToken(token: string): Promise<KcRefreshToken | null>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllUserTokens(userId: number | string): Promise<void>;
  cleanExpiredTokens(): Promise<void>;

  // Verification Codes
  createVerificationCode(data: { userId: number | string; code: string; type: string; expiresAt: Date }): Promise<KcVerificationCode>;
  findVerificationCode(email: string, code: string, type: string): Promise<{ code: KcVerificationCode; user: KcAuthUser } | null>;
  markCodeUsed(id: number | string): Promise<void>;

  // Init (create tables/collections if needed)
  onModuleInit?(): Promise<void>;
}
