import { DynamicModule, Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';


import { KC_AUTH_CONFIG, KC_AUTH_ADAPTER, KC_EMAIL_SERVICE, KcAuthConfig } from './config/auth.config';
import { KcAuthService } from './auth.service';
import { KcAuthController } from './auth.controller';
import { KcTokenService } from './tokens/jwt.service';
import { KcJwtStrategy } from './tokens/jwt.strategy';
import { KcPasswordService } from './password/password.service';
import { KcUsersService } from './users/users.service';
import { KcUsersController } from './users/users.controller';
import { KcJwtAuthGuard } from './guards/jwt-auth.guard';
import { KcRolesGuard } from './roles/roles.guard';
import { KcRateLimitGuard } from './security/rate-limit.guard';
import { parseDuration } from './utils/duration.util';

import { TypeOrmAuthAdapter } from './adapters/typeorm.adapter';
import { KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity } from './adapters/typeorm.entities';

@Module({})
export class KcAuthModule {
  static forRoot(config: KcAuthConfig): DynamicModule {
    if (!config?.jwtSecret?.trim()) {
      throw new Error('[KcAuthModule] "jwtSecret" is required and cannot be empty.');
    }

    // adapterProvider/emailProvider are DI wiring, not runtime config: keep them
    // out of the injected value.
    const { adapterProvider: customAdapter, emailProvider: customEmail, ...runtimeConfig } = config;

    const resolvedConfig: KcAuthConfig = {
      adapter: 'typeorm',
      accessTokenExpiration: '15m',
      refreshTokenExpiration: '7d',
      bcryptRounds: 10,
      passwordMinLength: 6,
      enableRegistration: false,
      enablePasswordRecovery: true,
      verificationCodeExpiration: '1h',
      verificationCodeLength: 6,
      verificationCodeMaxAttempts: 5,
      defaultRole: 'user',
      loginRateLimit: { ttl: 60, limit: 5 },
      ...runtimeConfig,
    };

    // Fail fast on malformed durations instead of surfacing at first use.
    parseDuration(resolvedConfig.accessTokenExpiration!, 'accessTokenExpiration');
    parseDuration(resolvedConfig.refreshTokenExpiration!, 'refreshTokenExpiration');
    parseDuration(resolvedConfig.verificationCodeExpiration!, 'verificationCodeExpiration');

    const configProvider: Provider = {
      provide: KC_AUTH_CONFIG,
      useValue: resolvedConfig,
    };

    const emailProvider: Provider = customEmail
      ? typeof customEmail === 'function'
        ? { provide: KC_EMAIL_SERVICE, useClass: customEmail }
        : { ...customEmail, provide: KC_EMAIL_SERVICE }
      : { provide: KC_EMAIL_SERVICE, useValue: null };

    const imports: any[] = [
      PassportModule,
      JwtModule.register({
        secret: config.jwtSecret,
        signOptions: { expiresIn: (config.accessTokenExpiration || '15m') as any },
      }),
    ];

    let adapterProvider: Provider;
    if ((config.adapter ?? 'typeorm') === 'custom') {
      if (!customAdapter) {
        throw new Error('[KcAuthModule] adapter "custom" requires "adapterProvider".');
      }
      adapterProvider =
        typeof customAdapter === 'function'
          ? { provide: KC_AUTH_ADAPTER, useClass: customAdapter }
          : { ...customAdapter, provide: KC_AUTH_ADAPTER };
    } else {
      adapterProvider = { provide: KC_AUTH_ADAPTER, useClass: TypeOrmAuthAdapter };
      imports.push(
        TypeOrmModule.forFeature([KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity]),
      );
    }

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
        KcPasswordService,
        KcUsersService,
        KcJwtAuthGuard,
        KcRolesGuard,
        KcRateLimitGuard,
      ],
      controllers: [KcAuthController, KcUsersController],
      exports: [
        KcAuthService,
        KcUsersService,
        KcPasswordService,
        KcTokenService,
        KcJwtAuthGuard,
        KcRolesGuard,
        KcRateLimitGuard,
        KC_AUTH_CONFIG,
        KC_AUTH_ADAPTER,
      ],
    };
  }
}
