import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  KC_AUTH_ADAPTER,
  KC_AUTH_CONFIG,
  KC_DEFAULT_PERMISSION_VERBS,
  KcAuthConfig,
  KcAuthUser,
  KcPermissionVerbs,
} from '../config/auth.config';
import { AuthDatabaseAdapter, supportsProfiles } from '../adapters/adapter.interface';
import { permissionsFromMatrix, resolveEffectivePermissions } from '../utils/permissions.util';

interface CacheEntry {
  permissions: string[];
  expiresAt: number;
}

/**
 * Resolves the permissions a user effectively has:
 *
 *     effective = profile permissions ∪ the user's own permissions
 *
 * The profile side is cached per profile id, not per user, so a profile shared
 * by 65 users costs one query. The guard never touches this service: effective
 * permissions are computed once, when the access token is issued, and travel
 * inside the JWT.
 */
@Injectable()
export class KcPermissionsService {
  private readonly logger = new Logger(KcPermissionsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
  ) {}

  get verbs(): KcPermissionVerbs {
    return this.config.permissionVerbs ?? KC_DEFAULT_PERMISSION_VERBS;
  }

  /** True when the configured adapter implements the optional profile surface. */
  get profilesEnabled(): boolean {
    return supportsProfiles(this.adapter);
  }

  /**
   * The `resource:verb` strings granted by a profile, cached for
   * `profileCacheTtl` seconds. An inactive profile grants nothing.
   */
  async getProfilePermissions(profileId: number | string | null | undefined): Promise<string[]> {
    if (profileId === null || profileId === undefined) return [];
    if (!this.profilesEnabled) return [];

    const key = String(profileId);
    const ttlMs = (this.config.profileCacheTtl ?? 300) * 1000;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    let permissions: string[] = [];
    try {
      const profile = await this.adapter.findProfileById!(profileId);
      if (profile && profile.isActive) {
        const matrix = await this.adapter.findProfilePermissions!(profileId);
        permissions = permissionsFromMatrix(matrix, this.verbs);
      }
    } catch (err) {
      // A profile lookup must never cost a user their login. Falling back to
      // the user's own permissions is the pre-0.3.0 behaviour.
      this.logger.error(`Could not resolve permissions for profile ${key}: ${(err as Error).message}`);
      return [];
    }

    if (ttlMs > 0) this.cache.set(key, { permissions, expiresAt: Date.now() + ttlMs });
    return permissions;
  }

  /** Effective permissions of a user record (profile ∪ own). */
  async getEffectivePermissions(user: Pick<KcAuthUser, 'permissions' | 'profileId'>): Promise<string[]> {
    const fromProfile = await this.getProfilePermissions(user?.profileId ?? null);
    return resolveEffectivePermissions(user, fromProfile, this.verbs);
  }

  /** Drops a profile from the cache (call after writing its matrix). */
  invalidateProfile(profileId: number | string): void {
    this.cache.delete(String(profileId));
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
