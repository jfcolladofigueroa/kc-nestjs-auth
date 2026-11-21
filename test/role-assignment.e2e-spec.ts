import 'reflect-metadata';
import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { KcAuthModule } from '../src/auth.module';
import { KC_TENANT_SCOPE, KcTenantScope } from '../src/config/auth.config';
import { kcAuthEntities } from '../src/adapters/typeorm.entities';

/**
 * Privilege escalation through the users endpoints: an admin must not be able
 * to grant itself (or anyone) a role outside `assignableRoles`, nor touch a
 * user that already holds one.
 */

// Mutable fake: the test flips it to emulate a superadmin request.
const scope = { superadmin: false };
const fakeScope: KcTenantScope = {
  getTenantId: () => null,
  isSuperadmin: () => scope.superadmin,
};

async function bootApp(): Promise<{ app: INestApplication; base: string; ds: DataSource }> {
  @Global()
  @Module({
    providers: [{ provide: KC_TENANT_SCOPE, useValue: fakeScope }],
    exports: [KC_TENANT_SCOPE],
  })
  class ScopeModule {}

  @Module({
    imports: [
      ScopeModule,
      TypeOrmModule.forRoot({ type: 'sqljs', synchronize: true, autoSave: false, entities: kcAuthEntities }),
      KcAuthModule.forRoot({
        adapter: 'typeorm',
        jwtSecret: 'role-spec-secret',
        enableRegistration: true,
        loginRateLimit: { ttl: 60, limit: 1000 },
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

describe('role assignment through /users', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;
  let adminToken: string;
  let adminId: number;
  let userId: number;
  let rootId: number;

  const req = async (method: string, path: string, body?: any, token?: string): Promise<{ status: number; body: any }> => {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const idOf = async (email: string) =>
    Number((await ds.query(`SELECT id FROM auth_users WHERE email = '${email}'`))[0].id);
  const roleOf = async (id: number) =>
    (await ds.query(`SELECT role FROM auth_users WHERE id = ${id}`))[0].role;

  beforeAll(async () => {
    ({ app, base, ds } = await bootApp());
    for (const email of ['admin@test.com', 'user@test.com', 'root@test.com']) {
      await req('POST', '/auth/register', { email, password: 'secret1', name: email });
    }
    await ds.query(`UPDATE auth_users SET role = 'admin' WHERE email = 'admin@test.com'`);
    await ds.query(`UPDATE auth_users SET role = 'superadmin' WHERE email = 'root@test.com'`);
    adminId = await idOf('admin@test.com');
    userId = await idOf('user@test.com');
    rootId = await idOf('root@test.com');
    adminToken = (await req('POST', '/auth/login', { email: 'admin@test.com', password: 'secret1' })).body.accessToken;
  });

  afterEach(() => {
    scope.superadmin = false;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an admin promoting itself to superadmin', async () => {
    const r = await req('PUT', `/users/${adminId}`, { role: 'superadmin' }, adminToken);
    expect(r.status).toBe(400);
    expect(await roleOf(adminId)).toBe('admin');
  });

  it('rejects an admin granting superadmin to another user', async () => {
    const r = await req('PUT', `/users/${userId}`, { role: 'superadmin' }, adminToken);
    expect(r.status).toBe(403);
    expect(await roleOf(userId)).toBe('user');
  });

  it('rejects an admin creating a superadmin', async () => {
    const r = await req('POST', '/users', { email: 'new@test.com', password: 'secret123', name: 'New', role: 'superadmin' }, adminToken);
    expect(r.status).toBe(403);
    expect(await ds.query(`SELECT id FROM auth_users WHERE email = 'new@test.com'`)).toHaveLength(0);
  });

  it('rejects an admin editing a superadmin (e.g. to take over its password)', async () => {
    const r = await req('PUT', `/users/${rootId}`, { password: 'hijacked123' }, adminToken);
    expect(r.status).toBe(403);
    const login = await req('POST', '/auth/login', { email: 'root@test.com', password: 'secret1' });
    expect(login.status).toBe(201);
  });

  it('still lets an admin grant assignable roles and edit its own name', async () => {
    const promote = await req('PUT', `/users/${userId}`, { role: 'admin' }, adminToken);
    expect(promote.status).toBe(200);
    expect(await roleOf(userId)).toBe('admin');

    const self = await req('PUT', `/users/${adminId}`, { name: 'Renamed', role: 'admin' }, adminToken);
    expect(self.status).toBe(200);
  });

  it('lets a superadmin grant superadmin', async () => {
    scope.superadmin = true;
    const r = await req('PUT', `/users/${userId}`, { role: 'superadmin' }, adminToken);
    expect(r.status).toBe(200);
    expect(await roleOf(userId)).toBe('superadmin');
  });
});
