import { JwtService } from '@nestjs/jwt';
import { KcAuthConfig } from '../config/auth.config';
import { AuthDatabaseAdapter } from '../adapters/adapter.interface';
export interface JwtPayload {
    sub: number | string;
    email: string;
    role: string;
    /** Multi-tenancy opcional: tenant do usuário (ausente em projetos single-tenant). */
    tenantId?: number | null;
    permissions: string[];
}
export declare class KcTokenService {
    private readonly jwtService;
    private readonly config;
    private readonly adapter;
    constructor(jwtService: JwtService, config: KcAuthConfig, adapter: AuthDatabaseAdapter);
    generateAccessToken(payload: JwtPayload): string;
    generateRefreshToken(userId: number | string): Promise<string>;
    refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string | number;
            email: string;
            name: string;
            role: string;
            tenantId: number | null;
            permissions: string[];
        };
    } | null>;
    revokeToken(refreshToken: string): Promise<void>;
    revokeAllUserTokens(userId: number | string): Promise<void>;
}
export declare function parsePermissions(user: any): string[];
