import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { KC_AUTH_CONFIG, KcAuthConfig } from '../config/auth.config';

/**
 * In-memory sliding-window rate limiter for sensitive public endpoints
 * (login, forgot-password, reset-password). Keyed by IP + route + email so an
 * attacker cannot lock out other users, and one user cannot exhaust the limit
 * for everyone behind the same IP.
 *
 * State is per process: in multi-instance deployments each instance enforces
 * the limit independently. Complement with an edge/global limiter if needed.
 */
@Injectable()
export class KcRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(@Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const { ttl, limit } = this.config.loginRateLimit ?? { ttl: 60, limit: 5 };
    const req = context.switchToHttp().getRequest();
    const email =
      typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const key = `${req.ip}|${req.route?.path ?? req.url}|${email}`;

    const now = Date.now();
    const windowStart = now - ttl * 1_000;
    const recent = (this.hits.get(key) ?? []).filter(t => t > windowStart);

    if (recent.length >= limit) {
      throw new HttpException('Too many attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(windowStart);
    return true;
  }

  private prune(windowStart: number): void {
    for (const [key, timestamps] of this.hits) {
      const kept = timestamps.filter(t => t > windowStart);
      if (kept.length) this.hits.set(key, kept);
      else this.hits.delete(key);
    }
  }
}
