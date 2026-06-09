export declare const KC_AUTH_CONFIG = "KC_AUTH_CONFIG";
export declare const KC_AUTH_ADAPTER = "KC_AUTH_ADAPTER";
export declare const KC_EMAIL_SERVICE = "KC_EMAIL_SERVICE";
export interface KcAuthConfig {
    adapter: 'typeorm' | 'mongoose';
    jwtSecret: string;
    accessTokenExpiration?: string;
    refreshTokenExpiration?: string;
    bcryptRounds?: number;
    passwordMinLength?: number;
    enableRegistration?: boolean;
    enablePasswordRecovery?: boolean;
    verificationCodeExpiration?: string;
    verificationCodeLength?: number;
    defaultRole?: string;
    loginRateLimit?: {
        ttl: number;
        limit: number;
    };
    tokenBlacklist?: 'memory' | 'redis';
    redisUrl?: string;
    routePrefix?: string;
    usersRoutePrefix?: string;
}
export interface KcEmailService {
    sendPasswordRecoveryEmail(email: string, code: string, userName?: string): Promise<void>;
}
export interface KcAuthUser {
    id: number | string;
    email: string;
    name: string;
    role: string;
    passwordHash: string;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface KcRefreshToken {
    id: number | string;
    userId: number | string;
    token: string;
    expiresAt: Date;
    revoked: boolean;
    createdAt: Date;
}
export interface KcVerificationCode {
    id: number | string;
    userId: number | string;
    code: string;
    type: 'password_recovery' | 'email_verification';
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
}
