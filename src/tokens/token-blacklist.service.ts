import { Injectable, Inject } from '@nestjs/common';
import { KC_AUTH_CONFIG, KcAuthConfig } from '../config/auth.config';

@Injectable()
export class TokenBlacklistService {
  private readonly blacklist = new Set<string>();

  constructor(@Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig) {}

  async add(token: string): Promise<void> {
    if (this.config.tokenBlacklist === 'memory') {
      this.blacklist.add(token);
    }
    // TODO: Redis implementation
  }

  async isBlacklisted(token: string): Promise<boolean> {
    if (this.config.tokenBlacklist === 'memory') {
      return this.blacklist.has(token);
    }
    return false;
  }
}
