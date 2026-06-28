// Module
export { KcAuthModule } from './auth.module';

// Services
export { KcAuthService } from './auth.service';
export { KcUsersService } from './users/users.service';
export { KcPasswordService } from './password/password.service';
export { KcTokenService } from './tokens/jwt.service';

// Guards
export { KcJwtAuthGuard } from './guards/jwt-auth.guard';
export { KcRolesGuard } from './roles/roles.guard';

// Decorators
export { Roles } from './roles/roles.decorator';
export { Permissions } from './roles/permissions.decorator';
export { Public } from './guards/public.decorator';

// Config & Interfaces
export { KcAuthConfig, KcEmailService, KcAuthUser, KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KC_EMAIL_SERVICE } from './config/auth.config';
export { AuthDatabaseAdapter } from './adapters/adapter.interface';

// DTOs
export { LoginDto } from './dto/login.dto';
export { RegisterDto } from './dto/register.dto';
export { ChangePasswordDto } from './dto/change-password.dto';
export { ForgotPasswordDto } from './dto/forgot-password.dto';
export { ResetPasswordDto } from './dto/reset-password.dto';
export { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

// Entities (for TypeORM synchronize or migrations)
export { KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity } from './adapters/typeorm.entities';
