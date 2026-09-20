import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { kcAuthEntities } from '../src/adapters/typeorm.entities';
import { kcAuthMigrations } from '../src/migrations';

/**
 * The SQLite suite cannot catch driver-specific DDL mistakes — a column type
 * PostgreSQL rejects, or an auto-increment spelled the wrong way. This suite
 * runs the same migrations against a real PostgreSQL.
 *
 * It is skipped unless KC_TEST_PG_URL points at a database the test may create
 * and drop schemas in, e.g.
 *
 *   docker run -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
 *   KC_TEST_PG_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres npm test
 */
const url = process.env.KC_TEST_PG_URL;
const describePg = url ? describe : describe.skip;

describePg('Library migrations on PostgreSQL', () => {
  const schema = `kc_auth_test_${Date.now()}`;
  let ds: DataSource;

  beforeAll(async () => {
    const bootstrap = new DataSource({ type: 'postgres', url });
    await bootstrap.initialize();
    await bootstrap.query(`CREATE SCHEMA "${schema}"`);
    await bootstrap.destroy();

    ds = new DataSource({
      type: 'postgres',
      url,
      schema,
      // `schema` steers TypeORM's own SQL; the raw queries below need the
      // search_path pinned on every pooled connection.
      extra: { options: `-c search_path=${schema}` },
      entities: kcAuthEntities,
      migrations: kcAuthMigrations,
      synchronize: false,
    });
    await ds.initialize();
    await ds.runMigrations();
  }, 60000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    const cleanup = new DataSource({ type: 'postgres', url });
    await cleanup.initialize();
    await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await cleanup.destroy();
  }, 60000);

  const columns = async (table: string) =>
    ds.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position`,
      [schema, table],
    );

  it('creates every table with a working auto-increment primary key', async () => {
    for (const table of [
      'auth_users',
      'auth_refresh_tokens',
      'auth_verification_codes',
      'auth_profiles',
      'auth_profile_permissions',
    ]) {
      const [id] = await columns(table);
      expect([table, id.column_name]).toEqual([table, 'id']);
      expect([table, id.data_type]).toEqual([table, 'integer']);
      // A SERIAL: nextval() default, which is what makes ids stable and unique.
      expect([table, String(id.column_default).startsWith('nextval')]).toEqual([table, true]);
    }
  });

  it('inserts and reads back a user with a profile', async () => {
    const [profile] = await ds.query(
      `INSERT INTO auth_profiles (name, description) VALUES ('Almoxarife', 'seed') RETURNING id`,
    );
    await ds.query(
      `INSERT INTO auth_profile_permissions (profile_id, resource, can_create, can_read)
       VALUES ($1, 'material', true, true)`,
      [profile.id],
    );
    const [user] = await ds.query(
      `INSERT INTO auth_users (email, password_hash, name, role, profile_id)
       VALUES ('pg@test.com', 'hash', 'PG', 'user', $1) RETURNING id, profile_id, permissions`,
      [profile.id],
    );
    expect(user.id).toBeGreaterThan(0);
    expect(user.profile_id).toBe(profile.id);
    expect(user.permissions).toBe('[]');
  });

  it('rejects two single-tenant profiles with the same name', async () => {
    await ds.query(`INSERT INTO auth_profiles (name) VALUES ('Unico')`);
    // (tenant_id, name) alone would not catch this: NULL != NULL in SQL.
    await expect(ds.query(`INSERT INTO auth_profiles (name) VALUES ('Unico')`)).rejects.toThrow();
    // The same name under a tenant is fine — each tenant has its own profiles.
    await ds.query(`INSERT INTO auth_profiles (tenant_id, name) VALUES (1, 'Unico')`);
    await ds.query(`INSERT INTO auth_profiles (tenant_id, name) VALUES (2, 'Unico')`);
    await expect(
      ds.query(`INSERT INTO auth_profiles (tenant_id, name) VALUES (2, 'Unico')`),
    ).rejects.toThrow();
  });

  it('rejects a duplicated resource in a profile matrix', async () => {
    const [profile] = await ds.query(
      `INSERT INTO auth_profiles (name) VALUES ('Dup') RETURNING id`,
    );
    await ds.query(
      `INSERT INTO auth_profile_permissions (profile_id, resource) VALUES ($1, 'material')`,
      [profile.id],
    );
    await expect(
      ds.query(`INSERT INTO auth_profile_permissions (profile_id, resource) VALUES ($1, 'material')`, [
        profile.id,
      ]),
    ).rejects.toThrow();
  });

  it('cascades the matrix when a profile row is removed', async () => {
    const [profile] = await ds.query(
      `INSERT INTO auth_profiles (name) VALUES ('Cascade') RETURNING id`,
    );
    await ds.query(
      `INSERT INTO auth_profile_permissions (profile_id, resource) VALUES ($1, 'relatorio')`,
      [profile.id],
    );
    await ds.query(`DELETE FROM auth_profiles WHERE id = $1`, [profile.id]);
    const rows = await ds.query(`SELECT 1 FROM auth_profile_permissions WHERE profile_id = $1`, [
      profile.id,
    ]);
    expect(rows).toHaveLength(0);
  });

  it('leaves no pending migration', async () => {
    expect(await ds.showMigrations()).toBe(false);
  });
});
