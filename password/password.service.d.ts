import { KcAuthConfig } from '../config/auth.config';
export declare class KcPasswordService {
    private readonly config;
    constructor(config: KcAuthConfig);
    hash(password: string): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
    validate(password: string): {
        valid: boolean;
        message?: string;
    };
    generateCode(length?: number): string;
}
