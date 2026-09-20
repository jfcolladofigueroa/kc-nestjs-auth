import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import {
  KC_AUTH_ADAPTER,
  KC_AUTH_CONFIG,
  KcAuthConfig,
  KcProfile,
  KcProfilePermission,
  KcProfilePermissionInput,
} from '../config/auth.config';
import { AuthDatabaseAdapter, supportsProfiles } from '../adapters/adapter.interface';
import { KcPermissionsService } from '../permissions/permissions.service';
import { KcTokenService } from '../tokens/jwt.service';
import { permissionsFromMatrix } from '../utils/permissions.util';

@Injectable()
export class KcProfilesService {
  constructor(
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
    private readonly permissionsService: KcPermissionsService,
    private readonly tokenService: KcTokenService,
  ) {}

  /** Adapters are free not to implement profiles; say so clearly instead of crashing. */
  private assertSupported(): void {
    if (!supportsProfiles(this.adapter)) {
      throw new NotImplementedException(
        'The configured auth adapter does not implement profiles. Implement the optional profile methods of AuthDatabaseAdapter.',
      );
    }
  }

  private view(profile: KcProfile, matrix?: KcProfilePermission[]) {
    return {
      id: profile.id,
      tenantId: profile.tenantId ?? null,
      name: profile.name,
      description: profile.description ?? null,
      isActive: profile.isActive,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      ...(matrix
        ? {
            permissions: matrix.map(p => ({
              resource: p.resource,
              canCreate: !!p.canCreate,
              canUpdate: !!p.canUpdate,
              canRead: !!p.canRead,
              canDelete: !!p.canDelete,
            })),
            // The flattened `resource:verb` strings the guard would see.
            permissionStrings: permissionsFromMatrix(matrix, this.permissionsService.verbs),
          }
        : {}),
    };
  }

  async findAll(includeInactive = false) {
    this.assertSupported();
    const profiles = await this.adapter.findAllProfiles!({ includeInactive });
    return profiles.map(p => this.view(p));
  }

  async findOne(id: number | string) {
    this.assertSupported();
    const profile = await this.adapter.findProfileById!(id);
    if (!profile) throw new NotFoundException('Profile not found');
    const matrix = await this.adapter.findProfilePermissions!(id);
    return this.view(profile, matrix);
  }

  async create(data: { name: string; description?: string; tenantId?: number | null; permissions?: KcProfilePermissionInput[] }) {
    this.assertSupported();
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Profile name is required');

    await this.assertNameFree(name, data.tenantId ?? null);

    const profile = await this.adapter.createProfile!({
      name,
      description: data.description?.trim() || null,
      tenantId: data.tenantId ?? null,
    });

    let matrix: KcProfilePermission[] = [];
    if (data.permissions?.length) {
      matrix = await this.adapter.setProfilePermissions!(profile.id, data.permissions);
    }
    this.permissionsService.invalidateProfile(profile.id);
    return this.view(profile, matrix);
  }

  async update(id: number | string, data: { name?: string; description?: string; isActive?: boolean }) {
    this.assertSupported();
    const existing = await this.adapter.findProfileById!(id);
    if (!existing) throw new NotFoundException('Profile not found');

    const payload: Record<string, any> = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Profile name is required');
      if (name !== existing.name) await this.assertNameFree(name, existing.tenantId ?? null, id);
      payload.name = name;
    }
    if (data.description !== undefined) payload.description = data.description.trim() || null;
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    const updated = await this.adapter.updateProfile!(id, payload);
    if (!updated) throw new NotFoundException('Profile not found');

    await this.afterPermissionsChanged(id);
    const matrix = await this.adapter.findProfilePermissions!(id);
    return this.view(updated, matrix);
  }

  /** Logical removal: the profile is deactivated, never deleted. */
  async deactivate(id: number | string) {
    this.assertSupported();
    const profile = await this.adapter.findProfileById!(id);
    if (!profile) throw new NotFoundException('Profile not found');
    const updated = await this.adapter.updateProfile!(id, { isActive: false });
    if (!updated) throw new NotFoundException('Profile not found');
    // Users keep pointing at it; an inactive profile simply grants nothing,
    // leaving each user with its own permissions.
    await this.afterPermissionsChanged(id);
    return this.view(updated);
  }

  async getPermissions(id: number | string) {
    this.assertSupported();
    const profile = await this.adapter.findProfileById!(id);
    if (!profile) throw new NotFoundException('Profile not found');
    const matrix = await this.adapter.findProfilePermissions!(id);
    return this.view(profile, matrix);
  }

  /** Replaces the complete matrix of a profile. */
  async setPermissions(id: number | string, permissions: KcProfilePermissionInput[]) {
    this.assertSupported();
    const profile = await this.adapter.findProfileById!(id);
    if (!profile) throw new NotFoundException('Profile not found');

    const seen = new Set<string>();
    for (const row of permissions ?? []) {
      const resource = row?.resource?.trim();
      if (!resource) throw new BadRequestException('Every permission row needs a resource');
      if (seen.has(resource)) throw new BadRequestException(`Duplicated resource "${resource}"`);
      seen.add(resource);
    }

    const matrix = await this.adapter.setProfilePermissions!(id, permissions ?? []);
    await this.afterPermissionsChanged(id);
    return this.view(profile, matrix);
  }

  private async assertNameFree(name: string, tenantId: number | null, excludeId?: number | string) {
    if (typeof this.adapter.findProfileByName !== 'function') return;
    const clash = await this.adapter.findProfileByName(name, tenantId);
    if (clash && (excludeId === undefined || String(clash.id) !== String(excludeId))) {
      throw new ConflictException('A profile with that name already exists');
    }
  }

  /**
   * Effective permissions travel inside the access token, so a matrix change
   * only reaches a session on its next refresh (<= accessTokenExpiration).
   * With `revokeTokensOnProfileChange` the refresh tokens of the affected users
   * are revoked too, forcing a new login.
   */
  private async afterPermissionsChanged(profileId: number | string) {
    this.permissionsService.invalidateProfile(profileId);
    if (!this.config.revokeTokensOnProfileChange) return;
    if (typeof this.adapter.findUserIdsByProfile !== 'function') return;
    const userIds = await this.adapter.findUserIdsByProfile(profileId);
    for (const userId of userIds) {
      await this.tokenService.revokeAllUserTokens(userId);
    }
  }
}
