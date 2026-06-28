import { KcAuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { KcAuthConfig } from './config/auth.config';
export declare class KcAuthController {
    private readonly authService;
    private readonly config;
    constructor(authService: KcAuthService, config: KcAuthConfig);
    login(dto: LoginDto): Promise<{
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
    }>;
    register(dto: RegisterDto): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        permissions: never[];
    }>;
    refresh(body: {
        refreshToken: string;
    }): Promise<{
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
    }>;
    logout(body: {
        refreshToken: string;
    }): Promise<void>;
    getMe(req: any): Promise<{
        id: string | number;
        email: string;
        name: string;
        role: string;
        tenantId: number | null;
        permissions: string[];
    }>;
    changePassword(req: any, dto: ChangePasswordDto): Promise<void>;
    forgotPassword(dto: ForgotPasswordDto): Promise<void>;
    resetPassword(dto: ResetPasswordDto): Promise<void>;
}
