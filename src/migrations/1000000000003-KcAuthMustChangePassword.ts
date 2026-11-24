import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds `auth_users.must_change_password` (0.4.0). Strictly additive: the
 * column is NOT NULL with a default of false, so every existing user keeps
 * logging in exactly as before.
 */
export class KcAuthMustChangePassword1000000000003 implements MigrationInterface {
  name = 'KcAuthMustChangePassword1000000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('auth_users', 'must_change_password'))) {
      await queryRunner.addColumn(
        'auth_users',
        new TableColumn({ name: 'must_change_password', type: 'boolean', default: false }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('auth_users', 'must_change_password')) {
      await queryRunner.dropColumn('auth_users', 'must_change_password');
    }
  }
}
