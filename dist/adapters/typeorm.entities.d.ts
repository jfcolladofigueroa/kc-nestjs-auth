export declare class KcUserEntity {
    id: number;
    email: string;
    passwordHash: string;
    name: string;
    role: string;
    tenantId?: number | null;
    permissions: string;
    isActive: boolean;
    lastLoginAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class KcRefreshTokenEntity {
    id: number;
    userId: number;
    token: string;
    expiresAt: Date;
    revoked: boolean;
    createdAt: Date;
}
export declare class KcVerificationCodeEntity {
    id: number;
    userId: number;
    code: string;
    type: string;
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
}
