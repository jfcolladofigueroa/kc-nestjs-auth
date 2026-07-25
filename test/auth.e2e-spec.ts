import 'reflect-metadata';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { KcAuthModule } from '../src/auth.module';
import {
  KcUserEntity,
  KcRefreshTokenEntity,
  KcVerificationCodeEntity,
} from '../src/adapters/typeorm.entities';

interface Res {
  status: number;
  body: any;
}

describe('KcAuthModule (e2e)', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;

  const post = async (path: string, body: any, token?: string): Promise<Res> => {
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

  const get = async (path: string, token?: string): Promise<Res> => {
    const r = await fetch(base + path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  const del = async (path: string, token?: string): Promise<Res> => {
    const r = await fetch(base + path, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  beforeAll(async () => {
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
          jwtSecret: 'test-secret-123',
          enableRegistration: true,
          passwordMinLength: 6,
          // High enough not to interfere with this suite; rate limiting has its own spec.
          loginRateLimit: { ttl: 60, limit: 1000 },
        }),
      ],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  // Shared state across the sequential flow below.
  let accessToken: string;
  let refreshToken: string;
  let refreshToken2: string;
  let adminToken: string;
  let adminToken2: string;

  describe('registration', () => {
    it('creates a user and normalizes the email', async () => {
      const r = await post('/auth/register', {
        email: 'User@Test.com',
        password: 'secret1',
        name: 'Test User',
      });
      expect(r.status).toBe(201);
      expect(r.body.email).toBe('user@test.com');
    });

    it('rejects a duplicate email with 409', async () => {
      const r = await post('/auth/register', {
        email: 'user@test.com',
        password: 'secret1',
        name: 'Dup',
      });
      expect(r.status).toBe(409);
    });
  });

  describe('login', () => {
    it('rejects an invalid email with 400 (DTO validation)', async () => {
      const r = await post('/auth/login', { email: 'not-an-email', password: 'x' });
      expect(r.status).toBe(400);
    });

    it('rejects a wrong password with 401', async () => {
      const r = await post('/auth/login', { email: 'user@test.com', password: 'wrong' });
      expect(r.status).toBe(401);
    });

    it('returns access and refresh tokens on success', async () => {
      const r = await post('/auth/login', { email: 'user@test.com', password: 'secret1' });
      expect(r.status).toBe(201);
      expect(r.body.accessToken).toBeTruthy();
      expect(r.body.refreshToken).toBeTruthy();
      accessToken = r.body.accessToken;
      refreshToken = r.body.refreshToken;
    });
  });

  describe('authenticated endpoints', () => {
    it('GET /auth/me returns the current user', async () => {
      const r = await get('/auth/me', accessToken);
      expect(r.status).toBe(200);
      expect(r.body.email).toBe('user@test.com');
    });

    it('GET /auth/me without token returns 401', async () => {
      const r = await get('/auth/me');
      expect(r.status).toBe(401);
    });
  });

  describe('refresh token rotation', () => {
    it('rotates the refresh token', async () => {
      const r = await post('/auth/refresh', { refreshToken });
      expect(r.status).toBe(201);
      expect(r.body.accessToken).toBeTruthy();
      expect(r.body.refreshToken).not.toBe(refreshToken);
      refreshToken2 = r.body.refreshToken;
    });

    it('revokes the previous refresh token', async () => {
      const r = await post('/auth/refresh', { refreshToken });
      expect(r.status).toBe(401);
    });
  });

  describe('RBAC', () => {
    it('denies /users to a non-admin (403)', async () => {
      const r = await get('/users', accessToken);
      expect(r.status).toBe(403);
    });

    it('allows /users to an admin (200)', async () => {
      await ds.query(`UPDATE auth_users SET role = 'admin' WHERE email = 'user@test.com'`);
      const r = await post('/auth/login', { email: 'user@test.com', password: 'secret1' });
      adminToken = r.body.accessToken;

      const list = await get('/users', adminToken);
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body)).toBe(true);
    });

    it('admin creates a user with permissions via POST /users', async () => {
      const r = await post(
        '/users',
        {
          email: 'worker@test.com',
          password: 'password8',
          name: 'Worker',
          role: 'user',
          permissions: ['see-things'],
        },
        adminToken,
      );
      expect(r.status).toBe(201);
      expect(r.body.email).toBe('worker@test.com');
    });

    it('includes permissions in the JWT payload', async () => {
      const r = await post('/auth/login', { email: 'worker@test.com', password: 'password8' });
      const payload = JSON.parse(
        Buffer.from(r.body.accessToken.split('.')[1], 'base64').toString(),
      );
      expect(payload.permissions).toContain('see-things');
    });
  });

  describe('change password', () => {
    it('changes the password', async () => {
      const r = await post(
        '/auth/change-password',
        { currentPassword: 'secret1', newPassword: 'newPass1' },
        adminToken,
      );
      expect(r.status).toBe(201);
    });

    it('revokes existing refresh tokens', async () => {
      const r = await post('/auth/refresh', { refreshToken: refreshToken2 });
      expect(r.status).toBe(401);
    });

    it('accepts the new password on login', async () => {
      const r = await post('/auth/login', { email: 'user@test.com', password: 'newPass1' });
      expect(r.status).toBe(201);
      adminToken2 = r.body.accessToken;
    });
  });

  describe('password recovery', () => {
    let code: string;

    it('forgot-password responds 201 without revealing user existence', async () => {
      const r = await post('/auth/forgot-password', { email: 'worker@test.com' });
      expect(r.status).toBe(201);
      const unknown = await post('/auth/forgot-password', { email: 'ghost@test.com' });
      expect(unknown.status).toBe(201);
    });

    it('stores a numeric verification code', async () => {
      const rows = await ds.query(
        `SELECT c.code FROM auth_verification_codes c
         JOIN auth_users u ON u.id = c.user_id
         WHERE u.email = 'worker@test.com' ORDER BY c.id DESC LIMIT 1`,
      );
      code = rows[0]?.code;
      expect(code).toMatch(/^\d{6}$/);
    });

    it('rejects a wrong code with 400', async () => {
      const wrong = code === '000000' ? '111111' : '000000';
      const r = await post('/auth/reset-password', {
        email: 'worker@test.com',
        code: wrong,
        newPassword: 'resetPass1',
      });
      expect(r.status).toBe(400);
    });

    it('resets the password with the right code', async () => {
      const r = await post('/auth/reset-password', {
        email: 'worker@test.com',
        code,
        newPassword: 'resetPass1',
      });
      expect(r.status).toBe(201);
    });

    it('rejects reuse of a consumed code', async () => {
      const r = await post('/auth/reset-password', {
        email: 'worker@test.com',
        code,
        newPassword: 'another1',
      });
      expect(r.status).toBe(400);
    });

    it('accepts the reset password on login', async () => {
      const r = await post('/auth/login', { email: 'worker@test.com', password: 'resetPass1' });
      expect(r.status).toBe(201);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      const login = await post('/auth/login', { email: 'worker@test.com', password: 'resetPass1' });
      const r = await post(
        '/auth/logout',
        { refreshToken: login.body.refreshToken },
        login.body.accessToken,
      );
      expect(r.status).toBe(201);

      const reuse = await post('/auth/refresh', { refreshToken: login.body.refreshToken });
      expect(reuse.status).toBe(401);
    });
  });

  describe('user deletion', () => {
    it('prevents an admin from deleting itself (400)', async () => {
      const [{ id }] = await ds.query(`SELECT id FROM auth_users WHERE email = 'user@test.com'`);
      const r = await del(`/users/${id}`, adminToken2);
      expect(r.status).toBe(400);
    });

    it('deletes another user and removes it from the database', async () => {
      const [{ id }] = await ds.query(`SELECT id FROM auth_users WHERE email = 'worker@test.com'`);
      const r = await del(`/users/${id}`, adminToken2);
      expect(r.status).toBe(200);

      const [{ n }] = await ds.query(`SELECT COUNT(*) as n FROM auth_users`);
      expect(Number(n)).toBe(1);
    });
  });
});
