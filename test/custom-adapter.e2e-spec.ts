import 'reflect-metadata';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { KcAuthModule } from '../src/auth.module';
import { AuthDatabaseAdapter } from '../src/adapters/adapter.interface';
import {
  KcAuthUser,
  KcRefreshToken,
  KcVerificationCode,
} from '../src/config/auth.config';

/** Minimal in-memory adapter proving the 'custom' escape hatch works without TypeORM. */
class InMemoryAdapter implements AuthDatabaseAdapter {
  private users = new Map<number, KcAuthUser>();
  private tokens = new Map<string, KcRefreshToken>();
  private codes: KcVerificationCode[] = [];
  private seq = 1;

  async findUserByEmail(email: string) {
    return [...this.users.values()].find(u => u.email === email) ?? null;
  }
  async findUserById(id: number | string) {
    return this.users.get(Number(id)) ?? null;
  }
  async findAllUsers() {
    return [...this.users.values()];
  }
  async createUser(data: { email: string; passwordHash: string; name: string; role: string; tenantId?: number | null }) {
    const now = new Date();
    const user: KcAuthUser = {
      id: this.seq++,
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
      tenantId: data.tenantId ?? null,
      permissions: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id as number, user);
    return user;
  }
  async updateUser(id: number | string, data: Partial<KcAuthUser>) {
    const user = this.users.get(Number(id));
    if (!user) return null;
    Object.assign(user, data, { updatedAt: new Date() });
    return user;
  }
  async deleteUser(id: number | string) {
    this.users.delete(Number(id));
  }
  async createRefreshToken(data: { userId: number | string; token: string; expiresAt: Date }) {
    const token: KcRefreshToken = {
      id: this.seq++,
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
      revoked: false,
      createdAt: new Date(),
    };
    this.tokens.set(data.token, token);
    return token;
  }
  async findRefreshToken(token: string) {
    return this.tokens.get(token) ?? null;
  }
  async revokeRefreshToken(token: string) {
    const t = this.tokens.get(token);
    if (t) t.revoked = true;
  }
  async revokeAllUserTokens(userId: number | string) {
    for (const t of this.tokens.values()) {
      if (String(t.userId) === String(userId)) t.revoked = true;
    }
  }
  async cleanExpiredTokens() {}
  async createVerificationCode(data: { userId: number | string; code: string; type: string; expiresAt: Date }) {
    const code: KcVerificationCode = {
      id: this.seq++,
      userId: data.userId,
      code: data.code,
      type: data.type as KcVerificationCode['type'],
      expiresAt: data.expiresAt,
      used: false,
      attempts: 0,
      createdAt: new Date(),
    };
    this.codes.push(code);
    return code;
  }
  async findLatestActiveCode(email: string, type: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return null;
    const found = this.codes
      .filter(c => String(c.userId) === String(user.id) && c.type === type && !c.used)
      .pop();
    return found ? { code: found, user } : null;
  }
  async incrementCodeAttempts(id: number | string) {
    const c = this.codes.find(x => x.id === id);
    if (!c) return 0;
    c.attempts += 1;
    return c.attempts;
  }
  async markCodeUsed(id: number | string) {
    const c = this.codes.find(x => x.id === id);
    if (c) c.used = true;
  }
}

describe('KcAuthModule with a custom adapter (no TypeORM)', () => {
  let app: INestApplication;
  let base: string;

  const post = async (path: string, body: any, token?: string): Promise<{ status: number; body: any }> => {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  beforeAll(async () => {
    @Module({
      imports: [
        KcAuthModule.forRoot({
          adapter: 'custom',
          adapterProvider: InMemoryAdapter,
          jwtSecret: 'custom-adapter-secret',
          enableRegistration: true,
        }),
      ],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers and logs in against the in-memory adapter', async () => {
    const reg = await post('/auth/register', {
      email: 'mem@test.com',
      password: 'secret1',
      name: 'Mem User',
    });
    expect(reg.status).toBe(201);

    const login = await post('/auth/login', { email: 'mem@test.com', password: 'secret1' });
    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeTruthy();
  });

  it('rotates refresh tokens through the custom adapter', async () => {
    const login = await post('/auth/login', { email: 'mem@test.com', password: 'secret1' });
    const refreshed = await post('/auth/refresh', { refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(201);

    const reuse = await post('/auth/refresh', { refreshToken: login.body.refreshToken });
    expect(reuse.status).toBe(401);
  });
});

describe('KcAuthModule.forRoot validation', () => {
  it('throws a clear error when jwtSecret is missing', () => {
    expect(() => KcAuthModule.forRoot({ adapter: 'typeorm' } as any)).toThrow(/jwtSecret/);
    expect(() => KcAuthModule.forRoot({ adapter: 'typeorm', jwtSecret: '  ' } as any)).toThrow(/jwtSecret/);
  });

  it('throws when adapter is custom but no adapterProvider is given', () => {
    expect(() => KcAuthModule.forRoot({ adapter: 'custom', jwtSecret: 'x' })).toThrow(/adapterProvider/);
  });
});

/**
 * An adapter written against 0.2.0 knows nothing about profiles. It must keep
 * working: permissions stay flat, and the profile endpoints say so instead of
 * crashing.
 */
describe('A custom adapter without profile support', () => {
  let app: INestApplication;
  let base: string;
  let token: string;

  beforeAll(async () => {
    @Module({
      imports: [
        KcAuthModule.forRoot({
          adapter: 'custom',
          adapterProvider: InMemoryAdapter,
          jwtSecret: 'no-profiles-secret',
          enableRegistration: true,
          defaultRole: 'admin', // so the profile endpoints are reachable
        }),
      ],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: ['error'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');

    await fetch(base + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'noprofiles@test.com', password: 'secret1', name: 'No Profiles' }),
    });
    const login = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'noprofiles@test.com', password: 'secret1' }),
    });
    token = ((await login.json()) as any).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 501 on the profile endpoints', async () => {
    const r = await fetch(base + '/profiles', { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(501);
  });

  it('still resolves permissions, flat, on login', async () => {
    const r = await fetch(base + '/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    const body = (await r.json()) as any;
    expect(r.status).toBe(200);
    expect(body.permissions).toEqual([]);
    expect(body.profileId).toBeNull();
  });

  it('rejects assigning a profile instead of pretending it worked', async () => {
    const users = (await (await fetch(base + '/users', { headers: { Authorization: `Bearer ${token}` } })).json()) as any[];
    const r = await fetch(base + `/users/${users[0].id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profileId: 1 }),
    });
    expect(r.status).toBe(400);
  });
});
