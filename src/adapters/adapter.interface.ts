import {
  KcAuthUser,
  KcProfile,
  KcProfilePermission,
  KcProfilePermissionInput,
  KcRefreshToken,
  KcVerificationCode,
} from '../config/auth.config';

export interface AuthDatabaseAdapter {
  // Users
  findUserByEmail(email: string): Promise<KcAuthUser | null>;
  findUserById(id: number | string): Promise<KcAuthUser | null>;
  findAllUsers(): Promise<KcAuthUser[]>;
  createUser(data: { email: string; passwordHash: string; name: string; role: string; tenantId?: number | null; profileId?: number | string | null }): Promise<KcAuthUser>;
  /** Returns the updated user, or null when no row matched (e.g. tenant-scoped miss). */
  updateUser(id: number | string, data: Partial<Pick<KcAuthUser, 'email' | 'name' | 'role' | 'passwordHash' | 'isActive' | 'lastLoginAt' | 'tenantId' | 'profileId'>>): Promise<KcAuthUser | null>;
  deleteUser(id: number | string): Promise<void>;

  // Refresh Tokens
  createRefreshToken(data: { userId: number | string; token: string; expiresAt: Date }): Promise<KcRefreshToken>;
  findRefreshToken(token: string): Promise<KcRefreshToken | null>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllUserTokens(userId: number | string): Promise<void>;
  cleanExpiredTokens(): Promise<void>;

  // Verification Codes
  createVerificationCode(data: { userId: number | string; code: string; type: string; expiresAt: Date }): Promise<KcVerificationCode>;
  /** Latest unused code of the given type for the user, regardless of its value. */
  findLatestActiveCode(email: string, type: string): Promise<{ code: KcVerificationCode; user: KcAuthUser } | null>;
  /** Registers a failed match attempt and returns the updated attempt count. */
  incrementCodeAttempts(id: number | string): Promise<number>;
  markCodeUsed(id: number | string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Profiles (optional since 0.3.0)
  //
  // An adapter written against 0.2.0 keeps compiling and working: without these
  // methods a user's effective permissions are exactly its own `permissions`,
  // and the profile endpoints answer 501 Not Implemented.
  // ---------------------------------------------------------------------------

  findProfileById?(id: number | string): Promise<KcProfile | null>;
  findProfileByName?(name: string, tenantId?: number | null): Promise<KcProfile | null>;
  findAllProfiles?(options?: { includeInactive?: boolean }): Promise<KcProfile[]>;
  createProfile?(data: { name: string; description?: string | null; tenantId?: number | null }): Promise<KcProfile>;
  /** Returns the updated profile, or null when no row matched. */
  updateProfile?(id: number | string, data: Partial<Pick<KcProfile, 'name' | 'description' | 'isActive'>>): Promise<KcProfile | null>;
  /** The profile's permission matrix. Missing rows mean "no access to that resource". */
  findProfilePermissions?(profileId: number | string): Promise<KcProfilePermission[]>;
  /** Replaces the whole matrix of a profile and returns the stored result. */
  setProfilePermissions?(profileId: number | string, permissions: KcProfilePermissionInput[]): Promise<KcProfilePermission[]>;
  /** Ids of the users assigned to a profile. Used to revoke their tokens after a change. */
  findUserIdsByProfile?(profileId: number | string): Promise<(number | string)[]>;

  // Init (create tables/collections if needed)
  onModuleInit?(): Promise<void>;
}

/** True when the adapter implements the optional profile surface. */
export function supportsProfiles(adapter: AuthDatabaseAdapter): boolean {
  return (
    typeof adapter.findProfileById === 'function' &&
    typeof adapter.findProfilePermissions === 'function'
  );
}
