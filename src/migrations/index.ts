import { KcAuthInitialSchema1000000000001 } from './1000000000001-KcAuthInitialSchema';
import { KcAuthProfiles1000000000002 } from './1000000000002-KcAuthProfiles';

export { KcAuthInitialSchema1000000000001, KcAuthProfiles1000000000002 };

/**
 * Every migration owned by the library, in order. Spread it first in your
 * DataSource `migrations` array:
 *
 *     migrations: [...kcAuthMigrations, ...myAppMigrations]
 *
 * The timestamps are intentionally low (2001) so TypeORM's global ordering runs
 * them before any application migration, which is required because business
 * tables reference `auth_users.id`.
 */
export const kcAuthMigrations = [
  KcAuthInitialSchema1000000000001,
  KcAuthProfiles1000000000002,
];
