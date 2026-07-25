import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { KC_AUTH_CONFIG, KcAuthConfig } from '../config/auth.config';

@Injectable()
export class KcPasswordService {
  constructor(@Inject(KC_AUTH_CONFIG) private readonly config: KcAuthConfig) {}

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds || 10);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validate(password: string): { valid: boolean; message?: string } {
    const minLength = this.config.passwordMinLength || 6;
    if (password.length < minLength) {
      return { valid: false, message: `Password must be at least ${minLength} characters long` };
    }
    return { valid: true };
  }

  generateCode(length = 6): string {
    const { randomInt } = require('crypto');
    let code = '';
    for (let i = 0; i < length; i++) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }
}
