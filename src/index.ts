// Module
export { KcAuthModule } from './auth.module';

// Services
export { KcAuthService } from './auth.service';
export { KcUsersService } from './users/users.service';
export { KcPasswordService } from './password/password.service';
export { KcTokenService } from './tokens/jwt.service';
export { KcPermissionsService } from './permissions/permissions.service';
export { KcProfilesService } from './profiles/profiles.service';

// Guards
export { KcJwtAuthGuard } from './guards/jwt-auth.guard';
export { KcRolesGuard } from './roles/roles.guard';
export { KcRateLimitGuard } from './security/rate-limit.guard';

// Decorators
export { Roles } from './roles/roles.decorator';
export { Permissions } from './roles/permissions.decorator';
export { Public } from './guards/public.decorator';

// Config & Interfaces
export {
  KcAuthConfig, KcEmailService, KcAuthUser, KcTenantScope,
  KcProfile, KcProfilePermission, KcProfilePermissionInput,
  KcPermissionVerbs, KC_DEFAULT_PERMISSION_VERBS,
  KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KC_EMAIL_SERVICE, KC_TENANT_SCOPE,
} from './config/auth.config';
export { AuthDatabaseAdapter, supportsProfiles } from './adapters/adapter.interface';

// Permission helpers
export { parsePermissions, permissionsFromMatrix, resolveEffectivePermissions } from './utils/permissions.util';
export { KC_PROFILE_READ_PERMISSION, KC_PROFILE_WRITE_PERMISSION } from './profiles/profile.permissions';

// Events
export { KC_USER_DELETED_EVENT, KC_USER_DEACTIVATED_EVENT, KcUserDeletedEvent } from './events/auth.events';

// DTOs
export { LoginDto } from './dto/login.dto';
export { RegisterDto } from './dto/register.dto';
export { ChangePasswordDto } from './dto/change-password.dto';
export { ForgotPasswordDto } from './dto/forgot-password.dto';
export { ResetPasswordDto } from './dto/reset-password.dto';
export { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
export { CreateProfileDto, UpdateProfileDto, ProfilePermissionDto, SetProfilePermissionsDto } from './dto/profile.dto';

// Entities (for TypeORM synchronize or migrations)
export {
  KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity,
  KcProfileEntity, KcProfilePermissionEntity,
} from './adapters/typeorm.entities';

/**
 * Entities owned by the library. Spread into your TypeORM `entities` array:
 * `entities: [...kcAuthEntities, ...myEntities]`.
 */
export { kcAuthEntities } from './adapters/typeorm.entities';

// Migrations (run before your application's, see README)
export { kcAuthMigrations, KcAuthInitialSchema1000000000001, KcAuthProfiles1000000000002 } from './migrations';
