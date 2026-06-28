import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KcAuthConfig } from '../config/auth.config';
import { AuthDatabaseAdapter } from '../adapters/adapter.interface';
import { KcPasswordService } from '../password/password.service';

@Injectable()
export class KcUsersService {
  constructor(
    @Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig,
    @Inject(KC_AUTH_ADAPTER) private readonly adapter: AuthDatabaseAdapter,
    private readonly passwordService: KcPasswordService,
  ) {}

  async findAll() {
    const users = await this.adapter.findAllUsers();
    return users.map(u => ({
      id: u.id, email: u.email, name: u.name, role: u.role,
      tenantId: (u as any).tenantId ?? null,
      permissions: this.parsePermissions(u),
      isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
    }));
  }

  async create(email: string, password: string, name: string, role?: string, permissions?: string[], tenantId?: number | null) {
    const existing = await this.adapter.findUserByEmail(email.toLowerCase().trim());
    if (existing) throw new ConflictException('Email já cadastrado');

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
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const updateData: any = {};
    if (data.email) updateData.email = data.email.toLowerCase().trim();
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.permissions) updateData.permissions = JSON.stringify(data.permissions);
    if (data.password) {
      updateData.passwordHash = await this.passwordService.hash(data.password);
    }

    const updated = await this.adapter.updateUser(id, updateData);
    return { id: updated.id, email: updated.email, name: updated.name, role: updated.role, permissions: this.parsePermissions(updated), isActive: updated.isActive };
  }

  private parsePermissions(user: any): string[] {
    try {
      if (Array.isArray(user.permissions)) return user.permissions;
      if (typeof user.permissions === 'string') return JSON.parse(user.permissions);
    } catch {}
    return [];
  }

  async remove(id: number | string, currentUserId: number | string) {
    if (String(id) === String(currentUserId)) {
      throw new BadRequestException('Não é possível excluir seu próprio usuário');
    }
    const user = await this.adapter.findUserById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.adapter.deleteUser(id);
  }
}
