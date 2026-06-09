import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
declare const KcJwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class KcJwtAuthGuard extends KcJwtAuthGuard_base {
    private reflector;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): any;
}
export {};
