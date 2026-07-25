import { Injectable, Inject, Optional, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KcAuthConfig } from '../config/auth.config';
import { AuthDatabaseAdapter } from '../adapters/adapter.interface';
import { KcPasswordService } from '../password/password.service';
import { KC_USER_DELETED_EVENT, KcUserDeletedEvent } from '../events/auth.events';
import { parsePermissions } from '../utils/permissions.util';

@Injectable()
export class KcUsersService {
  constructor(
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
    private readonly passwordService: KcPasswordService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  async findAll() {
    const users = await this.adapter.findAllUsers();
    return users.map(u => ({
      id: u.id, email: u.email, name: u.name, role: u.role,
      tenantId: (u as any).tenantId ?? null,
      permissions: parsePermissions(u),
      isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
    }));
  }

  async create(email: string, password: string, name: string, role?: string, permissions?: string[], tenantId?: number | null) {
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
    });

    if (permissions?.length) {
      await this.adapter.updateUser(user.id, { permissions: JSON.stringify(permissions) } as any);
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role, permissions: permissions || [] };
  }

  async update(id: number | string, data: { email?: string; name?: string; role?: string; isActive?: boolean; password?: string; permissions?: string[] }) {
    const user = await this.adapter.findUserById(id);
    if (!user) throw new NotFoundException('User not found');

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
    if (data.password) {
      updateData.passwordHash = await this.passwordService.hash(data.password);
    }

    const updated = await this.adapter.updateUser(id, updateData);
    if (!updated) throw new NotFoundException('User not found');
    return { id: updated.id, email: updated.email, name: updated.name, role: updated.role, permissions: parsePermissions(updated), isActive: updated.isActive };
  }

  async remove(id: number | string, currentUserId: number | string) {
    if (String(id) === String(currentUserId)) {
      throw new BadRequestException('You cannot delete your own user');
    }
    const user = await this.adapter.findUserById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.adapter.deleteUser(id);

    // Notifies the consuming app so it can clean up its own data/side effects.
    // Fire-and-forget: listeners handle their own errors. Requires the app to
    // register EventEmitterModule.forRoot(); without it, eventEmitter is undefined.
    this.eventEmitter?.emit(KC_USER_DELETED_EVENT, {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: (user as any).tenantId ?? null,
    } as KcUserDeletedEvent);
  }
}
