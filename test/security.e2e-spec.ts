import 'reflect-metadata';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { KcAuthModule } from '../src/auth.module';
import { KcAuthConfig } from '../src/config/auth.config';
import {
  KcUserEntity,
  KcRefreshTokenEntity,
  KcVerificationCodeEntity,
} from '../src/adapters/typeorm.entities';
import { parseDuration } from '../src/utils/duration.util';

interface Res {
  status: number;
  body: any;
}

async function bootApp(config: Partial<KcAuthConfig>): Promise<{ app: INestApplication; base: string; ds: DataSource }> {
  @Module({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqljs',
        synchronize: true,
        autoSave: false,
        entities: [KcUserEntity, KcRefreshTokenEntity, KcVerificationCodeEntity],
      }),
      KcAuthModule.forRoot({
        adapter: 'typeorm',
        jwtSecret: 'security-spec-secret',
        enableRegistration: true,
        ...config,
      }),
    ],
  })
  class AppModule {}

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  return { app, base, ds: app.get(DataSource) };
}

function makeHttp(base: () => string) {
  const request = async (method: string, path: string, body?: any, token?: string): Promise<Res> => {
    const r = await fetch(base() + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return {
    post: (path: string, body: any, token?: string) => request('POST', path, body, token),
    put: (path: string, body: any, token?: string) => request('PUT', path, body, token),
  };
}

describe('rate limiting on sensitive endpoints', () => {
  let app: INestApplication;
  let base: string;
  const { post } = makeHttp(() => base);

  beforeAll(async () => {
    ({ app, base } = await bootApp({ loginRateLimit: { ttl: 60, limit: 3 } }));
    await post('/auth/register', { email: 'rl@test.com', password: 'secret1', name: 'RL' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after the login limit is exceeded', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await post('/auth/login', { email: 'rl@test.com', password: 'wrong' });
      expect(r.status).toBe(401);
    }
    const blocked = await post('/auth/login', { email: 'rl@test.com', password: 'wrong' });
    expect(blocked.status).toBe(429);
  });

  it('does not block attempts for a different email', async () => {
    const r = await post('/auth/login', { email: 'other@test.com', password: 'wrong' });
    expect(r.status).toBe(401);
  });

  it('rate limits forgot-password as well', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await post('/auth/forgot-password', { email: 'rl@test.com' });
      expect(r.status).toBe(201);
    }
    const blocked = await post('/auth/forgot-password', { email: 'rl@test.com' });
    expect(blocked.status).toBe(429);
  });
});

describe('verification code attempt limit', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;
  const { post } = makeHttp(() => base);

  const latestCode = async (email: string): Promise<string> => {
    const rows = await ds.query(
      `SELECT c.code FROM auth_verification_codes c
       JOIN auth_users u ON u.id = c.user_id
       WHERE u.email = '${email}' ORDER BY c.id DESC LIMIT 1`,
    );
    return rows[0]?.code;
  };

  beforeAll(async () => {
    ({ app, base, ds } = await bootApp({ loginRateLimit: { ttl: 60, limit: 1000 } }));
    await post('/auth/register', { email: 'code@test.com', password: 'secret1', name: 'Code' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('invalidates the code after 5 failed attempts', async () => {
    await post('/auth/forgot-password', { email: 'code@test.com' });
    const code = await latestCode('code@test.com');
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const r = await post('/auth/reset-password', {
        email: 'code@test.com',
        code: wrong,
        newPassword: 'newPass1',
      });
      expect(r.status).toBe(400);
    }

    // The correct code must now be rejected: it was invalidated by brute force.
    const r = await post('/auth/reset-password', {
      email: 'code@test.com',
      code,
      newPassword: 'newPass1',
    });
    expect(r.status).toBe(400);
  });

  it('allows recovery with a freshly requested code', async () => {
    await post('/auth/forgot-password', { email: 'code@test.com' });
    const code = await latestCode('code@test.com');

    const r = await post('/auth/reset-password', {
      email: 'code@test.com',
      code,
      newPassword: 'recovered1',
    });
    expect(r.status).toBe(201);

    const login = await post('/auth/login', { email: 'code@test.com', password: 'recovered1' });
    expect(login.status).toBe(201);
  });
});

describe('user update email conflict', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;
  const { post, put } = makeHttp(() => base);

  beforeAll(async () => {
    ({ app, base, ds } = await bootApp({ loginRateLimit: { ttl: 60, limit: 1000 } }));
    await post('/auth/register', { email: 'admin@test.com', password: 'secret1', name: 'Admin' });
    await post('/auth/register', { email: 'victim@test.com', password: 'secret1', name: 'Victim' });
    await ds.query(`UPDATE auth_users SET role = 'admin' WHERE email = 'admin@test.com'`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 409 when updating a user to an email that is already taken', async () => {
    const login = await post('/auth/login', { email: 'admin@test.com', password: 'secret1' });
    const [{ id }] = await ds.query(`SELECT id FROM auth_users WHERE email = 'victim@test.com'`);

    const r = await put(`/users/${id}`, { email: 'admin@test.com' }, login.body.accessToken);
    expect(r.status).toBe(409);
  });
});

describe('email service wiring', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;
  const { post } = makeHttp(() => base);
  const sent: Array<{ email: string; code: string }> = [];

  beforeAll(async () => {
    ({ app, base, ds } = await bootApp({
      loginRateLimit: { ttl: 60, limit: 1000 },
      emailProvider: {
        provide: 'KC_EMAIL_SERVICE',
        useValue: {
          sendPasswordRecoveryEmail: async (email: string, code: string) => {
            sent.push({ email, code });
          },
        },
      },
    }));
    await post('/auth/register', { email: 'mail@test.com', password: 'secret1', name: 'Mail' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('delivers the recovery code through the provided email service', async () => {
    await post('/auth/forgot-password', { email: 'mail@test.com' });

    expect(sent).toHaveLength(1);
    expect(sent[0].email).toBe('mail@test.com');

    const rows = await ds.query(
      `SELECT c.code FROM auth_verification_codes c
       JOIN auth_users u ON u.id = c.user_id
       WHERE u.email = 'mail@test.com' ORDER BY c.id DESC LIMIT 1`,
    );
    expect(sent[0].code).toBe(rows[0].code);
  });
});

describe('parseDuration', () => {
  it('parses supported units', () => {
    expect(parseDuration('30s', 'x')).toBe(30_000);
    expect(parseDuration('15m', 'x')).toBe(900_000);
    expect(parseDuration('2h', 'x')).toBe(7_200_000);
    expect(parseDuration('7d', 'x')).toBe(604_800_000);
  });

  it('rejects bare numbers and unknown units', () => {
    expect(() => parseDuration('60', 'verificationCodeExpiration')).toThrow(/verificationCodeExpiration/);
    expect(() => parseDuration('10w', 'x')).toThrow(/Invalid duration/);
    expect(() => parseDuration('', 'x')).toThrow(/Invalid duration/);
  });

  it('fails fast in forRoot on a malformed duration', () => {
    expect(() =>
      KcAuthModule.forRoot({ jwtSecret: 'x', refreshTokenExpiration: '24' }),
    ).toThrow(/refreshTokenExpiration/);
  });
});
