"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KcVerificationCodeEntity = exports.KcRefreshTokenEntity = exports.KcUserEntity = exports.UpdateUserDto = exports.CreateUserDto = exports.ResetPasswordDto = exports.ForgotPasswordDto = exports.ChangePasswordDto = exports.RegisterDto = exports.LoginDto = exports.KC_EMAIL_SERVICE = exports.KC_AUTH_ADAPTER = exports.KC_AUTH_CONFIG = exports.Public = exports.Permissions = exports.Roles = exports.KcRolesGuard = exports.KcJwtAuthGuard = exports.KcTokenService = exports.KcPasswordService = exports.KcUsersService = exports.KcAuthService = exports.KcAuthModule = void 0;
// Module
var auth_module_1 = require("./auth.module");
Object.defineProperty(exports, "KcAuthModule", { enumerable: true, get: function () { return auth_module_1.KcAuthModule; } });
// Services
var auth_service_1 = require("./auth.service");
Object.defineProperty(exports, "KcAuthService", { enumerable: true, get: function () { return auth_service_1.KcAuthService; } });
var users_service_1 = require("./users/users.service");
Object.defineProperty(exports, "KcUsersService", { enumerable: true, get: function () { return users_service_1.KcUsersService; } });
var password_service_1 = require("./password/password.service");
Object.defineProperty(exports, "KcPasswordService", { enumerable: true, get: function () { return password_service_1.KcPasswordService; } });
var jwt_service_1 = require("./tokens/jwt.service");
Object.defineProperty(exports, "KcTokenService", { enumerable: true, get: function () { return jwt_service_1.KcTokenService; } });
// Guards
var jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
Object.defineProperty(exports, "KcJwtAuthGuard", { enumerable: true, get: function () { return jwt_auth_guard_1.KcJwtAuthGuard; } });
var roles_guard_1 = require("./roles/roles.guard");
Object.defineProperty(exports, "KcRolesGuard", { enumerable: true, get: function () { return roles_guard_1.KcRolesGuard; } });
// Decorators
var roles_decorator_1 = require("./roles/roles.decorator");
Object.defineProperty(exports, "Roles", { enumerable: true, get: function () { return roles_decorator_1.Roles; } });
var permissions_decorator_1 = require("./roles/permissions.decorator");
Object.defineProperty(exports, "Permissions", { enumerable: true, get: function () { return permissions_decorator_1.Permissions; } });
var public_decorator_1 = require("./guards/public.decorator");
Object.defineProperty(exports, "Public", { enumerable: true, get: function () { return public_decorator_1.Public; } });
// Config & Interfaces
var auth_config_1 = require("./config/auth.config");
Object.defineProperty(exports, "KC_AUTH_CONFIG", { enumerable: true, get: function () { return auth_config_1.KC_AUTH_CONFIG; } });
Object.defineProperty(exports, "KC_AUTH_ADAPTER", { enumerable: true, get: function () { return auth_config_1.KC_AUTH_ADAPTER; } });
Object.defineProperty(exports, "KC_EMAIL_SERVICE", { enumerable: true, get: function () { return auth_config_1.KC_EMAIL_SERVICE; } });
// DTOs
var login_dto_1 = require("./dto/login.dto");
Object.defineProperty(exports, "LoginDto", { enumerable: true, get: function () { return login_dto_1.LoginDto; } });
var register_dto_1 = require("./dto/register.dto");
Object.defineProperty(exports, "RegisterDto", { enumerable: true, get: function () { return register_dto_1.RegisterDto; } });
var change_password_dto_1 = require("./dto/change-password.dto");
Object.defineProperty(exports, "ChangePasswordDto", { enumerable: true, get: function () { return change_password_dto_1.ChangePasswordDto; } });
var forgot_password_dto_1 = require("./dto/forgot-password.dto");
Object.defineProperty(exports, "ForgotPasswordDto", { enumerable: true, get: function () { return forgot_password_dto_1.ForgotPasswordDto; } });
var reset_password_dto_1 = require("./dto/reset-password.dto");
Object.defineProperty(exports, "ResetPasswordDto", { enumerable: true, get: function () { return reset_password_dto_1.ResetPasswordDto; } });
var create_user_dto_1 = require("./dto/create-user.dto");
Object.defineProperty(exports, "CreateUserDto", { enumerable: true, get: function () { return create_user_dto_1.CreateUserDto; } });
Object.defineProperty(exports, "UpdateUserDto", { enumerable: true, get: function () { return create_user_dto_1.UpdateUserDto; } });
// Entities (for TypeORM synchronize or migrations)
var typeorm_entities_1 = require("./adapters/typeorm.entities");
Object.defineProperty(exports, "KcUserEntity", { enumerable: true, get: function () { return typeorm_entities_1.KcUserEntity; } });
Object.defineProperty(exports, "KcRefreshTokenEntity", { enumerable: true, get: function () { return typeorm_entities_1.KcRefreshTokenEntity; } });
Object.defineProperty(exports, "KcVerificationCodeEntity", { enumerable: true, get: function () { return typeorm_entities_1.KcVerificationCodeEntity; } });
