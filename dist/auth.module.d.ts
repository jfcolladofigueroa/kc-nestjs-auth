import { DynamicModule } from '@nestjs/common';
import { KcAuthConfig } from './config/auth.config';
export declare class KcAuthModule {
    static forRoot(config: KcAuthConfig): DynamicModule;
}
