import { Repository } from 'typeorm';
import { AuthDatabaseAdapter } from './adapter.interface';
import { KcAuthUser, KcRefreshToken, KcVerificationCode } from '../config/auth.config';
import { KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity } from './typeorm.entities';
export declare class TypeOrmAuthAdapter implements AuthDatabaseAdapter {
    private readonly userRepo;
    private readonly tokenRepo;
    private readonly codeRepo;
    constructor(userRepo: Repository<KcUserEntity>, tokenRepo: Repository<KcRefreshTokenEntity>, codeRepo: Repository<KcVerificationCodeEntity>);
    findUserByEmail(email: string): Promise<KcAuthUser | null>;
    findUserById(id: number | string): Promise<KcAuthUser | null>;
    findAllUsers(): Promise<KcAuthUser[]>;
    createUser(data: {
        email: string;
        passwordHash: string;
        name: string;
        role: string;
    }): Promise<KcAuthUser>;
    updateUser(id: number | string, data: Partial<any>): Promise<KcAuthUser>;
    deleteUser(id: number | string): Promise<void>;
    createRefreshToken(data: {
        userId: number | string;
        token: string;
        expiresAt: Date;
    }): Promise<KcRefreshToken>;
    findRefreshToken(token: string): Promise<KcRefreshToken | null>;
    revokeRefreshToken(token: string): Promise<void>;
    revokeAllUserTokens(userId: number | string): Promise<void>;
    cleanExpiredTokens(): Promise<void>;
    createVerificationCode(data: {
        userId: number | string;
        code: string;
        type: string;
        expiresAt: Date;
    }): Promise<KcVerificationCode>;
    findVerificationCode(email: string, code: string, type: string): Promise<{
        code: KcVerificationCode;
        user: KcAuthUser;
    } | null>;
    markCodeUsed(id: number | string): Promise<void>;
}
