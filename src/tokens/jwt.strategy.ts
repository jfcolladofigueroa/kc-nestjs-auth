import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { KC_AUTH_CONFIG, KcAuthConfig } from '../config/auth.config';
import { JwtPayload } from './jwt.service';

@Injectable()
export class KcJwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(KC_AUTH_CONFIG) config: KcAuthConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException();
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId ?? null,
      permissions: payload.permissions || [],
    };
  }
}
