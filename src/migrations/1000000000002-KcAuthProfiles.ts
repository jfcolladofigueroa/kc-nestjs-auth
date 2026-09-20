import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
import { dateColumnType } from './date-type.util';

/**
 * Adds profiles and the permission matrix (0.3.0). Strictly additive: creates
 * `auth_profiles` and `auth_profile_permissions` and adds a nullable
 * `profile_id` to `auth_users`. Nothing is dropped or renamed, and every
 * existing user keeps `profile_id = NULL`, i.e. exactly its previous
 * permissions.
 */
export class KcAuthProfiles1000000000002 implements MigrationInterface {
  name = 'KcAuthProfiles1000000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPg = queryRunner.connection.options.type === 'postgres';
    const pk = isPg ? 'SERIAL' : 'integer';
    const ts = dateColumnType(queryRunner);

    if (!(await queryRunner.hasTable('auth_profiles'))) {
      await queryRunner.createTable(
        new Table({
          name: 'auth_profiles',
          columns: [
            { name: 'id', type: pk, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'tenant_id', type: 'int', isNullable: true },
            { name: 'name', type: 'varchar' },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'is_active', type: 'boolean', default: true },
            { name: 'created_at', type: ts, default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: ts, default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'auth_profiles',
        new TableIndex({ name: 'idx_auth_profiles_tenant', columnNames: ['tenant_id'] }),
      );
      // Unique per tenant. On Postgres NULL != NULL, so this does not constrain
      // single-tenant rows; KcProfilesService checks the name before inserting.
      await queryRunner.createIndex(
        'auth_profiles',
        new TableIndex({ name: 'uq_auth_profiles_tenant_name', columnNames: ['tenant_id', 'name'], isUnique: true }),
      );
    }

    if (!(await queryRunner.hasTable('auth_profile_permissions'))) {
      await queryRunner.createTable(
        new Table({
          name: 'auth_profile_permissions',
          columns: [
            { name: 'id', type: pk, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'profile_id', type: 'int' },
            { name: 'resource', type: 'varchar' },
            { name: 'can_create', type: 'boolean', default: false },
            { name: 'can_update', type: 'boolean', default: false },
            { name: 'can_read', type: 'boolean', default: false },
            { name: 'can_delete', type: 'boolean', default: false },
          ],
          foreignKeys: [
            {
              name: 'fk_auth_profile_permissions_profile',
              columnNames: ['profile_id'],
              referencedTableName: 'auth_profiles',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'auth_profile_permissions',
        new TableIndex({ name: 'uq_auth_profile_permissions', columnNames: ['profile_id', 'resource'], isUnique: true }),
      );
    }

    if (!(await queryRunner.hasColumn('auth_users', 'profile_id'))) {
      await queryRunner.addColumn(
        'auth_users',
        new TableColumn({ name: 'profile_id', type: 'int', isNullable: true }),
      );
      await queryRunner.createIndex(
        'auth_users',
        new TableIndex({ name: 'idx_auth_users_profile', columnNames: ['profile_id'] }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('auth_users', 'profile_id')) {
      await queryRunner.dropIndex('auth_users', 'idx_auth_users_profile').catch(() => undefined);
      await queryRunner.dropColumn('auth_users', 'profile_id');
    }
    if (await queryRunner.hasTable('auth_profile_permissions')) {
      await queryRunner.dropTable('auth_profile_permissions');
    }
    if (await queryRunner.hasTable('auth_profiles')) {
      await queryRunner.dropTable('auth_profiles');
    }
  }
}
