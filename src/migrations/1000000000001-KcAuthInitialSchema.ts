import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { dateColumnType } from './date-type.util';

/**
 * Baseline schema of the library: `auth_users`, `auth_refresh_tokens` and
 * `auth_verification_codes`.
 *
 * Every step is guarded by a `hasTable` / `hasColumn` check, so this migration
 * is a no-op on a database whose tables were already created by
 * `synchronize: true` (which is how every pre-0.3.0 install got them) and
 * creates them from scratch on an empty one.
 *
 * The timestamp is deliberately low (2001): TypeORM orders migrations globally
 * by timestamp, and the library's tables must exist before an application's
 * migrations add foreign keys to `auth_users.id`.
 */
export class KcAuthInitialSchema1000000000001 implements MigrationInterface {
  name = 'KcAuthInitialSchema1000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // An integer type plus isGenerated lets TypeORM emit the driver's own
    // auto-increment (SERIAL on Postgres, INTEGER ... AUTOINCREMENT on SQLite).
    // Spelling 'SERIAL' by hand yields a column with no type at all on Postgres,
    // and SQLite only accepts AUTOINCREMENT on a column spelled INTEGER.
    const pk = queryRunner.connection.options.type === 'postgres' ? 'int' : 'integer';
    const ts = dateColumnType(queryRunner);

    if (!(await queryRunner.hasTable('auth_users'))) {
      await queryRunner.createTable(
        new Table({
          name: 'auth_users',
          columns: [
            { name: 'id', type: pk, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'email', type: 'varchar', isUnique: true },
            { name: 'password_hash', type: 'varchar' },
            { name: 'name', type: 'varchar' },
            { name: 'role', type: 'varchar', default: "'user'" },
            { name: 'tenant_id', type: 'int', isNullable: true },
            { name: 'permissions', type: 'text', default: "'[]'" },
            { name: 'is_active', type: 'boolean', default: true },
            { name: 'last_login_at', type: ts, isNullable: true },
            { name: 'created_at', type: ts, default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: ts, default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('auth_refresh_tokens'))) {
      await queryRunner.createTable(
        new Table({
          name: 'auth_refresh_tokens',
          columns: [
            { name: 'id', type: pk, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'user_id', type: 'int' },
            { name: 'token', type: 'varchar', isUnique: true },
            { name: 'expires_at', type: ts },
            { name: 'revoked', type: 'boolean', default: false },
            { name: 'created_at', type: ts, default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'auth_refresh_tokens',
        new TableIndex({ name: 'idx_auth_refresh_tokens_user', columnNames: ['user_id'] }),
      );
    }

    if (!(await queryRunner.hasTable('auth_verification_codes'))) {
      await queryRunner.createTable(
        new Table({
          name: 'auth_verification_codes',
          columns: [
            { name: 'id', type: pk, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'user_id', type: 'int' },
            { name: 'code', type: 'varchar' },
            { name: 'type', type: 'varchar' },
            { name: 'expires_at', type: ts },
            { name: 'used', type: 'boolean', default: false },
            { name: 'attempts', type: 'int', default: 0 },
            { name: 'created_at', type: ts, default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'auth_verification_codes',
        new TableIndex({ name: 'idx_auth_verification_codes_user', columnNames: ['user_id'] }),
      );
    } else if (!(await queryRunner.hasColumn('auth_verification_codes', 'attempts'))) {
      // 0.1.0 databases predate the attempts counter.
      await queryRunner.query(
        `ALTER TABLE "auth_verification_codes" ADD "attempts" integer NOT NULL DEFAULT 0`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the auth tables destroys every account and orphans the business
    // ledgers that reference auth_users.id. Reverting is deliberately manual.
    void queryRunner;
    throw new Error(
      'KcAuthInitialSchema is not reversible: dropping auth_users would destroy every account. Restore from a backup instead.',
    );
  }
}
