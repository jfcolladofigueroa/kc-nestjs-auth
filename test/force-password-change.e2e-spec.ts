import 'reflect-metadata';
import { Controller, Get, INestApplication, Module, UseGuards, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { KcAuthModule } from '../src/auth.module';
import { KcAuthConfig } from '../src/config/auth.config';
import { kcAuthEntities } from '../src/adapters/typeorm.entities';
import { KcJwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { AllowPendingPasswordChange } from '../src/guards/allow-pending-password-change.decorator';

@Controller('business')
@UseGuards(KcJwtAuthGuard)
class BusinessController {
  @Get()
  list() {
    return { ok: true };
  }

  @AllowPendingPasswordChange()
  @Get('open')
  open() {
    return { ok: true };
  }
}

async function bootApp(config: Partial<KcAuthConfig>) {
  @Module({
    imports: [
      TypeOrmModule.forRoot({ type: 'sqljs', synchronize: true, autoSave: false, entities: kcAuthEntities }),
      KcAuthModule.forRoot({
        adapter: 'typeorm',
        jwtSecret: 'force-change-secret',
        enableRegistration: true,
        loginRateLimit: { ttl: 60, limit: 1000 },
        ...config,
      }),
    ],
    controllers: [BusinessController],
  })
  class AppModule {}

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  return { app, base, ds: app.get(DataSource) };
}

function client(base: () => string) {
  return async (method: string, path: string, body?: any, token?: string): Promise<{ status: number; body: any }> => {
    const r = await fetch(base() + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
}

async function makeAdmin(req: ReturnType<typeof client>, ds: DataSource): Promise<string> {
  await req('POST', '/auth/register', { email: 'admin@test.com', password: 'adminpass1', name: 'Admin' });
  await ds.query(`UPDATE auth_users SET role = 'admin' WHERE email = 'admin@test.com'`);
  return (await req('POST', '/auth/login', { email: 'admin@test.com', password: 'adminpass1' })).body.accessToken;
}

describe('forcePasswordChangeOnFirstLogin: true', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;
  let adminToken: string;
  const req = client(() => base);
  const flagOf = async (email: string) =>
    Number((await ds.query(`SELECT must_change_password AS f FROM auth_users WHERE email = '${email}'`))[0].f);

  beforeAll(async () => {
    ({ app, base, ds } = await bootApp({ forcePasswordChangeOnFirstLogin: true }));
    adminToken = await makeAdmin(req, ds);
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not flag self-registered users', async () => {
    expect(await flagOf('admin@test.com')).toBe(0);
    const me = await req('GET', '/auth/me', undefined, adminToken);
    expect(me.body.mustChangePassword).toBe(false);
  });

  it('flags users created by an admin and blocks them until they change the password', async () => {
    const created = await req('POST', '/users', { email: 'new@test.com', password: 'temporal1', name: 'New' }, adminToken);
    expect(created.status).toBe(201);
    expect(created.body.mustChangePassword).toBe(true);

    const login = await req('POST', '/auth/login', { email: 'new@test.com', password: 'temporal1' });
    expect(login.status).toBe(201);
    expect(login.body.user.mustChangePassword).toBe(true);
    const token = login.body.accessToken;

    const blocked = await req('GET', '/business', undefined, token);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    expect((await req('GET', '/business/open', undefined, token)).status).toBe(200);
    const me = await req('GET', '/auth/me', undefined, token);
    expect(me.status).toBe(200);
    expect(me.body.mustChangePassword).toBe(true);

    // The refreshed token keeps the flag: refreshing is not a way out.
    const refreshed = await req('POST', '/auth/refresh', { refreshToken: login.body.refreshToken });
    expect(refreshed.body.user.mustChangePassword).toBe(true);
    expect((await req('GET', '/business', undefined, refreshed.body.accessToken)).status).toBe(403);

    const same = await req('POST', '/auth/change-password', { currentPassword: 'temporal1', newPassword: 'temporal1' }, token);
    expect(same.status).toBe(400);

    const changed = await req('POST', '/auth/change-password', { currentPassword: 'temporal1', newPassword: 'definitiva1' }, token);
    expect(changed.status).toBe(201);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(await flagOf('new@test.com')).toBe(0);

    expect((await req('GET', '/business', undefined, changed.body.accessToken)).status).toBe(200);
    // The pre-change refresh tokens are revoked; the returned one works.
    expect((await req('POST', '/auth/refresh', { refreshToken: refreshed.body.refreshToken })).status).toBe(401);
    expect((await req('POST', '/auth/refresh', { refreshToken: changed.body.refreshToken })).status).toBe(201);
  });

  it('honours mustChangePassword: false on create', async () => {
    const created = await req(
      'POST', '/users',
      { email: 'svc@test.com', password: 'servicio1', name: 'Svc', mustChangePassword: false },
      adminToken,
    );
    expect(created.body.mustChangePassword).toBe(false);
    const login = await req('POST', '/auth/login', { email: 'svc@test.com', password: 'servicio1' });
    expect((await req('GET', '/business', undefined, login.body.accessToken)).status).toBe(200);
  });

  it('flags a user again when an admin resets its password', async () => {
    const id = Number((await ds.query(`SELECT id FROM auth_users WHERE email = 'svc@test.com'`))[0].id);
    const r = await req('PUT', `/users/${id}`, { password: 'reseteada1' }, adminToken);
    expect(r.status).toBe(200);
    expect(r.body.mustChangePassword).toBe(true);
    expect(await flagOf('svc@test.com')).toBe(1);
  });

  it('can be cleared or set explicitly by an admin', async () => {
    const id = Number((await ds.query(`SELECT id FROM auth_users WHERE email = 'svc@test.com'`))[0].id);
    expect((await req('PUT', `/users/${id}`, { mustChangePassword: false }, adminToken)).body.mustChangePassword).toBe(false);
    expect((await req('PUT', `/users/${id}`, { mustChangePassword: true }, adminToken)).body.mustChangePassword).toBe(true);
  });

  it('does not flag an admin resetting its own password', async () => {
    const id = Number((await ds.query(`SELECT id FROM auth_users WHERE email = 'admin@test.com'`))[0].id);
    const r = await req('PUT', `/users/${id}`, { password: 'adminpass2' }, adminToken);
    expect(r.body.mustChangePassword).toBe(false);
  });

  it('clears the flag when the user resets its password with a recovery code', async () => {
    await req('POST', '/users', { email: 'forgot@test.com', password: 'temporal1', name: 'F' }, adminToken);
    await req('POST', '/auth/forgot-password', { email: 'forgot@test.com' });
    const [{ code }] = await ds.query(
      `SELECT c.code FROM auth_verification_codes c JOIN auth_users u ON u.id = c.user_id WHERE u.email = 'forgot@test.com'`,
    );
    const r = await req('POST', '/auth/reset-password', { email: 'forgot@test.com', code, newPassword: 'elegida1' });
    expect(r.status).toBe(201);
    expect(await flagOf('forgot@test.com')).toBe(0);
  });
});

describe('forcePasswordChangeOnFirstLogin: false (default)', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;
  const req = client(() => base);

  beforeAll(async () => {
    ({ app, base, ds } = await bootApp({}));
  });

  afterAll(async () => {
    await app.close();
  });

  it('neither sets nor enforces the flag', async () => {
    const adminToken = await makeAdmin(req, ds);
    const created = await req('POST', '/users', { email: 'u@test.com', password: 'temporal1', name: 'U', mustChangePassword: true }, adminToken);
    expect(created.body.mustChangePassword).toBe(false);

    // Even a row flagged by hand is ignored while the option is off.
    await ds.query(`UPDATE auth_users SET must_change_password = 1 WHERE email = 'u@test.com'`);
    const login = await req('POST', '/auth/login', { email: 'u@test.com', password: 'temporal1' });
    expect(login.body.user.mustChangePassword).toBe(false);
    expect((await req('GET', '/business', undefined, login.body.accessToken)).status).toBe(200);
  });
});
