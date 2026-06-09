import { KcAuthConfig, KcEmailService } from './config/auth.config';
import { AuthDatabaseAdapter } from './adapters/adapter.interface';
import { KcTokenService } from './tokens/jwt.service';
import { KcPasswordService } from './password/password.service';
export declare class KcAuthService {
    private readonly config;
    private readonly adapter;
    private readonly emailService;
    private readonly tokenService;
    private readonly passwordService;
    constructor(config: KcAuthConfig, adapter: AuthDatabaseAdapter, emailService: KcEmailService | null, tokenService: KcTokenService, passwordService: KcPasswordService);
    login(email: string, password: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string | number;
            email: string;
            name: string;
            role: string;
            permissions: string[];
        };
    }>;
    register(email: string, password: string, name: string): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        permissions: never[];
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string | number;
            email: string;
            name: string;
            role: string;
            permissions: string[];
        };
    }>;
    logout(refreshToken: string): Promise<void>;
    getMe(userId: number | string): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        permissions: string[];
    }>;
    changePassword(userId: number | string, currentPassword: string, newPassword: string): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    resetPassword(email: string, code: string, newPassword: string): Promise<void>;
}
