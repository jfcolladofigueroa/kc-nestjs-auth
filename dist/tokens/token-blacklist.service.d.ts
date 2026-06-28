import { KcAuthConfig } from '../config/auth.config';
export declare class TokenBlacklistService {
    private readonly config;
    private readonly blacklist;
    constructor(config: KcAuthConfig);
    add(token: string): Promise<void>;
    isBlacklisted(token: string): Promise<boolean>;
}
