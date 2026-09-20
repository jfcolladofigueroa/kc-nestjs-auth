# @kc-software/nestjs-auth

Reusable NestJS authentication module: JWT access tokens, rotating refresh
tokens, RBAC with **profiles and a permission matrix**, password recovery with
one-time codes, optional multi-tenancy, versioned migrations and built-in rate
limiting. Backed by TypeORM (PostgreSQL/MySQL/SQLite), with an escape hatch to
plug in your own database adapter.

## Requirements

- NestJS 10 or 11.
- TypeORM 0.3.x and `@nestjs/typeorm` (required peer dependencies, even if you use a custom adapter).
- `@nestjs/event-emitter` (peer dependency; only needs `EventEmitterModule.forRoot()` if you want the `user.deleted` event).

## Installation

Published on the public npm registry. Depend on a version range, never on a
local copy:

```bash
npm install @kc-software/nestjs-auth \
  @nestjs/jwt @nestjs/passport @nestjs/typeorm @nestjs/event-emitter \
  passport passport-jwt bcrypt class-validator class-transformer typeorm
```

```jsonc
// package.json
"@kc-software/nestjs-auth": "^0.3.0"
```

> Do not vendor the build into a project (`"file:./lib/kc-auth"`). Every copy
> becomes a silent fork: the schema drifts, fixes stop propagating, and no two
> projects run the same auth code.

## Quick start

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KcAuthModule, kcAuthEntities, kcAuthMigrations } from '@kc-software/nestjs-auth';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      // Register the library entities (plus your own):
      entities: [...kcAuthEntities, ...myEntities],
      // The library's migrations run first — see "Migrations" below.
      migrations: [...kcAuthMigrations, ...myMigrations],
      // Use migrations in production; synchronize only for local development.
    }),
    KcAuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET!, // forRoot throws if missing
      enableRegistration: false,          // admins create users by default
    }),
  ],
})
export class AppModule {}
```

Enable DTO validation in `main.ts` (the library ships class-validator DTOs):

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

## Configuration

All durations are strings with an explicit unit: `s`, `m`, `h` or `d` (e.g. `'15m'`, `'7d'`). Bare numbers like `'60'` are rejected at startup.

| Option | Default | Description |
| --- | --- | --- |
| `jwtSecret` | — (required) | Secret for signing access tokens. |
| `adapter` | `'typeorm'` | `'typeorm'` or `'custom'`. |
| `adapterProvider` | — | Custom `AuthDatabaseAdapter` (class or provider). Required with `adapter: 'custom'`. |
| `emailProvider` | — | `KcEmailService` implementation used to send recovery codes. Without it, codes are stored but not emailed. |
| `accessTokenExpiration` | `'15m'` | Access token lifetime. |
| `refreshTokenExpiration` | `'7d'` | Refresh token lifetime. |
| `bcryptRounds` | `10` | bcrypt cost factor. |
| `passwordMinLength` | `6` | Minimum password length (service-level check). |
| `enableRegistration` | `false` | Enables public `POST /auth/register`. |
| `enablePasswordRecovery` | `true` | Enables forgot/reset password endpoints (404 when disabled). |
| `verificationCodeExpiration` | `'1h'` | Recovery code lifetime. |
| `verificationCodeLength` | `6` | Recovery code digits. |
| `verificationCodeMaxAttempts` | `5` | Failed attempts before a code is invalidated. |
| `defaultRole` | `'user'` | Role assigned on registration. |
| `loginRateLimit` | `{ ttl: 60, limit: 5 }` | Sliding window (seconds, attempts) applied to login, forgot-password and reset-password, keyed by IP + route + email. |
| `permissionVerbs` | `{ create: 'incluir', update: 'alterar', read: 'consultar', delete: 'excluir' }` | Verbs used to flatten a profile matrix into `resource:verb` strings. |
| `profileCacheTtl` | `300` | Seconds a profile's resolved permissions stay cached in memory. `0` disables the cache. |
| `revokeTokensOnProfileChange` | `false` | Revoke the refresh tokens of the affected users when a profile or an assignment changes. |
| `userDeletionMode` | `'deactivate'` | `'deactivate'` keeps the row and sets `isActive = false`; `'hard'` physically deletes it (pre-0.3.0 behaviour). |

## Endpoints

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | public, rate limited | Returns `accessToken`, `refreshToken` and the user. |
| POST | `/auth/register` | public | 404-like rejection unless `enableRegistration`. |
| POST | `/auth/refresh` | public | Rotates the refresh token (the old one is revoked). |
| POST | `/auth/logout` | bearer | Revokes the given refresh token. |
| GET | `/auth/me` | bearer | Current user with role, tenant and permissions. |
| POST | `/auth/change-password` | bearer | Changes password and revokes all refresh tokens. |
| POST | `/auth/forgot-password` | public, rate limited | Issues a recovery code (never reveals whether the email exists). |
| POST | `/auth/reset-password` | public, rate limited | Resets the password with a valid one-time code. |
| GET | `/users` | admin | Lists users (tenant-scoped when a tenant scope is provided). |
| POST | `/users` | admin | Creates a user with role/permissions/tenant. |
| PUT | `/users/:id` | admin | Updates email, name, role, isActive, password, permissions. |
| DELETE | `/users/:id` | admin | **Deactivates** a user (never yourself), revokes its tokens and emits `kc-auth.user.deleted`. |
| GET | `/profiles` | `auth.perfil:consultar` | Lists profiles (`?includeInactive=true` for all). |
| GET | `/profiles/:id` | `auth.perfil:consultar` | A profile with its full matrix. |
| POST | `/profiles` | `auth.perfil:alterar` | Creates a profile, optionally with its matrix. |
| PUT | `/profiles/:id` | `auth.perfil:alterar` | Updates name, description or `isActive`. |
| DELETE | `/profiles/:id` | `auth.perfil:alterar` | Logical removal: sets `isActive = false`. |
| GET | `/profiles/:id/permissions` | `auth.perfil:consultar` | The matrix of a profile. |
| PUT | `/profiles/:id/permissions` | `auth.perfil:alterar` | Replaces the **whole** matrix; a resource left out is revoked. |

Routes are fixed at `/auth`, `/users` and `/profiles`. To remount them, use Nest's standard mechanisms: `app.setGlobalPrefix('api')` or `RouterModule.register([{ path: 'v1', module: YourModule }])`.

## Guards and decorators

`KcJwtAuthGuard` and `KcRolesGuard` are exported for your own controllers:

```ts
import { KcJwtAuthGuard, KcRolesGuard, Roles, Permissions, Public } from '@kc-software/nestjs-auth';

@Controller('reports')
@UseGuards(KcJwtAuthGuard, KcRolesGuard)
export class ReportsController {
  @Get()           // any authenticated user
  list() {}

  @Roles('manager')            // 'admin' always passes any check
  @Get('managers')
  managers() {}

  @Permissions('reports:export')
  @Get('export')
  export() {}

  @Public()        // opt out of auth for a single route
  @Get('status')
  status() {}
}
```

`req.user` contains `{ id, email, role, tenantId, profileId, permissions }`, where
`permissions` is the **effective** list (profile ∪ own).

## API guarantees

These are contractual, not implementation details. Applications built on this
library keep ledgers that must stay readable for a decade, and their foreign
keys point straight at `auth_users.id`.

1. **`KcUserEntity.id` is stable and is never reused.** It is a database
   sequence; no code path reassigns, compacts or recycles an id. A movement
   recorded against user 47 in 2026 still means the same person in 2036.
2. **Users are never deleted.** `DELETE /users/:id` performs a *logical*
   removal: the row stays, `isActive` becomes false, and every refresh token is
   revoked so the session ends immediately. An inactive user cannot log in
   (`401 User is inactive`).
3. **Because of 1 and 2, a consuming app must not keep its own users table.**
   Point `movimento.id_usuario`, `log_auditoria.id_usuario` and friends at
   `auth_users.id` with a plain foreign key.

`userDeletionMode: 'hard'` opts out of guarantee 2 and restores the pre-0.3.0
physical delete. Do not set it in an application that keeps historical records.

## Profiles and the permission matrix

A permission is the string `resource:verb`, which is what `@Permissions()` and
`KcRolesGuard` have always consumed. The four verbs are the ones Brazilian
public-sector tenders ask for:

| Verb | Meaning | Example |
| --- | --- | --- |
| `incluir` | create | `material:incluir` |
| `alterar` | update | `material:alterar` |
| `consultar` | read | `material:consultar` |
| `excluir` | delete | `material:excluir` |

Write these strings in your decorators. Override them with `permissionVerbs` if
your market uses different wording.

A **profile** groups those permissions so a policy lives in one place instead of
being copied across every user:

```
effective permissions = profile permissions  ∪  the user's own permissions
```

Union, never replacement. The profile is the baseline; a user may carry extras.
`profileId` is nullable, and a user with `profileId = NULL` resolves to exactly
its own `permissions` — which is why upgrading changes nothing for users that
predate profiles.

```ts
// Create a profile with its matrix
POST /profiles
{
  "name": "Almoxarife",
  "permissions": [
    { "resource": "material",  "canCreate": true, "canUpdate": true, "canRead": true, "canDelete": true },
    { "resource": "relatorio", "canRead": true }
  ]
}
// -> permissionStrings:
//    ["material:incluir","material:alterar","material:consultar","material:excluir","relatorio:consultar"]

// Assign it
PUT /users/12 { "profileId": 3 }
// Detach it
PUT /users/12 { "profileId": null }
```

`PUT /profiles/:id/permissions` replaces the **whole** matrix: a resource
missing from the body is revoked. That matches an admin screen that always
submits the complete grid.

Deactivating a profile (`DELETE /profiles/:id`) does not touch its users: an
inactive profile simply grants nothing, so each user falls back to its own
permissions.

Profile names are unique per tenant. Under a NULL tenant — the single-tenant
case — a plain `(tenant_id, name)` index would not enforce that, because NULL
never equals NULL; the migration adds a partial unique index for it where the
driver supports one, and `KcProfilesService` checks the name in every case.

### When a change takes effect

Effective permissions are resolved **once, when the access token is issued**,
and travel inside the JWT. The guard therefore does no database work per
request — no join to profiles on every call.

The cost is a bounded delay: a change to a profile reaches a live session on its
next token refresh, i.e. within `accessTokenExpiration` (15 minutes by default).
For a 65-user back office that is normally the right trade. When it is not, set
`revokeTokensOnProfileChange: true` and every affected user's refresh tokens are
revoked on the spot, forcing a new login; combined with a short
`accessTokenExpiration`, the worst case shrinks to that window.

The profile side of the resolution is cached in memory per profile id (not per
user), so a profile shared by 65 users costs one query. Writes through
`/profiles` invalidate the entry immediately. `profileCacheTtl` (default 300 s)
only bounds staleness when the rows are changed from outside — another instance,
or a SQL script. With several instances behind a load balancer, each keeps its
own cache: lower the TTL or restart on deploy if that matters.

### Who administers profiles

The endpoints are guarded by `auth.perfil:consultar` and `auth.perfil:alterar`
(exported as `KC_PROFILE_READ_PERMISSION` / `KC_PROFILE_WRITE_PERMISSION`).
Role `admin` bypasses every permission check, as it always has, so a fresh
install can bootstrap. Grant those two permissions — through a profile or
directly — to whoever should administer access in your app.

### Custom adapters

Every profile method on `AuthDatabaseAdapter` is optional. An adapter written
against 0.2.0 keeps compiling and working: permissions stay flat and the
`/profiles` endpoints answer `501 Not Implemented`.

## Dates on PostgreSQL (`KC_AUTH_DATE_TYPE`)

By default the date columns take TypeORM's driver type: `timestamp` on
PostgreSQL, `datetime` on MySQL/SQLite. On PostgreSQL that is a *naive*
`timestamp`, and it bites when the Node process does not run in UTC: `expiresAt`
is computed in Node and written as local wall clock, while `created_at` comes
from the database's `now()` in UTC. The two stop being comparable and a recovery
code can be born expired.

Set `KC_AUTH_DATE_TYPE=timestamptz` in the process environment to store absolute
instants instead. It is an environment variable, not a `forRoot()` option,
because column types are fixed when the entity decorators run — long before any
module is configured. Allowed values: `timestamptz`,
`timestamp with time zone`, `timestamp`, `datetime`; anything else throws at
import.

On an existing database, convert the columns as well:

```sql
ALTER TABLE auth_users
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
-- ...and the same for updated_at, last_login_at, and the expires_at/created_at
-- columns of auth_refresh_tokens and auth_verification_codes.
```

The library's migrations read the same variable, so a schema they create already
matches.

## Migrations

The library owns `auth_users`, `auth_refresh_tokens`, `auth_verification_codes`,
`auth_profiles` and `auth_profile_permissions`, so it ships their migrations.
Spread them **first**:

```ts
import { kcAuthEntities, kcAuthMigrations } from '@kc-software/nestjs-auth';

new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [...kcAuthEntities, ...myEntities],
  migrations: [...kcAuthMigrations, ...myMigrations],
  synchronize: false,
});
```

Order is not a matter of taste: your business tables carry foreign keys to
`auth_users.id`, so the auth tables have to exist first. TypeORM sorts
migrations globally by the timestamp in the class name, and the library's are
deliberately stamped in 2001 (`KcAuthInitialSchema1000000000001`,
`KcAuthProfiles1000000000002`) so they always sort ahead of yours.

- On an **empty database**, the two library migrations plus your own produce the
  complete schema.
- On an **existing database** — including one whose tables were created by
  `synchronize: true` — the baseline migration is a no-op (every step is guarded
  by a `hasTable` / `hasColumn` check) and the 0.3.0 one only adds:
  `auth_profiles`, `auth_profile_permissions`, and a nullable `profile_id` on
  `auth_users`. Nothing is dropped, renamed or rewritten, and every existing
  user keeps `profile_id = NULL`.

`KcAuthInitialSchema` has no `down()`: dropping `auth_users` would destroy every
account and orphan the ledgers that reference it. Restore from a backup instead.

## Sending recovery emails

Provide a `KcEmailService` implementation:

```ts
import { KC_EMAIL_SERVICE, KcEmailService } from '@kc-software/nestjs-auth';

@Injectable()
class MailerEmailService implements KcEmailService {
  async sendPasswordRecoveryEmail(email: string, code: string, userName?: string) {
    // send with your mailer of choice
  }
}

KcAuthModule.forRoot({
  jwtSecret: process.env.JWT_SECRET!,
  emailProvider: MailerEmailService, // or { provide: KC_EMAIL_SERVICE, useExisting: ... }
});
```

## Custom database adapter

Implement `AuthDatabaseAdapter` to use any storage (Mongo, Prisma, an external API...):

```ts
import { AuthDatabaseAdapter, KC_AUTH_ADAPTER } from '@kc-software/nestjs-auth';

class MyAdapter implements AuthDatabaseAdapter { /* ... */ }

KcAuthModule.forRoot({
  adapter: 'custom',
  adapterProvider: MyAdapter, // or { provide: KC_AUTH_ADAPTER, useFactory: ... }
  jwtSecret: process.env.JWT_SECRET!,
});
```

## Multi-tenancy (optional)

Provide the `KC_TENANT_SCOPE` token with a `KcTenantScope` implementation (e.g. reading the tenant from the request context). When present, `GET /users`, user creation and updates are scoped to the current tenant; superadmins bypass scoping. Login is intentionally not tenant-scoped, so emails must be unique across tenants.

## user.deleted event

If your app registers `EventEmitterModule.forRoot()`, `DELETE /users/:id` emits
`kc-auth.user.deleted` (`KC_USER_DELETED_EVENT`) with
`{ userId, email, name, role, tenantId, deletionMode }`, and additionally
`kc-auth.user.deactivated` (`KC_USER_DEACTIVATED_EVENT`) in the default
`'deactivate'` mode.

Read `deletionMode` before acting: since 0.3.0 it is `'deactivate'` by default,
which means **the row still exists**. Do not delete data keyed by that `userId`
unless the mode is `'hard'`.

## Migrating from 0.2.0

Permissions are backwards compatible: every existing user ends up with
`profile_id = NULL` and resolves to exactly the permissions it had. `KcRolesGuard`
and `@Permissions()` are unchanged, so no decorator needs touching.

1. **Run the library migrations.** Add `...kcAuthMigrations` at the front of your
   `migrations` array (see [Migrations](#migrations)) and run them. They are
   additive: `auth_profiles`, `auth_profile_permissions` and a nullable
   `profile_id` on `auth_users`.
2. **Register the new entities.** Replace your explicit list with
   `...kcAuthEntities`, or add `KcProfileEntity` and `KcProfilePermissionEntity`
   by hand.
3. **Review your `kc-auth.user.deleted` listeners.** `DELETE /users/:id` now
   deactivates instead of deleting (see [API guarantees](#api-guarantees)). The
   event still fires, but the row survives. If a listener deletes rows keyed by
   that `userId`, either adapt it or set `userDeletionMode: 'hard'` to keep the
   old behaviour.
4. **Drop the vendored copy.** Remove `lib/kc-auth` and `"file:./lib/kc-auth"`
   from `package.json`, and depend on `"^0.3.0"`.

Profiles are opt-in: nothing else is required until you decide to create one.

## Migrating from 0.1.0

0.2.0 contains breaking changes:

1. **Table rename** — the users table is now `auth_users` (prefixed like the other library tables) to avoid colliding with your app's own `users` table:
   ```sql
   ALTER TABLE users RENAME TO auth_users;
   ALTER TABLE auth_verification_codes ADD COLUMN attempts INT NOT NULL DEFAULT 0;
   ```
   Run this before deploying; with `synchronize: true` TypeORM would otherwise create an empty `auth_users` instead of renaming.
2. **Durations require a unit** — `refreshTokenExpiration` was previously parsed as bare days and `verificationCodeExpiration` as bare minutes. Both now use the same `'7d'` / `'1h'` format and reject bare numbers at startup.
3. **Removed config options** — `tokenBlacklist`, `redisUrl`, `routePrefix` and `usersRoutePrefix` never had any effect and are gone.
4. **`adapter: 'mongoose'` removed** — it was never implemented. Use `adapter: 'custom'` with your own adapter instead.
5. **Custom adapters** — `findVerificationCode(email, code, type)` was replaced by `findLatestActiveCode(email, type)` plus `incrementCodeAttempts(id)`; `updateUser` may now return `null` when no row matches.
6. **Error messages are now in English** (they were Portuguese).

## Security notes

- Refresh tokens (random 40-byte values) and recovery codes are stored in plaintext in the database. If your threat model includes database leaks, hash them at rest.
- `POST /auth/register` returns 409 for duplicate emails, which reveals account existence when public registration is enabled. Forgot-password does not leak existence.
- The rate limiter is per process. Behind a load balancer with several instances, each instance enforces its own window; add an edge limiter (or `@nestjs/throttler` with a shared store) if you need a global guarantee.
- Access tokens stay valid until they expire (default 15 minutes) even after logout; that is inherent to stateless JWTs. Keep `accessTokenExpiration` short.

## Development

```bash
npm install
npm test        # e2e suites against an in-memory SQLite database
npm run build
```

The migration suite also runs against a real PostgreSQL when you point it at
one — it catches driver-specific DDL that SQLite happily accepts:

```bash
docker run -d --name kc-pg -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
KC_TEST_PG_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres npm test
```

Without `KC_TEST_PG_URL` that suite is skipped.

## License

MIT
