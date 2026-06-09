import { Strategy } from 'passport-jwt';
import { KcAuthConfig } from '../config/auth.config';
import { JwtPayload } from './jwt.service';
declare const KcJwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class KcJwtStrategy extends KcJwtStrategy_base {
    constructor(config: KcAuthConfig);
    validate(payload: JwtPayload): {
        id: string | number;
        email: string;
        role: string;
        permissions: string[];
    };
}
export {};
