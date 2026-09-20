import { QueryRunner } from 'typeorm';

/**
 * Date column type the migrations must create, so a migrated schema matches the
 * entities. Mirrors `KC_AUTH_DATE_TYPE` (see `typeorm.entities.ts`): on
 * PostgreSQL it is `timestamp` unless the variable asks for `timestamptz`.
 */
export function dateColumnType(queryRunner: QueryRunner): string {
  const configured = process.env.KC_AUTH_DATE_TYPE?.trim();
  if (queryRunner.connection.options.type === 'postgres') {
    return configured === 'timestamptz' || configured === 'timestamp with time zone'
      ? 'timestamptz'
      : 'timestamp';
  }
  return 'datetime';
}
