import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';


import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KC_EMAIL_SERVICE, KcAuthConfig } from './config/auth.config';
import { KcAuthService } from './auth.service';
import { KcAuthController } from './auth.controller';
import { KcTokenService } from './tokens/jwt.service';
import { KcJwtStrategy } from './tokens/jwt.strategy';
import { TokenBlacklistService } from './tokens/token-blacklist.service';
import { KcPasswordService } from './password/password.service';
import { KcUsersService } from './users/users.service';
import { KcUsersController } from './users/users.controller';
import { KcJwtAuthGuard } from './guards/jwt-auth.guard';
import { KcRolesGuard } from './roles/roles.guard';

import { TypeOrmAuthAdapter } from './adapters/typeorm.adapter';
import { KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity } from './adapters/typeorm.entities';

@Module({})
export class KcAuthModule {
  static forRoot(config: KcAuthConfig): DynamicModule {
    const configProvider: Provider = {
      provide: KC_AUTH_CONFIG,
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

    const emailProvider: Provider = {
      provide: KC_EMAIL_SERVICE,
      useValue: null,
    };

    const imports: any[] = [
      PassportModule,
      JwtModule.register({
        secret: config.jwtSecret,
        signOptions: { expiresIn: (config.accessTokenExpiration || '15m') as any },
      }),
    ];

    const adapterProvider: Provider = { provide: KC_AUTH_ADAPTER, useClass: TypeOrmAuthAdapter };

    if (config.adapter === 'typeorm') {
      imports.push(
        TypeOrmModule.forFeature([KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity]),
      );
    }

    const authPrefix = config.routePrefix || 'auth';
    const usersPrefix = config.usersRoutePrefix || 'users';

    return {
      module: KcAuthModule,
      global: true,
      imports: [...imports],
      providers: [
        configProvider,
        emailProvider,
        adapterProvider,
        KcAuthService,
        KcTokenService,
        KcJwtStrategy,
        TokenBlacklistService,
        KcPasswordService,
        KcUsersService,
        KcJwtAuthGuard,
        KcRolesGuard,
      ],
      controllers: [KcAuthController, KcUsersController],
      exports: [
        KcAuthService,
        KcUsersService,
        KcPasswordService,
        KcTokenService,
        KcJwtAuthGuard,
        KcRolesGuard,
        KC_AUTH_CONFIG,
        KC_AUTH_ADAPTER,
      ],
    };
  }
}

@Module({})
class KcAuthInternalModule {}

@Module({})
class KcUsersInternalModule {}
