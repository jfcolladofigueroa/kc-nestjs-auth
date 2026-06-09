"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var KcAuthModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KcAuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const auth_config_1 = require("./config/auth.config");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_service_1 = require("./tokens/jwt.service");
const jwt_strategy_1 = require("./tokens/jwt.strategy");
const token_blacklist_service_1 = require("./tokens/token-blacklist.service");
const password_service_1 = require("./password/password.service");
const users_service_1 = require("./users/users.service");
const users_controller_1 = require("./users/users.controller");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const roles_guard_1 = require("./roles/roles.guard");
const typeorm_adapter_1 = require("./adapters/typeorm.adapter");
const typeorm_entities_1 = require("./adapters/typeorm.entities");
let KcAuthModule = KcAuthModule_1 = class KcAuthModule {
    static forRoot(config) {
        const configProvider = {
            provide: auth_config_1.KC_AUTH_CONFIG,
            useValue: {
                accessTokenExpiration: '15m',
                refreshTokenExpiration: '7d',
                bcryptRounds: 10,
                passwordMinLength: 6,
                enableRegistration: false,
                enablePasswordRecovery: true,
                verificationCodeExpiration: '60',
                verificationCodeLength: 6,
                defaultRole: 'user',
                tokenBlacklist: 'memory',
                routePrefix: 'auth',
                usersRoutePrefix: 'users',
                ...config,
            },
        };
        const emailProvider = {
            provide: auth_config_1.KC_EMAIL_SERVICE,
            useValue: null,
        };
        const imports = [
            passport_1.PassportModule,
            jwt_1.JwtModule.register({
                secret: config.jwtSecret,
                signOptions: { expiresIn: (config.accessTokenExpiration || '15m') },
            }),
        ];
        const adapterProvider = { provide: auth_config_1.KC_AUTH_ADAPTER, useClass: typeorm_adapter_1.TypeOrmAuthAdapter };
        if (config.adapter === 'typeorm') {
            imports.push(typeorm_1.TypeOrmModule.forFeature([typeorm_entities_1.KcUserEntity, typeorm_entities_1.KcRefreshTokenEntity, typeorm_entities_1.KcVerificationCodeEntity]));
        }
        const authPrefix = config.routePrefix || 'auth';
        const usersPrefix = config.usersRoutePrefix || 'users';
        return {
            module: KcAuthModule_1,
            global: true,
            imports: [...imports],
            providers: [
                configProvider,
                emailProvider,
                adapterProvider,
                auth_service_1.KcAuthService,
                jwt_service_1.KcTokenService,
                jwt_strategy_1.KcJwtStrategy,
                token_blacklist_service_1.TokenBlacklistService,
                password_service_1.KcPasswordService,
                users_service_1.KcUsersService,
                jwt_auth_guard_1.KcJwtAuthGuard,
                roles_guard_1.KcRolesGuard,
            ],
            controllers: [auth_controller_1.KcAuthController, users_controller_1.KcUsersController],
            exports: [
                auth_service_1.KcAuthService,
                users_service_1.KcUsersService,
                password_service_1.KcPasswordService,
                jwt_service_1.KcTokenService,
                jwt_auth_guard_1.KcJwtAuthGuard,
                roles_guard_1.KcRolesGuard,
                auth_config_1.KC_AUTH_CONFIG,
                auth_config_1.KC_AUTH_ADAPTER,
            ],
        };
    }
};
exports.KcAuthModule = KcAuthModule;
exports.KcAuthModule = KcAuthModule = KcAuthModule_1 = __decorate([
    (0, common_1.Module)({})
], KcAuthModule);
let KcAuthInternalModule = class KcAuthInternalModule {
};
KcAuthInternalModule = __decorate([
    (0, common_1.Module)({})
], KcAuthInternalModule);
let KcUsersInternalModule = class KcUsersInternalModule {
};
KcUsersInternalModule = __decorate([
    (0, common_1.Module)({})
], KcUsersInternalModule);
