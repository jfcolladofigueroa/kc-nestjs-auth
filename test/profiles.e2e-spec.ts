import 'reflect-metadata';
import { Controller, Get, INestApplication, Module, UseGuards, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { KcAuthModule } from '../src/auth.module';
import { kcAuthEntities } from '../src/adapters/typeorm.entities';
import { KcJwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { KcRolesGuard } from '../src/roles/roles.guard';
import { Permissions } from '../src/roles/permissions.decorator';

interface Res {
  status: number;
  body: any;
}

/**
 * A consumer's controller, decorated exactly as it would have been before
 * 0.3.0. Nothing here knows profiles exist: it is the proof that KcRolesGuard
 * and @Permissions() keep their contract.
 */
@Controller('material')
@UseGuards(KcJwtAuthGuard, KcRolesGuard)
class MaterialController {
  @Get('consultar')
  @Permissions('material:consultar')
  read() {
    return { ok: true };
  }

  @Get('excluir')
  @Permissions('material:excluir')
  remove() {
    return { ok: true };
  }
}

describe('Profiles and the permission matrix (e2e)', () => {
  let app: INestApplication;
  let base: string;
  let ds: DataSource;
  let adminToken: string;

  const req = async (method: string, path: string, body?: any, token?: string): Promise<Res> => {
    const r = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const get = (p: string, t?: string) => req('GET', p, undefined, t);
  const post = (p: string, b: any, t?: string) => req('POST', p, b, t);
  const put = (p: string, b: any, t?: string) => req('PUT', p, b, t);
  const del = (p: string, t?: string) => req('DELETE', p, undefined, t);

  const loginAs = async (email: string, password = 'secret123') => {
    const r = await post('/auth/login', { email, password });
    expect(r.status).toBe(201);
    return r.body;
  };

  beforeAll(async () => {
    @Module({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          synchronize: true,
          autoSave: false,
          entities: kcAuthEntities,
        }),
        KcAuthModule.forRoot({
          adapter: 'typeorm',
          jwtSecret: 'profiles-spec-secret',
          enableRegistration: true,
          passwordMinLength: 6,
          loginRateLimit: { ttl: 60, limit: 1000 },
          // Off by default; the cache is exercised explicitly below.
          profileCacheTtl: 300,
        }),
      ],
      controllers: [MaterialController],
    })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    ds = app.get(DataSource);

    // Bootstrap an admin the way a fresh install would.
    await post('/auth/register', { email: 'admin@test.com', password: 'secret123', name: 'Admin' });
    await ds.query(`UPDATE auth_users SET role = 'admin' WHERE email = 'admin@test.com'`);
    adminToken = (await loginAs('admin@test.com')).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  let profileId: number;

  describe('regression: a user without a profile behaves exactly as before 0.3.0', () => {
    beforeAll(async () => {
      const r = await post(
        '/users',
        {
          email: 'legacy@test.com',
          password: 'secret123',
          name: 'Legacy',
          permissions: ['material:consultar', 'relatorio:consultar'],
        },
        adminToken,
      );
      expect(r.status).toBe(201);
    });

    it('stores profile_id as NULL, like every migrated row', async () => {
      const [row] = await ds.query(`SELECT profile_id FROM auth_users WHERE email = 'legacy@test.com'`);
      expect(row.profile_id).toBeNull();
    });

    it('returns exactly its flat permissions on login', async () => {
      const session = await loginAs('legacy@test.com');
      expect(session.user.permissions).toEqual(['material:consultar', 'relatorio:consultar']);
      expect(session.user.profileId).toBeNull();
    });

    it('returns exactly its flat permissions on /auth/me and on refresh', async () => {
      const session = await loginAs('legacy@test.com');
      const me = await get('/auth/me', session.accessToken);
      expect(me.body.permissions).toEqual(['material:consultar', 'relatorio:consultar']);

      const refreshed = await post('/auth/refresh', { refreshToken: session.refreshToken });
      expect(refreshed.body.user.permissions).toEqual(['material:consultar', 'relatorio:consultar']);
    });

    it('passes and fails the untouched KcRolesGuard just as before', async () => {
      const session = await loginAs('legacy@test.com');
      expect((await get('/material/consultar', session.accessToken)).status).toBe(200);
      expect((await get('/material/excluir', session.accessToken)).status).toBe(403);
    });
  });

  describe('profile administration', () => {
    it('refuses a non-admin without auth.perfil:consultar', async () => {
      const session = await loginAs('legacy@test.com');
      expect((await get('/profiles', session.accessToken)).status).toBe(403);
    });

    it('creates a profile with its matrix', async () => {
      const r = await post(
        '/profiles',
        {
          name: 'Almoxarife',
          description: 'Gestão do almoxarifado',
          permissions: [
            { resource: 'material', canCreate: true, canUpdate: true, canRead: true, canDelete: true },
            { resource: 'relatorio', canRead: true },
          ],
        },
        adminToken,
      );
      expect(r.status).toBe(201);
      profileId = r.body.id;
      expect(r.body.permissionStrings).toEqual([
        'material:incluir',
        'material:alterar',
        'material:consultar',
        'material:excluir',
        'relatorio:consultar',
      ]);
    });

    it('rejects a duplicated profile name', async () => {
      const r = await post('/profiles', { name: 'Almoxarife' }, adminToken);
      expect(r.status).toBe(409);
    });

    it('rejects a matrix with a duplicated resource', async () => {
      const r = await put(
        `/profiles/${profileId}/permissions`,
        { permissions: [{ resource: 'material', canRead: true }, { resource: 'material', canCreate: true }] },
        adminToken,
      );
      expect(r.status).toBe(400);
    });

    it('lists and reads back the matrix', async () => {
      const list = await get('/profiles', adminToken);
      expect(list.status).toBe(200);
      expect(list.body.map((p: any) => p.name)).toContain('Almoxarife');

      const one = await get(`/profiles/${profileId}/permissions`, adminToken);
      expect(one.body.permissions).toEqual([
        { resource: 'material', canCreate: true, canUpdate: true, canRead: true, canDelete: true },
        { resource: 'relatorio', canCreate: false, canUpdate: false, canRead: true, canDelete: false },
      ]);
    });
  });

  describe('a user with a profile', () => {
    beforeAll(async () => {
      const r = await post(
        '/users',
        {
          email: 'almoxarife@test.com',
          password: 'secret123',
          name: 'Almoxarife',
          profileId,
          // Own extra on top of the profile.
          permissions: ['config:alterar'],
        },
        adminToken,
      );
      expect(r.status).toBe(201);
    });

    it('inherits the profile permissions and adds its own', async () => {
      const session = await loginAs('almoxarife@test.com');
      expect(session.user.profileId).toBe(profileId);
      expect(session.user.permissions).toEqual([
        'material:incluir',
        'material:alterar',
        'material:consultar',
        'material:excluir',
        'relatorio:consultar',
        'config:alterar',
      ]);
    });

    it('keeps its own permissions column untouched by the profile', async () => {
      const [row] = await ds.query(`SELECT permissions FROM auth_users WHERE email = 'almoxarife@test.com'`);
      expect(JSON.parse(row.permissions)).toEqual(['config:alterar']);
    });

    it('passes the guard on a permission that only the profile grants', async () => {
      const session = await loginAs('almoxarife@test.com');
      expect((await get('/material/excluir', session.accessToken)).status).toBe(200);
    });

    it('does not duplicate a permission granted by both sides', async () => {
      await put(
        `/users/${(await get('/users', adminToken)).body.find((u: any) => u.email === 'almoxarife@test.com').id}`,
        { permissions: ['material:consultar', 'config:alterar'] },
        adminToken,
      );
      const session = await loginAs('almoxarife@test.com');
      const perms: string[] = session.user.permissions;
      expect(perms.filter(p => p === 'material:consultar')).toHaveLength(1);
    });
  });

  describe('changing a profile reaches every user without touching their rows', () => {
    it('revokes a verb for all its users at once', async () => {
      const before = await ds.query(`SELECT permissions, profile_id FROM auth_users WHERE email = 'almoxarife@test.com'`);

      const r = await put(
        `/profiles/${profileId}/permissions`,
        {
          permissions: [
            { resource: 'material', canCreate: true, canUpdate: true, canRead: true, canDelete: false },
            { resource: 'relatorio', canRead: true },
          ],
        },
        adminToken,
      );
      expect(r.status).toBe(200);

      const after = await ds.query(`SELECT permissions, profile_id FROM auth_users WHERE email = 'almoxarife@test.com'`);
      expect(after).toEqual(before); // the user row was not written to

      const session = await loginAs('almoxarife@test.com');
      expect(session.user.permissions).not.toContain('material:excluir');
      expect((await get('/material/excluir', session.accessToken)).status).toBe(403);
      expect((await get('/material/consultar', session.accessToken)).status).toBe(200);
    });

    it('an inactive profile grants nothing, leaving the user with its own permissions', async () => {
      const r = await del(`/profiles/${profileId}`, adminToken);
      expect(r.status).toBe(200);
      expect(r.body.isActive).toBe(false);

      const session = await loginAs('almoxarife@test.com');
      expect(session.user.permissions).toEqual(['material:consultar', 'config:alterar']);

      // Reactivate for the remaining assertions.
      await put(`/profiles/${profileId}`, { isActive: true }, adminToken);
      const back = await loginAs('almoxarife@test.com');
      expect(back.user.permissions).toContain('material:incluir');
    });
  });

  describe('assigning and detaching a profile', () => {
    let legacyId: number;

    beforeAll(async () => {
      const users = await get('/users', adminToken);
      legacyId = users.body.find((u: any) => u.email === 'legacy@test.com').id;
    });

    it('assigns a profile to a user that had none', async () => {
      const r = await put(`/users/${legacyId}`, { profileId }, adminToken);
      expect(r.status).toBe(200);
      expect(r.body.effectivePermissions).toContain('material:incluir');
      // Its own permissions are still there, untouched.
      expect(r.body.permissions).toEqual(['material:consultar', 'relatorio:consultar']);
    });

    it('detaches it with profileId: null, restoring the flat permissions', async () => {
      const r = await put(`/users/${legacyId}`, { profileId: null }, adminToken);
      expect(r.status).toBe(200);
      expect(r.body.profileId).toBeNull();
      expect(r.body.effectivePermissions).toEqual(['material:consultar', 'relatorio:consultar']);
    });

    it('rejects an unknown profile instead of silently detaching', async () => {
      const r = await put(`/users/${legacyId}`, { profileId: 99999 }, adminToken);
      expect(r.status).toBe(404);
    });
  });
});
