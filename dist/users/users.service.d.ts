import { KcAuthConfig } from '../config/auth.config';
import { AuthDatabaseAdapter } from '../adapters/adapter.interface';
import { KcPasswordService } from '../password/password.service';
export declare class KcUsersService {
    private readonly config;
    private readonly adapter;
    private readonly passwordService;
    constructor(config: KcAuthConfig, adapter: AuthDatabaseAdapter, passwordService: KcPasswordService);
    findAll(): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        tenantId: any;
        permissions: string[];
        isActive: boolean;
        lastLoginAt: Date | undefined;
        createdAt: Date;
    }[]>;
    create(email: string, password: string, name: string, role?: string, permissions?: string[], tenantId?: number | null): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        permissions: string[];
    }>;
    update(id: number | string, data: {
        email?: string;
        name?: string;
        role?: string;
        isActive?: boolean;
        password?: string;
        permissions?: string[];
    }): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        permissions: string[];
        isActive: boolean;
    }>;
    private parsePermissions;
    remove(id: number | string, currentUserId: number | string): Promise<void>;
}
