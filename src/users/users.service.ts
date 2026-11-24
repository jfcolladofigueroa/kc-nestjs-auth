import { Injectable, Inject, Optional, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KC_TENANT_SCOPE, KcAuthConfig, KcTenantScope } from '../config/auth.config';
import { AuthDatabaseAdapter } from '../adapters/adapter.interface';
import { KcPasswordService } from '../password/password.service';
import { KC_USER_DEACTIVATED_EVENT, KC_USER_DELETED_EVENT, KcUserDeletedEvent } from '../events/auth.events';
import { parsePermissions } from '../utils/permissions.util';
import { KcPermissionsService } from '../permissions/permissions.service';
import { KcTokenService } from '../tokens/jwt.service';

@Injectable()
export class KcUsersService {
  constructor(
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
    private readonly passwordService: KcPasswordService,
    private readonly permissionsService: KcPermissionsService,
    private readonly tokenService: KcTokenService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() @Inject(KC_TENANT_SCOPE) private readonly tenantScope?: KcTenantScope,
  ) {}

  /**
   * `caller` is the authenticated user behind an HTTP request. When it is
   * absent the call comes from the host app's own code, which is trusted.
   */
  private isPrivilegedCaller(): boolean {
    return !!this.tenantScope?.isSuperadmin();
  }

  private isAssignable(role: string): boolean {
    const allowed = this.config.assignableRoles ?? ['user', 'admin'];
    return allowed.includes(role);
  }

  private assertCanAssignRole(role: string, caller?: { id?: number | string }): void {
    if (!caller || this.isPrivilegedCaller()) return;
    if (!this.isAssignable(role)) {
      throw new ForbiddenException(`Role "${role}" cannot be assigned`);
    }
  }

  async findAll() {
    const users = await this.adapter.findAllUsers();
    // `permissions` stays the user's own list (that is what the admin screen
    // edits); `effectivePermissions` adds what the profile grants. Profile
    // lookups are cached per profile, so a shared profile costs one query.
    return Promise.all(
      users.map(async u => ({
        id: u.id, email: u.email, name: u.name, role: u.role,
        tenantId: (u as any).tenantId ?? null,
        profileId: u.profileId ?? null,
        permissions: parsePermissions(u),
        effectivePermissions: await this.permissionsService.getEffectivePermissions(u),
        isActive: u.isActive, mustChangePassword: this.tokenService.mustChangePassword(u),
        lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
      })),
    );
  }

  /** Whether a forced password change applies (the option is on), and the value requested or defaulted. */
  private forcedChange(requested: boolean | undefined, byDefault: boolean): boolean | undefined {
    if (!this.config.forcePasswordChangeOnFirstLogin) return undefined;
    return requested ?? byDefault;
  }

  /**
   * With `forcePasswordChangeOnFirstLogin`, the new user must change its
   * password at the first login (its password was chosen by someone else),
   * unless `options.mustChangePassword` is false.
   */
  async create(email: string, password: string, name: string, role?: string, permissions?: string[], tenantId?: number | null, profileId?: number | string | null, caller?: { id?: number | string }, options?: { mustChangePassword?: boolean }) {
    if (role) this.assertCanAssignRole(role, caller);
    const existing = await this.adapter.findUserByEmail(email.toLowerCase().trim());
    if (existing) throw new ConflictException('Email already registered');

    const validation = this.passwordService.validate(password);
    if (!validation.valid) throw new BadRequestException(validation.message);

    const passwordHash = await this.passwordService.hash(password);
    const user = await this.adapter.createUser({
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      role: role || this.config.defaultRole || 'user',
      tenantId: tenantId ?? null,
      profileId: await this.validateProfile(profileId),
      ...(this.forcedChange(options?.mustChangePassword, true) ? { mustChangePassword: true } : {}),
    });

    if (permissions?.length) {
      await this.adapter.updateUser(user.id, { permissions: JSON.stringify(permissions) } as any);
    }
    return {
      id: user.id, email: user.email, name: user.name, role: user.role,
      profileId: user.profileId ?? null,
      permissions: permissions || [],
      mustChangePassword: this.tokenService.mustChangePassword(user),
    };
  }

  async update(id: number | string, data: { email?: string; name?: string; role?: string; isActive?: boolean; password?: string; permissions?: string[]; profileId?: number | string | null; mustChangePassword?: boolean }, caller?: { id?: number | string }) {
    const user = await this.adapter.findUserById(id);
    if (!user) throw new NotFoundException('User not found');

    if (caller && !this.isPrivilegedCaller()) {
      // A user holding a role the caller cannot grant (e.g. 'superadmin') is
      // out of reach: otherwise an admin could take it over by changing its
      // email or password.
      if (!this.isAssignable(user.role)) {
        throw new ForbiddenException('You cannot modify this user');
      }
      if (data.role && data.role !== user.role) {
        if (String(id) === String(caller.id)) {
          throw new BadRequestException('You cannot change your own role');
        }
        this.assertCanAssignRole(data.role, caller);
      }
    }

    const updateData: any = {};
    if (data.email) {
      const newEmail = data.email.toLowerCase().trim();
      if (newEmail !== user.email) {
        const existing = await this.adapter.findUserByEmail(newEmail);
        if (existing && String(existing.id) !== String(id)) {
          throw new ConflictException('Email already registered');
        }
      }
      updateData.email = newEmail;
    }
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.permissions) updateData.permissions = JSON.stringify(data.permissions);
    if (data.profileId !== undefined) {
      updateData.profileId = await this.validateProfile(data.profileId);
    }
    if (data.password) {
      updateData.passwordHash = await this.passwordService.hash(data.password);
    }
    // A password set by someone else must be changed at the next login; an
    // admin resetting its own password through this endpoint chose it itself.
    const isSelf = caller !== undefined && String(id) === String(caller.id);
    const forced = this.forcedChange(data.mustChangePassword, !!data.password && !isSelf);
    if (forced !== undefined && (data.password || data.mustChangePassword !== undefined)) {
      if (forced || user.mustChangePassword) updateData.mustChangePassword = forced;
    }

    const updated = await this.adapter.updateUser(id, updateData);
    if (!updated) throw new NotFoundException('User not found');

    // A profile reassignment only reaches a live session on its next refresh,
    // unless the app opted into revoking tokens on profile changes.
    if (data.profileId !== undefined && this.config.revokeTokensOnProfileChange) {
      await this.tokenService.revokeAllUserTokens(id);
    }

    return {
      id: updated.id, email: updated.email, name: updated.name, role: updated.role,
      profileId: updated.profileId ?? null,
      permissions: parsePermissions(updated),
      effectivePermissions: await this.permissionsService.getEffectivePermissions(updated),
      isActive: updated.isActive,
      mustChangePassword: this.tokenService.mustChangePassword(updated),
    };
  }

  /**
   * Removes a user. By default this is a *logical* removal: the row stays,
   * `isActive` becomes false and every refresh token is revoked. That is the
   * guarantee the README documents — ids are stable and never reused, so the
   * consuming app's immutable ledgers can reference `auth_users.id` for a
   * decade. Set `userDeletionMode: 'hard'` to restore the pre-0.3.0 behaviour.
   */
  async remove(id: number | string, currentUserId: number | string) {
    if (String(id) === String(currentUserId)) {
      throw new BadRequestException('You cannot delete your own user');
    }
    const user = await this.adapter.findUserById(id);
    if (!user) throw new NotFoundException('User not found');

    const hard = this.config.userDeletionMode === 'hard';
    if (hard) {
      await this.adapter.deleteUser(id);
    } else {
      const updated = await this.adapter.updateUser(id, { isActive: false });
      if (!updated) throw new NotFoundException('User not found');
      await this.tokenService.revokeAllUserTokens(id);
      this.eventEmitter?.emit(KC_USER_DEACTIVATED_EVENT, {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: (user as any).tenantId ?? null,
      } as KcUserDeletedEvent);
    }

    // Emitted in both modes so listeners written against 0.2.0 keep firing;
    // `deletionMode` tells them whether the row is actually gone.
    // Fire-and-forget: listeners handle their own errors. Requires the app to
    // register EventEmitterModule.forRoot(); without it, eventEmitter is undefined.
    this.eventEmitter?.emit(KC_USER_DELETED_EVENT, {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: (user as any).tenantId ?? null,
      deletionMode: hard ? 'hard' : 'deactivate',
    } as KcUserDeletedEvent);
  }

  /**
   * Resolves a profile assignment. Returns null for "no profile" and rejects a
   * profile that does not exist, so a typo cannot silently leave a user with no
   * inherited permissions.
   */
  private async validateProfile(profileId?: number | string | null): Promise<number | string | null> {
    if (profileId === undefined || profileId === null || profileId === '') return null;
    if (!this.permissionsService.profilesEnabled) {
      throw new BadRequestException('The configured auth adapter does not support profiles');
    }
    const profile = await this.adapter.findProfileById!(profileId);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile.id;
  }
}
