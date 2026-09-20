import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { kcAuthEntities } from '../src/adapters/typeorm.entities';
import { kcAuthMigrations } from '../src/migrations';

const newDataSource = (opts: { synchronize: boolean }) =>
  new DataSource({
    type: 'sqljs',
    autoSave: false,
    synchronize: opts.synchronize,
    entities: kcAuthEntities,
    migrations: kcAuthMigrations,
  });

const tableNames = async (ds: DataSource): Promise<string[]> => {
  const rows = await ds.query(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  return rows.map((r: any) => r.name);
};

const columnNames = async (ds: DataSource, table: string): Promise<string[]> => {
  const rows = await ds.query(`PRAGMA table_info('${table}')`);
  return rows.map((r: any) => r.name);
};

describe('Library migrations', () => {
  describe('on an empty database', () => {
    let ds: DataSource;

    beforeAll(async () => {
      ds = await newDataSource({ synchronize: false }).initialize();
      await ds.runMigrations();
    });

    afterAll(async () => {
      await ds.destroy();
    });

    it('creates the full library schema on its own', async () => {
      const tables = await tableNames(ds);
      expect(tables).toEqual(
        expect.arrayContaining([
          'auth_users',
          'auth_refresh_tokens',
          'auth_verification_codes',
          'auth_profiles',
          'auth_profile_permissions',
        ]),
      );
    });

    it('adds the nullable profile_id to auth_users', async () => {
      const columns = await columnNames(ds, 'auth_users');
      expect(columns).toContain('profile_id');
      const [info] = (await ds.query(`PRAGMA table_info('auth_users')`)).filter(
        (r: any) => r.name === 'profile_id',
      );
      expect(info.notnull).toBe(0);
    });

    it('records both migrations, library ones first', async () => {
      const rows = await ds.query(`SELECT name FROM migrations ORDER BY timestamp ASC`);
      expect(rows.map((r: any) => r.name)).toEqual([
        'KcAuthInitialSchema1000000000001',
        'KcAuthProfiles1000000000002',
      ]);
    });

    it('is idempotent: running them again changes nothing', async () => {
      const pending = await ds.showMigrations();
      expect(pending).toBe(false);
    });
  });

  describe('on an existing 0.2.0 production database', () => {
    let ds: DataSource;

    beforeAll(async () => {
      // A database whose auth tables were created by `synchronize: true`, as
      // every pre-0.3.0 install has, minus the 0.3.0 additions.
      ds = await newDataSource({ synchronize: false }).initialize();
      await ds.query(`
        CREATE TABLE "auth_users" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "email" varchar NOT NULL UNIQUE,
          "password_hash" varchar NOT NULL,
          "name" varchar NOT NULL,
          "role" varchar NOT NULL DEFAULT ('user'),
          "tenant_id" integer,
          "permissions" text NOT NULL DEFAULT ('[]'),
          "is_active" boolean NOT NULL DEFAULT (1),
          "last_login_at" datetime,
          "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )`);
      await ds.query(`
        CREATE TABLE "auth_refresh_tokens" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "user_id" integer NOT NULL,
          "token" varchar NOT NULL UNIQUE,
          "expires_at" datetime NOT NULL,
          "revoked" boolean NOT NULL DEFAULT (0),
          "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )`);
      await ds.query(`
        CREATE TABLE "auth_verification_codes" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "user_id" integer NOT NULL,
          "code" varchar NOT NULL,
          "type" varchar NOT NULL,
          "expires_at" datetime NOT NULL,
          "used" boolean NOT NULL DEFAULT (0),
          "attempts" integer NOT NULL DEFAULT (0),
          "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )`);
      await ds.query(
        `INSERT INTO "auth_users" ("email", "password_hash", "name", "role", "permissions")
         VALUES ('prod@test.com', 'hash', 'Prod User', 'user', '["material:consultar"]')`,
      );

      await ds.runMigrations();
    });

    afterAll(async () => {
      await ds.destroy();
    });

    it('does not lose or rewrite existing rows', async () => {
      const [user] = await ds.query(`SELECT * FROM auth_users WHERE email = 'prod@test.com'`);
      expect(user.id).toBe(1);
      expect(user.permissions).toBe('["material:consultar"]');
      expect(JSON.parse(user.permissions)).toEqual(['material:consultar']);
    });

    it('leaves every existing user without a profile', async () => {
      const [user] = await ds.query(`SELECT profile_id FROM auth_users WHERE email = 'prod@test.com'`);
      expect(user.profile_id).toBeNull();
    });

    it('adds the new tables without touching the old ones', async () => {
      const tables = await tableNames(ds);
      expect(tables).toEqual(expect.arrayContaining(['auth_profiles', 'auth_profile_permissions']));
    });

    it('leaves no pending migration', async () => {
      expect(await ds.showMigrations()).toBe(false);
    });
  });

  describe('schema parity', () => {
    it('produces the same auth_users columns as synchronize would', async () => {
      const migrated = await newDataSource({ synchronize: false }).initialize();
      await migrated.runMigrations();
      const synced = await newDataSource({ synchronize: true }).initialize();

      for (const table of [
        'auth_users',
        'auth_refresh_tokens',
        'auth_verification_codes',
        'auth_profiles',
        'auth_profile_permissions',
      ]) {
        expect([table, (await columnNames(migrated, table)).sort()]).toEqual([
          table,
          (await columnNames(synced, table)).sort(),
        ]);
      }

      await migrated.destroy();
      await synced.destroy();
    });
  });
});
